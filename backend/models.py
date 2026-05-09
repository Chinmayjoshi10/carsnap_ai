from pydantic import BaseModel
from typing import Optional, List


class ExtractRequest(BaseModel):
    front_image: str         # base64 data URL (required)
    back_image: Optional[str] = None  # base64 data URL (optional)


class ContactData(BaseModel):
    """Full semantic contact data returned from AI extraction."""
    full_name: Optional[str] = None
    job_title: Optional[str] = None
    company: Optional[str] = None
    emails: List[str] = []
    phones: List[str] = []
    address: Optional[str] = None
    website: Optional[str] = None
    linkedin: Optional[str] = None
    social_handles: List[str] = []
    services: List[str] = []
    industry_tags: List[str] = []
    business_summary: Optional[str] = None
    notes: Optional[str] = None
    raw_card_text: str = ""
    email_subject: str = ""
    email_draft: str = ""
    confidence: float = 0.0

    # Legacy aliases for frontend compatibility
    @property
    def name(self):
        return self.full_name

    @property
    def email(self):
        return self.emails[0] if self.emails else None

    @property
    def phone(self):
        return self.phones[0] if self.phones else None


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    uid: Optional[str] = None


class SaveContactRequest(BaseModel):
    """Full semantic contact storage request."""
    full_name: Optional[str] = None
    job_title: Optional[str] = None
    company: Optional[str] = None
    emails: List[str] = []
    phones: List[str] = []
    address: Optional[str] = None
    website: Optional[str] = None
    linkedin: Optional[str] = None
    social_handles: List[str] = []
    services: List[str] = []
    industry_tags: List[str] = []
    business_summary: Optional[str] = None
    notes: Optional[str] = None
    raw_card_text: Optional[str] = None
    email_subject: Optional[str] = None
    email_draft: Optional[str] = None
    front_image_url: Optional[str] = None
    back_image_url: Optional[str] = None
    confidence: float = 0.0
    email_sent: bool = False
    saved_by: Optional[str] = None
