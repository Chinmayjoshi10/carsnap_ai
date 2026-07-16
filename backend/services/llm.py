"""
LLM extraction service — Gemini 2.5 Pro for full business intelligence extraction.

Supports:
- Single-side card text
- Dual-side merged text (front + back)
- Complete semantic extraction with business intelligence fields
"""

import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

# --- Anthropic direct API (client version) ---
# import anthropic
# --- AWS Bedrock ---
# import boto3
# --- Deprecated SDK ---
# import google.generativeai as genai
# --- End alternative imports ---

load_dotenv()

EXTRACT_PROMPT = """You are an AI-powered business relationship intelligence assistant. I will give you raw OCR text extracted from a business/visiting card. The text may come from both front and back sides (labeled with === FRONT SIDE === and === BACK SIDE ===). The text may have OCR errors, weird line breaks, or garbled characters — do your best.

Extract EVERY piece of information and generate business intelligence. Return ONLY a valid JSON object, no other text, no markdown fences:

{
  "full_name": string or null,
  "job_title": string or null,
  "company": string or null,
  "emails": [string],
  "phones": [string],
  "address": string or null,
  "website": string or null,
  "linkedin": string or null,
  "social_handles": [string],
  "services": [string],
  "industry_tags": [string],
  "business_summary": string or null,
  "notes": string or null,
  "confidence": float
}

Field rules:
- full_name: Full name exactly as printed
- job_title: Title/designation/role exactly as printed
- company: Full company/organization name
- emails: ALL email addresses found (array). First one should be the primary contact email
- phones: ALL phone numbers found (array) with country codes if visible. First one should be the primary number
- address: Full address including city, state, zip — combine multiple lines into one string
- website: Website URL if present (include www/http)
- linkedin: LinkedIn URL or handle if present
- social_handles: Any social media handles found (Twitter/X, Instagram, Facebook, etc.) — include the platform prefix like "@handle (Twitter)"
- services: What does this person/company DO? Infer from job title, company name, taglines, descriptions on the card. Return 2-5 short service descriptions. Examples: ["Custom Software Development", "Cloud Migration", "IT Consulting"]
- industry_tags: Infer 2-4 industry/sector tags. Examples: ["Technology", "Healthcare", "B2B SaaS"]
- business_summary: A concise 1-2 sentence human-readable summary of who this person is and what they do. Example: "Senior architect at a mid-size consulting firm specializing in enterprise cloud migrations."
- notes: Any other notable info on the card (tagline, certifications, branch names, GST number, awards, QR code mentions, etc.) — combine into one string, or null
- confidence: How confident are you in the extraction? 0.0 to 1.0. High (0.8+) = clear card, most fields found. Medium (0.5-0.8) = some fields unclear. Low (<0.5) = very poor quality or mostly unreadable


If text comes from both sides of the card, MERGE all information intelligently:
- Deduplicate phone numbers and emails that appear on both sides
- Combine address fragments
- Front side typically has name/title/company
- Back side often has services, certifications, branch addresses, social media

OCR Text:
"""

# ============================================================
# Hardcoded follow-up email — exact approved template
# Only the recipient's first name is swapped in. No LLM involvement.
# ============================================================
HARDCODED_EMAIL_SUBJECT = "Great meeting you at the Loudoun Chamber"

HARDCODED_EMAIL_TEMPLATE = """Hi {first_name},

It was great meeting you through the Loudoun Chamber. I've been meaning to reach out.

Through my coaching work, I have the opportunity to speak with professionals, leaders, and business owners. Over time, I found myself wondering whether the challenges I hear are unique to each business or common across many.

That curiosity led me to start the Business Perspectives Project \u2014 a series of conversations with local business owners to better understand the realities of running a business today.

If you're open to a 30-minute virtual conversation, I'd genuinely enjoy learning from your experience. Just reply to this email, and I'll send over a few times that work.

Best,

Arushi Bhardwaj
Founder | SoulSynergy-Coach
ICF Professional Certified Coach (PCC)"""


