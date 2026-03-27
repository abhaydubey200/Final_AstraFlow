import asyncio
import os
import uuid
import sys
from datetime import datetime
from dotenv import load_dotenv

# Add backend to path
BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.append(BASE_DIR)

def run_phase_1(supabase):
    print("\n--- Phase 1: API Connectivity ---")
    try:
        res = supabase.table("pipelines").select("id").limit(1).execute()
        print(f"OK: Connection Stable. Fetched {len(res.data)} pipelines.")
        return True
    except Exception as e:
        print(f"ERR: Connection Failed: {e}")
        return False

def run_phase_2(supabase):
    print("\n--- Phase 2: Write -> Read -> Delete ---")
    test_id = str(uuid.uuid4())
    try:
        # Insert
        print(f"Testing write with test_id: {test_id}")
        supabase.table("pipelines").insert({
            "id": test_id,
            "name": "audit_health_check_test",
            "owner_id": "00000000-0000-0000-0000-000000000000",
            "status": "active"
        }).execute()
        print("OK: Insert Success.")

        # Read
        read_res = supabase.table("pipelines").select("*").eq("id", test_id).execute()
        if read_res.data and read_res.data[0]['id'] == test_id:
            print("OK: Read Success.")
        else:
            print("ERR: Read Failed or record not found.")

        # Delete
        supabase.table("pipelines").delete().eq("id", test_id).execute()
        print("OK: Delete Success.")
        return True
    except Exception as e:
        print(f"ERR: CRUD Test Failed: {e}")
        return False

async def main():
    print("AstraFlow Supabase SDK Audit")
    
    # Delayed import
    try:
        from core.supabase_client import supabase
        print("OK: Supabase client initialized.")
    except Exception as e:
        print(f"ERR: Failed to initialize Supabase client: {e}")
        return

    run_phase_1(supabase)
    run_phase_2(supabase)

    print("\n--- Phase 3: Service Layer Test ---")
    try:
        from services.pipeline_service import PipelineService
        ps = PipelineService()
        print("OK: PipelineService initialized.")
    except Exception as e:
        print(f"ERR: Service Init Failed: {e}")

    print("\nAudit Finalized.")

if __name__ == "__main__":
    load_dotenv()
    asyncio.run(main())
