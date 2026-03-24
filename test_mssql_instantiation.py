import sys
import os
# Add the project root to sys.path if needed
sys.path.append(os.getcwd())

try:
    from backend.core.mssql_connector import MSSQLConnector
    print("SUCCESS: Imported MSSQLConnector")
    
    config = {
        "host": "mock",
        "user": "sa",
        "database": "test",
        "password": "pass"
    }
    connector = MSSQLConnector(config)
    print("SUCCESS: Instantiated MSSQLConnector")
except Exception as e:
    print(f"FAILURE: {e}")
    import traceback
    traceback.print_exc()
