import os
import uuid
import json
import asyncio
import asyncpg
from typing import List, Dict, Any, Optional
from core.postgres_connector import PostgresConnector
from core.base_connector import BaseConnector
from core.dag_validator import DAGValidator

from services.connection_service import ConnectionService

class PipelineService:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool
        self.connection_service = ConnectionService(pool)

    async def log_event(self, run_id: str, pipeline_id: str, stage: str, message: str, level: str = 'INFO', metadata: Dict[str, Any] = None):
        """Records a structured log entry in the database."""
        try:
            r_id = uuid.UUID(run_id)
            p_id = uuid.UUID(pipeline_id)
        except ValueError:
            return  # Ignore logs for invalid IDs

        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO public.pipeline_logs (run_id, pipeline_id, stage, log_level, message, metadata) "
                "VALUES ($1, $2, $3, $4, $5, $6)",
                r_id, p_id, stage, level, message, json.dumps(metadata or {})
            )

    async def create_pipeline(self, payload: Dict[str, Any]):
        pipeline = payload.get("pipeline", {})
        nodes = payload.get("nodes", [])
        edges = payload.get("edges", [])
        
        # 0. Validate DAG Integrity
        node_ids = [str(n.get("id")) for n in nodes if n.get("id")]
        # For new nodes without IDs, we temporarily use their indices
        for i, node in enumerate(nodes):
            if not node.get("id"):
                node["id"] = f"temp_{i}"
                node_ids.append(node["id"])
        
        edge_list = [{"parent_task_id": str(e.get("source_node_id")), "child_task_id": str(e.get("target_node_id"))} for e in edges]
        if not DAGValidator.validate(node_ids, edge_list):
            raise ValueError("Circular dependency detected in pipeline DAG")

        async with self.pool.acquire() as conn:
            async with conn.transaction():
                # 1. Insert Pipeline
                pipeline_id = await conn.fetchval(
                    "INSERT INTO pipelines (name, status, environment, description, execution_mode) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                    pipeline.get("name"), "draft", pipeline.get("environment", "dev"), pipeline.get("description"), pipeline.get("execution_mode", "linear")
                )
                
                # 2. Assign IDs and Insert Nodes
                node_id_map = {}
                nodes_to_insert = []
                for i, node in enumerate(nodes):
                    original_id = node.get("id")
                    # Generate a real UUID if the frontend ID isn't one or is a temp one
                    try:
                        node_uuid = uuid.UUID(original_id) if original_id and not str(original_id).startswith("temp_") else uuid.uuid4()
                    except (ValueError, TypeError):
                        node_uuid = uuid.uuid4()
                    
                    if original_id:
                        node_id_map[str(original_id)] = node_uuid
                    
                    nodes_to_insert.append((
                        node_uuid, pipeline_id, node.get("node_type"), node.get("label"), 
                        json.dumps(node.get("config_json", {}) if isinstance(node.get("config_json"), dict) else json.loads(node.get("config_json") or "{}")),
                        node.get("position_x", 0), node.get("position_y", 0), i
                    ))

                if nodes_to_insert:
                    await conn.executemany(
                        "INSERT INTO pipeline_nodes (id, pipeline_id, node_type, label, config_json, position_x, position_y, order_index) "
                        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
                        nodes_to_insert
                    )
                
                # 3. Insert Edges using the Map
                if edges:
                    edge_data = []
                    for edge in edges:
                        s_id = str(edge.get("source_node_id"))
                        t_id = str(edge.get("target_node_id"))
                        
                        # Resolve from map if possible
                        s_uuid = node_id_map.get(s_id)
                        t_uuid = node_id_map.get(t_id)
                        
                        if not s_uuid:
                             try: s_uuid = uuid.UUID(s_id)
                             except: continue
                        if not t_uuid:
                             try: t_uuid = uuid.UUID(t_id)
                             except: continue

                        edge_data.append((pipeline_id, s_uuid, t_uuid))

                    if edge_data:
                        await conn.executemany(
                            "INSERT INTO pipeline_edges (pipeline_id, source_node_id, target_node_id) "
                            "VALUES ($1, $2, $3)",
                            edge_data
                        )
                
                # 4. Initial Version
                await conn.execute(
                    "INSERT INTO pipeline_versions (pipeline_id, version_number, dag_json) "
                    "VALUES ($1, 1, $2)",
                    pipeline_id, json.dumps({"nodes": nodes, "edges": edges})
                )
                
                # 5. Compile DAG for Scheduler
                await self.compile_dag(str(pipeline_id), nodes, edges)
                
            return {"id": str(pipeline_id), "status": "created"}

    async def compile_dag(self, pipeline_id: str, nodes: List[Dict], edges: List[Dict]):
        """Translates visual nodes and edges into executable tasks and dependencies."""
        type_mapping = {
            "source": "EXTRACT",
            "extract": "EXTRACT",
            "load": "LOAD",
            "destination": "LOAD",
            "transform": "SQL",
            "validate": "VALIDATION",
            "filter": "SQL",
            "join": "SQL",
            "aggregate": "SQL"
        }
        
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                # Clear existing
                await conn.execute("DELETE FROM public.pipeline_tasks WHERE pipeline_id = $1", uuid.UUID(pipeline_id))
                await conn.execute("DELETE FROM public.pipeline_dependencies WHERE pipeline_id = $1", uuid.UUID(pipeline_id))
                
                # Create Tasks
                node_to_task_id = {}
                for node in nodes:
                    node_id = str(node.get("id"))
                    task_name = node.get("label", "Unnamed Task")
                    task_type = type_mapping.get(node.get("node_type", "").lower(), "SQL")
                    config = node.get("config_json", {})
                    if not isinstance(config, dict):
                        try: config = json.loads(config)
                        except: config = {}
                    
                    # Inject connection_id if exists in node top-level
                    if node.get("connection_id"):
                        config["connection_id"] = node["connection_id"]
                    
                    # Ensure table_name/source_table exists
                    if not config.get("table_name"):
                        config["table_name"] = node.get("table_name") or node.get("source_table") or node.get("target_table")
                    
                    # Store Task (Mock will generate ID)
                    await conn.execute(
                        "INSERT INTO public.pipeline_tasks (pipeline_id, task_name, task_type, config_json) VALUES ($1, $2, $3, $4)",
                        uuid.UUID(pipeline_id), task_name, task_type, json.dumps(config) if isinstance(config, dict) else config
                    )
                    
                    # Fetch the generated ID (In mock we can just use the node_id if we want, but let's be realistic)
                    # For simplicity in mock, let's assume we can map them back.
                    # Actually, let's just use the node ID as task ID in the mock if possible?
                    # No, the mock generates a random UUID for tasks.
                    # Let's fetch them all back to map.
                    
                # Re-fetch tasks to build mapping (since mock generates random UUIDs)
                task_rows = await conn.fetch("SELECT id, task_name FROM public.pipeline_tasks WHERE pipeline_id = $1", uuid.UUID(pipeline_id))
                task_map = {r['task_name']: r['id'] for r in task_rows}
                
                # Insert Dependencies
                for edge in edges:
                    s_id = str(edge.get("source_node_id"))
                    t_id = str(edge.get("target_node_id"))
                    
                    # Find labels to map back
                    s_label = next((n.get("label") for n in nodes if str(n.get("id")) == s_id), None)
                    t_label = next((n.get("label") for n in nodes if str(n.get("id")) == t_id), None)
                    
                    if s_label and t_label and s_label in task_map and t_label in task_map:
                        await conn.execute(
                            "INSERT INTO public.pipeline_dependencies (pipeline_id, parent_task_id, child_task_id) "
                            "VALUES ($1, $2, $3)",
                            uuid.UUID(pipeline_id), task_map[s_label], task_map[t_label]
                        )

    async def create_run(self, pipeline_id: str, status: str = "pending", environment: Optional[str] = None) -> Dict[str, Any]:
        """Creates a new pipeline_run record, inheriting environment from pipeline if not provided."""
        try:
            p_uuid = uuid.UUID(pipeline_id)
        except ValueError:
            raise ValueError(f"Invalid pipeline_id: {pipeline_id}")

        async with self.pool.acquire() as conn:
            if not environment:
                # Fetch env from pipeline
                env_row = await conn.fetchrow("SELECT environment FROM pipelines WHERE id = $1", p_uuid)
                environment = env_row['environment'] if env_row else 'dev'

            run_id = await conn.fetchval(
                "INSERT INTO pipeline_runs (pipeline_id, status, environment, start_time) VALUES ($1, $2, $3, NOW()) RETURNING id",
                p_uuid, status, environment
            )

            # Initialize task runs for all nodes
            nodes = await conn.fetch("SELECT id FROM pipeline_nodes WHERE pipeline_id = $1", p_uuid)
            for node in nodes:
                await conn.execute(
                    "INSERT INTO public.pipeline_task_runs (pipeline_run_id, node_id, status) VALUES ($1, $2, 'pending')",
                    run_id, node['id']
                )

            return {"id": str(run_id), "status": status, "environment": environment}

    async def list_runs(self, pipeline_id: Optional[str] = None) -> List[Dict[str, Any]]:
        async with self.pool.acquire() as conn:
            query = "SELECT * FROM pipeline_runs"
            params = []
            if pipeline_id and pipeline_id.strip():
                try:
                    uuid_val = uuid.UUID(pipeline_id)
                    query += " WHERE pipeline_id = $1"
                    params.append(uuid_val)
                except ValueError:
                    pass # Ignore invalid UUID filters
            query += " ORDER BY start_time DESC"
            rows = await conn.fetch(query, *params)
            return [dict(r) for r in rows]

    async def list_run_tasks(self, run_id: str) -> List[Dict[str, Any]]:
        """Fetches all tasks associated with a specific pipeline run."""
        try:
            r_uuid = uuid.UUID(run_id)
        except ValueError:
            return []
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM public.pipeline_task_runs WHERE pipeline_run_id = $1 ORDER BY start_time ASC",
                r_uuid
            )
            return [dict(r) for r in rows]

    async def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        try:
            r_uuid = uuid.UUID(run_id)
        except ValueError:
            return None
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM pipeline_runs WHERE id = $1", r_uuid)
            return dict(row) if row else None

    async def list_pipelines(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM pipelines ORDER BY updated_at DESC LIMIT $1 OFFSET $2",
                limit, offset
            )
            return [dict(r) for r in rows]

    async def get_pipeline(self, pipeline_id: str) -> Optional[Dict[str, Any]]:
        try:
            p_uuid = uuid.UUID(pipeline_id)
        except ValueError:
            return None

        async with self.pool.acquire() as conn:
            p_row = await conn.fetchrow("SELECT * FROM pipelines WHERE id = $1", p_uuid)
            if not p_row:
                return None
            
            pipeline = dict(p_row)
            n_rows = await conn.fetch("SELECT * FROM pipeline_nodes WHERE pipeline_id = $1 ORDER BY order_index", p_uuid)
            e_rows = await conn.fetch("SELECT * FROM pipeline_edges WHERE pipeline_id = $1", p_uuid)
            
            pipeline["pipeline_nodes"] = [dict(r) for r in n_rows]
            pipeline["pipeline_edges"] = [dict(r) for r in e_rows]
            return pipeline

    async def update_pipeline(self, pipeline_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        print(f"DEBUG: update_pipeline called for {pipeline_id} with payload keys: {list(payload.keys())}")
        p_uuid = uuid.UUID(pipeline_id)
        
        # 0. Validate DAG Integrity if nodes/edges modified
        if 'nodes' in payload or 'edges' in payload:
            print("DEBUG: Validating DAG integrity...")
            pipeline = await self.get_pipeline(pipeline_id)
            if not pipeline:
                print(f"DEBUG: Pipeline {pipeline_id} not found in get_pipeline")
                return None
            nodes = payload.get('nodes', pipeline.get('pipeline_nodes', []))
            edges = payload.get('edges', pipeline.get('pipeline_edges', []))
            
            node_ids = [str(n.get("id")) for n in nodes]
            edge_list = [{"parent_task_id": str(e.get("source_node_id")), "child_task_id": str(e.get("target_node_id"))} for e in edges]
            if not DAGValidator.validate(node_ids, edge_list):
                raise ValueError("Circular dependency detected in pipeline DAG")

        async with self.pool.acquire() as conn:
            async with conn.transaction():
                # 1. Update metadata
                updates = []
                params = [p_uuid]
                for key in ['name', 'description', 'status', 'schedule_type', 'schedule_config', 'execution_mode']:
                    if key in payload:
                        updates.append(f"{key} = ${len(params) + 1}")
                        params.append(payload[key])
                
                if updates:
                    query = f"UPDATE pipelines SET {', '.join(updates)}, updated_at = NOW() WHERE id = $1"
                    await conn.execute(query, *params)

                # 2. Update nodes and edges if provided
                if 'nodes' in payload or 'edges' in payload:
                    # Get current max version
                    v_row = await conn.fetchrow(
                        "SELECT MAX(version_number) as v FROM pipeline_versions WHERE pipeline_id = $1",
                        p_uuid
                    )
                    current_v = v_row['v'] if v_row and v_row['v'] is not None else 0
                    next_version = current_v + 1
                    
                    # Create new version record
                    dag_json = {
                        "nodes": payload.get('nodes', []),
                        "edges": payload.get('edges', [])
                    }
                    print(f"DEBUG: Created version {next_version}")
                    
                    # 3. Compile DAG for Scheduler
                    print("DEBUG: Compiling DAG...")
                    await self.compile_dag(str(pipeline_id), nodes, edges)
                    print("DEBUG: DAG compiled.")

                    # Update current active nodes
                    if 'nodes' in payload:
                        await conn.execute("DELETE FROM pipeline_nodes WHERE pipeline_id = $1", p_uuid)
                        node_id_map = {}
                        nodes_to_insert = []
                        for i, node in enumerate(payload['nodes']):
                            original_id = node.get("id")
                            try:
                                node_uuid = uuid.UUID(original_id) if original_id else uuid.uuid4()
                            except (ValueError, TypeError):
                                node_uuid = uuid.uuid4()
                            
                            if original_id:
                                node_id_map[str(original_id)] = node_uuid
                            
                            nodes_to_insert.append((
                                node_uuid, p_uuid, node['node_type'], node['label'], 
                                json.dumps(node.get('config_json', {})), node.get('position_x', 0), 
                                node.get('position_y', 0), i
                            ))

                        if nodes_to_insert:
                            await conn.executemany(
                                "INSERT INTO pipeline_nodes (id, pipeline_id, node_type, label, config_json, position_x, position_y, order_index) "
                                "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
                                nodes_to_insert
                            )

                    if 'edges' in payload:
                        await conn.execute("DELETE FROM pipeline_edges WHERE pipeline_id = $1", p_uuid)
                        edge_data = []
                        for edge in payload['edges']:
                            s_id = str(edge.get("source_node_id"))
                            t_id = str(edge.get("target_node_id"))
                            
                            s_uuid = node_id_map.get(s_id)
                            t_uuid = node_id_map.get(t_id)
                            
                            if not s_uuid:
                                 try: s_uuid = uuid.UUID(s_id)
                                 except: continue
                            if not t_uuid:
                                 try: t_uuid = uuid.UUID(t_id)
                                 except: continue

                            edge_data.append((p_uuid, s_uuid, t_uuid))

                        if edge_data:
                            await conn.executemany(
                                "INSERT INTO pipeline_edges (pipeline_id, source_node_id, target_node_id) "
                                "VALUES ($1, $2, $3)",
                                edge_data
                            )

                p_row = await conn.fetchrow("SELECT * FROM pipelines WHERE id = $1", p_uuid)
                return dict(p_row) if p_row else {}

    async def list_versions(self, pipeline_id: str) -> List[Dict[str, Any]]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM pipeline_versions WHERE pipeline_id = $1 ORDER BY version_number DESC",
                uuid.UUID(pipeline_id)
            )
            return [dict(r) for r in rows]

    async def export_all_data(self) -> Dict[str, Any]:
        async with self.pool.acquire() as conn:
            pipelines = await conn.fetch("SELECT * FROM pipelines")
            nodes = await conn.fetch("SELECT * FROM pipeline_nodes")
            edges = await conn.fetch("SELECT * FROM pipeline_edges")
            return {
                "pipelines": [dict(r) for r in pipelines],
                "nodes": [dict(r) for r in nodes],
                "edges": [dict(r) for r in edges]
            }

    async def delete_pipeline(self, pipeline_id: str):
        async with self.pool.acquire() as conn:
            # Cascade delete should handle nodes/edges if schema is set up correctly
            await conn.execute("DELETE FROM pipelines WHERE id = $1", uuid.UUID(pipeline_id))

    async def duplicate_pipeline(self, pipeline_id: str):
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            return None
        
        # Strip IDs and modify name
        new_payload = {
            "pipeline": {
                "name": f"{pipeline['name']} (copy)",
                "description": pipeline.get("description"),
                "environment": pipeline.get("environment")
            },
            "nodes": [ {k: v for k, v in n.items() if k not in ["id", "pipeline_id", "created_at", "updated_at"]} for n in pipeline.get("pipeline_nodes", [])],
            "edges": [ {k: v for k, v in e.items() if k not in ["id", "pipeline_id", "created_at", "updated_at"]} for e in pipeline.get("pipeline_edges", [])]
        }
        return await self.create_pipeline(new_payload)

    async def list_worker_jobs(self, run_id: str) -> List[Dict[str, Any]]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM astra_worker_queue WHERE run_id = $1", uuid.UUID(run_id))
            return [dict(r) for r in rows]

    async def get_run_logs(self, run_id: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        async with self.pool.acquire() as conn:
            query = "SELECT * FROM public.pipeline_logs WHERE run_id = $1"
            params = [uuid.UUID(run_id)]
            # Add filtering if needed
            query += " ORDER BY timestamp ASC"
            rows = await conn.fetch(query, *params)
            return [dict(r) for r in rows]

    async def list_all_nodes(self) -> List[Dict[str, Any]]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM pipeline_nodes ORDER BY order_index")
            return [dict(r) for r in rows]

    async def create_trigger(self, parent_id: str, child_id: str, trigger_type: str = 'on_success'):
        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO pipeline_triggers (parent_pipeline_id, child_pipeline_id, trigger_type) "
                "VALUES ($1, $2, $3) ON CONFLICT (parent_pipeline_id, child_pipeline_id) DO UPDATE SET trigger_type = $3",
                uuid.UUID(parent_id), uuid.UUID(child_id), trigger_type
            )

    async def check_and_trigger_children(self, parent_pipeline_id: str, run_status: str):
        """Checks for child pipelines that should be triggered based on parent success/failure."""
        async with self.pool.acquire() as conn:
            # Find triggers matching the status
            trigger_map = {
                'completed': 'on_success',
                'failed': 'on_failure'
            }
            ttype = trigger_map.get(run_status)
            if not ttype:
                return []

            rows = await conn.fetch(
                "SELECT child_pipeline_id FROM pipeline_triggers WHERE parent_pipeline_id = $1 AND trigger_type = $2 AND is_active = true",
                uuid.UUID(parent_pipeline_id), ttype
            )
            return [str(r['child_pipeline_id']) for r in rows]

    async def validate_pipeline(self, pipeline_id: str) -> Dict[str, Any]:
        """Performs pre-flight checks on a pipeline configuration."""
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            return {"valid": False, "errors": [{"field": "pipeline", "message": "Pipeline not found", "severity": "error"}]}

        errors = []
        warnings = []
        
        # DAG Integrity Check
        node_ids = [str(n.get("id")) for n in pipeline.get("pipeline_nodes", [])]
        edge_list = [{"parent_task_id": str(e.get("source_node_id")), "child_task_id": str(e.get("target_node_id"))} for e in pipeline.get("pipeline_edges", [])]
        if not DAGValidator.validate(node_ids, edge_list):
            errors.append({"field": "dag", "message": "Circular dependency detected", "severity": "error"})

        # 1. Identify Source & Destination connections from nodes
        nodes = pipeline.get("pipeline_nodes", [])
        source_nodes = [n for n in nodes if (n.get("node_type") or "").lower() in ("extract", "source")]
        dest_nodes = [n for n in nodes if (n.get("node_type") or "").lower() in ("load", "destination")]
        
        async def check_node_connection(node, errors):
            cfg = node["config_json"]
            if isinstance(cfg, str):
                try: 
                    cfg = json.loads(cfg)
                except: 
                    cfg = {}
            elif not isinstance(cfg, dict):
                cfg = {}

            # Check for both connection_id (Source) and target_connection_id (Load)
            conn_id = cfg.get("connection_id") or cfg.get("target_connection_id")
            node_id = str(node.get("id") or "unknown")
            
            if not conn_id:
                errors.append({"node_id": node_id, "field": "connection", "message": "Connection not configured", "severity": "error"})
                return
            
            conn_data = await self.connection_service.get_connection(conn_id)
            if not conn_data:
                errors.append({"node_id": node_id, "field": "connection", "message": f"Connection {conn_id} not found", "severity": "error"})
            else:
                try:
                    health = await self.connection_service.test_connection({**conn_data, "id": conn_id})
                    if not health["success"]:
                        errors.append({"node_id": node_id, "field": "connection", "message": f"Connection unreachable: {health.get('error')}", "severity": "error"})
                except Exception as e:
                    errors.append({"node_id": node_id, "field": "connection", "message": f"Internal error during health check: {str(e)}", "severity": "error"})

        # Parallel health checks
        check_tasks = []
        for node in source_nodes + dest_nodes:
            check_tasks.append(check_node_connection(node, errors))
            
        if check_tasks:
            await asyncio.gather(*check_tasks)

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "dag": {"nodes": len(pipeline.get("pipeline_nodes", [])), "edges": len(pipeline.get("pipeline_edges", []))}
        }
