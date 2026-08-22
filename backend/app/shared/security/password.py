"""
Hashing de contraseñas. Único lugar del proyecto que conoce bcrypt.
"""
from __future__ import annotations

import hashlib

import bcrypt


def hash_password(plain_password: str) -> str:
    digest = hashlib.sha256(plain_password.encode("utf-8")).digest()
    return bcrypt.hashpw(digest, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    digest = hashlib.sha256(plain_password.encode("utf-8")).digest()
    return bcrypt.checkpw(digest, hashed_password.encode("utf-8"))
