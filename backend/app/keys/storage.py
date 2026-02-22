"""Fernet encryption for private key storage."""

import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import get_settings
from app.exceptions import KeyEncryptionError


def _derive_fernet_key(secret: str) -> bytes:
    """Derive a Fernet-compatible key from secret_key via SHA-256."""
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_private_key(pem_bytes: bytes) -> str:
    """Encrypt a PEM private key using Fernet derived from SECRET_KEY."""
    try:
        settings = get_settings()
        key = _derive_fernet_key(settings.secret_key)
        f = Fernet(key)
        return f.encrypt(pem_bytes).decode()
    except Exception as exc:
        raise KeyEncryptionError(f"Failed to encrypt private key: {exc}") from exc


def decrypt_private_key(encrypted: str) -> bytes:
    """Decrypt a Fernet-encrypted PEM private key."""
    try:
        settings = get_settings()
        key = _derive_fernet_key(settings.secret_key)
        f = Fernet(key)
        return f.decrypt(encrypted.encode())
    except Exception as exc:
        raise KeyEncryptionError(f"Failed to decrypt private key: {exc}") from exc
