import os
import uuid
import json
import asyncio
import threading
from datetime import datetime
from typing import Dict, Any, List, Optional

# ---------------------------------------------------------------------------
# File-backed shared store for mock mode
# ---------------------------------------------------------------------------
if os.environ.get("USE_TEST_MOCK_FILE") == "true":
    MOCK_FILE = os.path.join(os.path.dirname(__file__), "test_mock_store.json")
else:
    MOCK_FILE = os.path.join(os.path.dirname(__file__), "mock_store.json")
    
_global_lock = asyncio.Lock()

def _get_default_store():
    return {
        "connections": [],
        "connection_credentials": [],
        "connection_secrets": [],
        "connection_capabilities": [],
        "pipelines": [],
        "pipeline_nodes": [],
        "pipeline_edges": [],
        "pipeline_versions": [],
        "pipeline_runs": [],
        "task_runs": [],
        "pipeline_tasks": [],
        "pipeline_dependencies": [],
        "staging_files": [],
        "worker_heartbeats": [],
        "pipeline_partitions": [],
        "bulk_load_jobs": [],
        "astra_alerts": [],
        "failed_jobs": [],
        "system_metrics": [],
        "pipeline_checkpoints": [],
        "astra_worker_queue": [],
        "pipeline_logs": []
    }

def _load_store():
    if not os.path.exists(MOCK_FILE):
        return _get_default_store()
    try:
        with open(MOCK_FILE, "r") as f:
            data = json.load(f)
            # Ensure all keys exist
            defaults = _get_default_store()
            for k, v in defaults.items():
                if k not in data:
                    data[k] = v
            return data
    except Exception as e:
        print(f"ERROR: Mock DB failed to load store: {e}")
        return _get_default_store()

class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return super().default(obj)

import shutil

def _save_store(store):
    """Saves store atomically by writing to temp file first, with backup."""
    tmp_file = f"{MOCK_FILE}.tmp"
    bak_file = f"{MOCK_FILE}.bak"
    try:
        # 1. Write to temp file
        with open(tmp_file, "w") as f:
            # Use default=str as a catch-all, but we could also use custom encoder
            json.dump(store, f, indent=2, default=str)
        
        # 2. Create backup of current store if it exists
        if os.path.exists(MOCK_FILE):
            try:
                shutil.copy2(MOCK_FILE, bak_file)
            except Exception as bak_err:
                print(f"WARNING: Mock DB failed to create backup: {bak_err}")

        # 3. Rename to final file (atomic on most OS)
        if os.path.exists(MOCK_FILE):
             os.replace(tmp_file, MOCK_FILE)
        else:
             os.rename(tmp_file, MOCK_FILE)
             
    except Exception as e:
        import traceback
        log_path = os.path.join(os.path.dirname(__file__), "mock_db_trace.log")
        with open(log_path, "a") as errf:
            errf.write(f"ERROR: [{datetime.utcnow().isoformat()}] Mock DB failed to save store: {e}\n")
            errf.write(traceback.format_exc())
            errf.write("\n")
        # Ensure temp file is cleaned up on failure
        if os.path.exists(tmp_file):
            try: os.remove(tmp_file)
            except: pass


class MockCursor:
    def __init__(self, query, args, store):
        self.query = query
        self.args = args
        self.store = store
        self.data = []
        self._pos = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._pos >= len(self.data):
            raise StopAsyncIteration
        res = self.data[self._pos]
        self._pos += 1
        return res

