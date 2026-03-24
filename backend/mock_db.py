import os
import re
import uuid
import json
import asyncio
import threading
import contextvars
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional

# ---------------------------------------------------------------------------
# File-backed shared store for mock mode
# ---------------------------------------------------------------------------
if os.environ.get("USE_TEST_MOCK_FILE") == "true":
    MOCK_FILE = os.path.join(os.path.dirname(__file__), "test_mock_store.json")
else:
    MOCK_FILE = os.path.join(os.path.dirname(__file__), "mock_store.json")

print(f"MOCK_DB: Using store at {os.path.abspath(MOCK_FILE)}")
    
# _global_lock = None # Removed to prevent deadlocks
_thread_lock = threading.Lock()
_in_transaction_ctx = contextvars.ContextVar('in_transaction', default=False)

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
        "circuit_breakers": [],
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

async def _load_store():
    trigger = os.path.join(os.path.dirname(__file__), "chaos_outage.trigger")
    if os.path.exists(trigger):
        raise Exception("MOCK_DB_CHAOS: Database is down via trigger file!")

    exists = os.path.exists(MOCK_FILE)
    if not exists:
        return _get_default_store()
    
    for _ in range(10): 
        try:
            def _read_sync():
                with open(MOCK_FILE, 'r') as f:
                    return json.load(f)
            data = await asyncio.to_thread(_read_sync)
            if data and isinstance(data, dict):
                return data
        except Exception:
            await asyncio.sleep(0.05)
    
    return _get_default_store()

async def _save_store(store):
    trigger = os.path.join(os.path.dirname(__file__), "chaos_outage.trigger")
    if os.path.exists(trigger):
        raise Exception("MOCK_DB_CHAOS: Database is down via trigger file!")

    # In transaction, we defer save until commit (MockTransaction handles it)
    if _in_transaction_ctx.get():
        return

    import tempfile
    import time
    
    def _save_sync():
        with _thread_lock:
            fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(MOCK_FILE), suffix=".tmp")
            try:
                with os.fdopen(fd, 'w') as f:
                    json.dump(store, f, indent=2)
                
                max_retries = 20
                for attempt in range(max_retries):
                    try:
                        if os.path.exists(MOCK_FILE):
                            os.replace(tmp_path, MOCK_FILE)
                        else:
                            os.rename(tmp_path, MOCK_FILE)
                        return
                    except (PermissionError, OSError):
                        if attempt < max_retries - 1:
                            time.sleep(min(0.05 * (2 ** attempt), 2.0))
                        else:
                            raise
            finally:
                if os.path.exists(tmp_path):
                    for _ in range(5):
                        try:
                            os.remove(tmp_path)
                            break
                        except:
                            time.sleep(0.1)

    try:
        await asyncio.to_thread(_save_sync)
    except Exception as e:
        pass # Errors logged elsewhere if needed

