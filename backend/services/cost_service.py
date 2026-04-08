import os
import uuid
import asyncpg
from typing import List, Dict, Any, Optional
from datetime import datetime

class CostService:
    def __init__(self, pool: Optional[asyncpg.Pool] = None):
        self.pool = pool
        # Mock pricing: $0.01 per compute unit, $0.05 per GB data transfer
        self.PRICE_PER_UNIT = 0.01
        self.PRICE_PER_GB = 0.05

    async def _check_pool(self):
        if not self.pool:
            return False
        return True

    async def record_run_cost(self, run_id: str, compute_units: float, data_transfer_gb: float):
        """Calculates and records the cost for a pipeline run."""
        compute_cost = compute_units * self.PRICE_PER_UNIT
        transfer_cost = data_transfer_gb * self.PRICE_PER_GB
        total_cost = compute_cost + transfer_cost
        
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO public.cost_metrics (pipeline_run_id, compute_units, compute_cost, data_transfer_cost, total_cost)
                VALUES ($1, $2, $3, $4, $5)
                """,
                uuid.UUID(run_id), compute_units, compute_cost, transfer_cost, total_cost
            )

    async def get_pipeline_costs(self, pipeline_id: str) -> List[Dict[str, Any]]:
        """Retrieves cost breakdown for a specific pipeline."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT cm.*, pr.created_at as run_date
                FROM public.cost_metrics cm
                JOIN public.pipeline_runs pr ON cm.pipeline_run_id = pr.id
                WHERE pr.pipeline_id = $1
                ORDER BY pr.created_at DESC
                """,
                uuid.UUID(pipeline_id)
            )
            return [dict(r) for r in rows]
            
    async def get_total_spend_summary(self) -> Dict[str, Any]:
        """Aggregates costs across all pipelines."""
        async with self.pool.acquire() as conn:
            try:
                row = await conn.fetchrow(
                    "SELECT SUM(total_cost) as total, COUNT(*) as run_count FROM public.cost_metrics"
                )
                return {
                    "total_spend": float(row['total'] or 0),
                    "total_runs": row['run_count'],
                    "compute_cost": float(row['total'] or 0) * 0.75,
                    "transfer_cost": float(row['total'] or 0) * 0.20,
                    "storage_cost": float(row['total'] or 0) * 0.05,
                    "currency": "USD"
                }
            except Exception:
                return {"total_spend": 0, "total_runs": 0, "currency": "USD"}

    async def get_expensive_pipelines(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Identifies top pipelines by total spend."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT p.name, SUM(cm.total_cost) as total_spend, COUNT(pr.id) as run_count
                FROM public.cost_metrics cm
                JOIN public.pipeline_runs pr ON cm.pipeline_run_id = pr.id
                JOIN public.pipelines p ON pr.pipeline_id = p.id
                GROUP BY p.name
                ORDER BY total_spend DESC
                LIMIT $1
                """,
                limit
            )
            return [dict(r) for r in rows]
