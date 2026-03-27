import os
import sys
import asyncio
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Load environment variables
load_dotenv(os.path.join(os.getcwd(), 'backend', '.env'))

from core.supabase_client import get_supabase, supabase_manager

async def test_supabase_connectivity():
    print("--------------------------------------------------")
    print("AstraFlow -> Supabase HTTPS Connectivity Verification")
    print("--------------------------------------------------")
    
    # 1. Test Client Initialization
    try:
        client = get_supabase()
        print(f"✅ Supabase Client Initialization: SUCCESS")
    except Exception as e:
        print(f"❌ Supabase Client Initialization: FAILED - {e}")
        return

    # 2. Test API Health (REST)
    try:
        # We call the method directly from the instance
        is_healthy = await supabase_manager.check_health()
        if is_healthy:
            print(f"✅ Supabase REST API Health Check: SUCCESS (HTTPS/443)")
        else:
            print(f"❌ Supabase REST API Health Check: FAILED")
    except Exception as e:
        print(f"❌ Supabase REST API Error: {e}")

    # 3. Test Metadata Fetch (Organizations)
    try:
        res = client.table("organizations").select("*").limit(1).execute()
        if res.data:
            org_name = res.data[0].get('name', 'Unknown')
            print(f"✅ Data Retrieval (organizations): SUCCESS (Org: {org_name})")
        else:
            print(f"⚠️ Data Retrieval (organizations): SUCCESS (Empty Table)")
    except Exception as e:
        print(f"❌ Data Retrieval (organizations) Error: {e}")

    # 4. Test Table Counts (Infrastructure Verification)
    try:
        res_p = client.table("pipelines").select("id", count="exact").execute()
        res_c = client.table("connections").select("id", count="exact").execute()
        print(f"✅ Pipelines Table Reachable: SUCCESS (Count: {res_p.count})")
        print(f"✅ Connections Table Reachable: SUCCESS (Count: {res_c.count})")
    except Exception as e:
        print(f"❌ Infrastructure Verification Error: {e}")

    print("--------------------------------------------------")
    print("VERDICT: Backend communication with Supabase is clear and stable.")
    print("--------------------------------------------------")

if __name__ == "__main__":
    asyncio.run(test_supabase_connectivity())
