"""
Batch processing route — extract multiple cards and optionally send emails.

POST /batch-send
Accepts an array of card images, extracts contacts from each, and sends
the hardcoded follow-up email to every contact that has a valid email.
Also saves each contact to Firestore.

Cards are processed CONCURRENTLY (up to 5 at a time) to avoid long wait times.
"""

import re
import json
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from services.ocr import extract_dual_side
from services.llm import extract_contact_from_text
from services.storage import upload_card_image
from services.google_oauth import refresh_access_token
from services.gmail_sender import send_via_gmail, TokenExpiredError
from services.firebase import db, save_contact

router = APIRouter()

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# Max cards processed at the same time — keeps API rate limits happy
MAX_CONCURRENCY = 5


class CardImage(BaseModel):
    front_image: str                   # base64 data URL (required)
    back_image: Optional[str] = None   # base64 data URL (optional)


class BatchSendRequest(BaseModel):
    cards: List[CardImage]
    uid: str  # Must be signed in with Gmail connected


async def _process_single_card(
    index: int,
    card: CardImage,
    access_token: str,
    refresh_token: str,
    sender_email: str,
    sender_name: str,
    uid: str,
    semaphore: asyncio.Semaphore,
    token_lock: asyncio.Lock,
    token_holder: dict,
) -> dict:
    """Process one card: OCR → extract → upload → email → save. Runs under semaphore."""

    card_result = {
        "index": index,
        "status": "pending",
        "full_name": None,
        "email": None,
        "error": None,
    }

    async with semaphore:
        try:
            # Step 1: OCR
            ocr_result = await extract_dual_side(card.front_image, card.back_image)
            combined_text = ocr_result["combined_raw_text"]

            if not combined_text:
                card_result["status"] = "skipped"
                card_result["error"] = "Could not read text from image"
                return card_result

            # Step 2: LLM extraction
            contact = await extract_contact_from_text(combined_text)

            card_result["full_name"] = contact.get("full_name")
            primary_email = (contact.get("emails") or [None])[0]
            card_result["email"] = primary_email

            # Step 3: Upload image (best effort, sync — runs in thread pool)
            front_url = ""
            try:
                front_url = await asyncio.to_thread(upload_card_image, card.front_image, "front")
            except Exception:
                pass

            back_url = ""
            if card.back_image:
                try:
                    back_url = await asyncio.to_thread(upload_card_image, card.back_image, "back")
                except Exception:
                    pass

            # Step 4: Send email if valid address
            email_sent = False
            if primary_email and EMAIL_REGEX.match(primary_email):
                subject = contact.get("email_subject", "Great connecting with you")
                body = contact.get("email_draft", "")

                # Replace [Your Name] placeholder
                if sender_name:
                    body = body.replace("[Your Name]", sender_name)

                try:
                    current_token = token_holder["access_token"]
                    await send_via_gmail(
                        current_token, primary_email, subject, body,
                        sender_email, cc=sender_email
                    )
                    email_sent = True
                    card_result["status"] = "sent"
                except TokenExpiredError:
                    # Refresh once under lock so multiple tasks don't all refresh
                    async with token_lock:
                        try:
                            token_data = await refresh_access_token(refresh_token)
                            token_holder["access_token"] = token_data["access_token"]
                        except Exception:
                            pass

                    try:
                        await send_via_gmail(
                            token_holder["access_token"], primary_email, subject, body,
                            sender_email, cc=sender_email
                        )
                        email_sent = True
                        card_result["status"] = "sent"
                    except Exception as retry_err:
                        card_result["status"] = "email_failed"
                        card_result["error"] = str(retry_err)
                except Exception as send_err:
                    card_result["status"] = "email_failed"
                    card_result["error"] = str(send_err)
            else:
                card_result["status"] = "no_email"

            # Step 5: Save contact to Firestore
            save_data = {
                **contact,
                "raw_card_text": combined_text,
                "front_image_url": front_url,
                "back_image_url": back_url,
                "email_sent": email_sent,
                "saved_by": uid,
            }
            contact_id = await asyncio.to_thread(save_contact, save_data)
            card_result["contact_id"] = contact_id

        except json.JSONDecodeError:
            card_result["status"] = "extract_failed"
            card_result["error"] = "AI returned invalid response"
        except Exception as e:
            card_result["status"] = "extract_failed"
            card_result["error"] = str(e)

    return card_result


@router.post("/batch-send")
async def batch_send(request: BatchSendRequest):
    """
    Process multiple business cards concurrently: extract → save → send email.
    Up to MAX_CONCURRENCY cards are processed in parallel.
    Returns a summary of results per card.
    """
    if not request.uid:
        raise HTTPException(status_code=401, detail="gmail_not_connected: Please sign in and connect Gmail.")

    if not request.cards or len(request.cards) == 0:
        raise HTTPException(status_code=400, detail="No cards provided.")

    if len(request.cards) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 cards per batch.")

    # ── Get Gmail credentials ──
    user_ref = db.collection("users").document(request.uid)
    user_doc = user_ref.get()

    if not user_doc.exists:
        raise HTTPException(status_code=401, detail="gmail_not_connected: User not found.")

    user_data = user_doc.to_dict()
    refresh_token = user_data.get("google_refresh_token")
    sender_email = user_data.get("email")
    sender_name = user_data.get("display_name", "")

    if not refresh_token or not user_data.get("gmail_connected"):
        raise HTTPException(status_code=401, detail="gmail_not_connected: Gmail is not connected.")

    # Get fresh access token
    try:
        token_data = await refresh_access_token(refresh_token)
        access_token = token_data["access_token"]
    except Exception:
        user_ref.update({
            "gmail_connected": False,
            "google_refresh_token": None,
            "updated_at": datetime.utcnow(),
        })
        raise HTTPException(
            status_code=401,
            detail="gmail_reconnect_required: Gmail access has been revoked. Please reconnect."
        )

    # ── Process all cards concurrently ──
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
    token_lock = asyncio.Lock()
    token_holder = {"access_token": access_token}  # mutable so tasks share refreshed token

    tasks = [
        _process_single_card(
            index=i,
            card=card,
            access_token=access_token,
            refresh_token=refresh_token,
            sender_email=sender_email,
            sender_name=sender_name,
            uid=request.uid,
            semaphore=semaphore,
            token_lock=token_lock,
            token_holder=token_holder,
        )
        for i, card in enumerate(request.cards)
    ]

    results = await asyncio.gather(*tasks)

    # Sort by original index
    results.sort(key=lambda r: r["index"])

    sent_count = sum(1 for r in results if r["status"] == "sent")
    failed_count = sum(1 for r in results if r["status"] in ("email_failed", "extract_failed"))
    skipped_count = sum(1 for r in results if r["status"] in ("no_email", "skipped"))

    return {
        "success": True,
        "total": len(request.cards),
        "sent": sent_count,
        "failed": failed_count,
        "skipped": skipped_count,
        "results": results,
    }
