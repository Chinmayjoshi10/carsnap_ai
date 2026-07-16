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
  "confidence": float,
  "email_subject": string,
  "email_draft": string
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

Email rules — THIS IS CRITICAL. Write like a REAL HUMAN, not an AI. Each email MUST be unique and personalized:

- email_subject: A short, casual subject line like a real person would type. MUST reference something specific from the card (their name, company, or role). Examples:
  * "Great meeting you at the chamber event!"
  * "Nice connecting today, [first name]"
  * "Hey [first name] — loved hearing about [company]"
  NEVER write generic subjects like "Professional Follow-up" or "Networking Connection" or "Business Perspective Project"

- email_draft: A warm, personalized follow-up email. STRICT rules:
  * Start with "Hi [first name]," or "Hey [first name]!" — casual and warm
  * 3-5 sentences MAXIMUM. Short emails don't trigger spam filters, long ones do.
  * Reference something SPECIFIC about their role, company, or industry from the card data — this makes every email unique
  * Mention you recently met and exchanged cards at a Loudoun Chamber event
  * Express genuine interest in their work based on what's on the card
  * End with a simple call to action like "Would love to grab coffee and hear more about [specific thing]!" or "Let's stay in touch — would be great to chat sometime."
  * Sign off with a natural closing followed by:\n[Your Name]
  * Use [Your Name] as the sender placeholder — the app will replace it

  ANTI-SPAM RULES (follow these strictly):
  * NEVER include any URLs or links (no calendly, no websites, no booking links)
  * NEVER say "no hidden agenda", "this isn't a sales call", or similar disclaimers — these are top spam trigger phrases
  * NEVER use phrases like "I hope this email finds you well" or "I hope you're doing well" — spam filter red flags
  * NEVER mention sending to multiple people or "50 business owners" — bulk language = spam
  * Keep under 100 words total. Shorter = safer.
  * Sound like a real person texting a new acquaintance, NOT a marketing email

If text comes from both sides of the card, MERGE all information intelligently:
- Deduplicate phone numbers and emails that appear on both sides
- Combine address fragments
- Front side typically has name/title/company
- Back side often has services, certifications, branch addresses, social media

OCR Text:
"""

# ============================================================
# Hardcoded follow-up email (DISABLED — AI generation re-enabled)
# ------------------------------------------------------------
# Kept as fallback. To revert to hardcoded emails:
# 1. Uncomment build_hardcoded_email()
# 2. Add result.update(build_hardcoded_email(...)) back in _extract_sync
# 3. Remove email_subject/email_draft from the EXTRACT_PROMPT JSON schema
# ============================================================
# HARDCODED_EMAIL_SUBJECT = "Business Perspective Project | Seeking Your Perspective"
#
# HARDCODED_EMAIL_TEMPLATE = """Hi {first_name},
#
# I hope you're doing well.
#
# We met through a Loudoun Chamber event, and I've been meaning to reach out.
#
# I'd love to borrow 30 minutes of your time for a virtual conversation to hear your perspective on your business today — what's working, what's challenging, and how you're thinking about the future.
#
# Lately, I've been wondering whether there are common challenges that most business owners face, whether my own perceptions are grounded in reality or simply assumptions, and how emerging technologies like AI are influencing the way businesses operate. Rather than speculate, I've decided to learn directly from business owners themselves.
#
# My goal is to speak with 50 business owners over the next couple of months across a variety of industries.
#
# To be completely transparent, there's no hidden agenda behind these conversations. This isn't a sales call, a coaching session, or research on behalf of another organization. My goal is simply to become a better student of the Loudoun business community by listening to the people who are building it every day.
#
# Would you be willing to be one of the people I learn from? I'd really value your perspective.
#
# If you are willing, please feel free to book a slot at the link below:
#
# https://calendly.com/connect-sscoach/30min
#
# Thank you,
#
# Arushi
#
# Founder | SoulSynergy-Coach
# ICF Professional Certified Coach (PCC)
# connect.sscoach@gmail.com"""
#
#
# def build_hardcoded_email(full_name) -> dict:
#     """Return the fixed follow-up email, with the recipient's first name filled in."""
#     first_name = (full_name or "").strip().split(" ")[0] if full_name else ""
#     greeting_name = first_name if first_name else "there"
#     return {
#         "email_subject": HARDCODED_EMAIL_SUBJECT,
#         "email_draft": HARDCODED_EMAIL_TEMPLATE.format(first_name=greeting_name),
#     }


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
            temperature=0.7,
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

    # Ensure email fields exist (AI should generate them, but fallback just in case)
    if not result.get("email_subject"):
        first = (result.get("full_name") or "").split(" ")[0] or "there"
        result["email_subject"] = f"Great connecting, {first}!"
    if not result.get("email_draft"):
        first = (result.get("full_name") or "").split(" ")[0] or "there"
        result["email_draft"] = (
            f"Hey {first},\n\n"
            f"Really enjoyed meeting you at the chamber event! "
            f"Would love to stay in touch and hear more about what you're working on.\n\n"
            f"Cheers,\n[Your Name]"
        )

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
