import sys
import os
import asyncio
# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

async def test_snowflake():
    from core.snowflake_connector import SnowflakeConnector
    
    # Test Mock mode
    print("Testing Snowflake Mock Mode...")
    config = {"host": "demo.snowflakecomputing.com", "user": "test", "password": "test"}
    connector = SnowflakeConnector(config)
    success = await connector.connect()
    print(f"Connect success: {success}")
    health = await connector.health_check()
    print(f"Health check: {health}")
    
    # Test Real mode (triggered by non-mock host)
    print("\nTesting Snowflake Real Mode (Fallback check)...")
    config = {"host": "real-account", "user": "test", "password": "test", "database": "db", "warehouse": "wh"}
    connector = SnowflakeConnector(config)
    # This will try to initialize connection/pool. 
    # Since we are not providing real credentials, it should fail at the connect() call 
    # BUT it should NOT raise an AttributeError if we've fixed it.
    success = await connector.connect()
    print(f"Connect success (should be False if credentials invalid): {success}")
    
    # Check if diagnose catches errors gracefully
    print("\nTesting Diagnostics...")
    diag = await connector.diagnose()
    print(f"Diagnostics: {diag}")

if __name__ == "__main__":
    asyncio.run(test_snowflake())
