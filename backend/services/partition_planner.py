import os
import asyncpg
import uuid
from typing import List, Dict, Any, Optional

class PartitionPlanner:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    async def plan_partitions(self, pipeline_run_id: str, connector_config: Dict[str, Any], table_name: str, partition_column: str, partition_count: int = 4) -> List[Dict[str, Any]]:
        """
        Creates partition ranges for parallel extraction.
        Idempotent: Re-uses existing partitions if already defined for this run.
        """
        async with self.pool.acquire() as conn:
            # 1. Check for existing partitions
            existing_rows = await conn.fetch(
                "SELECT id, range_start, range_end, status FROM public.pipeline_partitions WHERE pipeline_run_id = $1 AND table_name = $2",
                uuid.UUID(pipeline_run_id), table_name
            )
            
            if existing_rows:
                return [
                    {
                        "id": str(r['id']),
                        "start": int(r['range_start']),
                        "end": int(r['range_end']),
                        "status": r['status']
                    }
                    for r in existing_rows
                ]

            # 2. Otherwise Plan and Insert
            min_val = 0
            max_val = 1000000
            step = (max_val - min_val) // partition_count
            
            partitions = []
            for i in range(partition_count):
                start = min_val + (i * step)
                end = min_val + ((i + 1) * step) if i < partition_count - 1 else max_val
                
                partition_id = await conn.fetchval(
                    "INSERT INTO public.pipeline_partitions (pipeline_run_id, table_name, partition_key, range_start, range_end, status) "
                    "VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id",
                    uuid.UUID(pipeline_run_id), table_name, partition_column, str(start), str(end)
                )
                partitions.append({
                    "id": str(partition_id),
                    "start": start,
                    "end": end,
                    "status": 'pending'
                })
            return partitions