def build_hardcoded_email(full_name) -> dict:
    """Return the fixed follow-up email, with the recipient's first name filled in."""
    first_name = (full_name or "").strip().split(" ")[0] if full_name else ""
    greeting_name = first_name if first_name else "there"
    return {
        "email_subject": HARDCODED_EMAIL_SUBJECT,
        "email_draft": HARDCODED_EMAIL_TEMPLATE.format(first_name=greeting_name),
    }


# ============================================================
# Google Gemini Pro implementation (active) — using google-genai SDK
# ============================================================
_gemini_client = None

def _get_client():
    """Reuse a single genai client instance."""
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _gemini_client


def _extract_sync(raw_text: str, model: str = None) -> dict:
    """Synchronous extraction — called via asyncio.to_thread."""
    client = _get_client()
    use_model = model or os.getenv("GEMINI_MODEL", "gemini-2.5-pro")

    response = client.models.generate_content(
        model=use_model,
        contents=EXTRACT_PROMPT + raw_text,
        config=types.GenerateContentConfig(
            max_output_tokens=2000,
            temperature=0.2,
        ),
    )

    text = response.text.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    result = json.loads(text)

    # Ensure array fields are actually arrays
    for key in ["emails", "phones", "social_handles", "services", "industry_tags"]:
        if not isinstance(result.get(key), list):
            result[key] = [result[key]] if result.get(key) else []

    # Ensure confidence is a float
    try:
        result["confidence"] = float(result.get("confidence", 0.5))
    except (ValueError, TypeError):
        result["confidence"] = 0.5

    # Always use the hardcoded email template — no LLM generation
    result.update(build_hardcoded_email(result.get("full_name")))

    return result


async def extract_contact_from_text(raw_text: str) -> dict:
    """Use Gemini Pro to extract full business intelligence from OCR text."""
    import asyncio
    return await asyncio.to_thread(_extract_sync, raw_text)


async def extract_contact_fast(raw_text: str) -> dict:
    """Fast extraction using Gemini 2.0 Flash — for batch processing."""
    import asyncio
    return await asyncio.to_thread(_extract_sync, raw_text, "gemini-2.0-flash")


# ============================================================
# AWS Bedrock implementation (commented out)
# Uncomment this and comment out the Gemini version above to use
# ============================================================
# async def extract_contact_from_text(raw_text: str) -> dict:
#     """Use Claude via AWS Bedrock to extract structured contact data from OCR text."""
#     client = boto3.client(
#         "bedrock-runtime",
#         region_name=os.getenv("AWS_REGION", "us-east-1"),
#         aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
#         aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
#     )
#
#     body = json.dumps({
#         "anthropic_version": "bedrock-2023-10-16",
#         "max_tokens": 800,
#         "messages": [{
#             "role": "user",
#             "content": EXTRACT_PROMPT + raw_text
#         }]
#     })
#
#     response = client.invoke_model(
#         modelId=os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-20250514-v1:0"),
#         contentType="application/json",
#         accept="application/json",
#         body=body,
#     )
#
#     result = json.loads(response["body"].read())
#     text = result["content"][0]["text"].strip()
#     # Strip markdown fences if model adds them
#     text = text.replace("```json", "").replace("```", "").strip()
#
#     return json.loads(text)

# ============================================================
# Anthropic direct API implementation (commented out for client)
# Uncomment this and comment out the active version above to use
# ============================================================
# async def extract_contact_from_text(raw_text: str) -> dict:
#     """Use Claude to extract structured contact data from OCR text."""
#     client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
#
#     message = client.messages.create(
#         model="claude-sonnet-4-20250514",
#         max_tokens=800,
#         messages=[{
#             "role": "user",
#             "content": EXTRACT_PROMPT + raw_text
#         }]
#     )
#
#     text = message.content[0].text.strip()
#     # Strip markdown fences if model adds them
#     text = text.replace("```json", "").replace("```", "").strip()
#
#     return json.loads(text)
