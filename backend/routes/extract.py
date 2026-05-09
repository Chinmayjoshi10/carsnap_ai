from fastapi import APIRouter, HTTPException
from models import ExtractRequest, ContactData
from services.ocr import extract_dual_side
from services.llm import extract_contact_from_text
from services.storage import upload_card_image
import json

router = APIRouter()


@router.post("/extract")
async def extract(request: ExtractRequest):
    """
    Extract contact intelligence from business card image(s).
    Supports front-only or front + back dual-side extraction.
    """
    # Step 1: OCR — dual side
    try:
        ocr_result = await extract_dual_side(request.front_image, request.back_image)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OCR failed: {str(e)}")

    combined_text = ocr_result["combined_raw_text"]

    if not combined_text:
        raise HTTPException(
            status_code=422,
            detail="no_text: Could not read text from image. Try better lighting or a clearer photo."
        )

    # Step 2: LLM extraction
    try:
        contact = await extract_contact_from_text(combined_text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned invalid response. Please retry.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI extraction failed: {str(e)}")

    # Step 3: Upload images to Firebase Storage (non-blocking, best effort)
    front_url = ""
    back_url = ""
    try:
        front_url = upload_card_image(request.front_image, "front")
    except Exception:
        pass
    if request.back_image:
        try:
            back_url = upload_card_image(request.back_image, "back")
        except Exception:
            pass

    # Build response
    response_data = {
        **contact,
        "raw_card_text": combined_text,
        "front_image_url": front_url,
        "back_image_url": back_url,
        "has_back": request.back_image is not None,
    }

    return response_data
