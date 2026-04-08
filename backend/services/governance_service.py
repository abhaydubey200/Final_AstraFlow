import os
import uuid
import asyncpg
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

class GovernanceService:
    def __init__(self, pool: Optional[asyncpg.Pool] = None):
        self.pool = pool

    async def apply_retention_policies(self):
        """Purges old data based on defined retention periods."""
        async with self.pool.acquire() as conn:
            # Retention settings
            log_retention_days = 30
            run_retention_days = 90
            
            log_cutoff = datetime.now() - timedelta(days=log_retention_days)
            run_cutoff = datetime.now() - timedelta(days=run_retention_days)
            
            # 1. Purge old execution logs
            log_count = await conn.execute(
                "DELETE FROM execution_logs WHERE timestamp < $1", 
                log_cutoff
            )
            
            # 2. Purge old pipeline runs
            run_count = await conn.execute(
                "DELETE FROM pipeline_runs WHERE created_at < $1 AND status IN ('completed', 'failed', 'cancelled')",
                run_cutoff
            )
            
            return {
                "logs_purged": log_count,
                "runs_purged": run_count,
                "cutoff_logs": log_cutoff.isoformat(),
                "cutoff_runs": run_cutoff.isoformat()
            }

    async def get_audit_trail(self, resource_type: Optional[str] = None, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves and aggregates audit logs for compliance reporting."""
        async with self.pool.acquire() as conn:
            query = "SELECT * FROM audit_logs"
            params = []
            conditions = []
            
            if resource_type:
                conditions.append(f"resource_type = ${len(params) + 1}")
                params.append(resource_type)
            if user_id:
                conditions.append(f"user_id = ${len(params) + 1}")
                params.append(uuid.UUID(user_id))
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            
            query += " ORDER BY created_at DESC LIMIT 500"
            
            rows = await conn.fetch(query, *params)
            return [dict(r) for r in rows]

    async def log_policy_violation(self, pipeline_id: str, violation_type: str, details: Dict[str, Any]):
        """Records a governance policy violation for auditing."""
        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO audit_logs (action, resource_type, resource_id, details) "
                "VALUES ($1, $2, $3, $4)",
                "policy_violation", "pipeline", uuid.UUID(pipeline_id), 
                json.dumps({
                    "violation": violation_type,
                    "details": details,
                    "timestamp": datetime.now().isoformat()
                })
            )

    async def classify_data(self, column_id: str, classification_type: str, policy: str):
        """Classifies a column (e.g., PII, PCI) and applies a governance policy."""
        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO public.data_classifications (column_id, classification_type, policy_applied) "
                "VALUES ($1, $2, $3)",
                uuid.UUID(column_id), classification_type, policy
            )

    async def get_sensitive_columns(self, dataset_id: str) -> List[Dict[str, Any]]:
        """Returns all columns marked as sensitive in a dataset."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT c.column_name, cls.classification_type, cls.policy_applied
                FROM public.catalog_columns c
                JOIN public.data_classifications cls ON c.id = cls.column_id
                WHERE c.dataset_id = $1
                """,
                uuid.UUID(dataset_id)
            )
            return [dict(r) for r in rows]
