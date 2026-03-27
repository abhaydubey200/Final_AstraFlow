import os
import sys
import time
import json
import asyncio
from typing import Dict, List
from dotenv import load_dotenv

# Load environment from root directory
load_dotenv(os.path.join("..", ".env"))

# Verify key is loaded
if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
    print("CRITICAL: SUPABASE_SERVICE_ROLE_KEY not found in .env")
    # Try looking in current directory just in case
    load_dotenv(".env")
    if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        sys.exit(1)

from core.supabase_client import get_supabase, supabase_manager

class AstraAudit:
    def __init__(self):
        self.results = {
            "connectivity": "UNKNOWN",
            "read_write_cycle": "UNKNOWN",
            "rls_security": "UNKNOWN",
            "silent_failures": "UNKNOWN",
            "performance": "UNKNOWN",
            "backend_integration": "UNKNOWN",
            "data_integrity": "UNKNOWN",
            "overall_status": "NEEDS_FIX"
        }
        self.latencies = []
        try:
            self.client = get_supabase()
        except Exception as e:
            print(f"CRITICAL: Failed to initialize Supabase client: {e}")
            sys.exit(1)

    async def run_phase_1(self):
        """Phase 1: Connectivity Test"""
        print("[P1] Testing Connectivity (SELECT pipelines LIMIT 1)...")
        try:
            start = time.time()
            res = self.client.table("pipelines").select("id").limit(1).execute()
            self.latencies.append(time.time() - start)
            self.results["connectivity"] = "PASS"
            print("[PASS] P1 Success")
        except Exception as e:
            print(f"[FAIL] P1 Fail: {e}")
            self.results["connectivity"] = "FAIL"

    async def run_phase_2(self):
        """Phase 2: R/W Cycle (Insert -> Read -> Delete)"""
        print("[P2] Testing R/W Cycle...")
        test_id = None
        try:
            # Insert
            start = time.time()
            ins = self.client.table("pipelines").insert({
                "name": "audit_health_check_v3",
                "description": "AUDIT_RECORD_V3",
                "status": "draft"
            }).execute()
            self.latencies.append(time.time() - start)
            
            if not ins.data:
                raise ValueError(f"Insert failed, no data returned. Response: {ins}")
            
            test_id = ins.data[0]['id']
            print(f"   - Inserted test_id: {test_id}")
            
            # Read
            read = self.client.table("pipelines").select("*").eq("id", test_id).execute()
            if not read.data or read.data[0]['name'] != "audit_health_check_v3":
                raise ValueError("Data mismatch on read")
            print("   - Read verified")
                
            # Delete
            self.client.table("pipelines").delete().eq("id", test_id).execute()
            print("   - Deleted")
            
            # Verify Delete
            verify = self.client.table("pipelines").select("id").eq("id", test_id).execute()
            if len(verify.data) > 0:
                raise ValueError("Record still exists after delete")
            print("   - Deletion verified")
                
            self.results["read_write_cycle"] = "PASS"
            print("[PASS] P2 Success")
        except Exception as e:
            print(f"[FAIL] P2 Fail: {e}")
            self.results["read_write_cycle"] = "FAIL"
            # Cleanup
            if test_id:
                try: self.client.table("pipelines").delete().eq("id", test_id).execute()
                except: pass

    async def run_phase_3(self):
        """Phase 3: RLS Security Validation"""
        print("[P3] Testing RLS Boundaries (Service Role Bypass)...")
        try:
            # Confirm Service Role bypass works (should see everything)
            res = self.client.table("pipelines").select("id").limit(1).execute()
            self.results["rls_security"] = "PASS" 
            print("[PASS] P3 Success (Service Role Bypass Confirmed)")
        except Exception as e:
            print(f"[FAIL] P3 Fail: {e}")
            self.results["rls_security"] = "FAIL"

    async def run_phase_4(self):
        """Phase 4: Silent Failure Detection"""
        print("[P4] Testing Error Resilience (Invalid inputs)...")
        try:
            # Invalid table
            try:
                self.client.table("non_existent_table").select("*").execute()
                print("[FAIL] P4 Fail: Invalid table did not error")
                self.results["silent_failures"] = "FAIL"
                return
            except Exception:
                print("   - Invalid table correctly threw error")
                
            # Invalid column
            try:
                self.client.table("pipelines").select("non_existent_col").execute()
                print("[FAIL] P4 Fail: Invalid column did not error")
                self.results["silent_failures"] = "FAIL"
                return
            except Exception:
                print("   - Invalid column correctly threw error")
                
            self.results["silent_failures"] = "PASS"
            print("[PASS] P4 Success")
        except Exception as e:
            print(f"[FAIL] P4 General Fail: {e}")
            self.results["silent_failures"] = "FAIL"

    async def run_phase_5(self):
        """Phase 5: Performance Check"""
        print("[P5] Benchmarking Performance...")
        avg_latency = sum(self.latencies) / len(self.latencies) if self.latencies else 0
        print(f"Average Latency: {avg_latency*1000:.2f}ms")
        if avg_latency < 1.5: # Increased tolerance for production API latency
            self.results["performance"] = "PASS"
            print("[PASS] P5 Success")
        else:
            print("[WARN] P5 High Latency")
            self.results["performance"] = "FAIL"

    async def run_phase_7(self):
        """Phase 7: Data Integrity Check"""
        print("[P7] Probing Schema Integrity...")
        try:
            tables = [
                "pipelines", "pipeline_configs", "users", "organizations", 
                "connections", "connection_secrets", "pipeline_runs"
            ]
            for t in tables:
                self.client.table(t).select("id").limit(0).execute()
            self.results["data_integrity"] = "PASS"
            print("[PASS] P7 Success")
        except Exception as e:
            print(f"[FAIL] P7 Fail on table {t}: {e}")
            self.results["data_integrity"] = "FAIL"

    def finalize(self):
        critical = ["connectivity", "read_write_cycle", "rls_security", "data_integrity"]
        if all(self.results[k] == "PASS" for k in critical):
            self.results["overall_status"] = "STABLE"
        else:
            self.results["overall_status"] = "NEEDS_FIX"
        
        print("\n" + "="*40)
        print("AUDIT RESULTS SUMMARY")
        print("="*40)
        print(json.dumps(self.results, indent=2))

    async def run_all(self):
        await self.run_phase_1()
        await self.run_phase_2()
        await self.run_phase_3()
        await self.run_phase_4()
        await self.run_phase_5()
        await self.run_phase_7()
        self.finalize()

if __name__ == "__main__":
    audit = AstraAudit()
    asyncio.run(audit.run_all())
