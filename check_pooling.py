import snowflake.connector
try:
    import snowflake.connector.pooling
    print(f"snowflake.connector.pooling members: {dir(snowflake.connector.pooling)}")
except ImportError:
    print("snowflake.connector.pooling NOT available.")
