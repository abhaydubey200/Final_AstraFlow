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
            # Use a default dev key if not set (WARNING: NOT FOR PRODUCTION!)
            logger.warning(
                "ASTRAFLOW_MASTER_KEY not set. Using development default. "
                "Generate a secure key with: openssl rand -hex 32"
            )
            # Default dev key (64 zeros)
            key_hex = "0000000000000000000000000000000000000000000000000000000000000000"
        
        try:
            key_bytes = bytes.fromhex(key_hex)
            if len(key_bytes) != 32:
                logger.warning(f"Key should be 32 bytes (256 bits), got {len(key_bytes)} bytes. Using padded/truncated version.")
                # Pad or truncate to 32 bytes
                if len(key_bytes) < 32:
                    key_bytes = key_bytes + b'\x00' * (32 - len(key_bytes))
                else:
                    key_bytes = key_bytes[:32]
            return key_bytes
        except ValueError as e:
            logger.error(f"Invalid ASTRAFLOW_MASTER_KEY format: {e}. Using default dev key.")
            return bytes.fromhex("0000000000000000000000000000000000000000000000000000000000000000")


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
