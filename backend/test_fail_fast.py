import os
import sys
import unittest
from dotenv import load_dotenv

# Ensure we are in backend for imports
sys.path.append(os.getcwd())

class TestFailFast(unittest.TestCase):
    def test_invalid_supabase_url(self):
        """Phase 8: Verify system fails fast with invalid URL"""
        os.environ["VITE_SUPABASE_URL"] = "https://invalid-url.supabase.co"
        os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "invalid-key"
        
        from core.supabase_client import SupabaseManager
        # Reset singleton if possible or just create new instance
        manager = SupabaseManager()
        
        print("[P8] Testing Invalid URL Fail-Fast...")
        with self.assertRaises(Exception):
            manager.client().table("pipelines").select("*").limit(1).execute()
        print("[PASS] System correctly failed on invalid URL")

    def test_missing_keys(self):
        """Phase 8: Verify critical error on missing keys"""
        os.environ["VITE_SUPABASE_URL"] = ""
        os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"] = ""
        os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
        
        from core.supabase_client import SupabaseManager
        manager = SupabaseManager()
        
        print("[P8] Testing Missing Keys Fail-Fast...")
        with self.assertRaises(RuntimeError):
            manager.client()
        print("[PASS] System correctly threw RuntimeError on missing config")

if __name__ == "__main__":
    unittest.main()
