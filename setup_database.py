"""
AstraFlow Database Setup and Health Check Script

This script:
1. Verifies Supabase connection
2. Creates necessary database tables
3. Sets up initial data
4. Validates the database schema
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def check_env_vars():
    """Check if all required environment variables are set"""
    print("🔍 Checking environment variables...")
    
    required_vars = {
        "SUPABASE_URL": os.getenv("SUPABASE_URL"),
        "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        "SUPABASE_JWT_SECRET": os.getenv("SUPABASE_JWT_SECRET"),
        "ASTRAFLOW_MASTER_KEY": os.getenv("ASTRAFLOW_MASTER_KEY"),
    }
    
    missing = []
    for var, value in required_vars.items():
        if not value or value.startswith("your_"):
            missing.append(var)
            print(f"   ❌ {var} - Not set or using placeholder")
        else:
            # Don't print the actual value for security
            print(f"   ✅ {var} - Configured")
    
    if missing:
        print("\n❌ ERROR: Missing required environment variables!")
        print("\nPlease configure these in your .env file:")
        for var in missing:
            print(f"   - {var}")
        print("\nSee SETUP_GUIDE.md for instructions")
        return False
    
    # Validate master key format
    master_key = required_vars["ASTRAFLOW_MASTER_KEY"]
    if len(master_key) != 64:
        print(f"\n❌ ERROR: ASTRAFLOW_MASTER_KEY must be 64 hex characters (32 bytes)")
        print(f"   Current length: {len(master_key)}")
        print(f"   Generate with: openssl rand -hex 32")
        return False
    
    print("\n✅ All environment variables are configured correctly")
    return True


def test_supabase_connection():
    """Test connection to Supabase"""
    print("\n🔗 Testing Supabase connection...")
    
    try:
        from supabase import create_client, Client
        
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        supabase: Client = create_client(url, key)
        
        # Try a simple query
        result = supabase.table("pipelines").select("id").limit(1).execute()
        
        print("   ✅ Successfully connected to Supabase")
        print(f"   📊 Database is accessible")
        return True
        
    except Exception as e:
        print(f"   ❌ Failed to connect to Supabase")
        print(f"   Error: {str(e)}")
        print("\n   Troubleshooting:")
        print("   1. Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
        print("   2. Check if Supabase project is active (not paused)")
        print("   3. Verify network connectivity")
        return False


def check_database_schema():
    """Check if required tables exist"""
    print("\n📋 Checking database schema...")
    
    try:
        from supabase import create_client
        
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        supabase = create_client(url, key)
        
        required_tables = [
            "pipelines",
            "connections",
            "pipeline_runs",
            "run_logs",
            "pipeline_nodes",
            "pipeline_edges",
            "self_healing_events",
            "worker_heartbeats"
        ]
        
        existing_tables = []
        missing_tables = []
        
        for table in required_tables:
            try:
                supabase.table(table).select("*").limit(1).execute()
                existing_tables.append(table)
                print(f"   ✅ {table}")
            except:
                missing_tables.append(table)
                print(f"   ⚠️  {table} - Not found")
        
        if missing_tables:
            print(f"\n⚠️  Warning: {len(missing_tables)} table(s) missing")
            print("   These tables should be created in Supabase:")
            for table in missing_tables:
                print(f"      - {table}")
            print("\n   See backend/database/schema.sql for table definitions")
            return False
        
        print(f"\n✅ All {len(required_tables)} required tables exist")
        return True
        
    except Exception as e:
        print(f"   ❌ Error checking schema: {str(e)}")
        return False


def test_encryption():
    """Test encryption/decryption with master key"""
    print("\n🔐 Testing encryption system...")
    
    try:
        from backend.core.security import encrypt_value, decrypt_value
        
        test_data = "test_secret_password_123"
        
        # Test encryption
        encrypted = encrypt_value(test_data)
        print(f"   ✅ Encryption successful")
        
        # Test decryption
        decrypted = decrypt_value(encrypted)
        
        if decrypted == test_data:
            print(f"   ✅ Decryption successful")
            print(f"   ✅ Encryption system working correctly")
            return True
        else:
            print(f"   ❌ Decryption mismatch!")
            return False
            
    except Exception as e:
        print(f"   ❌ Encryption test failed: {str(e)}")
        return False


def main():
    """Run all setup and health checks"""
    print("=" * 60)
    print("  ASTRAFLOW - Database Setup & Health Check")
    print("=" * 60)
    
    # Run checks
    checks = [
        ("Environment Variables", check_env_vars),
        ("Supabase Connection", test_supabase_connection),
        ("Database Schema", check_database_schema),
        ("Encryption System", test_encryption),
    ]
    
    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ Unexpected error during {name}: {str(e)}")
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("  HEALTH CHECK SUMMARY")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status:12} - {name}")
        if not passed:
            all_passed = False
    
    print("=" * 60)
    
    if all_passed:
        print("\n🎉 All checks passed! AstraFlow is ready to run.")
        print("\nNext steps:")
        print("   1. Start the application: start_astraflow.bat")
        print("   2. Access frontend: http://localhost:8080")
        print("   3. Access API docs: http://localhost:8000/docs")
        return 0
    else:
        print("\n⚠️  Some checks failed. Please fix the issues above.")
        print("\nSee SETUP_GUIDE.md for detailed instructions")
        return 1


if __name__ == "__main__":
    sys.exit(main())
