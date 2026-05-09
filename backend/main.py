from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.extract import router as extract_router
from routes.send_email import router as email_router
from routes.auth import router as auth_router
from services.firebase import db, save_contact, get_all_contacts, update_contact
from models import SaveContactRequest
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="CardSnap API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock down to your Vercel URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extract_router)
app.include_router(email_router)
app.include_router(auth_router)

@app.post("/save-contact")
async def save(contact: SaveContactRequest):
    contact_id = save_contact(contact.dict())
    return {"success": True, "id": contact_id}

@app.get("/contacts")
async def contacts():
    return get_all_contacts()

@app.patch("/contacts/{contact_id}")
async def update(contact_id: str, updates: dict):
    update_contact(contact_id, updates)
    return {"success": True}

@app.get("/health")
async def health():
    return {"status": "ok"}
