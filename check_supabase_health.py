import os
import asyncio
import asyncpg
from dotenv import load_dotenv

async def audit_supabase():
    load_dotenv()
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        print("ERROR: DATABASE_URL not found in .env")
        return

    print(f"AUDIT: Attempting to connect to Supabase at {dsn.split('@')[1].split(':')[0]}...")
    
    try:
        # 1. Test Connection
        conn = await asyncpg.connect(dsn, timeout=10)
        print("SUCCESS: Physical connection to Supabase established.")
        
        # 2. Check Schema
        print("\nAUDIT: Fetching table list in 'public' schema...")
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        
        if not tables:
            print("WARNING: 'public' schema is EMPTY. No tables found.")
        else:
            print(f"SUCCESS: Found {len(tables)} tables.")
            for t in tables:
                row_count = await conn.fetchval(f"SELECT COUNT(*) FROM public.\"{t['table_name']}\"")
                print(f" - {t['table_name']}: {row_count} records")

        # 3. Check RLS Status
        print("\nAUDIT: Verifying Row Level Security (RLS) status...")
        rls_status = await conn.fetch("""
            SELECT tablename, rowsecurity 
            FROM pg_tables 
            WHERE schemaname = 'public'
        """)
        for s in rls_status:
            status = "ENABLED" if s['rowsecurity'] else "DISABLED"
            print(f" - {s['tablename']}: RLS is {status}")

        # 4. Check Current User
        user_info = await conn.fetchrow("SELECT current_user, session_user, current_database()")
        print(f"\nAUDIT: Connected as '{user_info[0]}' to database '{user_info[2]}'")

        await conn.close()
        print("\nAUDIT COMPLETE: Supabase is healthy and responding.")

    except Exception as e:
        print(f"\nFATAL AUDIT ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(audit_supabase())
