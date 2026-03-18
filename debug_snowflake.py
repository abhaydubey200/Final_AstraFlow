import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from core.snowflake_connector import SnowflakeConnector
    from core.base_connector import BaseConnector
    
    print(f"SnowflakeConnector abstract methods: {SnowflakeConnector.__abstractmethods__}")
    
    c = SnowflakeConnector({"host": "abc", "user": "u", "password": "p", "database": "d", "warehouse": "w"})
    print("Instantiation successful!")
except Exception as e:
    print(f"Error: {e}")
