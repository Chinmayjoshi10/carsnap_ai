"""
Batch processing route — extract multiple cards and send emails via queue.

POST /batch-send
Accepts an array of card images, extracts contacts from each, and queues
the follow-up email to every contact that has a valid email.
Also saves each contact to Firestore.

Architecture:
  - Card extraction (OCR + LLM) runs CONCURRENTLY (up to 5 at a time)
  - Email sending runs SEQUENTIALLY with a delay between each send
    to avoid triggering Gmail/recipient spam filters
"""

import re
import json
import asyncio
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from services.ocr import extract_dual_side
from services.llm import extract_contact_fast
from services.google_oauth import refresh_access_token
from services.gmail_sender import send_via_gmail, TokenExpiredError
from services.firebase import db, save_contact

router = APIRouter()
logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# Max cards extracted at the same time (OCR + LLM is safe to parallelize)
MAX_EXTRACT_CONCURRENCY = 5

# Seconds to wait between each email send — prevents spam detection
# Gmail's internal rate limit is ~20/sec but spam filters flag bursts.
# 15s gap mimics natural human sending patterns.
EMAIL_SEND_DELAY_SECONDS = 15


class CardImage(BaseModel):
    front_image: str                   # base64 data URL (required)
    back_image: Optional[str] = None   # base64 data URL (optional)


class BatchSendRequest(BaseModel):
    cards: List[CardImage]
    uid: str  # Must be signed in with Gmail connected


# ── Phase 1: Extract contact data (runs concurrently) ──────────────────────


async def _extract_single_card(
    index: int,
    card: CardImage,
    semaphore: asyncio.Semaphore,
) -> dict:
    """Extract contact info from one card: OCR → LLM. Runs under semaphore."""

    result = {
        "index": index,
        "status": "extracted",
        "contact": None,
        "raw_text": None,
        "error": None,
    }

    async with semaphore:
        try:
            # Step 1: OCR
            ocr_result = await extract_dual_side(card.front_image, card.back_image)
            combined_text = ocr_result["combined_raw_text"]

            if not combined_text:
                result["status"] = "skipped"
                result["error"] = "Could not read text from image"
                return result

            # Step 2: LLM extraction (Gemini Flash for speed)
            contact = await extract_contact_fast(combined_text)
            result["contact"] = contact
            result["raw_text"] = combined_text

        except json.JSONDecodeError:
            result["status"] = "extract_failed"
            result["error"] = "AI returned invalid response"
        except Exception as e:
            result["status"] = "extract_failed"
            result["error"] = str(e)

    return result


# ── Phase 2: Send emails sequentially with delay (the queue) ───────────────


async def _send_email_queued(
    extracted: dict,
    sender_email: str,
    sender_name: str,
    uid: str,
    refresh_token: str,
    token_holder: dict,
    token_lock: asyncio.Lock,
) -> dict:
    """Send one email. Called sequentially from the queue loop."""

    contact = extracted["contact"]
    index = extracted["index"]

    card_result = {
        "index": index,
        "status": extracted["status"],
        "full_name": contact.get("full_name") if contact else None,
        "email": None,
        "error": extracted.get("error"),
        "contact_id": None,
    }

    # If extraction already failed, just return
    if extracted["status"] in ("skipped", "extract_failed"):
        return card_result

    primary_email = (contact.get("emails") or [None])[0]
    card_result["email"] = primary_email

    # ── Send email if valid address ──
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
                sender_email, bcc=sender_email
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
                    sender_email, bcc=sender_email
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

    # ── Save contact to Firestore ──
    try:
        save_data = {
            **contact,
            "raw_card_text": extracted["raw_text"],
            "front_image_url": "",
            "back_image_url": "",
            "email_sent": email_sent,
            "saved_by": uid,
        }
        contact_id = await asyncio.to_thread(save_contact, save_data)
        card_result["contact_id"] = contact_id
    except Exception as save_err:
        logger.warning(f"Failed to save contact #{index}: {save_err}")

    return card_result


# ── Main endpoint ──────────────────────────────────────────────────────────


@router.post("/batch-send")
async def batch_send(request: BatchSendRequest):
    """
    Process multiple business cards in two phases:

    Phase 1 — CONCURRENT extraction (OCR + LLM, up to 5 at a time)
      Fast — all cards are scanned and parsed in parallel.

    Phase 2 — SEQUENTIAL email queue (one every 15 seconds)
      Slow on purpose — staggering sends prevents Gmail and recipient
      mail servers from flagging the emails as spam/bulk.

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

    # ── Phase 1: Extract all cards concurrently ──
    extract_semaphore = asyncio.Semaphore(MAX_EXTRACT_CONCURRENCY)

    extract_tasks = [
        _extract_single_card(index=i, card=card, semaphore=extract_semaphore)
        for i, card in enumerate(request.cards)
    ]

    extracted_results = await asyncio.gather(*extract_tasks)

    # ── Phase 2: Send emails sequentially with delay ──
    token_lock = asyncio.Lock()
    token_holder = {"access_token": access_token}

    final_results = []
    emails_sent_so_far = 0

    for extracted in extracted_results:
        # Wait between sends to avoid spam triggers (skip delay for first email
        # and for cards that won't send an email anyway)
        needs_email = (
            extracted["status"] == "extracted"
            and extracted["contact"]
            and (extracted["contact"].get("emails") or [None])[0]
        )

        if needs_email and emails_sent_so_far > 0:
            logger.info(
                f"Email queue: waiting {EMAIL_SEND_DELAY_SECONDS}s before "
                f"sending email #{emails_sent_so_far + 1}..."
            )
            await asyncio.sleep(EMAIL_SEND_DELAY_SECONDS)

        result = await _send_email_queued(
            extracted=extracted,
            sender_email=sender_email,
            sender_name=sender_name,
            uid=request.uid,
            refresh_token=refresh_token,
            token_holder=token_holder,
            token_lock=token_lock,
        )

        if result["status"] == "sent":
            emails_sent_so_far += 1

        final_results.append(result)

    # Sort by original index
    final_results.sort(key=lambda r: r["index"])

    sent_count = sum(1 for r in final_results if r["status"] == "sent")
    failed_count = sum(1 for r in final_results if r["status"] in ("email_failed", "extract_failed"))
    skipped_count = sum(1 for r in final_results if r["status"] in ("no_email", "skipped"))

    return {
        "success": True,
        "total": len(request.cards),
        "sent": sent_count,
        "failed": failed_count,
        "skipped": skipped_count,
        "results": final_results,
    }
