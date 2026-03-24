try:
    import snowflake.connector
    print(f"Snowflake Connector Version: {snowflake.connector.__version__}")
    try:
        from snowflake.connector.pooling import SnowflakeConnectionPool
        print("SnowflakeConnectionPool is available.")
    except ImportError:
        print("SnowflakeConnectionPool is NOT available in this version.")
except ImportError:
    print("Snowflake Connector NOT installed.")
except Exception as e:
    print(f"Error checking Snowflake: {e}")
