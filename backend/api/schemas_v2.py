"""
Enhanced Pydantic schemas for request/response validation.
Provides type safety and automatic validation for all API endpoints.
"""
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


# ================== Enums ==================

class PipelineStatus(str, Enum):
    """Pipeline status enumeration."""
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"


class RunStatus(str, Enum):
    """Pipeline run status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ConnectionType(str, Enum):
    """Connection type enumeration."""
    POSTGRES = "postgres"
    MYSQL = "mysql"
    MSSQL = "mssql"
    SNOWFLAKE = "snowflake"
    BIGQUERY = "bigquery"
    REDSHIFT = "redshift"


# ================== Pipeline Schemas ==================

class PipelineNodeBase(BaseModel):
    """Base schema for pipeline nodes."""
    node_type: str = Field(..., min_length=1, max_length=50)
    label: str = Field(..., min_length=1, max_length=255)
    position_x: int = Field(default=0)
    position_y: int = Field(default=0)
    config_json: Dict[str, Any] = Field(default_factory=dict)


class PipelineEdgeBase(BaseModel):
    """Base schema for pipeline edges."""
    source_node_id: str = Field(..., min_length=1)
    target_node_id: str = Field(..., min_length=1)


class PipelineCreate(BaseModel):
    """Schema for creating a new pipeline."""
    model_config = ConfigDict(str_strip_whitespace=True)
    
    name: str = Field(..., min_length=1, max_length=255, description="Pipeline name")
    description: Optional[str] = Field(None, max_length=1000, description="Pipeline description")
    status: PipelineStatus = Field(default=PipelineStatus.DRAFT)
    schedule: Optional[str] = Field(None, max_length=100, description="Cron schedule")
    config: Dict[str, Any] = Field(default_factory=dict, description="Pipeline configuration")
    nodes: List[PipelineNodeBase] = Field(default_factory=list)
    edges: List[PipelineEdgeBase] = Field(default_factory=list)
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate pipeline name."""
        if not v or not v.strip():
            raise ValueError("Pipeline name cannot be empty")
        return v.strip()
    
    @field_validator('schedule')
    @classmethod
    def validate_schedule(cls, v: Optional[str]) -> Optional[str]:
        """Validate cron schedule format."""
        if v and v.strip():
            # Basic validation - you can add more sophisticated cron validation
            parts = v.strip().split()
            if len(parts) not in [5, 6]:
                raise ValueError("Invalid cron schedule format")
        return v


class PipelineUpdate(BaseModel):
    """Schema for updating an existing pipeline."""
    model_config = ConfigDict(str_strip_whitespace=True)
    
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    status: Optional[PipelineStatus] = None
    schedule: Optional[str] = Field(None, max_length=100)
    config: Optional[Dict[str, Any]] = None
    nodes: Optional[List[PipelineNodeBase]] = None
    edges: Optional[List[PipelineEdgeBase]] = None


class PipelineResponse(BaseModel):
    """Schema for pipeline response."""
    id: str
    name: str
    description: Optional[str]
    status: str
    schedule: Optional[str]
    created_at: datetime
    updated_at: datetime
    config: Optional[Dict[str, Any]] = None


# ================== Connection Schemas ==================

class ConnectionConfigBase(BaseModel):
    """Base schema for connection configuration."""
    host: Optional[str] = Field(None, max_length=255)
    port: Optional[int] = Field(None, ge=1, le=65535)
    database: Optional[str] = Field(None, max_length=255)
    user: Optional[str] = Field(None, max_length=255)
    # password is handled separately through secret service


class PostgresConfig(ConnectionConfigBase):
    """PostgreSQL connection configuration."""
    ssl_mode: Optional[str] = Field(default="prefer")
    
    @field_validator('port')
    @classmethod
    def validate_port(cls, v: Optional[int]) -> Optional[int]:
        """Set default PostgreSQL port."""
        return v or 5432


class MySQLConfig(ConnectionConfigBase):
    """MySQL connection configuration."""
    charset: Optional[str] = Field(default="utf8mb4")
    
    @field_validator('port')
    @classmethod
    def validate_port(cls, v: Optional[int]) -> Optional[int]:
        """Set default MySQL port."""
        return v or 3306


class SnowflakeConfig(BaseModel):
    """Snowflake connection configuration."""
    account: str = Field(..., min_length=1, max_length=255)
    user: str = Field(..., min_length=1, max_length=255)
    warehouse: str = Field(..., min_length=1, max_length=255)
    database: str = Field(..., min_length=1, max_length=255)
    schema: Optional[str] = Field(default="PUBLIC")
    role: Optional[str] = None


class ConnectionCreate(BaseModel):
    """Schema for creating a new connection."""
    model_config = ConfigDict(str_strip_whitespace=True)
    
    name: str = Field(..., min_length=1, max_length=255, description="Connection name")
    type: ConnectionType = Field(..., description="Connection type")
    description: Optional[str] = Field(None, max_length=1000)
    config: Dict[str, Any] = Field(..., description="Connection configuration")
    password: Optional[str] = Field(None, description="Connection password (will be encrypted)")
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate connection name."""
        if not v or not v.strip():
            raise ValueError("Connection name cannot be empty")
        # Remove special characters that could cause issues
        invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*']
        if any(char in v for char in invalid_chars):
            raise ValueError(f"Connection name cannot contain: {', '.join(invalid_chars)}")
        return v.strip()


class ConnectionUpdate(BaseModel):
    """Schema for updating an existing connection."""
    model_config = ConfigDict(str_strip_whitespace=True)
    
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    config: Optional[Dict[str, Any]] = None
    password: Optional[str] = None


class ConnectionResponse(BaseModel):
    """Schema for connection response."""
    id: str
    name: str
    type: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    # config is excluded for security (passwords)


# ================== Pipeline Run Schemas ==================

class TriggerRunRequest(BaseModel):
    """Schema for triggering a pipeline run."""
    config_override: Optional[Dict[str, Any]] = Field(default=None, description="Override pipeline config")
    
    @field_validator('config_override')
    @classmethod
    def validate_config(cls, v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Validate config override."""
        if v and not isinstance(v, dict):
            raise ValueError("config_override must be a dictionary")
        return v


class RunResponse(BaseModel):
    """Schema for pipeline run response."""
    id: str
    pipeline_id: str
    status: str
    start_time: datetime
    end_time: Optional[datetime]
    rows_processed: int = 0
    error_message: Optional[str] = None


# ================== Common Schemas ==================

class HealthCheckResponse(BaseModel):
    """Schema for health check response."""
    status: str = Field(default="healthy")
    version: str
    timestamp: datetime
    checks: Dict[str, bool] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    """Schema for error responses."""
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime
    
    
class PaginationParams(BaseModel):
    """Schema for pagination parameters."""
    limit: int = Field(default=50, ge=1, le=100, description="Number of items to return")
    offset: int = Field(default=0, ge=0, description="Number of items to skip")
    
    
class BulkDeleteRequest(BaseModel):
    """Schema for bulk delete operations."""
    ids: List[str] = Field(..., min_length=1, max_length=100, description="List of IDs to delete")
    
    @field_validator('ids')
    @classmethod
    def validate_ids(cls, v: List[str]) -> List[str]:
        """Validate ID list."""
        if not v:
            raise ValueError("At least one ID must be provided")
        if len(v) > 100:
            raise ValueError("Cannot delete more than 100 items at once")
        # Remove duplicates
        return list(set(v))