class MockConnection:
    def __init__(self, db_state):
        self.db_state = db_state
        self.transaction_store = None
        self.last_inserted_id = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    async def close(self):
        pass

    async def fetch(self, query, *args):
        # No lock needed for simulation; file I/O handles safety
        store = self.transaction_store if self.transaction_store else await _load_store()
        query_lower = query.lower().strip()
        print(f"DEBUG SQL: {query_lower[:80]}...")

        if "select id from public.pipeline_runs" in query_lower and "status = 'running'" in query_lower:
            runs = store.get("pipeline_runs", [])
            return [{"id": r["id"]} for r in runs if isinstance(r, dict) and r.get("status") == "running"]

        # connections
        if "from connections" in query_lower and "select" in query_lower:
            rows = []
            for c in store.get("connections", []):
                if not isinstance(c, dict): continue
                row = c.copy()
                row.setdefault("status", "connected")
                row.setdefault("last_tested_at", row.get("updated_at") or datetime.utcnow().isoformat())
                rows.append(row)
            return rows

        # pipelines
        if "from pipelines" in query_lower and "select" in query_lower:
            results = []
            for p in store.get("pipelines", []):
                if not isinstance(p, dict): continue
                row = p.copy()
                row.setdefault("status", "draft")
                row.setdefault("environment", "dev")
                row.setdefault("created_at", row.get("updated_at") or datetime.utcnow().isoformat())
                row.setdefault("updated_at", row.get("created_at") or datetime.utcnow().isoformat())
                results.append(row)
            results.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
            return results

        # pipeline_runs
        if "from pipeline_runs" in query_lower or "from public.pipeline_runs" in query_lower:
            results = [r.copy() for r in store.get("pipeline_runs", []) if isinstance(r, dict)]
            for r in results:
                r.setdefault("status", "pending")
                r.setdefault("run_status", r.get("status", "pending"))
            if "where id =" in query_lower and args:
                results = [r for r in results if str(r.get("id")) == str(args[0])]
            elif "where pipeline_id =" in query_lower and args:
                results = [r for r in results if str(r.get("pipeline_id")) == str(args[0])]
            results.sort(key=lambda x: x.get("updated_at", x.get("start_time", "")), reverse=True)
            return results

        # claim_next_worker_job
        if "claim_next_worker_job" in query_lower:
            for j in store.get("astra_worker_queue", []):
                if j["status"] == "pending":
                    j["status"] = "processing"
                    j["updated_at"] = datetime.utcnow().isoformat()
                    await _save_store(store)
                    return [j]
            return []

        return []

    async def fetchrow(self, query, *args):
        query_lower = query.lower().strip()
        store = self.transaction_store if self.transaction_store else await _load_store()
        
        if "update public.task_runs" in query_lower and "returning *" in query_lower:
            for t in store.get("task_runs", []):
                if t["status"] == "queued":
                    t["status"] = "running"
                    t["start_time"] = datetime.utcnow().isoformat()
                    await _save_store(store)
                    return t
            return None

        if "from connections" in query_lower and "where" in query_lower:
            cid = str(args[0]) if args else None
            for c in store.get("connections", []):
                if str(c.get("id")) == cid: return c
            return None

        if "from pipelines" in query_lower and "where id =" in query_lower:
            pid = str(args[0]) if args else None
            for p in store.get("pipelines", []):
                if isinstance(p, dict) and str(p.get("id")) == pid: return p
            return None

        if "from connection_credentials" in query_lower and "where connection_id =" in query_lower:
            cid = str(args[0]) if args else None
            for cred in store.get("connection_credentials", []):
                if str(cred.get("connection_id")) == cid: return cred
            return None

        if "from connection_secrets" in query_lower and "where connection_id =" in query_lower:
            cid = str(args[0]) if args else None
            skey = args[1] if len(args) > 1 else None
            for s in store.get("connection_secrets", []):
                if str(s.get("connection_id")) == cid and s.get("secret_key") == skey:
                    return s
            return None

        res = await self.fetch(query, *args)
        return res[0] if res else None

    async def fetchval(self, query, *args):
        query_lower = query.lower().strip()
        if "insert into" in query_lower:
            # We must use self.last_inserted_id if set by execute()
            await self.execute(query, *args)
            return self.last_inserted_id or str(uuid.uuid4())

        res = await self.fetchrow(query, *args)
        if res is None: return None
        
        if "select secret_value from connection_secrets" in query_lower and isinstance(res, dict):
            return res.get("secret_value")
            
        if isinstance(res, dict): return list(res.values())[0]
        return res

    async def execute(self, query, *args):
        store = self.transaction_store if self.transaction_store else await _load_store()
        query_lower = query.lower().strip()
        
        if "insert into pipelines" in query_lower:
            new_id = str(uuid.uuid4())
            row = {
                "id": new_id,
                "name": args[0], "status": args[1], "environment": args[2],
                "description": args[3], "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            store.setdefault("pipelines", []).append(row)
            self.last_inserted_id = new_id
            await _save_store(store)
            return "INSERT"

        if "insert into connections" in query_lower:
            new_id = str(uuid.uuid4())
            row = {
                "id": new_id,
                "name": args[0], "type": args[1], "host": args[2], "port": args[3],
                "database_name": args[4], "username": args[5], "ssl_enabled": args[6],
                "security_level": args[7], "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            store.setdefault("connections", []).append(row)
            self.last_inserted_id = new_id
            await _save_store(store)
            return "INSERT"

        if "insert into connection_secrets" in query_lower:
            new_id = str(uuid.uuid4())
            row = {
                "id": new_id,
                "connection_id": str(args[0]), "secret_key": args[1], "secret_value": args[2],
                "created_at": datetime.utcnow().isoformat()
            }
            store.setdefault("connection_secrets", []).append(row)
            self.last_inserted_id = new_id
            await _save_store(store)
            return "INSERT"

        if "insert into connection_credentials" in query_lower:
            # args: connection_id, encrypted_credentials, iv
            row = {
                "connection_id": str(args[0]),
                "encrypted_credentials": args[1],
                "iv": args[2],
                "created_at": datetime.utcnow().isoformat()
            }
            # Handle upsert manually
            creds = store.setdefault("connection_credentials", [])
            existing = [c for c in creds if str(c.get("connection_id")) == str(args[0])]
            if existing:
                existing[0].update(row)
            else:
                creds.append(row)
            await _save_store(store)
            return "INSERT"

        if "insert into pipeline_nodes" in query_lower:
            # (id, pipeline_id, node_type, label, config_json, position_x, position_y, order_index)
            row = {
                "id": str(args[0]), "pipeline_id": str(args[1]), "node_type": args[2],
                "label": args[3], "config_json": args[4], "position_x": args[5],
                "position_y": args[6], "order_index": args[7]
            }
            store.setdefault("pipeline_nodes", []).append(row)
            self.last_inserted_id = str(args[0])
            await _save_store(store)
            return "INSERT"

        if "insert into pipeline_edges" in query_lower:
            # (pipeline_id, source_node_id, target_node_id)
            row = {
                "id": str(uuid.uuid4()),
                "pipeline_id": str(args[0]), "source_node_id": str(args[1]), "target_node_id": str(args[2])
            }
            store.setdefault("pipeline_edges", []).append(row)
            await _save_store(store)
            return "INSERT"

        if "insert into connection_performance" in query_lower:
            # (connection_id, avg_latency_ms, updated_at)
            new_id = str(uuid.uuid4())
            row = {
                "id": new_id,
                "connection_id": str(args[0]), "avg_latency_ms": args[1], "updated_at": datetime.utcnow().isoformat()
            }
            # Handle manual upsert logic if needed, but for mock append is usually fine or update existing
            existing = [r for r in store.get("connection_performance", []) if str(r.get("connection_id")) == str(args[0])]
            if existing:
                existing[0]["avg_latency_ms"] = args[1]
                existing[0]["updated_at"] = datetime.utcnow().isoformat()
            else:
                store.setdefault("connection_performance", []).append(row)
            await _save_store(store)
            return "INSERT"

        if "update" in query_lower:
            await _save_store(store)
            return "UPDATE"

        if "insert into" in query_lower:
            await _save_store(store)
            return "INSERT"

        if "delete from" in query_lower:
            parts = query_lower.split()
            try:
                table_idx = parts.index("from") + 1
                table_name = parts[table_idx].replace("public.", "")
                
                if "where id =" in query_lower and args:
                    target_id = str(args[0])
                    if table_name in store:
                        # Perform the deletion
                        original_len = len(store[table_name])
                        store[table_name] = [item for item in store[table_name] if str(item.get("id")) != target_id]
                        
                        # Manual Cascades for known relationships in mock mode
                        if table_name == "connections":
                            store["connection_secrets"] = [s for s in store.get("connection_secrets", []) if str(s.get("connection_id")) != target_id]
                            store["connection_capabilities"] = [c for c in store.get("connection_capabilities", []) if str(c.get("connection_id")) != target_id]
                            store["connection_performance"] = [p for p in store.get("connection_performance", []) if str(p.get("connection_id")) != target_id]
                        elif table_name == "pipelines":
                            store["pipeline_nodes"] = [n for n in store.get("pipeline_nodes", []) if str(n.get("pipeline_id")) != target_id]
                            store["pipeline_edges"] = [e for e in store.get("pipeline_edges", []) if str(e.get("pipeline_id")) != target_id]

                        if len(store[table_name]) < original_len:
                            print(f"MOCK_DB: Deleted {target_id} from {table_name}")
                
                await _save_store(store)
                return "DELETE"
            except (ValueError, IndexError) as e:
                print(f"MOCK_DB: Failed to parse DELETE query: {query_lower} - {e}")
                return "DELETE"

        return "OK"

    async def executemany(self, query, data):
        for args in data:
            await self.execute(query, *args)
        return "OK"

    def transaction(self):
        return MockTransaction(self)

class MockTransaction:
    def __init__(self, conn):
        self.conn = conn
        self.token = None

    async def __aenter__(self):
        self.conn.transaction_store = await _load_store()
        self.token = _in_transaction_ctx.set(True)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type is None and self.conn.transaction_store:
                # Manually clear context to allow save
                _in_transaction_ctx.reset(self.token)
                self.token = None
                await _save_store(self.conn.transaction_store)
        finally:
            if self.token: _in_transaction_ctx.reset(self.token)
            self.conn.transaction_store = None

class MockPool:
    def __init__(self, db_state):
        self.db_state = db_state
    @asynccontextmanager
    async def acquire(self):
        yield MockConnection(self.db_state)
    async def release(self, conn): pass
    async def close(self): pass

class MockAsyncpg:
    def __init__(self): self.db_state = {}
    async def connect(self, dsn=None, **kwargs): return MockConnection(self.db_state)
    async def create_pool(self, dsn=None, **kwargs): return MockPool(self.db_state)

import asyncpg
mock_pg = MockAsyncpg()
asyncpg.connect = mock_pg.connect
asyncpg.create_pool = mock_pg.create_pool
print("INFRA: asyncpg monkey-patched with MockDB (Lock-less for deadlock prevention).")

class MockStorageService:
    async def upload_file(self, l, r): pass
    async def download_file(self, r, l): pass
    async def list_files(self, p): return []

try:
    import services.storage_service
    services.storage_service.StorageService = MockStorageService
except: pass
