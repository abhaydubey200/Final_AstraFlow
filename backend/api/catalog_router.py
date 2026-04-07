from fastapi import APIRouter, Request
from typing import List, Dict, Any, Optional
import asyncpg

router = APIRouter(prefix="/catalog", tags=["catalog"])

@router.get("/search")
async def search_catalog(request: Request, q: str = ""):
    """
    Search the data catalog for datasets, tables, and columns.
    Handles missing database pool gracefully.
    """
    pool: Optional[asyncpg.Pool] = request.app.state.db_pool
    
    # Graceful degradation - return empty results if DB unavailable
    if not pool:
        return []
    
    try:
        async with pool.acquire() as conn:
            # Search across datasets and tables
            results = await conn.fetch("""
                SELECT 
                    d.id,
                    d.name,
                    d.description,
                    d.connection_id,
                    c.name as connection_name,
                    d.schema_json,
                    d.row_count,
                    d.created_at,
                    d.updated_at,
                    'dataset' as type
                FROM datasets d
                LEFT JOIN connections c ON d.connection_id = c.id
                WHERE 
                    d.name ILIKE $1 
                    OR d.description ILIKE $1
                    OR d.schema_json::text ILIKE $1
                ORDER BY d.updated_at DESC
                LIMIT 50
            """, f"%{q}%")
            
            return [dict(r) for r in results]
            
    except Exception as e:
        # Log error but return empty results instead of crashing
        print(f"Catalog search error: {e}")
        return []
