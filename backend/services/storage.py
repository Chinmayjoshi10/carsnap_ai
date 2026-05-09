"""
Firebase Storage service — upload card images, return public URLs.

Stores images in Firebase Storage (via Google Cloud Storage)
and returns publicly accessible URLs for Firestore references.
"""

import os
import base64
import uuid
from datetime import datetime
from firebase_admin import storage
from dotenv import load_dotenv

load_dotenv()

BUCKET_NAME = os.getenv("FIREBASE_STORAGE_BUCKET", "")


def _get_bucket():
    """Get or initialize the storage bucket."""
    if not BUCKET_NAME:
        return None
    try:
        return storage.bucket(BUCKET_NAME)
    except Exception:
        return None


def upload_card_image(base64_image: str, side: str = "front") -> str:
    """
    Upload a base64-encoded card image to Firebase Storage.
    
    Args:
        base64_image: base64 data URL (data:image/jpeg;base64,...)
        side: "front" or "back"
    
    Returns:
        Public URL of the uploaded image, or empty string if storage not configured
    """
    bucket = _get_bucket()
    if not bucket:
        # Storage not configured — return empty (non-fatal)
        return ""

    try:
        # Strip data URL prefix
        if "," in base64_image:
            header, b64data = base64_image.split(",", 1)
        else:
            b64data = base64_image
            header = ""

        # Determine content type
        content_type = "image/jpeg"
        if "png" in header:
            content_type = "image/png"
        elif "webp" in header:
            content_type = "image/webp"

        ext = content_type.split("/")[1]
        image_bytes = base64.b64decode(b64data)

        # Generate unique path
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_id = uuid.uuid4().hex[:8]
        blob_path = f"cards/{timestamp}_{unique_id}_{side}.{ext}"

        blob = bucket.blob(blob_path)
        blob.upload_from_string(image_bytes, content_type=content_type)
        blob.make_public()

        return blob.public_url

    except Exception:
        # Upload failure is non-fatal — contact still gets saved
        return ""
