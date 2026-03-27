import asyncio
import os
import uuid
import sys
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

print("DEBUG: Loading Supabase...")
try:
    from core.supabase_client import supabase
    print("DEBUG: Supabase loaded!")
except Exception as e:
    print(f"DEBUG: FAILED to load Supabase: {e}")
    sys.exit(1)

async def main():
    print("AstraFlow Audit - Phase 1 Start")
    try:
        res = supabase.table("pipelines").select("id").limit(1).execute()
        print(f"OK: Found {len(res.data)} pipelines.")
    except Exception as e:
        print(f"ERR: {e}")

if __name__ == "__main__":
    asyncio.run(main())
