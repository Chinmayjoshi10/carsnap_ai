import os
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

# Initialize only once
if not firebase_admin._apps:
    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": os.getenv("FIREBASE_PROJECT_ID"),
        "private_key": os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n"),
        "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
        "token_uri": "https://oauth2.googleapis.com/token",
    })
    firebase_admin.initialize_app(cred)

db = firestore.client()

def save_contact(contact: dict) -> str:
    """Save contact to Firestore, return document ID."""
    contact["created_at"] = datetime.utcnow()
    doc_ref = db.collection("contacts").add(contact)
    return doc_ref[1].id

def get_all_contacts() -> list:
    """Fetch all contacts ordered by newest first."""
    docs = db.collection("contacts").order_by(
        "created_at", direction=firestore.Query.DESCENDING
    ).stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]

def update_contact(contact_id: str, updates: dict):
    """Update specific fields on a contact."""
    db.collection("contacts").document(contact_id).update(updates)
