import os
import uuid
import json
import asyncio
import logging
from typing import List, Dict, Any, Optional

from core.supabase_client import supabase, supabase_logger
from core.decorators import safe_execute
from core.data_utils import cached_supabase_call, limiter, invalidate_cache
from core.dag_validator import DAGValidator

class PipelineService:
    def __init__(self, pool: Any = None):
        # pool is deprecated, all calls use HTTPS SDK
        self.supabase = supabase

    @safe_execute()
    async def log_event(self, run_id: str, pipeline_id: str, stage: str, message: str, level: str = 'INFO', metadata: Dict[str, Any] = None):
        """Records a structured log entry in the database (Phase 11)."""
        payload = {
            "run_id": run_id,
            "pipeline_id": pipeline_id,
            "stage": stage,
            "log_level": level,
            "message": message,
            "metadata": metadata or {}
        }
        self.supabase.table("pipeline_logs").insert(payload).execute()
        # No need for manual logs if using service role

    @supabase_logger
    async def create_pipeline(self, payload: Dict[str, Any], **kwargs):
        """Creates a pipeline, its nodes, and initial version via SDK."""
        pipeline = payload.get("pipeline", {})
        nodes = payload.get("nodes", [])
        edges = payload.get("edges", [])
        
        # 0. Validate DAG Integrity
        node_ids = [str(n.get("id")) for n in nodes if n.get("id")]
        for i, node in enumerate(nodes):
            if not node.get("id"):
                node["id"] = f"temp_{i}"
                node_ids.append(node["id"])
        
        edge_list = [{"parent_task_id": str(e.get("source_node_id")), "child_task_id": str(e.get("target_node_id"))} for e in edges]
        if not DAGValidator.validate(node_ids, edge_list):
            raise ValueError("Circular dependency detected in pipeline DAG")

        # 1. Insert Pipeline
        p_res = self.supabase.table("pipelines").insert({
            "name": pipeline.get("name"),
            "status": "draft",
            "environment": pipeline.get("environment", "dev"),
            "description": pipeline.get("description"),
            "execution_mode": pipeline.get("execution_mode", "linear")
        }).execute()
        
        pipeline_id = p_res.data[0]['id']
        
        # 2. Insert Nodes
        node_id_map = {}
        nodes_to_insert = []
        for i, node in enumerate(nodes):
            node_uuid = str(uuid.uuid4())
            original_id = node.get("id")
            if original_id:
                node_id_map[str(original_id)] = node_uuid
            
            nodes_to_insert.append({
                "id": node_uuid,
                "pipeline_id": pipeline_id,
                "node_type": node.get("node_type"),
                "label": node.get("label"),
                "config_json": node.get("config_json", {}),
                "position_x": node.get("position_x", 0),
                "position_y": node.get("position_y", 0),
                "order_index": i
            })

        if nodes_to_insert:
            self.supabase.table("pipeline_nodes").insert(nodes_to_insert).execute()
        
        # 3. Insert Edges
        if edges:
            edge_data = []
            for edge in edges:
                s_uuid = node_id_map.get(str(edge.get("source_node_id")))
                t_uuid = node_id_map.get(str(edge.get("target_node_id")))
                if s_uuid and t_uuid:
                    edge_data.append({
                        "pipeline_id": pipeline_id,
                        "source_node_id": s_uuid,
                        "target_node_id": t_uuid
                    })
            if edge_data:
                self.supabase.table("pipeline_edges").insert(edge_data).execute()
        
        # 4. Initial Version
        self.supabase.table("pipeline_versions").insert({
            "pipeline_id": pipeline_id,
            "version_number": 1,
            "dag_json": {"nodes": nodes, "edges": edges}
        }).execute()
        
        # 4. Initial Version
        self.supabase.table("pipeline_versions").insert({
            "pipeline_id": pipeline_id,
            "version_number": 1,
            "dag_json": {"nodes": nodes, "edges": edges}
        }).execute()
        
        # Phase 8: Manual Cache Invalidation
        invalidate_cache("list_pipelines")
        
        return {"id": str(pipeline_id), "status": "created"}

    @safe_execute()
    async def compile_dag(self, pipeline_id: str, nodes: List[Dict], edges: List[Dict]):
        """Translates visual nodes and edges into executable tasks (Phase 2 Migration)."""
        type_mapping = {
            "source": "EXTRACT", "extract": "EXTRACT", "load": "LOAD", "destination": "LOAD",
            "transform": "SQL", "validate": "VALIDATION", "filter": "SQL", "join": "SQL", "aggregate": "SQL"
        }
        
        # 1. Clear existing tasks and dependencies
        self.supabase.table("pipeline_tasks").delete().eq("pipeline_id", pipeline_id).execute()
        self.supabase.table("pipeline_dependencies").delete().eq("pipeline_id", pipeline_id).execute()
        
        # 2. Create Tasks
        tasks_to_insert = []
        node_to_task_name = {}
        for node in nodes:
            node_id = str(node.get("id"))
            task_name = node.get("label", "Unnamed Task")
            node_to_task_name[node_id] = task_name
            
            task_type = type_mapping.get(node.get("node_type", "").lower(), "SQL")
            config = node.get("config_json", {})
            if isinstance(config, str):
                try: config = json.loads(config)
                except: config = {}
            
            if node.get("connection_id"):
                config["connection_id"] = node["connection_id"]
            if not config.get("table_name"):
                config["table_name"] = node.get("table_name") or node.get("source_table") or node.get("target_table")
            
            tasks_to_insert.append({
                "pipeline_id": pipeline_id,
                "task_name": task_name,
                "task_type": task_type,
                "config_json": config
            })
            
        if tasks_to_insert:
            t_res = self.supabase.table("pipeline_tasks").insert(tasks_to_insert).execute()
            
            # Map task names to generated IDs
            task_map = {r['task_name']: r['id'] for r in t_res.data}
            
            # 3. Insert Dependencies
            edge_data = []
            for edge in edges:
                s_id = str(edge.get("source_node_id"))
                t_id = str(edge.get("target_node_id"))
                
                s_name = node_to_task_name.get(s_id)
                t_name = node_to_task_name.get(t_id)
                
                if s_name and t_name and s_name in task_map and t_name in task_map:
                    edge_data.append({
                        "pipeline_id": pipeline_id,
                        "parent_task_id": task_map[s_name],
                        "child_task_id": task_map[t_name]
                    })
            if edge_data:
                self.supabase.table("pipeline_dependencies").insert(edge_data).execute()

    @safe_execute()
    async def create_run(self, pipeline_id: str, status: str = "pending", environment: Optional[str] = None) -> Dict[str, Any]:
        """Creates a new pipeline_run record (Phase 2 Migration)."""
        if not environment:
            # Fetch env from pipeline
            env_res = self.supabase.table("pipelines").select("environment").eq("id", pipeline_id).execute()
            environment = env_res.data[0]['environment'] if env_res.data else 'dev'

        run_res = self.supabase.table("pipeline_runs").insert({
            "pipeline_id": pipeline_id,
            "status": status,
            "environment": environment
        }).execute()

        if not run_res.data:
            raise RuntimeError("Failed to create pipeline run")

        run_id = run_res.data[0]['id']

        # Initialize task runs for all nodes
        nodes_res = self.supabase.table("pipeline_nodes").select("id").eq("pipeline_id", pipeline_id).execute()
        if nodes_res.data:
            task_runs = [{"pipeline_run_id": run_id, "node_id": node['id'], "status": "pending"} for node in nodes_res.data]
            self.supabase.table("pipeline_task_runs").insert(task_runs).execute()

        return {"id": str(run_id), "status": status, "environment": environment}

    @safe_execute()
    async def list_runs(self, pipeline_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Phase 2 Migration: List runs."""
        query = self.supabase.table("pipeline_runs").select("*")
        if pipeline_id:
            query = query.eq("pipeline_id", pipeline_id)
        res = query.order("start_time", desc=True).execute()
        return res.data

    @safe_execute()
    async def list_run_tasks(self, run_id: str) -> List[Dict[str, Any]]:
        """Phase 2 Migration: List task runs for a given execution."""
        res = self.supabase.table("pipeline_task_runs").select("*").eq("pipeline_run_id", run_id).order("start_time", asc=True).execute()
        return res.data

    @safe_execute()
    async def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Phase 2 Migration: Get single run."""
        res = self.supabase.table("pipeline_runs").select("*").eq("id", run_id).execute()
        return res.data[0] if res.data else None

    @cached_supabase_call(ttl=60)
    @safe_execute()
    @supabase_logger
    async def list_pipelines(self, limit: int = 50, offset: int = 0):
        """Lists pipelines with standard 60s caching (Phase 8)."""
        res = self.supabase.table("pipelines")\
            .select("*")\
            .order("updated_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
        return res.data

    @safe_execute()
    async def get_pipeline(self, pipeline_id: str) -> Optional[Dict[str, Any]]:
        """Phase 2 Migration: Get pipeline with nodes & edges."""
        p_res = self.supabase.table("pipelines").select("*").eq("id", pipeline_id).execute()
        if not p_res.data:
            return None
            
        pipeline = p_res.data[0]
        n_res = self.supabase.table("pipeline_nodes").select("*").eq("pipeline_id", pipeline_id).order("order_index").execute()
        e_res = self.supabase.table("pipeline_edges").select("*").eq("pipeline_id", pipeline_id).execute()
        
        pipeline["pipeline_nodes"] = n_res.data
        pipeline["pipeline_edges"] = e_res.data
        return pipeline

    @safe_execute()
    async def update_pipeline(self, pipeline_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Phase 2 Migration: Update pipeline with versioning."""
        # 1. Update metadata
        update_data = {}
        for key in ['name', 'description', 'status', 'schedule_type', 'schedule_config', 'execution_mode']:
            if key in payload:
                update_data[key] = payload[key]
        
        if update_data:
            update_data["updated_at"] = "now()"
            self.supabase.table("pipelines").update(update_data).eq("id", pipeline_id).execute()

        # 2. Update nodes and edges if provided
        if 'nodes' in payload or 'edges' in payload:
            # Create new version record
            v_res = self.supabase.table("pipeline_versions").select("version_number").eq("pipeline_id", pipeline_id).order("version_number", desc=True).limit(1).execute()
            current_v = v_res.data[0]['version_number'] if v_res.data else 0
            
            self.supabase.table("pipeline_versions").insert({
                "pipeline_id": pipeline_id,
                "version_number": current_v + 1,
                "dag_json": {
                    "nodes": payload.get('nodes', []),
                    "edges": payload.get('edges', [])
                }
            }).execute()

            # Update current active nodes
            if 'nodes' in payload:
                self.supabase.table("pipeline_nodes").delete().eq("pipeline_id", pipeline_id).execute()
                nodes_to_insert = []
                for i, node in enumerate(payload['nodes']):
                    nodes_to_insert.append({
                        "pipeline_id": pipeline_id,
                        "node_type": node['node_type'],
                        "label": node['label'],
                        "config_json": node.get('config_json', {}),
                        "position_x": node.get('position_x', 0),
                        "position_y": node.get('position_y', 0),
                        "order_index": i
                    })
                if nodes_to_insert:
                    self.supabase.table("pipeline_nodes").insert(nodes_to_insert).execute()

            if 'edges' in payload:
                self.supabase.table("pipeline_edges").delete().eq("pipeline_id", pipeline_id).execute()
                edge_data = []
                for edge in payload['edges']:
                    edge_data.append({
                        "pipeline_id": pipeline_id,
                        "source_node_id": edge.get("source_node_id"),
                        "target_node_id": edge.get("target_node_id")
                    })
                if edge_data:
                    self.supabase.table("pipeline_edges").insert(edge_data).execute()

        # Phase 8: Invalidate Cache
        invalidate_cache("list_pipelines")
        
        res = self.supabase.table("pipelines").select("*").eq("id", pipeline_id).execute()
        return res.data[0] if res.data else {}

    @safe_execute()
    async def list_versions(self, pipeline_id: str) -> List[Dict[str, Any]]:
        """Phase 2 Migration: List versions."""
        res = self.supabase.table("pipeline_versions").select("*").eq("pipeline_id", pipeline_id).order("version_number", desc=True).execute()
        return res.data

    @safe_execute()
    async def export_all_data(self) -> Dict[str, Any]:
        """Phase 2 Migration: Export metadata."""
        p = self.supabase.table("pipelines").select("*").execute()
        n = self.supabase.table("pipeline_nodes").select("*").execute()
        e = self.supabase.table("pipeline_edges").select("*").execute()
        return {
            "pipelines": p.data,
            "nodes": n.data,
            "edges": e.data
        }

    @safe_execute()
    async def delete_pipeline(self, pipeline_id: str):
        """Phase 2 Migration: Delete pipeline."""
        self.supabase.table("pipelines").delete().eq("id", pipeline_id).execute()
        invalidate_cache("list_pipelines")

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

    @safe_execute()
    async def list_worker_jobs(self, run_id: str) -> List[Dict[str, Any]]:
        """Phase 2 Migration: List worker jobs."""
        res = self.supabase.table("astra_worker_queue").select("*").eq("run_id", run_id).execute()
        return res.data

    @safe_execute()
    async def get_run_logs(self, run_id: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Phase 2 Migration: Get run logs."""
        res = self.supabase.table("pipeline_logs").select("*").eq("run_id", run_id).order("timestamp", asc=True).execute()
        return res.data

    async def get_logs(self, run_id: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Alias for get_run_logs for API consistency across services."""
        return await self.get_run_logs(run_id, filters)

    @safe_execute()
    async def list_all_nodes(self) -> List[Dict[str, Any]]:
        """Phase 2 Migration: List all nodes."""
        res = self.supabase.table("pipeline_nodes").select("*").order("order_index").execute()
        return res.data

    @safe_execute()
    async def create_trigger(self, parent_id: str, child_id: str, trigger_type: str = 'on_success'):
        """Phase 2 Migration: Upsert trigger."""
        self.supabase.table("pipeline_triggers").upsert({
            "parent_pipeline_id": parent_id,
            "child_pipeline_id": child_id,
            "trigger_type": trigger_type
        }).execute()

    @safe_execute()
    async def check_and_trigger_children(self, parent_pipeline_id: str, run_status: str):
        """Phase 2 Migration: Check and trigger children."""
        trigger_map = {'completed': 'on_success', 'failed': 'on_failure'}
        ttype = trigger_map.get(run_status)
        if not ttype: return []

        res = self.supabase.table("pipeline_triggers")\
            .select("child_pipeline_id")\
            .eq("parent_pipeline_id", parent_pipeline_id)\
            .eq("trigger_type", ttype)\
            .eq("is_active", True)\
            .execute()
        return [str(r['child_pipeline_id']) for r in res.data]

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
