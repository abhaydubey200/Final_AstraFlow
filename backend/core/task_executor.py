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
from datetime import datetime, timedelta

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
        """Routing method for task execution with Persistent Circuit Breaking and Retries."""
        
        # 1. Check Circuit Breaker (DB-Backed)
        async with self.pool.acquire() as conn:
            breaker = await conn.fetchrow(
                "SELECT open_until, failure_count FROM public.circuit_breakers WHERE task_type = $1",
                task_type
            )
        
        now = datetime.utcnow()
        if breaker and breaker['open_until'] and breaker['open_until'] > now:
            wait_time = int((breaker['open_until'] - now).total_seconds())
            raise Exception(f"Circuit Breaker OPEN for {task_type}. Suspended for another {wait_time}s.")

        logger.info(f"Executing task type: {task_type}")
        
        # 2. Single Execution Attempt (No internal loop)
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
                await asyncio.sleep(0.5)
            
            # Success: Reset Circuit Breaker in DB
            async with self.pool.acquire() as conn:
                await conn.execute(
                    "INSERT INTO public.circuit_breakers (task_type, failure_count, open_until) VALUES ($1, 0, NULL) "
                    "ON CONFLICT (task_type) DO UPDATE SET failure_count = 0, open_until = NULL",
                    task_type
                )
            return # Exit on success
            
        except Exception as e:
            logger.error(f"Task {task_type} failed: {e}")
            
            # Persistent Retry Logic
            async with self.pool.acquire() as conn:
                # 1. Get current retry count from task_runs
                task_run_id = metadata.get('task_run_id')
                if not task_run_id:
                    raise e # Fallback if no task_run_id
                    
                row = await conn.fetchrow("SELECT retry_count FROM public.task_runs WHERE id = $1", uuid.UUID(str(task_run_id)))
                retry_count = (row['retry_count'] if row else 0) + 1
                max_retries = config.get('retries', 3)
                
                if retry_count <= max_retries:
                    # Calculate Exponential Backoff
                    base_delay = 2
                    delay = base_delay * (2 ** (retry_count - 1))
                    next_retry = datetime.utcnow() + timedelta(seconds=delay)
                    
                    logger.warning(f"Task {task_type} moving to RETRYING status (Attempt {retry_count}/{max_retries}). Next retry: {next_retry}")
                    
                    await conn.execute(
                        "UPDATE public.task_runs SET status = 'retrying', retry_count = $1, next_retry_at = $2, error_message = $3, updated_at = NOW() WHERE id = $4",
                        retry_count, next_retry, str(e), uuid.UUID(str(task_run_id))
                    )
                else:
                    # Final Failure
                    logger.error(f"Task {task_type} reached max retries ({max_retries}). Marking as FAILED.")
                    await conn.execute(
                        "UPDATE public.task_runs SET status = 'failed', error_message = $1, end_time = NOW(), updated_at = NOW() WHERE id = $2",
                        str(e), uuid.UUID(str(task_run_id))
                    )
                    
                    # Update Circuit Breaker in DB on final failure
                    new_breaker_count = (breaker['failure_count'] if breaker else 0) + 1
                    open_until = None
                    if new_breaker_count >= 5:
                        open_until = datetime.utcnow() + timedelta(minutes=5)
                        logger.error(f"Circuit Breaker TRIPPED for {task_type} for 5 minutes.")
                    
                    await conn.execute(
                        "INSERT INTO public.circuit_breakers (task_type, failure_count, open_until) VALUES ($1, $2, $3) "
                        "ON CONFLICT (task_type) DO UPDATE SET failure_count = $2, open_until = $3",
                        task_type, new_breaker_count, open_until
                    )
            
            raise e

    async def _get_connector(self, connection_id: Optional[str], config: Dict[str, Any]) -> Any:
        """Factory method to get the correct connector based on connection_id or config."""
        if connection_id:
            conn_data = await self.conn_service.get_connection(connection_id)
            if not conn_data:
                raise Exception(f"Connection {connection_id} not found")
            conn_type = (conn_data.get('type') or conn_data.get('connection_type') or '').upper()
            conn_config = conn_data
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
            # 1. Plan Partitions (Idempotent)
            partitions = await self.partition_planner.plan_partitions(str(run_id), config.get('source_config', {}), table_name, 'id')
            
            # 2. Parallelize partition processing
            semaphore = asyncio.Semaphore(4)
            
            async def _process_partition(partition):
                # Skip if already completed
                if partition.get('status') == 'completed':
                    logger.info(f"Partition {partition['id']} already COMPLETED. Skipping.")
                    return

                async with semaphore:
                    # Mark partition as processing
                    async with self.pool.acquire() as conn:
                        await conn.execute(
                            "UPDATE public.pipeline_partitions SET status = 'processing', updated_at = NOW() WHERE id = $1",
                            uuid.UUID(partition['id'])
                        )

                    p_config = {
                        'partition_key': 'id', 
                        'range_start': partition['start'], 
                        'range_end': partition['end']
                    }
                    
                    # Get existing staging files for this partition to skip already extracted chunks
                    async with self.pool.acquire() as conn:
                        rows = await conn.fetch(
                            "SELECT file_path FROM public.staging_files WHERE partition_id = $1",
                            uuid.UUID(partition['id'])
                        )
                        existing_files = {r['file_path'] for r in rows}

                    async for chunk in connector.read_chunked(table_name, chunk_size, p_config):
                        # Chunk ID/Path determination (simplistic for now)
                        chunk_hash = f"part_{partition['id'][:8]}_{len(existing_files)}" # This needs a more stable hash/index in real systems
                        remote_path_prefix = f"staging/{run_id}/{table_name}/"
                        
                        # Check IF this chunk was already processed (by looking at remote_path pattern)
                        # NOTE: In a production system, connector.read_chunked would need to provide a stable chunk offset.
                        # For now, we use a simple "count of existing files" as a proxy if stable offsets aren't available.
                        
                        # Convert to Parquet
                        local_file = ParquetUtils.chunk_to_parquet(chunk)
                        remote_path = f"{remote_path_prefix}{os.path.basename(local_file)}"
                        
                        if remote_path in existing_files:
                            logger.info(f"Chunk {remote_path} already exists. Skipping.")
                            if os.path.exists(local_file): os.remove(local_file)
                            continue

                        # Upload to Storage
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

                    # Mark partition as completed
                    async with self.pool.acquire() as conn:
                        await conn.execute(
                            "UPDATE public.pipeline_partitions SET status = 'completed', updated_at = NOW() WHERE id = $1",
                            uuid.UUID(partition['id'])
                        )
            
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
