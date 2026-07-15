"""
Batch processing route — extract multiple cards and optionally send emails.

POST /batch-send
Accepts an array of card images, extracts contacts from each, and sends
the hardcoded follow-up email to every contact that has a valid email.
Also saves each contact to Firestore.
"""

import re
import json
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


class CardImage(BaseModel):
    front_image: str                   # base64 data URL (required)
    back_image: Optional[str] = None   # base64 data URL (optional)


class BatchSendRequest(BaseModel):
    cards: List[CardImage]
    uid: str  # Must be signed in with Gmail connected


@router.post("/batch-send")
async def batch_send(request: BatchSendRequest):
    """
    Process multiple business cards: extract → save → send email for each.
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

    # ── Process each card ──
    results = []
    sent_count = 0
    failed_count = 0
    skipped_count = 0

    for i, card in enumerate(request.cards):
        card_result = {
            "index": i,
            "status": "pending",
            "full_name": None,
            "email": None,
            "error": None,
        }

        try:
            # Step 1: OCR
            ocr_result = await extract_dual_side(card.front_image, card.back_image)
            combined_text = ocr_result["combined_raw_text"]

            if not combined_text:
                card_result["status"] = "skipped"
                card_result["error"] = "Could not read text from image"
                skipped_count += 1
                results.append(card_result)
                continue

            # Step 2: LLM extraction
            contact = await extract_contact_from_text(combined_text)

            card_result["full_name"] = contact.get("full_name")
            primary_email = contact.get("emails", [None])[0] if contact.get("emails") else None
            card_result["email"] = primary_email

            # Step 3: Upload image (best effort)
            front_url = ""
            try:
                front_url = upload_card_image(card.front_image, "front")
            except Exception:
                pass

            back_url = ""
            if card.back_image:
                try:
                    back_url = upload_card_image(card.back_image, "back")
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
                    await send_via_gmail(
                        access_token, primary_email, subject, body,
                        sender_email, cc=sender_email
                    )
                    email_sent = True
                    sent_count += 1
                    card_result["status"] = "sent"
                except TokenExpiredError:
                    # Refresh token and retry once
                    try:
                        token_data = await refresh_access_token(refresh_token)
                        access_token = token_data["access_token"]
                        await send_via_gmail(
                            access_token, primary_email, subject, body,
                            sender_email, cc=sender_email
                        )
                        email_sent = True
                        sent_count += 1
                        card_result["status"] = "sent"
                    except Exception as retry_err:
                        card_result["status"] = "email_failed"
                        card_result["error"] = str(retry_err)
                        failed_count += 1
                except Exception as send_err:
                    card_result["status"] = "email_failed"
                    card_result["error"] = str(send_err)
                    failed_count += 1
            else:
                card_result["status"] = "no_email"
                skipped_count += 1

            # Step 5: Save contact to Firestore
            save_data = {
                **contact,
                "raw_card_text": combined_text,
                "front_image_url": front_url,
                "back_image_url": back_url,
                "email_sent": email_sent,
                "saved_by": request.uid,
            }
            contact_id = save_contact(save_data)
            card_result["contact_id"] = contact_id

        except json.JSONDecodeError:
            card_result["status"] = "extract_failed"
            card_result["error"] = "AI returned invalid response"
            failed_count += 1
        except Exception as e:
            card_result["status"] = "extract_failed"
            card_result["error"] = str(e)
            failed_count += 1

        results.append(card_result)

    return {
        "success": True,
        "total": len(request.cards),
        "sent": sent_count,
        "failed": failed_count,
        "skipped": skipped_count,
        "results": results,
    }
