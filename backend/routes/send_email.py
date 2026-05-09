"""
Send email route — Gmail only.
Uses stored refresh token to send via the user's Gmail account.
Automatically refreshes access tokens.
"""

import os
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from datetime import datetime

from services.google_oauth import refresh_access_token
from services.gmail_sender import send_via_gmail, TokenExpiredError
from services.firebase import db

load_dotenv()

router = APIRouter()

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    uid: str  # Required — must be signed in with Gmail connected


@router.post("/send-email")
async def send_email(request: SendEmailRequest):
    if not EMAIL_REGEX.match(request.to):
        raise HTTPException(status_code=400, detail="Invalid email address")

    if not request.uid:
        raise HTTPException(
            status_code=401,
            detail="gmail_not_connected: Please sign in and connect Gmail to send emails."
        )

    # Load refresh token from Firestore
    user_ref = db.collection("users").document(request.uid)
    user_doc = user_ref.get()

    if not user_doc.exists:
        raise HTTPException(
            status_code=401,
            detail="gmail_not_connected: User not found. Please connect Gmail first."
        )

    user_data = user_doc.to_dict()
    refresh_token = user_data.get("google_refresh_token")

    if not refresh_token or not user_data.get("gmail_connected"):
        raise HTTPException(
            status_code=401,
            detail="gmail_not_connected: Gmail is not connected. Please connect your Gmail account."
        )

    # Get fresh access token
    try:
        token_data = await refresh_access_token(refresh_token)
        access_token = token_data["access_token"]
    except Exception:
        # Refresh token is invalid/revoked — mark disconnected
        user_ref.update({
            "gmail_connected": False,
            "google_refresh_token": None,
            "updated_at": datetime.utcnow(),
        })
        raise HTTPException(
            status_code=401,
            detail="gmail_reconnect_required: Gmail access has been revoked. Please reconnect your Gmail account."
        )

    # Send via Gmail API
    try:
        result = await send_via_gmail(
            access_token, request.to, request.subject, request.body,
            user_data.get("email")
        )
        return {
            "success": True,
            "message_id": result.get("id"),
            "message": f"Email sent via Gmail to {request.to}",
            "sent_via": "gmail",
        }
    except TokenExpiredError:
        # Access token expired mid-request — try one more refresh
        try:
            token_data = await refresh_access_token(refresh_token)
            access_token = token_data["access_token"]
            result = await send_via_gmail(
                access_token, request.to, request.subject, request.body,
                user_data.get("email")
            )
            return {
                "success": True,
                "message_id": result.get("id"),
                "message": f"Email sent via Gmail to {request.to}",
                "sent_via": "gmail",
            }
        except Exception:
            user_ref.update({
                "gmail_connected": False,
                "google_refresh_token": None,
                "updated_at": datetime.utcnow(),
            })
            raise HTTPException(
                status_code=401,
                detail="gmail_reconnect_required: Gmail token expired. Please reconnect your Gmail account."
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gmail send failed: {str(e)}")
