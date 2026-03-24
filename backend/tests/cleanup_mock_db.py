import asyncio
import os
import asyncpg
from dotenv import load_dotenv

async def cleanup():
    load_dotenv()
    os.environ["USE_MOCK_DB"] = "true"
    # In mock mode, this will use the mock_db and mock_store.json
    try:
        import mock_db
        from core.database import db_manager
        await db_manager.connect()
        async with db_manager.pool.acquire() as conn:
            print("Cleaning Mock DB tables...")
            await conn.execute("DELETE FROM public.task_runs")
            await conn.execute("DELETE FROM public.pipeline_runs")
            await conn.execute("DELETE FROM public.staging_files")
            await conn.execute("DELETE FROM public.pipeline_logs")
            await conn.execute("DELETE FROM public.astra_worker_queue")
            # We don't delete pipelines/nodes/edges to keep definitions, 
            # but the load test creates new ones anyway.
            print("Cleanup complete.")
        await db_manager.disconnect()
    except Exception as e:
        print(f"Cleanup failed: {e}")

if __name__ == "__main__":
    asyncio.run(cleanup())
