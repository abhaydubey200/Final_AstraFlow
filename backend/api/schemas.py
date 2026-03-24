from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from uuid import UUID

class SourceNodeConfig(BaseModel):
    connection_id: Optional[str] = None
    source_warehouse: Optional[str] = None
    source_database: Optional[str] = None
    source_schema: Optional[str] = None
    source_table: Optional[str] = None
    source_mode: Optional[str] = "table"
    sql_query: Optional[str] = None
    file_path: Optional[str] = None
    storage_bucket: Optional[str] = None
    file_format: Optional[str] = "csv"
    extraction_mode: Optional[str] = "full_load"

class LoadNodeConfig(BaseModel):
    target_connection_id: Optional[str] = None
    target_warehouse: Optional[str] = None
    target_database: Optional[str] = None
    target_schema: Optional[str] = None
    target_table: Optional[str] = None
    load_mode: Optional[str] = "existing"
    new_table_name: Optional[str] = None
    write_mode: Optional[str] = "append"

class TransformNodeConfig(BaseModel):
    transform_mode: Optional[str] = "sql"
    logic: Optional[str] = None

class NodeSchema(BaseModel):
    id: Optional[str] = None
    node_type: str
    label: str
    config_json: Dict[str, Any] = Field(default_factory=dict)
    position_x: float = 0
    position_y: float = 0
    order_index: int = 0

class PipelineTaskRunResponse(BaseModel):
    id: UUID
    pipeline_run_id: UUID
    node_id: UUID
    status: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    retry_count: int = Field(default=0, ge=0)
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

class PipelineCheckpointResponse(BaseModel):
    task_id: UUID
    last_processed_offset: Optional[str] = None
    status: str

    class Config:
        from_attributes = True

class EdgeSchema(BaseModel):
    source_node_id: str
    target_node_id: str

class PipelineCreate(BaseModel):
    pipeline: Dict[str, Any]
    nodes: List[NodeSchema]
    edges: List[EdgeSchema]

class PipelineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    schedule_type: Optional[str] = None
    schedule_config: Optional[Dict[str, Any]] = None
    nodes: Optional[List[NodeSchema]] = None
    edges: Optional[List[EdgeSchema]] = None

class PipelineRunTrigger(BaseModel):
    source: Optional[Dict[str, Any]] = None
    destination: Optional[Dict[str, Any]] = None

class PipelineResponse(BaseModel):
    id: UUID
    name: str
    status: str
    environment: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    pipeline_nodes: List[Dict[str, Any]] = []
    pipeline_edges: List[Dict[str, Any]] = []

    class Config:
        from_attributes = True

class PipelineRunResponse(BaseModel):
    id: UUID
    pipeline_id: UUID
    status: str
    environment: str
    start_time: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    end_time: Optional[datetime] = None # Alias for finished_at to match frontend
    rows_processed: int = Field(default=0, ge=0)
    last_successful_stage: Optional[str] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True
