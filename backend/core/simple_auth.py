"""
Simple hardcoded auth for single-admin mode
NO Supabase, NO JWT validation, NO complexity
"""
from fastapi import Header, HTTPException
from typing import Optional

# Hardcoded SUPER_ADMIN user
SUPER_ADMIN = {
    "id": "admin-001",
    "email": "dubeyabhay430@gmail.com",
    "name": "Abhay Dubey",
    "role": "SUPER_ADMIN",
    "company": "AstraFlow Internal"
}

async def get_current_user(authorization: Optional[str] = Header(None)):
    """
    Always returns SUPER_ADMIN user
    No validation, no tokens, just works
    """
    return SUPER_ADMIN

def get_current_user_sync():
    """Synchronous version for non-async contexts"""
    return SUPER_ADMIN