class MockConnection:
    def __init__(self, db_state):
        self.db_state = db_state

    async def fetch(self, query, *args):
        async with _global_lock:
            store = _load_store()
            query_lower = query.lower().strip()
            # print(f"Mock DB: fetch -> {query_lower[:80]}")

            # --- connections listing ---
            if "from connections" in query_lower and "select" in query_lower:
                rows = []
                for c in store.get("connections", []):
                    row = c.copy()
                    row.setdefault("status", "connected")
                    row.setdefault("last_tested_at", row.get("updated_at") or datetime.utcnow().isoformat())
                    if row.get("type") == "snowflake":
                        row.setdefault("warehouse_name", "COMPUTE_WH")
                    row.setdefault("avg_latency_ms", 25.5)
                    row.setdefault("avg_query_time_ms", 12.0)
                    row.setdefault("requests_per_minute", 150)
                    row.setdefault("error_rate", 0.0)
                    row.setdefault("supports_cdc", True)
                    row.setdefault("supports_incremental", True)
                    row.setdefault("supports_parallel_reads", True)
                    row.setdefault("supports_transactions", True)
                    row.setdefault("max_connections", 100)
                    rows.append(row)
                return rows

            # --- pipelines listing ---
            if "from pipelines" in query_lower and "select" in query_lower:
                return [p.copy() for p in store.get("pipelines", [])]

            # --- pipeline runs ---
            if "from pipeline_runs" in query_lower:
                normalized = []
                for r in store.get("pipeline_runs", []):
                    nr = r.copy()
                    # UI expects certain fields
                    nr.setdefault("status", "pending")
                    nr.setdefault("run_status", nr["status"])
                    nr.setdefault("rows_processed", 0)
                    nr.setdefault("error_message", None)
                    nr.setdefault("end_time", nr.get("finished_at"))
                    nr.setdefault("finished_at", nr.get("end_time"))
                    normalized.append(nr)
                
                # If it's the scheduler looking for active runs
                if "run_status = 'running'" in query_lower or "status = 'running'" in query_lower:
                    return [r for r in normalized if r.get("status") == "running" or r.get("run_status") == "running"]
                # If it's a specific pipeline history
                if "where pipeline_id =" in query_lower and args:
                    pid = str(args[0])
                    return [r for r in normalized if str(r.get("pipeline_id")) == pid]
                # Default: return all
                return normalized

            # --- task runs ---
            if "from public.task_runs" in query_lower:
                if "where pipeline_run_id =" in query_lower or "where run_id =" in query_lower:
                    rid = str(args[0])
                    runs = [t.copy() for t in store.get("task_runs", []) if str(t.get("pipeline_run_id")) == rid or str(t.get("run_id")) == rid]
                    # Inject labels for UI if missing
                    for r in runs:
                        if not r.get("task_name"):
                            r["task_name"] = f"Task {str(r.get('task_id', 'unknown'))[:8]}"
                        if not r.get("label"):
                            r["label"] = r["task_name"]
                        r.setdefault("name", r["task_name"])
                    return runs

            # --- worker jobs from astra_worker_queue ---
            if "from astra_worker_queue" in query_lower:
                if "where run_id =" in query_lower:
                    rid = str(args[0])
                    jobs = [j.copy() for j in store.get("astra_worker_queue", []) if str(j.get("run_id")) == rid]
                    return jobs

            # --- worker_heartbeats ---
            if "from worker_heartbeats" in query_lower:
                rows = store.get("worker_heartbeats", [])
                res = []
                for r in rows:
                    res.append({
                        "id": r["worker_id"],
                        "status": r["status"],
                        "last_heartbeat": r["last_seen"],
                        "tasks": r.get("metadata", {}).get("tasks", 0),
                        "cpu": r.get("metadata", {}).get("cpu", 0.0),
                    })
                return res

            if "update public.astra_worker_queue" in query_lower:
                # Standard recovery update with RETURNING
                if "status = 'pending'" in query_lower or "status='pending'" in query_lower:
                    res = []
                    for job in store.get("astra_worker_queue", []):
                        if job.get("status") == "processing":
                            job["status"] = "pending"
                            job["retry_count"] = job.get("retry_count", 0) + 1
                            job["updated_at"] = datetime.utcnow().isoformat()
                            res.append({"id": job["id"], "run_id": job.get("run_id")})
                    _save_store(store)
                    return res

            # --- pipeline logs ---
            if "from public.pipeline_logs" in query_lower or "from pipeline_logs" in query_lower:
                rid = str(args[0])
                logs = [l.copy() for l in store.get("pipeline_logs", []) if str(l.get("run_id")) == rid]
                return logs

            # --- audit logs ---
            if "from audit_logs" in query_lower:
                return store.get("audit_logs", [
                    {
                        "id": str(uuid.uuid4()),
                        "action": "pipeline_created",
                        "resource_type": "pipeline",
                        "resource_id": str(args[0]) if args else str(uuid.uuid4()),
                        "user_id": "admin-1234",
                        "details": json.dumps({"note": "Simulated Audit Log"}),
                        "timestamp": datetime.utcnow().isoformat(),
                        "created_at": datetime.utcnow().isoformat()
                    }
                ])

            return []

    async def fetchrow(self, query, *args):
        async with _global_lock:
            store = _load_store()
            query_lower = query.lower().strip()
            # print(f"Mock DB: fetchrow -> {query_lower[:80]}")

            # --- claim_next_worker_job ---
            if "claim_next_worker_job" in query_lower:
                for j in store.get("astra_worker_queue", []):
                    if j["status"] == "pending":
                        j["status"] = "processing"
                        j.setdefault("retry_count", 0)
                        j["updated_at"] = datetime.utcnow().isoformat()
                        _save_store(store)
                        return j
                return None

            # --- claim_task_run ---
            if "update public.task_runs" in query_lower and "returning *" in query_lower:
                for t in store.get("task_runs", []):
                    if t["status"] == "queued":
                        t["status"] = "running"
                        t["start_time"] = datetime.utcnow().isoformat()
                        t["updated_at"] = datetime.utcnow().isoformat()
                        # Include pipeline_id for alert logic if available
                        if "pipeline_id" not in t:
                            for pt in store.get("pipeline_tasks", []):
                                if str(pt.get("id")) == str(t.get("task_id")):
                                    t["pipeline_id"] = pt.get("pipeline_id")
                                    break
                        _save_store(store)
                        return t
                return None

            if "from pipelines" in query_lower and "where id =" in query_lower:
                pid = str(args[0]) if args else None
                for p in store.get("pipelines", []):
                    if str(p.get("id")) == pid:
                        return p
                return None

            if "from public.pipeline_tasks" in query_lower and "where id =" in query_lower:
                tid = str(args[0])
                for t in store.get("pipeline_tasks", []):
                    if str(t.get("id")) == tid:
                        return t
                return None

            # --- single connection by id ---
            if "from connections" in query_lower and "where" in query_lower:
                cid = str(args[0]) if args else None
                for c in store.get("connections", []):
                    if str(c.get("id")) == cid:
                        return c
                return None

            # --- single pipeline_run by id ---
            if "from pipeline_runs" in query_lower and "where id =" in query_lower:
                rid = str(args[0])
                for r in store.get("pipeline_runs", []):
                    if str(r.get("id")) == rid:
                        nr = r.copy()
                        nr.setdefault("status", "pending")
                        nr.setdefault("run_status", nr["status"])
                        nr.setdefault("rows_processed", 0)
                        nr.setdefault("error_message", None)
                        return nr
                return None

            if "from connection_capabilities" in query_lower:
                cid = str(args[0])
                for cap in store.get("connection_capabilities", []):
                    if str(cap.get("connection_id")) == cid:
                        return cap
                return None

            if "from connection_credentials" in query_lower:
                cid = str(args[0])
                for cred in store.get("connection_credentials", []):
                    if str(cred.get("connection_id")) == cid:
                        return cred
                return None

            if "returning" in query_lower and "id" in query_lower:
                return {"id": str(uuid.uuid4())}

            # --- dashboard main metrics ---
            if "from pipeline_checkpoints" in query_lower:
                q = store.get("astra_worker_queue", [])
                return {
                    "totalRows": 150000,
                    "rowsPerSec": 1250.5,
                    "queuePending": len([j for j in q if j["status"] == "pending"]),
                    "alertDelivered": 0,
                    "successRate": 99.2
                }

            # --- queue aggregates (monitoring) ---
            if "from astra_worker_queue" in query_lower and "count(*)" in query_lower:
                q = store.get("astra_worker_queue", [])
                return {
                    "pending": len([j for j in q if j["status"] == "pending"]),
                    "processing": len([j for j in q if j["status"] == "processing"]),
                    "failed": len([j for j in q if j["status"] == "failed"]),
                    "completed": len([j for j in q if j["status"] == "completed"])
                }

            return None

    async def fetchval(self, query, *args):
        async with _global_lock:
            store = _load_store()
            query_lower = query.lower().strip()
            with open("mock_db_trace.log", "a") as f:
                f.write(f"fetchval: {query_lower[:80]}\n")

            # --- SUM(row_count) for pipeline_runs ---
            if "select sum(row_count) from public.staging_files" in query_lower:
                rid = str(args[0])
                total = sum(int(f.get("row_count", 0)) for f in store.get("staging_files", []) if str(f.get("pipeline_run_id")) == rid)
                return total

            # --- INSERT INTO pipeline_runs ... RETURNING id ---
            if "insert into pipeline_runs" in query_lower:
                new_id = str(uuid.uuid4())
                now = datetime.utcnow().isoformat()
                row = {
                    "id": new_id,
                    "pipeline_id": str(args[0]),
                    "status": args[1],
                    "run_status": args[1], # sync both
                    "environment": args[2],
                    "created_at": now,
                    "start_time": now,
                    "end_time": None,
                    "finished_at": None,
                    "rows_processed": 0,
                    "error_message": None
                }
                store["pipeline_runs"].append(row)
                _save_store(store)
                return new_id

            # --- INSERT INTO pipeline_partitions ---
            if "insert into public.pipeline_partitions" in query_lower:
                new_id = str(uuid.uuid4())
                row = {
                    "id": new_id,
                    "pipeline_run_id": str(args[0]),
                    "table_name": args[1],
                    "partition_key": args[2],
                    "range_start": args[3],
                    "range_end": args[4]
                }
                store.setdefault("pipeline_partitions", []).append(row)
                _save_store(store)
                return new_id

            # --- INSERT INTO bulk_load_jobs ---
            if "insert into public.bulk_load_jobs" in query_lower:
                new_id = str(uuid.uuid4())
                row = {
                    "id": new_id,
                    "pipeline_run_id": str(args[0]),
                    "target_table": args[1],
                    "command_type": args[2] if len(args) > 2 else "UNKNOWN",
                    "status": args[3] if len(args) > 3 else "running",
                    "started_at": datetime.utcnow().isoformat()
                }
                store.setdefault("bulk_load_jobs", []).append(row)
                _save_store(store)
                return new_id

            # --- INSERT INTO connections ---
            if "insert into connections" in query_lower:
                new_id = str(uuid.uuid4())
                row = {
                    "id": new_id,
                    "name": args[0],
                    "type": args[1],
                    "host": args[2],
                    "port": args[3],
                    "database_name": args[4],
                    "username": args[5],
                    "ssl_enabled": args[6],
                    "security_level": args[7],
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
                store["connections"].append(row)
                _save_store(store)
                return new_id

            # --- INSERT INTO pipelines ---
            if "insert into pipelines" in query_lower:
                new_id = str(uuid.uuid4())
                print(f"DEBUG mock_db fetchval pipelen insert: query={query}, args={args}")
                row = {
                    "id": new_id,
                    "name": args[0],
                    "status": args[1],
                    "environment": args[2],
                    "description": args[3],
                    "execution_mode": args[4] if len(args) > 4 else "linear",
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
                store["pipelines"].append(row)
                _save_store(store)
                return new_id

            # --- MAX version ---
            if "max(version_number)" in query_lower:
                pid = str(args[0])
                versions = [v for v in store.get("pipeline_versions", []) if str(v.get("pipeline_id")) == pid]
                return max([v.get("version_number", 0) for v in versions]) if versions else 0

            # Default fallthrough for inserts returning ID
            if "insert into" in query_lower and "returning" in query_lower:
                 new_fall = str(uuid.uuid4())
                 print(f"DEBUG fallback fetchval hit for: {query_lower}")
                 return new_fall
                 
            print(f"DEBUG fetchval returning None for: {query_lower}")
            return None


    async def execute(self, query, *args):
        async with _global_lock:
            store = _load_store()
            query_lower = query.lower().strip()
            with open("mock_db_trace.log", "a") as f:
                f.write(f"execute: {query_lower[:80]}\n")
            
            if "delete from public.pipeline_tasks" in query_lower:
                pid = str(args[0])
                store["pipeline_tasks"] = [t for t in store.get("pipeline_tasks", []) if str(t.get("pipeline_id")) != pid]
                _save_store(store)
                return "DELETE"

            if "delete from public.pipeline_dependencies" in query_lower:
                pid = str(args[0])
                store["pipeline_dependencies"] = [d for d in store.get("pipeline_dependencies", []) if str(d.get("pipeline_id")) != pid]
                _save_store(store)
                return "DELETE"

            if "delete from pipeline_nodes" in query_lower:
                pid = str(args[0])
                store["pipeline_nodes"] = [n for n in store.get("pipeline_nodes", []) if str(n.get("pipeline_id")) != pid]
                _save_store(store)
                return "DELETE"

            if "delete from pipeline_edges" in query_lower:
                pid = str(args[0])
                store["pipeline_edges"] = [e for e in store.get("pipeline_edges", []) if str(e.get("pipeline_id")) != pid]
                _save_store(store)
                return "DELETE"

            if "delete from pipelines" in query_lower:
                pid = str(args[0])
                store["pipelines"] = [p for p in store.get("pipelines", []) if str(p.get("id")) != pid]
                _save_store(store)
                return "DELETE"

            if "delete from connections" in query_lower:
                cid = str(args[0])
                store["connections"] = [c for c in store.get("connections", []) if str(c.get("id")) != cid]
                # Also cleanup credentials and capabilities if they exist
                store["connection_credentials"] = [c for c in store.get("connection_credentials", []) if str(c.get("connection_id")) != cid]
                store["connection_capabilities"] = [c for c in store.get("connection_capabilities", []) if str(c.get("connection_id")) != cid]
                _save_store(store)
                return "DELETE"

            if "update connections set" in query_lower:
                cid = str(args[7]) # UUID is the last arg in the service call
                for c in store.get("connections", []):
                    if str(c.get("id")) == cid:
                        c["name"] = args[0]
                        c["host"] = args[1]
                        c["port"] = args[2]
                        c["database_name"] = args[3]
                        c["username"] = args[4]
                        c["ssl_enabled"] = args[5]
                        c["security_level"] = args[6]
                        c["updated_at"] = datetime.utcnow().isoformat()
                _save_store(store)
                return "UPDATE"

            if "update pipelines set" in query_lower:
                pid = str(args[0])
                # args usually follow the order in PipelineService.update_pipeline: (p_uuid, *params)
                # But here we need to be careful with how the service builds the query.
                # Actually, PipelineService builds it dynamically. 
                # Let's simplify and just match the ID and assume updated_at is enough for now, 
                # OR we look at the query to extract values.
                # Since mock_db is a bit fragile with dynamic queries, let's try to be cleverer.
                
                for p in store.get("pipelines", []):
                    if str(p.get("id")) == pid:
                        # Find indices from query: "SET name = $2, description = $3, ... WHERE id = $1"
                        import re
                        param_matches = re.findall(r"(\w+) = \$(\d+)", query_lower)
                        for field, idx in param_matches:
                            val_idx = int(idx) - 1 # args is 0-indexed, $1 is args[0]
                            if val_idx < len(args):
                                p[field] = args[val_idx]
                        p["updated_at"] = datetime.utcnow().isoformat()
                _save_store(store)
                return "UPDATE"

            if "insert into public.pipeline_tasks" in query_lower:
                row = {
                    "id": str(uuid.uuid4()),
                    "pipeline_id": str(args[0]),
                    "task_name": str(args[1]),
                    "task_type": str(args[2]),
                    "config_json": args[3]
                }
                store["pipeline_tasks"].append(row)
                _save_store(store)
                return "INSERT"

            if "insert into public.pipeline_dependencies" in query_lower:
                row = {
                    "pipeline_id": str(args[0]),
                    "parent_task_id": str(args[1]),
                    "child_task_id": str(args[2])
                }
                store["pipeline_dependencies"].append(row)
                _save_store(store)
                return "INSERT"

            if "insert into pipeline_nodes" in query_lower:
                row = {
                    "id": str(args[0]),
                    "pipeline_id": str(args[1]),
                    "node_type": args[2],
                    "label": args[3],
                    "config_json": args[4],
                    "position_x": args[5],
                    "position_y": args[6],
                    "order_index": args[7]
                }
                store["pipeline_nodes"].append(row)
                _save_store(store)
                return "INSERT"

            if "insert into pipeline_edges" in query_lower:
                 row = {
                     "pipeline_id": str(args[0]),
                     "source_node_id": str(args[1]),
                     "target_node_id": str(args[2])
                 }
                 store["pipeline_edges"].append(row)
                 _save_store(store)
                 return "INSERT"

            if "insert into pipeline_versions" in query_lower:
                 if "($1, 1, $2)" in query_lower:
                      row = {
                          "pipeline_id": str(args[0]),
                          "version_number": 1,
                          "dag_json": args[1],
                          "created_at": datetime.utcnow().isoformat()
                      }
                 else:
                      row = {
                          "pipeline_id": str(args[0]),
                          "version_number": args[1],
                          "dag_json": args[2],
                          "created_at": datetime.utcnow().isoformat()
                      }
                 store.setdefault("pipeline_versions", []).append(row)
                 _save_store(store)
                 return "INSERT"

            if "insert into public.astra_alerts" in query_lower:
                row = {
                    "id": str(uuid.uuid4()),
                    "alert_type": args[0] if len(args) > 0 else "UNKNOWN",
                    "pipeline_id": str(args[1]) if len(args) > 1 and args[1] else None,
                    "message": args[2] if len(args) > 2 else "No message",
                    "severity": args[3] if len(args) > 3 else "medium",
                    "status": "open",
                    "created_at": datetime.utcnow().isoformat()
                }
                store.setdefault("astra_alerts", []).append(row)
                _save_store(store)
                return "INSERT"

            if "insert into public.pipeline_logs" in query_lower:
                row = {
                    "id": str(uuid.uuid4()),
                    "run_id": str(args[0]),
                    "pipeline_id": str(args[1]),
                    "stage": args[2],
                    "log_level": args[3],
                    "message": args[4],
                    "metadata": args[5] if isinstance(args[5], dict) else json.loads(args[5] or "{}"),
                    "timestamp": datetime.utcnow().isoformat()
                }
                store.setdefault("pipeline_logs", []).append(row)
                _save_store(store)
                return "INSERT"

            if "insert into connection_credentials" in query_lower:
                cid = str(args[0])
                found = False
                for c in store.get("connection_credentials", []):
                    if str(c.get("connection_id")) == cid:
                        c["encrypted_credentials"] = args[1]
                        c["iv"] = args[2]
                        c["created_at"] = datetime.utcnow().isoformat()
                        found = True
                if not found:
                    store["connection_credentials"].append({
                        "connection_id": cid,
                        "encrypted_credentials": args[1],
                        "iv": args[2],
                        "created_at": datetime.utcnow().isoformat()
                    })
                _save_store(store)
                return "INSERT"

            if "insert into connection_secrets" in query_lower:
                cid = str(args[0])
                key = args[1]
                found = False
                for s in store.get("connection_secrets", []):
                    if str(s.get("connection_id")) == cid and s.get("secret_key") == key:
                        s["secret_value"] = args[2]
                        s["updated_at"] = datetime.utcnow().isoformat()
                        found = True
                if not found:
                    store["connection_secrets"].append({
                        "connection_id": cid,
                        "secret_key": key,
                        "secret_value": args[2],
                        "updated_at": datetime.utcnow().isoformat()
                    })
                _save_store(store)
                return "INSERT"

            if "insert into connection_capabilities" in query_lower:
                cid = str(args[0])
                found = False
                for c in store.get("connection_capabilities", []):
                    if str(c.get("connection_id")) == cid:
                        c.update({
                            "supports_cdc": args[1],
                            "supports_incremental": args[2],
                            "supports_parallel_reads": args[3],
                            "supports_transactions": args[4],
                            "max_connections": args[5],
                            "updated_at": datetime.utcnow().isoformat()
                        })
                        found = True
                if not found:
                    store["connection_capabilities"].append({
                        "connection_id": cid,
                        "supports_cdc": args[1],
                        "supports_incremental": args[2],
                        "supports_parallel_reads": args[3],
                        "supports_transactions": args[4],
                        "max_connections": args[5],
                        "updated_at": datetime.utcnow().isoformat()
                    })
                _save_store(store)
                return "INSERT"

            if "insert into system_metrics" in query_lower:
                 # Just store for trends
                 row = {
                     "metric_name": args[0],
                     "metric_value": args[1],
                     "dimensions": json.loads(args[2]) if isinstance(args[2], str) else args[2],
                     "recorded_at": datetime.utcnow().isoformat()
                 }
                 store.setdefault("system_metrics", []).append(row)
                 _save_store(store)
                 return "INSERT"

            if "insert into public.failed_jobs" in query_lower:
                row = {
                    "id": str(uuid.uuid4()),
                    "job_id": str(args[0]) if len(args) > 0 else "UNKNOWN",
                    "pipeline_id": str(args[1]) if len(args) > 1 else "UNKNOWN",
                    "run_id": str(args[2]) if len(args) > 2 else "UNKNOWN",
                    "stage": args[3] if len(args) > 3 else "UNKNOWN",
                    "payload": args[4] if len(args) > 4 else "{}",
                    "error_message": args[5] if len(args) > 5 else "No error message",
                    "created_at": datetime.utcnow().isoformat()
                }
                store.setdefault("failed_jobs", []).append(row)
                _save_store(store)
                return "INSERT"

            if "update public.pipeline_runs" in query_lower:
                rid = None
                new_status = None
                if "$2" in query_lower:
                    # Pattern: SET run_status = '...', rows_processed = $1 WHERE id = $2
                    rid = str(args[1])
                    rows = args[0]
                    if "status = 'failed'" in query_lower or "run_status = 'failed'" in query_lower: new_status = 'failed'
                    elif "status = 'completed'" in query_lower or "run_status = 'completed'" in query_lower: new_status = 'completed'
                    else: new_status = 'running'
                elif "$1" in query_lower:
                    rid = str(args[0])
                    if "status = 'failed'" in query_lower or "run_status = 'failed'" in query_lower: new_status = 'failed'
                    elif "status = 'completed'" in query_lower or "run_status = 'completed'" in query_lower: new_status = 'completed'

                if rid:
                    for r in store.get("pipeline_runs", []):
                        if str(r.get("id")) == rid:
                            if new_status: 
                                r["status"] = new_status
                                r["run_status"] = new_status
                            if "rows_processed" in query_lower:
                                r["rows_processed"] = args[0]
                            r["finished_at"] = datetime.utcnow().isoformat()
                    _save_store(store)
                return "UPDATE"

            if "update public.task_runs" in query_lower:
                tid = None
                new_status = None
                inc_retry = "retry_count + 1" in query_lower
                
                # Find task ID
                if "$3" in query_lower:
                    new_status = args[0]
                    tid = str(args[2])
                elif "$2" in query_lower:
                    if "next_retry_at =" in query_lower:
                        tid = str(args[1])
                    else:
                        tid = str(args[1])
                        new_status = args[0]
                elif "$1" in query_lower:
                    tid = str(args[0])

                if "status = 'queued'" in query_lower: new_status = 'queued'
                elif "status = 'running'" in query_lower: new_status = 'running'
                elif "status = 'completed'" in query_lower: new_status = 'completed'
                elif "status = 'failed'" in query_lower: new_status = 'failed'

                if tid:
                    for t in store.get("task_runs", []):
                        if str(t.get("id")) == tid:
                            if new_status: t["status"] = new_status
                            if inc_retry: t["retry_count"] = t.get("retry_count", 0) + 1
                            t["updated_at"] = datetime.utcnow().isoformat()
                    _save_store(store)
                return "UPDATE"

            if "insert into public.task_runs" in query_lower:
                row = {
                    "id": str(args[4]) if len(args) > 4 else str(uuid.uuid4()),
                    "pipeline_run_id": str(args[0]),
                    "task_id": str(args[1]),
                    "status": args[2],
                    "start_time": args[3].isoformat() if hasattr(args[3], 'isoformat') else str(args[3]),
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
                store["task_runs"].append(row)
                _save_store(store)
                return "INSERT"

            if "insert into public.staging_files" in query_lower:
                row = {
                    "id": str(uuid.uuid4()),
                    "pipeline_run_id": str(args[0]),
                    "partition_id": str(args[1]),
                    "file_path": args[2],
                    "row_count": args[3],
                    "file_size_bytes": args[4],
                    "created_at": datetime.utcnow().isoformat()
                }
                store.setdefault("staging_files", []).append(row)
                _save_store(store)
                return "INSERT"

            if "insert into public.astra_worker_queue" in query_lower:
                row = {
                    "id": str(uuid.uuid4()),
                    "pipeline_id": str(args[0]),
                    "run_id": str(args[1]),
                    "stage": args[2],
                    "payload": json.loads(args[3]) if isinstance(args[3], str) else args[3],
                    "status": "pending",
                    "retry_count": 0,
                    "scheduled_at": (args[4].isoformat() if hasattr(args[4], 'isoformat') else str(args[4])) if len(args) > 4 else datetime.utcnow().isoformat(),
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
                store.setdefault("astra_worker_queue", []).append(row)
                _save_store(store)
                return "INSERT"

            if "update public.astra_worker_queue" in query_lower:
                jid = None
                new_status = None
                error_text = None
                if "status = 'pending'" in query_lower or "status='pending'" in query_lower:
                    new_status = 'pending'
                    if "$2" in query_lower: 
                        jid = str(args[1])
                    elif "$1" in query_lower: 
                        count = 0
                        for job in store.get("astra_worker_queue", []):
                            if job.get("status") == "processing":
                                job["status"] = "pending"
                                job["retry_count"] = job.get("retry_count", 0) + 1
                                job["updated_at"] = datetime.utcnow().isoformat()
                                count += 1
                        _save_store(store)
                        return "UPDATE"
                else:
                    if len(args) >= 3:
                        new_status = args[0]
                        error_text = args[1]
                        jid = str(args[2])
                
                if jid:
                    for job in store.get("astra_worker_queue", []):
                        if str(job.get("id")) == jid:
                            if new_status: job["status"] = new_status
                            if error_text: job["error_text"] = error_text
                            job["updated_at"] = datetime.utcnow().isoformat()
                    _save_store(store)
                return "UPDATE"

            if "insert into public.worker_heartbeats" in query_lower:
                wid = str(args[0])
                status = args[1]
                metadata = json.loads(args[2]) if isinstance(args[2], str) else args[2]
                found = False
                for h in store.get("worker_heartbeats", []):
                    if h["worker_id"] == wid:
                        h["status"] = status
                        h["metadata"] = metadata
                        h["last_seen"] = datetime.utcnow().isoformat()
                        found = True
                        break
                if not found:
                    store["worker_heartbeats"].append({
                        "worker_id": wid,
                        "status": status,
                        "metadata": metadata,
                        "last_seen": datetime.utcnow().isoformat()
                    })
                _save_store(store)
                return "INSERT"

            if "update public.bulk_load_jobs" in query_lower:
                jid = str(args[1] if "$2" in query_lower else args[0])
                for job in store.get("bulk_load_jobs", []):
                    if str(job.get("id")) == jid:
                        if "status =" in query_lower:
                            job["status"] = args[0] if "$1" in query_lower else "success"
                        job["completed_at"] = datetime.utcnow().isoformat()
                _save_store(store)
                return "UPDATE"

            if "insert into public.pipeline_versions" in query_lower:
                row = {
                    "id": str(uuid.uuid4()),
                    "pipeline_id": str(args[0]),
                    "version_number": args[1],
                    "dag_json": args[2],
                    "created_at": datetime.utcnow().isoformat()
                }
                store.setdefault("pipeline_versions", []).append(row)
                _save_store(store)
                return "INSERT"

            if "insert into public.pipeline_partitions" in query_lower:
                row = {
                    "id": str(uuid.uuid4()),
                    "pipeline_run_id": str(args[0]),
                    "table_name": args[1],
                    "partition_key": args[2],
                    "range_start": args[3],
                    "range_end": args[4],
                    "created_at": datetime.utcnow().isoformat()
                }
                store.setdefault("pipeline_partitions", []).append(row)
                _save_store(store)
                if "returning id" in query_lower:
                    return row["id"]
                return "INSERT"

            if "insert into" in query_lower:
                if "returning id" in query_lower:
                    return str(uuid.uuid4())
                return "INSERT"

            return "OK"

    async def executemany(self, query, data):
        query_lower = query.lower().strip()
        print(f"Mock DB: executemany -> {query_lower[:80]}")
        for args in data:
            await self.execute(query, *args)
        return "OK"

    def transaction(self):
        return MockTransaction()

    async def close(self):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

class MockTransaction:
    async def __aenter__(self):
        return self
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

class MockPool:
    def __init__(self, db_state):
        self.db_state = db_state
    def acquire(self):
        return MockConnection(self.db_state)
    async def release(self, conn):
        pass
    async def close(self):
        pass

class MockAsyncpg:
    def __init__(self):
        self.db_state = {}
    async def connect(self, dsn=None, **kwargs):
        return MockConnection(self.db_state)
    async def create_pool(self, dsn=None, **kwargs):
        return MockPool(self.db_state)

import asyncpg
mock_pg = MockAsyncpg()
asyncpg.connect = mock_pg.connect
asyncpg.create_pool = mock_pg.create_pool
print("INFRA: asyncpg monkey-patched with MockDB for Pipelines.")

class MockStorageService:
    def __init__(self):
        pass
    async def upload_file(self, local_path, remote_path):
        print(f"MOCK_STORAGE: Uploading {local_path} to {remote_path}")
    async def download_file(self, remote_path, local_path):
        print(f"MOCK_STORAGE: Downloading {remote_path} to {local_path}")
    async def list_files(self, prefix):
        return []

try:
    import services.storage_service
    services.storage_service.StorageService = MockStorageService
except:
    pass
