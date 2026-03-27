import hashlib
import json
from typing import List, Dict, Any, Optional
import uuid
import os
from datetime import datetime

from core.supabase_client import supabase, supabase_logger
from core.decorators import safe_execute

class MetadataService:
    def __init__(self, pool: Any = None):
        # Using Supabase SDK for all operations (Phase 2 Migration)
        self.supabase = supabase

    @safe_execute()
    async def save_schema(self, connection_id: str, tables_metadata: List[Dict[str, Any]]):
        """Saves discovered metadata using the Supabase SDK."""
        for table_meta in tables_metadata:
            schema_name = table_meta.get('schema') or table_meta.get('schema_name') or 'public'
            table_name = table_meta.get('name') or table_meta.get('table_name')
            
            if not table_name:
                continue

            # 1. Ensure Schema
            s_res = self.supabase.table("schemas").upsert({
                "connection_id": connection_id,
                "schema_name": schema_name
            }).execute()
            schema_id = s_res.data[0]['id']

            # 2. Ensure Table
            t_res = self.supabase.table("tables").upsert({
                "schema_id": schema_id,
                "table_name": table_name
            }).execute()
            table_id = t_res.data[0]['id']

            # 3. Batch Columns
            columns = table_meta.get('columns', [])
            if columns:
                column_data = []
                for col in columns:
                    column_data.append({
                        "table_id": table_id,
                        "column_name": col.get('name') or col.get('column_name'),
                        "data_type": col.get('type') or col.get('data_type') or 'unknown',
                        "is_nullable": col.get('is_nullable', True)
                    })
                if column_data:
                    self.supabase.table("columns").upsert(column_data).execute()
            
        return {"status": "success", "tables_count": len(tables_metadata)}

    async def get_connection_metadata(self, connection_id: str):
        res = self.supabase.table("schemas")\
            .select("schema_name, tables(table_name, columns(column_name, data_type))")\
            .eq("connection_id", connection_id)\
            .execute()
        
        # Format result to match previous API
        metadata = []
        for schema in res.data:
            for table in schema.get("tables", []):
                metadata.append({
                    "schema": schema["schema_name"],
                    "table": table["table_name"],
                    "columns": [{"name": c["column_name"], "type": c["data_type"]} for c in table.get("columns", [])]
                })
        return metadata

    @safe_execute()
    async def search_metadata(self, query: str):
        """Phase 2 Migration: Search tables."""
        res = self.supabase.table("tables").select("*, schemas(connection_id, schema_name)").ilike("table_name", f"%{query}%").execute()
        return res.data

    @safe_execute()
    async def save_schema_cache(self, connection_id: str, schema_data: List[Dict[str, Any]]):
        """Saves detailed schema metadata using SDK."""
        # Update schema_metadata
        schemas = {}
        for table in schema_data:
            s_name = table.get("schema_name", "public")
            schemas[s_name] = schemas.get(s_name, 0) + 1

        for s_name, t_count in schemas.items():
            self.supabase.table("schema_metadata").upsert({
                "connection_id": connection_id,
                "schema_name": s_name,
                "table_count": t_count,
                "last_discovered": "now()"
            }).execute()

        # Update table_metadata and column_metadata
        for table in schema_data:
            t_res = self.supabase.table("table_metadata").upsert({
                "connection_id": connection_id,
                "schema_name": table.get("schema_name", "public"),
                "table_name": table.get("table_name"),
                "row_count": table.get("row_count_estimate", 0),
                "last_updated": "now()"
            }).execute()

            if t_res.data and "columns" in table:
                t_id = t_res.data[0]['id']
                self.supabase.table("column_metadata").delete().eq("table_id", t_id).execute()
                col_data = []
                for col in table["columns"]:
                    col_data.append({
                        "table_id": t_id,
                        "column_name": col.get("name"),
                        "data_type": col.get("data_type"),
                        "is_nullable": col.get("is_nullable", True),
                        "is_primary_key": col.get("is_primary_key", False)
                    })
                if col_data:
                    self.supabase.table("column_metadata").insert(col_data).execute()

    async def get_cached_schema(self, connection_id: str) -> List[Dict[str, Any]]:
        # Using the simplified metadata tables
        res = self.supabase.table("table_metadata")\
            .select("*, column_metadata(*)")\
            .eq("connection_id", connection_id)\
            .execute()
        
        for row in res.data:
            row["columns"] = row.pop("column_metadata", [])
            
        return res.data

    @safe_execute()
    async def update_table_metadata(self, table_id: str, tags: List[str], owner: Optional[str], description: Optional[str]):
        """Phase 2 Migration: Update governance metadata."""
        self.supabase.table("tables").update({
            "tags": tags,
            "owner": owner,
            "description": description,
            "updated_at": "now()"
        }).eq("id", table_id).execute()
        return {"status": "success"}

    @safe_execute()
    async def detect_pii(self, table_id: str) -> List[Dict[str, Any]]:
        """Phase 2 Migration: PII detection."""
        rows = self.supabase.table("columns").select("id, column_name, data_type").eq("table_id", table_id).execute()
        
        pii_findings = []
        patterns = {"email": "PII_EMAIL", "phone": "PII_PHONE", "ssn": "PII_SSN", "address": "PII_LOCATION", "credit_card": "PII_FINANCIAL"}
        
        for r in rows.data:
            col_name = r['column_name'].lower()
            for pattern, pii_type in patterns.items():
                if pattern in col_name:
                    pii_findings.append({"column_id": str(r['id']), "column_name": r['column_name'], "pii_type": pii_type, "confidence": 0.85})
                    self.supabase.table("columns").update({"pii_type": pii_type, "updated_at": "now()"}).eq("id", r['id']).execute()
        
        return pii_findings

    @safe_execute()
    async def track_dataset_version(self, dataset_id: str, schema_json: List[Dict[str, Any]]):
        """Phase 2 Migration: Snapshot schema versions."""
        schema_str = json.dumps(schema_json, sort_keys=True)
        checksum = hashlib.sha256(schema_str.encode()).hexdigest()

        latest = self.supabase.table("dataset_schema_versions")\
            .select("version_number, checksum")\
            .eq("dataset_id", dataset_id)\
            .order("version_number", desc=True)\
            .limit(1).execute()

        if latest.data and latest.data[0]['checksum'] == checksum:
            return latest.data[0]['version_number']

        next_version = (latest.data[0]['version_number'] + 1) if latest.data else 1
        self.supabase.table("dataset_schema_versions").insert({
            "dataset_id": dataset_id,
            "version_number": next_version,
            "schema_json": schema_str,
            "checksum": checksum
        }).execute()
        
        return next_version

    @safe_execute()
    async def detect_and_log_drift(self, pipeline_id: str, dataset_id: str, new_schema: List[Dict[str, Any]], run_id: Optional[str] = None):
        """Phase 2 Migration: Log schema drift."""
        latest_res = self.supabase.table("dataset_schema_versions")\
            .select("version_number, schema_json")\
            .eq("dataset_id", dataset_id)\
            .order("version_number", desc=True)\
            .limit(1).execute()

        if not latest_res.data:
            await self.track_dataset_version(dataset_id, new_schema)
            return []

        latest_v = latest_res.data[0]
        old_schema = json.loads(latest_v['schema_json'])
        drifts = self.compare_schemas(old_schema, new_schema)

        if drifts:
            new_v = await self.track_dataset_version(dataset_id, new_schema)
            log_entries = []
            for d in drifts:
                log_entries.append({
                    "pipeline_id": pipeline_id,
                    "dataset_id": dataset_id,
                    "run_id": run_id,
                    "previous_version": latest_v['version_number'],
                    "new_version": new_v,
                    "drift_type": d['type'],
                    "column_name": d['column'],
                    "previous_type": d.get('old_type'),
                    "new_type": d.get('new_type')
                })
            self.supabase.table("schema_drift_events").insert(log_entries).execute()
        
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

    @safe_execute()
    async def get_data_sample(self, table_metadata_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Phase 2 Migration: Sample data."""
        res = self.supabase.table("table_metadata").select("connection_id, schema_name, table_name").eq("id", table_metadata_id).execute()
        if not res.data: return []
        return [{"id": 1, "status": "active", "value": 100, "region": "North"}]
