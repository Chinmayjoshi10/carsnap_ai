"""
Google OAuth service — authorization code exchange + token refresh.

This service handles the server-side OAuth flow:
1. Exchange authorization code for access + refresh tokens
2. Store refresh token securely in Firestore
3. Refresh access tokens automatically before each Gmail send
4. Revoke tokens on disconnect
"""

import os
import httpx
from dotenv import load_dotenv

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke"


async def exchange_code_for_tokens(code: str, redirect_uri: str) -> dict:
    """
    Exchange an authorization code for access_token + refresh_token.
    Uses access_type=offline to get a long-lived refresh token.
    
    Returns: { access_token, refresh_token, expires_in, scope, token_type }
    Raises: Exception on failure
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(TOKEN_ENDPOINT, data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })

    data = resp.json()
    if resp.status_code != 200 or "error" in data:
        error_desc = data.get("error_description", data.get("error", "Token exchange failed"))
        raise Exception(f"Google token exchange failed: {error_desc}")

    if "refresh_token" not in data:
        raise Exception(
            "No refresh_token returned. User may need to re-authorize with prompt=consent. "
            "Ensure access_type=offline and prompt=consent in the authorization URL."
        )

    return data


async def refresh_access_token(refresh_token: str) -> dict:
    """
    Use a stored refresh_token to get a fresh access_token.
    
    Returns: { access_token, expires_in, scope, token_type }
    Raises: Exception if refresh token is invalid/revoked
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(TOKEN_ENDPOINT, data={
            "refresh_token": refresh_token,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "grant_type": "refresh_token",
        })

    data = resp.json()
    if resp.status_code != 200 or "error" in data:
        error_desc = data.get("error_description", data.get("error", "Token refresh failed"))
        raise Exception(f"Token refresh failed: {error_desc}")

    return data


async def revoke_token(token: str) -> bool:
    """
    Revoke a refresh token with Google.
    Returns True if successful, False otherwise.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(REVOKE_ENDPOINT, params={"token": token})
        return resp.status_code == 200
    except Exception:
        return False
