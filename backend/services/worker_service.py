import os
import uuid
import json
import asyncio
import asyncpg
from datetime import datetime
from typing import Dict, Any, Optional
from core.base_connector import BaseConnector

from services.connection_service import ConnectionService
from services.pipeline_service import PipelineService
from services.validation_service import ValidationService
from services.lineage_service import LineageService
from services.cost_service import CostService
from services.alert_service import AlertService
from services.schema_service import SchemaService
from services.storage_service import StorageService
from services.partition_planner import PartitionPlanner
from services.bulk_load_service import BulkLoadService
from core.parquet_utils import ParquetUtils

class WorkerService:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool
        self.connection_service = ConnectionService(pool)
        self.pipeline_service = PipelineService(pool)
        self.validation_service = ValidationService(pool)
        self.lineage_service = LineageService(pool)
        self.storage_service = StorageService()
        self.partition_planner = PartitionPlanner(pool)
        self.bulk_load_service = BulkLoadService(pool)
        self.cost_service = CostService(pool)
        self.alert_service = AlertService(pool)
        self.schema_service = SchemaService(pool)
        from core.task_executor import TaskExecutor
        self.task_executor = TaskExecutor(pool)

    async def claim_job(self) -> Optional[Dict[str, Any]]:
        """Claims the next available job from the queue using Atomic Claim RPC."""
        async with self.pool.acquire() as conn:
            # Call the stored procedure claim_next_worker_job()
            row = await conn.fetchrow("SELECT * FROM public.claim_next_worker_job()")
            if row:
                return dict(row)
            return None

    async def update_job_status(self, job_id: str, status: str, error: Optional[str] = None):
        """Updates the status of a worker job and potentially the master run status."""
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE public.astra_worker_queue SET status = $1, error_text = $2, updated_at = NOW() WHERE id = $3",
                status, error, uuid.UUID(job_id)
            )
            
            # If job failed, mark the whole run as failed
            if status == "failed":
                row = await conn.fetchrow("SELECT run_id FROM public.astra_worker_queue WHERE id = $1", uuid.UUID(job_id))
                if row:
                    await conn.execute(
                        "UPDATE public.pipeline_runs SET status = 'failed', finished_at = NOW() WHERE id = $1",
                        row['run_id']
                    )

    async def claim_task_run(self) -> Optional[Dict[str, Any]]:
        """Claims a queued task run from the DAG engine."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE public.task_runs
                SET status = 'running', start_time = NOW(), updated_at = NOW()
                WHERE id = (
                    SELECT id FROM public.task_runs 
                    WHERE status = 'queued' 
                    ORDER BY created_at ASC 
                    FOR UPDATE SKIP LOCKED 
                    LIMIT 1
                )
                RETURNING *
                """
            )
            if row:
                task_info = await conn.fetchrow(
                    "SELECT task_type, config_json FROM public.pipeline_tasks WHERE id = $1",
                    row['task_id']
                )
                if not task_info:
                    print(f"WORKER: Task {row['task_id']} not found in pipeline_tasks. Marking task run as failed.")
                    await conn.execute(
                        "UPDATE public.task_runs SET status = 'failed', error_message = 'Task metadata not found' WHERE id = $1",
                        row['id']
                    )
                    return None
                    
                res = dict(row)
                res['task_type'] = task_info['task_type']
                res['config'] = json.loads(task_info['config_json']) if isinstance(task_info['config_json'], str) else task_info['config_json']
                return res
            return None

    async def update_task_status(self, task_run_id: str, status: str, error: Optional[str] = None):
        """Updates the status of a specific task run."""
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE public.task_runs SET status = $1, error_message = $2, end_time = NOW(), updated_at = NOW() WHERE id = $3",
                status, error, uuid.UUID(task_run_id)
            )

    async def process_job(self, job: Dict[str, Any]):
        """Executes the specific stage logic for a job."""
        job_id = job['id']
        pipeline_id = job['pipeline_id']
        run_id = job['run_id']
        stage = job['stage']
        payload = job.get('payload', {})

        print(f"Worker processing job {job_id} [Stage: {stage}] for Pipeline {pipeline_id}")
        
        try:
            # ----------------------------------------------------------------
            # MOCK MODE: Simulate all stages inline without real DB connections
            # ----------------------------------------------------------------
            if os.getenv("USE_MOCK_DB") == "true":
                print(f"MOCK_WORKER: Simulating stage '{stage}' for Run {run_id}")
                await asyncio.sleep(0.3)  # Simulate I/O work

                # Mark this job complete
                await self.update_job_status(str(job_id), "completed")

                # Advance to next stage or finalize run
                next_stages = {'extract': 'transform', 'transform': 'validate', 'validate': 'load'}
                next_stage = next_stages.get(stage)
                if next_stage:
                    await self.enqueue_job(str(pipeline_id), str(run_id), next_stage, payload)
                    print(f"MOCK_WORKER: Enqueued next stage '{next_stage}' for Run {run_id}")
                else:
                    # Final stage complete — mark run as completed
                    async with self.pool.acquire() as conn:
                        await conn.execute(
                            "UPDATE public.pipeline_runs SET status = 'completed', finished_at = NOW() WHERE id = $1",
                            run_id
                        )
                    print(f"MOCK_WORKER: Run {run_id} completed successfully!")
                print(f"MOCK_WORKER: Job {job_id} done.")
                return  # Exit early — no real DB work needed

            # Phase 2: Staging Extraction Flow
            if stage == 'extract':
                from core.postgres_connector import PostgresConnector
                connector = PostgresConnector(payload.get('source_config', {}))
                await connector.connect()
                
                table_name = payload.get('table_name')
                chunk_size = payload.get('chunk_size', 50000)
                
                # Check for partitions
                partitions = await self.partition_planner.plan_partitions(str(run_id), {}, table_name, 'id')
                
                # Parallelize partition processing with a concurrency limit
                semaphore = asyncio.Semaphore(4) # Limit to 4 parallel partitions
                
                async def _process_partition_task(partition):
                    async with semaphore:
                        p_config = {'partition_key': 'id', 'range_start': partition['start'], 'range_end': partition['end']}
                        
                        # 2. Extract Chunks and Upload
                        # We use an inner task list to overlap extraction and upload if needed, 
                        # but here we focus on inter-partition parallelism first.
                        async for chunk in connector.read_chunked(table_name, chunk_size, p_config):
                            # Convert to Parquet
                            local_file = ParquetUtils.chunk_to_parquet(chunk)
                            
                            # Upload to Storage
                            remote_path = f"staging/{run_id}/{table_name}/{os.path.basename(local_file)}"
                            await self.storage_service.upload_file(local_file, remote_path)
                            
                            # Store Metadata
                            async with self.pool.acquire() as conn:
                                await conn.execute(
                                    "INSERT INTO public.staging_files (pipeline_run_id, partition_id, file_path, row_count, file_size_bytes) "
                                    "VALUES ($1, $2, $3, $4, $5)",
                                    uuid.UUID(run_id), uuid.UUID(partition['id']), remote_path, len(chunk), os.path.getsize(local_file)
                                )
                                
                            # Cleanup local cache
                            if os.path.exists(local_file):
                                os.remove(local_file)
                
                await asyncio.gather(*[_process_partition_task(p) for p in partitions])
                await connector.disconnect()

            elif stage == 'load':
                # Phase 2: Bulk Loading Flow
                # (Assuming target is Snowflake for demonstration)
                s3_base_path = f"staging/{run_id}/{payload.get('table_name')}/"
                await self.bulk_load_service.load_to_snowflake(str(run_id), payload.get('dest_config', {}), payload.get('table_name'), s3_base_path)

            elif stage == 'validate':
                # Simplified: fetch a "sample" from what would be in the buffer
                sample = [{"id": 1, "email": "invalid-email"}] # Mock sample
                v_result = await self.validation_service.validate_data(str(run_id), str(pipeline_id), sample)
                
                if v_result['status'] == 'fail':
                    raise Exception(f"Critical validation failure: {json.dumps(v_result['results'])}")
                print(f"Validation passed for run {run_id}")
            else:
                print(f"WARNING: Unknown stage '{stage}' for job {job_id}")
                await asyncio.sleep(1)
            
            # 2. Update job status
            await self.update_job_status(str(job_id), "completed")
            
            # 3. Determine next stage or finish run
            # Stabilization: Fetch next stage from pipeline configuration if available,
            # otherwise fallback to default linear sequence.
            next_stages = {
                'extract': 'transform',
                'transform': 'validate',
                'validate': 'load'
            }
            
            next_stage = next_stages.get(stage)
            if next_stage:
                # Check if pipeline run is still 'running' before enqueuing next
                async with self.pool.acquire() as conn:
                    run_active = await conn.fetchval(
                        "SELECT count(*) FROM public.pipeline_runs WHERE id = $1 AND status != 'failed'",
                        run_id
                    )
                    if run_active:
                        await self.enqueue_job(str(pipeline_id), str(run_id), next_stage, payload)
            else:
                # Finished 'load' stage - Finalize Run
                async with self.pool.acquire() as conn:
                    await conn.execute(
                        "UPDATE public.pipeline_runs SET status = 'completed', finished_at = NOW() WHERE id = $1",
                        run_id
                    )
                    
                    # Record Lineage (Source to Target)
                    # Simplified: using placeholder IDs from payload or pipeline config
                    source_id = payload.get('source_node_id', str(uuid.uuid4()))
                    target_id = payload.get('target_node_id', str(uuid.uuid4()))
                    
                    # Phase 4: Enhanced Lineage & Cost
                    source_asset = await self.lineage_service.get_asset_id(payload.get('table_name', 'unknown'), 'table', 'source')
                    target_asset = await self.lineage_service.get_asset_id(payload.get('table_name', 'unknown'), 'table', 'destination')
                    await self.lineage_service.record_asset_lineage(source_asset, target_asset, str(pipeline_id), stage)
                    
                    # Record Cost (Estimated units)
                    await self.cost_service.record_run_cost(str(run_id), compute_units=1.5, data_transfer_gb=0.5)
                
                # Trigger children pipelines
                child_ids = await self.pipeline_service.check_and_trigger_children(str(pipeline_id), 'completed')
                if child_ids:
                    print(f"Triggering child pipelines: {child_ids}")
                    for cid in child_ids:
                        # Start new run for each child
                        # This would normally fetch some default config
                        await self.pipeline_service.create_run(cid, "pending")
                        # (Note: In a full implementation, we'd need to enqueue the first job for the child too)

            print(f"Job {job_id} completed successfully.")
        except Exception as e:
            await self.update_job_status(str(job_id), "failed", str(e))
            print(f"Error processing job {job_id}: {e}")

    async def process_task(self, task_run: Dict[str, Any]):
        """Executes a single task in the DAG."""
        run_id = task_run['id']
        task_type = task_run['task_type']
        config = task_run['config']
        
        print(f"Worker executing Task Run {run_id} [Type: {task_type}]")
        
        try:
            await self.task_executor.execute(task_type, config, {
                "pipeline_run_id": task_run['pipeline_run_id'],
                "task_id": task_run['task_id']
            })
            await self.update_task_status(str(run_id), "completed")
        except Exception as e:
            await self._handle_task_failure(task_run, str(e))

    async def _handle_task_failure(self, task_run: Dict[str, Any], error: str):
        """Internal helper to manage task retries and DLQ."""
        run_id = task_run['id']
        pipeline_run_id = task_run.get('pipeline_run_id')
        retry_count = task_run.get('retry_count', 0)
        max_retries = task_run.get('retries', 3)
        
        if retry_count < max_retries:
            # Exponential backoff: 1m, 2m, 4m...
            backoff_minutes = 2 ** retry_count
            print(f"Task Run {run_id} failed, retrying in {backoff_minutes}m (Attempt {retry_count + 1}/{max_retries})")
            
            async with self.pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE public.task_runs 
                    SET status = 'queued', 
                        retry_count = retry_count + 1, 
                        error_message = $1,
                        updated_at = NOW() 
                    WHERE id = $2
                    """,
                    error, uuid.UUID(str(run_id))
                )
        else:
            print(f"Task Run {run_id} failed after {max_retries} retries. Moving to DLQ.")
            await self.update_task_status(str(run_id), "failed", error)
            # Log critical alert
            await self.alert_service.create_alert(
                "TASK_FAILURE",
                str(task_run.get('pipeline_id')) if task_run.get('pipeline_id') else None,
                f"Task failure after {max_retries} retries: {error}",
                "CRITICAL"
            )

    async def enqueue_job(self, pipeline_id: str, run_id: str, stage: str, payload: Dict[str, Any], scheduled_at: Optional[datetime] = None):
        """Adds a new job to the worker queue."""
        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO public.astra_worker_queue (pipeline_id, run_id, stage, payload, status, scheduled_at) "
                "VALUES ($1, $2, $3, $4, 'pending', $5)",
                uuid.UUID(pipeline_id), uuid.UUID(run_id), stage, json.dumps(payload), scheduled_at or datetime.now()
            )

    async def update_heartbeat(self, worker_id: str, status: str = 'active', metadata: Optional[Dict[str, Any]] = None):
        """Updates the heartbeat for a specific worker."""
        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO public.worker_heartbeats (worker_id, last_seen, status, metadata) "
                "VALUES ($1, NOW(), $2, $3) ON CONFLICT (worker_id) DO UPDATE SET "
                "last_seen = NOW(), status = $2, metadata = $3",
                uuid.UUID(worker_id), status, json.dumps(metadata or {})
            )

    async def recover_stale_jobs(self, timeout_seconds: int = 120):
        """Finds jobs assigned to workers that haven't sent a heartbeat and returns them to 'pending'."""
        async with self.pool.acquire() as conn:
            # Reclaim jobs from workers that are dead (no heartbeat)
            # Note: We need the worker_id from astra_worker_queue if we track assignment, 
            # but currently we just use FOR UPDATE SKIP LOCKED.
            # However, if a worker crashes MID-PROCESSING, the job stays 'processing'.
            # We use worker_heartbeats to see if any worker hasn't reported in.
            
            stale_jobs = await conn.fetch(
                """
                UPDATE public.astra_worker_queue
                SET status = 'pending',
                    retry_count = retry_count + 1,
                    updated_at = NOW()
                WHERE status = 'processing' 
                  AND updated_at < NOW() - $1::interval
                  AND retry_count < 3
                RETURNING id, run_id
                """,
                f"{timeout_seconds} seconds"
            )
            
            if stale_jobs:
                print(f"Recovered {len(stale_jobs)} stale processing jobs.")
                
            # Permanently fail jobs that exceeded retries
            await conn.execute(
                """
                INSERT INTO public.failed_jobs (job_id, pipeline_id, run_id, stage, payload, error_message)
                SELECT id, pipeline_id, run_id, stage, payload, 'Job timed out and exceeded max retries during recovery'
                FROM public.astra_worker_queue
                WHERE status = 'processing' 
                  AND updated_at < NOW() - $1::interval
                  AND retry_count >= 3
                """,
                f"{timeout_seconds} seconds"
            )
            
            await conn.execute(
                """
                UPDATE public.astra_worker_queue
                SET status = 'failed'
                WHERE status = 'processing' 
                  AND updated_at < NOW() - $1::interval
                  AND retry_count >= 3
                """,
                f"{timeout_seconds} seconds"
            )
