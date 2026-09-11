"""
deps.py
=======
Authentication dependency: verify a Supabase access token, return its user id.

HOW IT WORKS. Supabase signs JWTs with a key published at
    <project>/auth/v1/.well-known/jwks.json
PyJWKClient fetches and caches that key set, so verification needs NO secret on
this server — only the project URL. A token is trusted when (a) it was signed
by that key, (b) `iss` matches the project, (c) `exp` has not passed, and
(d) `aud` is "authenticated".

DEV-MODE ESCAPE HATCH. When SUPABASE_URL is unset the dependency degrades to a
no-op that logs ONE warning: the CLI/renderer workflows keep working on a bare
checkout, and production becomes authenticated the moment the env var exists.
Endpoints that are cheap and public by design (/health, /transcript) never call
it.
"""

import logging

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from functools import lru_cache

from app.config import get_settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

_warned_once = False


def _jwk_client() -> jwt.PyJWKClient:
    url = (
        get_settings().supabase_url.rstrip("/")
        + "/auth/v1/.well-known/jwks.json"
    )
    return jwt.PyJWKClient(url)


from dataclasses import dataclass


@dataclass
class AuthContext:
    user_id: str
    token: str | None = None


async def get_current_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    token: str | None = None,
) -> AuthContext:
    """
    Bearer token or query param token → AuthContext (user_id and raw token). 401/503 otherwise.
    """
    global _warned_once

    settings = get_settings()
    if not settings.supabase_url:
        if not _warned_once:
            logger.warning(
                "SUPABASE_URL not set — auth disabled, endpoints are OPEN."
            )
            _warned_once = True
        return AuthContext(user_id="dev-anonymous", token=None)

    raw_token = (credentials.credentials if credentials and credentials.credentials else token)
    if not raw_token:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header or token parameter.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_str = raw_token
    try:
        signing_key = _jwk_client().get_signing_key_from_jwt(token_str)
        claims = jwt.decode(
            token_str,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=settings.supabase_url.rstrip("/") + "/auth/v1",
            options={"require": ["exp", "sub"]},
        )
    except (jwt.PyJWTError, jwt.PyJWKClientError, Exception) as e:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token has no subject.")

    return AuthContext(user_id=str(sub), token=token_str)


async def get_current_user(
    auth: AuthContext = Depends(get_current_auth),
) -> str:
    """
    Bearer token → Supabase user id (`sub`). 401/503 otherwise.
    """
    return auth.user_id
