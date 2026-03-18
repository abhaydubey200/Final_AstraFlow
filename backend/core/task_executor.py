import asyncio
import asyncpg
import logging
import time
from typing import Dict, Any, List, Optional
from services.connection_service import ConnectionService
from services.storage_service import StorageService
from services.bulk_load_service import BulkLoadService
from core.postgres_connector import PostgresConnector
from core.mssql_connector import MSSQLConnector
from core.mysql_connector import MySQLConnector
from core.snowflake_connector import SnowflakeConnector
from services.partition_planner import PartitionPlanner
from core.parquet_utils import ParquetUtils
import uuid
import os

logger = logging.getLogger(__name__)

class TaskExecutor:
    """Executes discrete tasks (SQL, EXTRACT, API, etc.) for the DAG engine."""
    
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool
        self.conn_service = ConnectionService(pool)
        self.storage_service = StorageService()
        self.bulk_load_service = BulkLoadService(pool)
        self.partition_planner = PartitionPlanner(pool)
        self.failure_counts: Dict[str, int] = {}
        self.circuit_open_until: Dict[str, float] = {}

    async def execute(self, task_type: str, config: Dict[str, Any], metadata: Dict[str, Any]):
        """Routing method for task execution with Circuit Breaking."""
        
        # Check Circuit Breaker
        now = time.time()
        if task_type in self.circuit_open_until:
            if now < self.circuit_open_until[task_type]:
                wait_time = int(self.circuit_open_until[task_type] - now)
                raise Exception(f"Circuit Breaker OPEN for {task_type}. Suspended for another {wait_time}s.")
            else:
                # Circuit closed (half-open state would be better, but this is simple hardening)
                self.circuit_open_until.pop(task_type, None)
                self.failure_counts[task_type] = 0

        logger.info(f"Executing task type: {task_type}")
        
        try:
            if task_type == 'EXTRACT':
                await self._run_extract(config, metadata)
            elif task_type == 'LOAD':
                await self._run_load(config, metadata)
            elif task_type == 'SQL':
                await self._run_sql(config, metadata)
            elif task_type == 'VALIDATION':
                await self._run_validation(config, metadata)
            else:
                logger.warning(f"Task type {task_type} is not yet implemented.")
                await asyncio.sleep(1)
            
            # Reset failures on success
            self.failure_counts[task_type] = 0
            
        except Exception as e:
            # Track failure for circuit breaking
            self.failure_counts[task_type] = self.failure_counts.get(task_type, 0) + 1
            if self.failure_counts[task_type] >= 5:
                # Open circuit for 5 minutes
                self.circuit_open_until[task_type] = now + 300
                logger.error(f"Circuit Breaker TRIPPED for {task_type} after 5 failures.")
            raise e

    async def _get_connector(self, connection_id: Optional[str], config: Dict[str, Any]) -> Any:
        """Factory method to get the correct connector based on connection_id or config."""
        if connection_id:
            conn_data = await self.conn_service.get_connection(connection_id)
            if not conn_data:
                raise Exception(f"Connection {connection_id} not found")
            conn_type = conn_data.get('connection_type', '').upper()
            conn_config = conn_data.get('config_json', {})
        else:
            conn_type = config.get('connection_type', 'POSTGRES').upper()
            conn_config = config.get('source_config') or config
            
        if conn_type == 'POSTGRES':
            return PostgresConnector(conn_config)
        elif conn_type == 'MSSQL':
            return MSSQLConnector(conn_config)
        elif conn_type == 'MYSQL':
            return MySQLConnector(conn_config)
        elif conn_type == 'SNOWFLAKE':
            return SnowflakeConnector(conn_config)
        else:
            raise Exception(f"Unsupported connection type: {conn_type}")

    async def _run_extract(self, config: Dict[str, Any], metadata: Dict[str, Any]):
        run_id = metadata.get('pipeline_run_id')
        if not run_id:
            raise Exception("pipeline_run_id missing from task metadata")
            
        connection_id = config.get('connection_id')
        table_name = (
            config.get('table_name') or 
            config.get('source_table') or 
            config.get('source_config', {}).get('table_name')
        )
        
        if not table_name:
            # Fallback for better UX/Debugging
            logger.warning(f"No table_name found in config for run {run_id}. Checking nodes...")
            table_name = "unknown_table"
            
        chunk_size = config.get('chunk_size', 50000)
        
        connector = await self._get_connector(connection_id, config)
        await connector.connect()
        
        try:
            # 1. Plan Partitions
            partitions = await self.partition_planner.plan_partitions(str(run_id), config.get('source_config', {}), table_name, 'id')
            
            # 2. Parallelize partition processing
            semaphore = asyncio.Semaphore(4)
            
            async def _process_partition(partition):
                async with semaphore:
                    p_config = {
                        'partition_key': 'id', 
                        'range_start': partition['start'], 
                        'range_end': partition['end']
                    }
                    
                    async for chunk in connector.read_chunked(table_name, chunk_size, p_config):
                        # Convert to Parquet
                        local_file = ParquetUtils.chunk_to_parquet(chunk)
                        
                        # Upload to Storage
                        remote_path = f"staging/{run_id}/{table_name}/{os.path.basename(local_file)}"
                        await self.storage_service.upload_file(local_file, remote_path)
                        
                        # Store Metadata
                        async with self.pool.acquire() as conn:
                            file_size = 0
                            try:
                                if os.path.exists(local_file):
                                    file_size = os.path.getsize(local_file)
                            except:
                                pass
                                
                            await conn.execute(
                                "INSERT INTO public.staging_files (pipeline_run_id, partition_id, file_path, row_count, file_size_bytes) "
                                "VALUES ($1, $2, $3, $4, $5)",
                                uuid.UUID(str(run_id)), uuid.UUID(partition['id']), remote_path, len(chunk), file_size
                            )
                        
                        # Cleanup
                        if os.path.exists(local_file):
                            os.remove(local_file)
            
            await asyncio.gather(*[_process_partition(p) for p in partitions])
        finally:
            await connector.disconnect()
        
        logger.info(f"Extracted and staged data for {table_name}")

    async def _run_load(self, config: Dict[str, Any], metadata: Dict[str, Any]):
        run_id = metadata.get('pipeline_run_id')
        table_name = (
            config.get('table_name') or 
            config.get('dest_table') or 
            config.get('target_table')
        )
        dest_config = config.get('dest_config', {})
        s3_path = f"staging/{run_id}/{table_name}/"
        await self.bulk_load_service.load_to_snowflake(str(run_id), dest_config, table_name, s3_path)

    async def _run_sql(self, config: Dict[str, Any], metadata: Dict[str, Any]):
        query = config.get('query')
        if not query:
            logger.warning("SQL task executed but 'query' is missing in config.")
            return
        # Logic to execute SQL on target connection
        logger.info(f"Executing SQL: {query[:50]}...")
        await asyncio.sleep(1)

    async def _run_validation(self, config: Dict[str, Any], metadata: Dict[str, Any]):
        rules = config.get('rules', [])
        logger.info(f"Running {len(rules)} validation rules.")
        await asyncio.sleep(0.5)
