import asyncio
import os
import uuid
import asyncpg
import mock_db 
from services.secret_service import SecretService

async def test_decrypt():
    # asyncpg is already monkey-patched by importing mock_db
    pool = await asyncpg.create_pool()
    service = SecretService(pool)
    
    conn_id = "38e0164c-1d8f-4c0d-9256-7abb7e0ea6b6"
    print(f"Testing decryption for connection: {conn_id}")
    
    password = await service.get_secret(conn_id, "password")
    print(f"Decrypted password length: {len(password) if password else 'None'}")
    if password:
        print(f"First 2 chars of password: {password[:2]}...")
    else:
        print("Password is None or empty!")

if __name__ == "__main__":
    asyncio.run(test_decrypt())
