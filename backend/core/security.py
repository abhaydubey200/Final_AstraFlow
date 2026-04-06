import os
import base64
import logging
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from typing import Tuple

logger = logging.getLogger(__name__)

class SecurityUtils:
    @staticmethod
    def get_master_key() -> bytes:
        """
        Retrieves the master encryption key from environment.
        
        Raises:
            ValueError: If ASTRAFLOW_MASTER_KEY is not set or invalid.
        
        Note:
            Generate a key with: openssl rand -hex 32
        """
        key_hex = os.getenv("ASTRAFLOW_MASTER_KEY")
        
        if not key_hex:
            error_msg = (
                "CRITICAL: ASTRAFLOW_MASTER_KEY environment variable is not set. "
                "This key is required for encrypting sensitive data. "
                "Generate one using: openssl rand -hex 32"
            )
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        try:
            key_bytes = bytes.fromhex(key_hex)
            if len(key_bytes) != 32:
                raise ValueError(f"Key must be exactly 32 bytes (256 bits), got {len(key_bytes)} bytes")
            return key_bytes
        except ValueError as e:
            error_msg = f"Invalid ASTRAFLOW_MASTER_KEY format: {e}. Must be a 64-character hex string."
            logger.error(error_msg)
            raise ValueError(error_msg)

    @staticmethod
    def encrypt(data: str) -> Tuple[str, str]:
        """Encrypts data using AES-GCM and returns (encrypted_data_b64, nonce_b64)."""
        key = SecurityUtils.get_master_key()
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, data.encode(), None)
        return (
            base64.b64encode(ciphertext).decode('utf-8'),
            base64.b64encode(nonce).decode('utf-8')
        )

    @staticmethod
    def decrypt(encrypted_data_b64: str, nonce_b64: str) -> str:
        """Decrypts AES-GCM encrypted data."""
        key = SecurityUtils.get_master_key()
        aesgcm = AESGCM(key)
        ciphertext = base64.b64decode(encrypted_data_b64)
        nonce = base64.b64decode(nonce_b64)
        decrypted = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode('utf-8')
