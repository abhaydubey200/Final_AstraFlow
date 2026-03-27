import uuid
from typing import Dict, Any, Optional
from core.security import SecurityUtils
from core.supabase_client import supabase, supabase_logger
from core.decorators import safe_execute

class SecretService:
    def __init__(self, pool: Any = None):
        # Using Supabase SDK for all operations (Phase 2 Migration)
        self.supabase = supabase

    @safe_execute()
    async def store_secret(self, connection_id: str, secret_key: str, secret_value: str) -> str:
        """Phase 2 Migration: Store encrypted secret."""
        encrypted_val, nonce = SecurityUtils.encrypt(secret_value)
        
        # 1. Update connection_credentials
        self.supabase.table("connection_credentials").upsert({
            "connection_id": connection_id,
            "encrypted_credentials": encrypted_val,
            "iv": nonce
        }).execute()

        # 2. Legacy support: connection_secrets
        self.supabase.table("connection_secrets").upsert({
            "connection_id": connection_id,
            "secret_key": secret_key,
            "secret_value": encrypted_val
        }).execute()
        
        return f"vault://astraflow/connections/{connection_id}/{secret_key}"

    @safe_execute()
    async def get_secret(self, connection_id: str, secret_key: str) -> Optional[str]:
        """Phase 2 Migration: Get and decrypt secret."""
        res = self.supabase.table("connection_credentials").select("encrypted_credentials, iv").eq("connection_id", connection_id).execute()
        
        if res.data:
            row = res.data[0]
            if row.get('encrypted_credentials') and row.get('iv'):
                return SecurityUtils.decrypt(row['encrypted_credentials'], row['iv'])
        
        # Fallback
        res_secret = self.supabase.table("connection_secrets").select("secret_value").eq("connection_id", connection_id).eq("secret_key", secret_key).execute()
        return res_secret.data[0]['secret_value'] if res_secret.data else None

    async def rotate_credentials(self, connection_id: str):
        """Placeholder for credential rotation logic."""
        # In a real system, this would generate a new password, 
        # update it in the source DB, and update the vault.
        pass
