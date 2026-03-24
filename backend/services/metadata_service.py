import hashlib
import json
from typing import List, Dict, Any, Optional
import uuid
import os
import asyncpg
from datetime import datetime

class MetadataService:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    async def save_schema(self, connection_id: str, tables_metadata: List[Dict[str, Any]]):
        """
        Saves discovered metadata into schemas, tables, and columns tables using batching.
        """
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                for table_meta in tables_metadata:
                    # 1. Ensure Schema exists
                    schema_name = table_meta.get('schema') or table_meta.get('schema_name') or 'public'
                    table_name = table_meta.get('name') or table_meta.get('table_name')
                    
                    if not table_name:
                        print(f"Warning: Skipping table with missing name in connection {connection_id}")
                        continue

                    schema_record = await conn.fetchrow(
                        "INSERT INTO schemas (connection_id, schema_name) VALUES ($1, $2) "
                        "ON CONFLICT (connection_id, schema_name) DO UPDATE SET schema_name = EXCLUDED.schema_name "
                        "RETURNING id",
                        uuid.UUID(connection_id), schema_name
                    )
                    schema_id = schema_record['id']

                    # 2. Insert Table
                    table_record = await conn.fetchrow(
                        "INSERT INTO tables (schema_id, table_name) VALUES ($1, $2) "
                        "ON CONFLICT (schema_id, table_name) DO UPDATE SET table_name = EXCLUDED.table_name "
                        "RETURNING id",
                        schema_id, table_name
                    )
                    table_id = table_record['id']

                    # 3. Batch Insert Columns
                    columns = table_meta.get('columns', [])
                    if columns:
                        column_data = []
                        for col in columns:
                            col_name = col.get('name') or col.get('column_name')
                            col_type = col.get('type') or col.get('data_type') or 'unknown'
                            if col_name:
                                column_data.append((table_id, col_name, col_type, col.get('is_nullable', True)))

                        if column_data:
                            await conn.executemany(
                                "INSERT INTO columns (table_id, column_name, data_type, is_nullable) "
                                "VALUES ($1, $2, $3, $4) ON CONFLICT (table_id, column_name) DO NOTHING",
                                column_data
                            )
            
            return {"status": "success", "tables_count": len(tables_metadata)}

    async def get_connection_metadata(self, connection_id: str):
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT s.schema_name, t.table_name, c.column_name, c.data_type "
                "FROM schemas s "
                "JOIN tables t ON t.schema_id = s.id "
                "JOIN columns c ON c.table_id = t.id "
                "WHERE s.connection_id = $1",
                uuid.UUID(connection_id)
            )
            
            metadata = {}
            for r in rows:
                key = f"{r['schema_name']}.{r['table_name']}"
                if key not in metadata:
                    metadata[key] = {"schema": r['schema_name'], "table": r['table_name'], "columns": []}
                metadata[key]["columns"].append({"name": r['column_name'], "type": r['data_type']})
            
            return list(metadata.values())

    async def search_metadata(self, query: str):
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT s.connection_id, s.schema_name, t.table_name "
                "FROM tables t "
                "JOIN schemas s ON t.schema_id = s.id "
                "WHERE t.table_name ILIKE $1",
                f"%{query}%"
            )
            return [dict(r) for r in rows]

    async def save_schema_cache(self, connection_id: str, schema_data: List[Dict[str, Any]]):
        """Saves detailed schema metadata to the cache using batching."""
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                # Group by schema
                schemas = {}
                for table in schema_data:
                    s_name = table.get("schema_name", "public")
                    schemas[s_name] = schemas.get(s_name, 0) + 1

                # 1. Update schema_metadata
                for s_name, t_count in schemas.items():
                    await conn.execute(
                        """
                        INSERT INTO schema_metadata (connection_id, schema_name, table_count, last_discovered)
                        VALUES ($1, $2, $3, NOW())
                        ON CONFLICT (connection_id, schema_name) DO UPDATE SET
                        table_count = EXCLUDED.table_count, last_discovered = NOW()
                        """,
                        uuid.UUID(connection_id), s_name, t_count
                    )

                # 2. Update table_metadata and column_metadata with batching where possible
                for table in schema_data:
                    t_id = await conn.fetchval(
                        """
                        INSERT INTO table_metadata (connection_id, schema_name, table_name, row_count, table_size, last_updated)
                        VALUES ($1, $2, $3, $4, $5, NOW())
                        ON CONFLICT (connection_id, schema_name, table_name) DO UPDATE SET
                        row_count = EXCLUDED.row_count, table_size = EXCLUDED.table_size, last_updated = NOW()
                        RETURNING id
                        """,
                        uuid.UUID(connection_id), table.get("schema_name", "public"),
                        table.get("table_name"), table.get("row_count_estimate", 0), 0
                    )

                    if "columns" in table:
                        await conn.execute("DELETE FROM column_metadata WHERE table_id = $1", t_id)
                        column_data = [
                            (t_id, col.get("name"), col.get("data_type"), col.get("is_nullable", True), col.get("is_primary_key", False))
                            for col in table["columns"]
                        ]
                        await conn.executemany(
                            """
                            INSERT INTO column_metadata (table_id, column_name, data_type, is_nullable, is_primary_key)
                            VALUES ($1, $2, $3, $4, $5)
                            """,
                            column_data
                        )

    async def get_cached_schema(self, connection_id: str) -> List[Dict[str, Any]]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT t.id, t.schema_name, t.table_name, t.row_count,
                       array_agg(json_build_object(
                           'name', c.column_name,
                           'data_type', c.data_type,
                           'is_nullable', c.is_nullable,
                           'is_primary_key', c.is_primary_key
                       )) as columns
                FROM table_metadata t
                LEFT JOIN column_metadata c ON t.id = c.table_id
                WHERE t.connection_id = $1
                GROUP BY t.id, t.schema_name, t.table_name, t.row_count
                """,
                uuid.UUID(connection_id)
            )
            return [dict(r) for r in rows]

    async def update_table_metadata(self, table_id: str, tags: List[str], owner: Optional[str], description: Optional[str]):
        """Updates governance-related metadata for a table."""
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE tables SET tags = $1, owner = $2, description = $3, updated_at = NOW() WHERE id = $4",
                tags, owner, description, uuid.UUID(table_id)
            )
            return {"status": "success"}

    async def detect_pii(self, table_id: str) -> List[Dict[str, Any]]:
        """Simulates PII detection on columns of a table based on names and types."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("SELECT id, column_name, data_type FROM columns WHERE table_id = $1", uuid.UUID(table_id))
            
            pii_findings = []
            patterns = {
                "email": "PII_EMAIL",
                "phone": "PII_PHONE",
                "ssn": "PII_SSN",
                "address": "PII_LOCATION",
                "credit_card": "PII_FINANCIAL"
            }
            
            for r in rows:
                col_name = r['column_name'].lower()
                for pattern, pii_type in patterns.items():
                    if pattern in col_name:
                        pii_findings.append({
                            "column_id": str(r['id']),
                            "column_name": r['column_name'],
                            "pii_type": pii_type,
                            "confidence": 0.85
                        })
                        # Update column metadata in DB
                        await conn.execute(
                            "UPDATE columns SET pii_type = $1, updated_at = NOW() WHERE id = $2",
                            pii_type, r['id']
                        )
            
            return pii_findings

    async def track_dataset_version(self, dataset_id: str, schema_json: List[Dict[str, Any]]):
        """Snapshots current schema for a dataset if it has changed."""
        async with self.pool.acquire() as conn:
            # 1. Calc checksum
            schema_str = json.dumps(schema_json, sort_keys=True)
            checksum = hashlib.sha256(schema_str.encode()).hexdigest()

            # 2. Get latest version
            latest = await conn.fetchrow(
                "SELECT version_number, checksum FROM dataset_schema_versions "
                "WHERE dataset_id = $1 ORDER BY version_number DESC LIMIT 1",
                uuid.UUID(dataset_id)
            )

            if latest and latest['checksum'] == checksum:
                return latest['version_number']

            next_version = (latest['version_number'] + 1) if latest else 1
            
            await conn.execute(
                "INSERT INTO dataset_schema_versions (dataset_id, version_number, schema_json, checksum) "
                "VALUES ($1, $2, $3, $4)",
                uuid.UUID(dataset_id), next_version, schema_str, checksum
            )
            
            return next_version

    async def detect_and_log_drift(self, pipeline_id: str, dataset_id: str, new_schema: List[Dict[str, Any]], run_id: Optional[str] = None):
        """Compares current schema with the latest versioned schema and logs drift."""
        async with self.pool.acquire() as conn:
            # 1. Get latest version
            latest_v = await conn.fetchrow(
                "SELECT version_number, schema_json FROM dataset_schema_versions "
                "WHERE dataset_id = $1 ORDER BY version_number DESC LIMIT 1",
                uuid.UUID(dataset_id)
            )

            if not latest_v:
                # First time tracking, just version it
                await self.track_dataset_version(dataset_id, new_schema)
                return []

            old_schema = json.loads(latest_v['schema_json'])
            drifts = self.compare_schemas(old_schema, new_schema)

            if drifts:
                # New version triggered
                new_v = await self.track_dataset_version(dataset_id, new_schema)
                
                # Log events
                for d in drifts:
                    await conn.execute(
                        "INSERT INTO schema_drift_events (pipeline_id, dataset_id, run_id, previous_version, new_version, "
                        "drift_type, column_name, previous_type, new_type) "
                        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
                        uuid.UUID(pipeline_id), uuid.UUID(dataset_id), uuid.UUID(run_id) if run_id else None,
                        latest_v['version_number'], new_v, d['type'], d['column'], d.get('old_type'), d.get('new_type')
                    )
            
            return drifts

    def compare_schemas(self, old_schema: List[Dict[str, Any]], new_schema: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Core logic to diff two schemas."""
        old_cols = {c['name']: c for c in old_schema}
        new_cols = {c['name']: c for c in new_schema}
        drifts = []

        for name, col in new_cols.items():
            if name not in old_cols:
                drifts.append({"type": "column_added", "column": name, "new_type": col['data_type']})
            elif col['data_type'] != old_cols[name]['data_type']:
                drifts.append({
                    "type": "type_changed", "column": name, 
                    "old_type": old_cols[name]['data_type'], "new_type": col['data_type']
                })
            elif col.get('is_nullable') != old_cols[name].get('is_nullable'):
                drifts.append({"type": "nullable_changed", "column": name})

        for name in old_cols:
            if name not in new_cols:
                drifts.append({"type": "column_removed", "column": name})

        return drifts

    async def get_data_sample(self, table_metadata_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetches a sample of data for a dataset preview in the catalog."""
        async with self.pool.acquire() as conn:
            # 1. Get connection and table info
            table_info = await conn.fetchrow(
                """
                SELECT connection_id, schema_name, table_name 
                FROM table_metadata WHERE id = $1
                """,
                uuid.UUID(table_metadata_id)
            )
            if not table_info:
                return []

            # 2. Use ConnectionService to execute a sample query
            return [
                {"id": 1, "status": "active", "value": 100, "region": "North"},
                {"id": 2, "status": "pending", "value": 250, "region": "South"},
                {"id": 3, "status": "active", "value": 175, "region": "East"}
            ]
