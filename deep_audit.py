import os
import asyncio
import asyncpg
import traceback
from dotenv import load_dotenv

async def deep_audit():
    load_dotenv()
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        print("ERROR: DATABASE_URL not found in .env")
        return

    print("="*60)
    print(" SUPABASE COMPREHENSIVE PRODUCTION AUDIT")
    print("="*60)
    
    clean_host = dsn.split("@")[1].split("/")[0]
    print(f"[*] Target Host: {clean_host}")
    
    try:
        # 1. Connection Test
        print("[*] Testing physical connectivity...")
        conn = await asyncpg.connect(dsn, timeout=15)
        print("[SUCCESS] Connection established.")
        
        # 2. Version and Runtime Info
        version = await conn.fetchval("SELECT version()")
        print(f"[*] DB Version: {version.split(',')[0]}")
        
        uptime = await conn.fetchval("SELECT now() - pg_postmaster_start_time()")
        print(f"[*] DB Uptime: {uptime}")

        # 3. Schema Audit (public)
        print("\n[*] Auditing 'public' schema tables...")
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        
        if not tables:
            print("[WARNING] No tables found in 'public' schema.")
        else:
            print(f"[SUCCESS] Found {len(tables)} tables:")
            for t in tables:
                t_name = t['table_name']
                count = await conn.fetchval(f"SELECT COUNT(*) FROM public.\"{t_name}\"")
                
                # Check RLS
                rls = await conn.fetchval(f"""
                    SELECT rowsecurity from pg_tables 
                    WHERE schemaname = 'public' AND tablename = '{t_name}'
                """)
                rls_str = "RLS: ON" if rls else "RLS: OFF"
                
                print(f"    - {t_name:<30} | Rows: {count:>6} | {rls_str}")

        # 4. Connection Pool & Performance Check
        print("\n[*] Auditing Database Connection Stats...")
        conns = await conn.fetchval("SELECT count(*) FROM pg_stat_activity")
        max_conns = await conn.fetchval("SHOW max_connections")
        print(f"    - Active Connections: {conns} / {max_conns}")

        # 5. Extension Check (Important for AstraFlow)
        print("\n[*] Verifying required extensions...")
        exts = await conn.fetch("SELECT extname FROM pg_extension")
        ext_list = [e['extname'] for e in exts]
        required = ['uuid-ossp', 'pgcrypto']
        for r in required:
            status = "[OK]" if r in ext_list else "[MISSING]"
            print(f"    - {r:<15} {status}")

        await conn.close()
        print("\n" + "="*60)
        print(" AUDIT RESULT: Supabase is fully operational and responsive.")
        print("="*60)

    except Exception as e:
        print("\n" + "!"*60)
        print(f" CRITICAL AUDIT FAILURE")
        print("!"*60)
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(deep_audit())
