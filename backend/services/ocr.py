"""
OCR service — extract text from business card images via Google Vision API.
Supports single image or dual-side (front + back) extraction.
"""

import os
import httpx
from dotenv import load_dotenv

load_dotenv()


async def extract_text_from_image(base64_image: str) -> str:
    """Send a single image to Google Vision API, return raw OCR text."""
    # Strip data URL prefix if present
    if "," in base64_image:
        base64_image = base64_image.split(",")[1]

    api_key = os.getenv("GOOGLE_VISION_API_KEY")
    url = f"https://vision.googleapis.com/v1/images:annotate?key={api_key}"

    payload = {
        "requests": [{
            "image": {"content": base64_image},
            "features": [{"type": "TEXT_DETECTION"}]
        }]
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

    raw_text = data["responses"][0].get("fullTextAnnotation", {}).get("text", "")
    return raw_text.strip()


async def extract_dual_side(front_image: str, back_image: str = None) -> dict:
    """
    Extract text from front (required) and back (optional) of a business card.
    
    Returns:
        {
            "front_raw_text": str,
            "back_raw_text": str or "",
            "combined_raw_text": str
        }
    """
    front_text = await extract_text_from_image(front_image)

    back_text = ""
    if back_image:
        try:
            back_text = await extract_text_from_image(back_image)
        except Exception:
            # Back side OCR failure is non-fatal — proceed with front only
            back_text = ""

    # Merge intelligently
    combined = front_text
    if back_text:
        combined = f"=== FRONT SIDE ===\n{front_text}\n\n=== BACK SIDE ===\n{back_text}"

    return {
        "front_raw_text": front_text,
        "back_raw_text": back_text,
        "combined_raw_text": combined,
    }
