import os
from fastapi import Header, HTTPException
from typing import Optional


def get_auth_token() -> str:
    return os.environ.get("AUTH_TOKEN", "changeme")


async def require_auth(authorization: Optional[str] = Header(None, alias="Authorization")):
    """FastAPI dependency: validates Bearer token from Authorization header."""
    token = get_auth_token()
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    if authorization.removeprefix("Bearer ") != token:
        raise HTTPException(status_code=401, detail="Invalid token")


def verify_ws_token(token: str) -> bool:
    """Verify token for WebSocket connections (passed as query param)."""
    return token == get_auth_token()
