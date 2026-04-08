from fastapi import Request
import asyncpg
from typing import AsyncGenerator
from services.analytics_service import AnalyticsService
from services.ai_insight_service import AIInsightService
from services.validation_service import ValidationService
from services.lineage_service import LineageService
from services.pipeline_service import PipelineService
from services.worker_service import WorkerService
from services.connection_service import ConnectionService
from services.metadata_service import MetadataService
from services.cost_service import CostService
from services.governance_service import GovernanceService


async def get_db(request: Request) -> AsyncGenerator[asyncpg.Connection, None]:
    """Dependency that yields a database connection from the global pool."""
    pool: asyncpg.Pool = request.app.state.db_pool
    async with pool.acquire() as connection:
        yield connection


async def get_analytics_service(request: Request) -> AnalyticsService:
    return AnalyticsService(request.app.state.db_pool)


async def get_ai_insight_service(request: Request) -> AIInsightService:
    return AIInsightService(request.app.state.db_pool)


async def get_validation_service(request: Request) -> ValidationService:
    return ValidationService(request.app.state.db_pool)


async def get_lineage_service(request: Request) -> LineageService:
    return LineageService(request.app.state.db_pool)


async def get_pipeline_service(request: Request) -> PipelineService:
    return PipelineService(request.app.state.db_pool)


async def get_worker_service(request: Request) -> WorkerService:
    return WorkerService(request.app.state.db_pool)


async def get_connection_service(request: Request) -> ConnectionService:
    return ConnectionService()


async def get_metadata_service(request: Request) -> MetadataService:
    return MetadataService(request.app.state.db_pool)


async def get_cost_service(request: Request) -> CostService:
    return CostService(request.app.state.db_pool)


async def get_governance_service(request: Request) -> GovernanceService:
    return GovernanceService(request.app.state.db_pool)
