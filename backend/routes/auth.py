"""
Auth routes — Google OAuth connect/disconnect + status check.

POST /auth/google/connect   — exchange auth code for refresh token, store in Firestore
POST /auth/google/disconnect — revoke token, remove from Firestore
GET  /auth/google/status     — check if user has Gmail connected
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.google_oauth import exchange_code_for_tokens, revoke_token
from services.firebase import db
from datetime import datetime

router = APIRouter(prefix="/auth/google", tags=["auth"])


class ConnectRequest(BaseModel):
    code: str           # authorization code from Google
    redirect_uri: str   # must match the one used in frontend consent URL
    uid: str            # Firebase user UID
    email: str          # user's email
    display_name: str = ""
    photo_url: str = ""


class DisconnectRequest(BaseModel):
    uid: str


@router.post("/connect")
async def connect_gmail(request: ConnectRequest):
    """
    Exchange authorization code for tokens.
    Store refresh_token in Firestore under users/{uid}.
    """
    try:
        tokens = await exchange_code_for_tokens(request.code, request.redirect_uri)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=400,
            detail="No refresh token received. Please re-authorize with prompt=consent."
        )

    # Store in Firestore — refresh token is ONLY stored server-side
    user_ref = db.collection("users").document(request.uid)
    user_ref.set({
        "email": request.email,
        "display_name": request.display_name,
        "photo_url": request.photo_url,
        "google_refresh_token": refresh_token,
        "gmail_connected": True,
        "updated_at": datetime.utcnow(),
    }, merge=True)

    return {
        "success": True,
        "gmail_connected": True,
        "message": "Gmail connected successfully",
    }


@router.post("/disconnect")
async def disconnect_gmail(request: DisconnectRequest):
    """
    Revoke the refresh token and remove it from Firestore.
    """
    user_ref = db.collection("users").document(request.uid)
    user_doc = user_ref.get()

    if user_doc.exists:
        data = user_doc.to_dict()
        refresh_token = data.get("google_refresh_token")

        # Revoke with Google (best effort)
        if refresh_token:
            await revoke_token(refresh_token)

        # Clear from Firestore
        user_ref.update({
            "google_refresh_token": None,
            "gmail_connected": False,
            "updated_at": datetime.utcnow(),
        })

    return {"success": True, "gmail_connected": False, "message": "Gmail disconnected"}


@router.get("/status/{uid}")
async def gmail_status(uid: str):
    """
    Check if user has Gmail connected.
    Returns connected state without exposing any tokens.
    """
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()

    if not user_doc.exists:
        return {"gmail_connected": False, "email": None}

    data = user_doc.to_dict()
    return {
        "gmail_connected": data.get("gmail_connected", False),
        "email": data.get("email"),
    }
