# CardSnap — Full Build Instructions for Claude

You are building **CardSnap**, a mobile-first web app that:
1. Captures a visiting card photo
2. Extracts contact info via OCR + AI
3. Generates a professional follow-up email
4. Sends the real email via Resend
5. Saves contact to Firebase Firestore

Read this entire file before writing a single line of code.

---

## STACK

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend API | Python (FastAPI) |
| OCR | Google Cloud Vision API |
| AI/LLM | Claude API (`claude-sonnet-4-20250514`) |
| Database | Firebase Firestore |
| Email | Resend API |
| Deployment | Frontend → Vercel, Backend → Railway |

---

## PROJECT STRUCTURE

Build exactly this structure. Do not add extra files or folders.

```
cardsnap/
├── frontend/                        # React + Vite app
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CardUploader.jsx
│   │   │   ├── ContactForm.jsx
│   │   │   ├── EmailEditor.jsx
│   │   │   ├── ContactList.jsx
│   │   │   └── StatusBanner.jsx
│   │   ├── pages/
│   │   │   ├── Capture.jsx
│   │   │   └── Contacts.jsx
│   │   ├── lib/
│   │   │   ├── firebase.js
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
│
├── backend/                         # Python FastAPI
│   ├── main.py                      # FastAPI app entry point
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── extract.py               # POST /extract
│   │   └── send_email.py            # POST /send-email
│   ├── services/
│   │   ├── __init__.py
│   │   ├── ocr.py                   # Google Vision wrapper
│   │   ├── llm.py                   # Claude API wrapper
│   │   └── firebase.py              # Firestore wrapper
│   ├── models.py                    # Pydantic request/response models
│   ├── requirements.txt
│   └── .env.example
│
├── .gitignore
└── README.md
```

---

## ENVIRONMENT VARIABLES

### Frontend (`frontend/.env.local`)
```
VITE_API_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Backend (`backend/.env`)
```
GOOGLE_VISION_API_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
SENDER_EMAIL=onboarding@resend.dev
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
```

---

## BACKEND — BUILD INSTRUCTIONS

### `backend/requirements.txt`
```
fastapi==0.111.0
uvicorn==0.29.0
python-dotenv==1.0.1
anthropic==0.25.0
google-cloud-vision==3.7.2
resend==2.0.0
firebase-admin==6.5.0
pydantic==2.7.1
python-multipart==0.0.9
httpx==0.27.0
Pillow==10.3.0
```

### `backend/models.py`
```python
from pydantic import BaseModel
from typing import Optional

class ExtractRequest(BaseModel):
    image: str  # base64 data URL

class ContactData(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    email_draft: str
    raw_text: str

class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str

class SaveContactRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    email_draft: Optional[str] = None
    email_sent: bool = False
```

### `backend/services/ocr.py`
```python
import os
import base64
import httpx
from dotenv import load_dotenv

load_dotenv()

async def extract_text_from_image(base64_image: str) -> str:
    """Send image to Google Vision API, return raw OCR text."""
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
```

### `backend/services/llm.py`
```python
import os
import json
import anthropic
from dotenv import load_dotenv

load_dotenv()

EXTRACT_PROMPT = """You are a contact extraction assistant. I will give you raw OCR text from a business/visiting card. The text may have errors, odd line breaks, or garbled characters — work with it as best you can.

Extract the following fields and return ONLY a valid JSON object, no other text, no markdown fences:

{
  "name": string or null,
  "email": string or null,
  "company": string or null,
  "phone": string or null,
  "job_title": string or null,
  "email_draft": string
}

Rules:
- name: Full name, best guess from the text
- email: First valid email address found, or null
- company: Company or organization name
- phone: First phone number found, or null
- job_title: Job title or designation
- email_draft: A short professional follow-up email. Rules:
  * Address by first name
  * 3-4 sentences only
  * Warm but professional tone
  * Reference that you met recently and exchanged cards
  * Express interest in staying in touch
  * Do NOT invent specific meeting details
  * Sign off as "Warm regards,\\n[Your Name]" with a placeholder

OCR Text:
"""

async def extract_contact_from_text(raw_text: str) -> dict:
    """Use Claude to extract structured contact data from OCR text."""
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=800,
        messages=[{
            "role": "user",
            "content": EXTRACT_PROMPT + raw_text
        }]
    )

    text = message.content[0].text.strip()
    # Strip markdown fences if model adds them
    text = text.replace("```json", "").replace("```", "").strip()

    return json.loads(text)
```

### `backend/services/firebase.py`
```python
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
```

### `backend/routes/extract.py`
```python
from fastapi import APIRouter, HTTPException
from models import ExtractRequest, ContactData
from services.ocr import extract_text_from_image
from services.llm import extract_contact_from_text
import json

router = APIRouter()

@router.post("/extract", response_model=ContactData)
async def extract(request: ExtractRequest):
    # Step 1: OCR
    try:
        raw_text = await extract_text_from_image(request.image)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OCR failed: {str(e)}")

    if not raw_text:
        raise HTTPException(
            status_code=422,
            detail="no_text: Could not read text from image. Try better lighting or a clearer photo."
        )

    # Step 2: LLM extraction
    try:
        contact = await extract_contact_from_text(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned invalid response. Please retry.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI extraction failed: {str(e)}")

    return ContactData(**contact, raw_text=raw_text)
```

### `backend/routes/send_email.py`
```python
import os
import re
import resend
from fastapi import APIRouter, HTTPException
from models import SendEmailRequest
from dotenv import load_dotenv

load_dotenv()

resend.api_key = os.getenv("RESEND_API_KEY")
router = APIRouter()

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

@router.post("/send-email")
async def send_email(request: SendEmailRequest):
    if not EMAIL_REGEX.match(request.to):
        raise HTTPException(status_code=400, detail="Invalid email address")

    html_body = request.body.replace("\n", "<br/>")
    html_content = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;line-height:1.7;color:#1E293B">
        {html_body}
    </div>
    """

    try:
        params = {
            "from": os.getenv("SENDER_EMAIL", "onboarding@resend.dev"),
            "to": [request.to],
            "subject": request.subject,
            "text": request.body,
            "html": html_content,
        }
        response = resend.Emails.send(params)
        return {"success": True, "message_id": response.get("id"), "message": f"Email sent to {request.to}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
```

### `backend/routes/__init__.py`
```python
# empty
```

### `backend/services/__init__.py`
```python
# empty
```

### `backend/main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.extract import router as extract_router
from routes.send_email import router as email_router
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
```

---

## FRONTEND — BUILD INSTRUCTIONS

### `frontend/package.json`
```json
{
  "name": "cardsnap-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.23.0",
    "firebase": "^10.11.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "vite": "^5.2.10"
  }
}
```

### `frontend/vite.config.js`
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
})
```

### `frontend/tailwind.config.js`
```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

### `frontend/postcss.config.js`
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} }
}
```

### `frontend/index.html`
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CardSnap</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### `frontend/src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; background: #F8FAFC; }
```

### `frontend/src/main.jsx`
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
```

### `frontend/src/App.jsx`
```jsx
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Capture from './pages/Capture'
import Contacts from './pages/Contacts'

function Nav() {
  const { pathname } = useLocation()
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between max-w-lg mx-auto">
      <span className="text-blue-700 font-bold text-lg">📇 CardSnap</span>
      <div className="flex gap-4">
        <Link to="/" className={`text-sm font-medium ${pathname === '/' ? 'text-blue-600' : 'text-slate-500'}`}>Capture</Link>
        <Link to="/contacts" className={`text-sm font-medium ${pathname === '/contacts' ? 'text-blue-600' : 'text-slate-500'}`}>Contacts</Link>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-lg mx-auto min-h-screen">
        <Nav />
        <div className="pt-16 pb-8 px-4">
          <Routes>
            <Route path="/" element={<Capture />} />
            <Route path="/contacts" element={<Contacts />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
```

### `frontend/src/lib/api.js`
```js
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function extractCard(base64Image) {
  const res = await fetch(`${BASE}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Extraction failed')
  }
  return res.json()
}

export async function sendEmail(to, subject, body) {
  const res = await fetch(`${BASE}/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Email send failed')
  }
  return res.json()
}

export async function saveContact(contact) {
  const res = await fetch(`${BASE}/save-contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contact)
  })
  if (!res.ok) throw new Error('Save failed')
  return res.json()
}

export async function getContacts() {
  const res = await fetch(`${BASE}/contacts`)
  if (!res.ok) throw new Error('Fetch failed')
  return res.json()
}

export async function updateContact(id, updates) {
  const res = await fetch(`${BASE}/contacts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  if (!res.ok) throw new Error('Update failed')
  return res.json()
}
```

### `frontend/src/lib/firebase.js`
```js
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
```

### `frontend/src/components/StatusBanner.jsx`
```jsx
export default function StatusBanner({ status, message }) {
  if (!status) return null

  const styles = {
    loading: 'bg-blue-50 border-blue-200 text-blue-700',
    success: 'bg-green-50 border-green-200 text-green-700',
    error:   'bg-red-50 border-red-200 text-red-700',
  }

  const icons = { loading: '⏳', success: '✅', error: '❌' }

  return (
    <div className={`border rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-medium ${styles[status]}`}>
      <span>{icons[status]}</span>
      <span>{message}</span>
    </div>
  )
}
```

### `frontend/src/components/CardUploader.jsx`
```jsx
import { useState } from 'react'

export default function CardUploader({ onImageCaptured, previewUrl }) {
  const [dragging, setDragging] = useState(false)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onloadend = () => onImageCaptured(reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <div className="w-full">
      {previewUrl ? (
        <div className="relative">
          <img src={previewUrl} alt="Card preview" className="w-full rounded-2xl object-cover max-h-52 border border-slate-200" />
          <button
            onClick={() => onImageCaptured(null)}
            className="absolute top-2 right-2 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow text-slate-500 text-sm"
          >✕</button>
        </div>
      ) : (
        <label
          className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all
            ${dragging ? 'border-blue-500 bg-blue-50' : 'border-blue-300 bg-white hover:bg-blue-50'}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        >
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <span className="text-5xl">📷</span>
          <div className="text-center">
            <p className="text-blue-600 font-semibold text-base">Tap to capture or upload</p>
            <p className="text-slate-400 text-sm mt-1">Visiting card photo</p>
          </div>
        </label>
      )}
    </div>
  )
}
```

### `frontend/src/components/ContactForm.jsx`
```jsx
export default function ContactForm({ contact, onChange }) {
  const fields = [
    { key: 'name',      label: 'Full Name',   placeholder: 'Not found — enter manually', type: 'text' },
    { key: 'email',     label: 'Email',       placeholder: 'Not found — enter manually', type: 'email' },
    { key: 'company',   label: 'Company',     placeholder: 'Not found — enter manually', type: 'text' },
    { key: 'phone',     label: 'Phone',       placeholder: 'Not found — enter manually', type: 'tel' },
    { key: 'job_title', label: 'Job Title',   placeholder: 'Not found — enter manually', type: 'text' },
  ]

  return (
    <div className="flex flex-col gap-3">
      {fields.map(({ key, label, placeholder, type }) => (
        <div key={key}>
          <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">{label}</label>
          <input
            type={type}
            value={contact[key] || ''}
            onChange={(e) => onChange({ ...contact, [key]: e.target.value })}
            placeholder={placeholder}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white placeholder-slate-300"
          />
        </div>
      ))}
    </div>
  )
}
```

### `frontend/src/components/EmailEditor.jsx`
```jsx
export default function EmailEditor({ value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Follow-up Email</label>
        <span className="text-xs text-slate-400">{value?.length || 0} chars</span>
      </div>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white resize-none leading-relaxed"
        placeholder="AI-generated email will appear here..."
      />
    </div>
  )
}
```

### `frontend/src/components/ContactList.jsx`
```jsx
import { useState, useEffect } from 'react'
import { getContacts } from '../lib/api'

export default function ContactList() {
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getContacts().then(setContacts).finally(() => setLoading(false))
  }, [])

  const filtered = contacts.filter(c =>
    [c.name, c.email, c.company].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  )

  if (loading) return <p className="text-center text-slate-400 py-10">Loading contacts...</p>

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, email, or company..."
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {filtered.length === 0 && (
        <p className="text-center text-slate-400 py-10 text-sm">
          {search ? 'No contacts match your search.' : 'No contacts saved yet.'}
        </p>
      )}
      {filtered.map(c => (
        <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-base flex-shrink-0">
            {c.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">{c.name || 'No name'}</p>
            <p className="text-slate-500 text-xs truncate">{c.company || ''}</p>
            <p className="text-blue-600 text-xs truncate">{c.email || 'No email'}</p>
          </div>
          {c.email_sent && (
            <span className="text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded-full flex-shrink-0">✓ Sent</span>
          )}
        </div>
      ))}
    </div>
  )
}
```

### `frontend/src/pages/Capture.jsx`
```jsx
import { useState, useRef } from 'react'
import CardUploader from '../components/CardUploader'
import ContactForm from '../components/ContactForm'
import EmailEditor from '../components/EmailEditor'
import StatusBanner from '../components/StatusBanner'
import { extractCard, sendEmail, saveContact, updateContact } from '../lib/api'

const emptyContact = { name: '', email: '', company: '', phone: '', job_title: '' }

export default function Capture() {
  const [image, setImage] = useState(null)
  const [contact, setContact] = useState(emptyContact)
  const [emailDraft, setEmailDraft] = useState('')
  const [status, setStatus] = useState(null)   // { type, message }
  const [extracted, setExtracted] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const lastSentRef = useRef(0)

  const handleImage = async (base64) => {
    if (!base64) { setImage(null); setContact(emptyContact); setEmailDraft(''); setExtracted(false); return }
    setImage(base64)
    setStatus({ type: 'loading', message: 'Reading card...' })
    try {
      const data = await extractCard(base64)
      setContact({
        name: data.name || '',
        email: data.email || '',
        company: data.company || '',
        phone: data.phone || '',
        job_title: data.job_title || '',
      })
      setEmailDraft(data.email_draft || '')
      setExtracted(true)
      setStatus({ type: 'success', message: 'Card read successfully! Review and edit below.' })
      setTimeout(() => setStatus(null), 3000)
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Could not read card. Try a clearer photo.' })
    }
  }

  const handleSend = async () => {
    if (!contact.email) return setStatus({ type: 'error', message: 'No email address found. Add one manually.' })
    if (Date.now() - lastSentRef.current < 60000) return setStatus({ type: 'error', message: 'Please wait a moment before sending again.' })
    setStatus({ type: 'loading', message: 'Sending email...' })
    try {
      const subject = `Great connecting with you${contact.name ? ', ' + contact.name.split(' ')[0] : ''}`
      await sendEmail(contact.email, subject, emailDraft)
      lastSentRef.current = Date.now()
      if (savedId) await updateContact(savedId, { email_sent: true })
      setStatus({ type: 'success', message: `✉️ Email sent to ${contact.email}!` })
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Email failed. Check the address and retry.' })
    }
  }

  const handleSave = async () => {
    setStatus({ type: 'loading', message: 'Saving contact...' })
    try {
      const result = await saveContact({ ...contact, email_draft: emailDraft, email_sent: false })
      setSavedId(result.id)
      setStatus({ type: 'success', message: '✅ Contact saved!' })
      setTimeout(() => setStatus(null), 3000)
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to save. Try again.' })
    }
  }

  const reset = () => {
    setImage(null); setContact(emptyContact); setEmailDraft('')
    setStatus(null); setExtracted(false); setSavedId(null)
  }

  return (
    <div className="flex flex-col gap-5 pt-2">
      <CardUploader onImageCaptured={handleImage} previewUrl={image} />

      {status && <StatusBanner status={status.type} message={status.message} />}

      {extracted && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Contact Info</h2>
            <ContactForm contact={contact} onChange={setContact} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Follow-up Email</h2>
            <EmailEditor value={emailDraft} onChange={setEmailDraft} />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSend}
              disabled={!contact.email}
              className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-semibold text-sm active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✉️ Send Email
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-slate-800 text-white rounded-xl py-3 font-semibold text-sm active:scale-95 transition-transform"
            >
              💾 Save Contact
            </button>
          </div>

          <button onClick={reset} className="text-center text-slate-400 text-sm py-2 underline underline-offset-2">
            Capture another card
          </button>
        </>
      )}
    </div>
  )
}
```

### `frontend/src/pages/Contacts.jsx`
```jsx
import ContactList from '../components/ContactList'

export default function Contacts() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-lg font-bold text-slate-800">Saved Contacts</h1>
      <ContactList />
    </div>
  )
}
```

---

## DEPLOYMENT

### Backend — Railway
1. Push `backend/` folder to a GitHub repo
2. Create new project on railway.app → Deploy from GitHub
3. Set all env variables from `backend/.env.example` in Railway dashboard
4. Railway auto-detects Python, runs `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Copy the Railway public URL (e.g. `https://cardsnap-api.up.railway.app`)

### Frontend — Vercel
1. Push `frontend/` folder to GitHub
2. Import on vercel.com → set root directory to `frontend/`
3. Add env variables including `VITE_API_URL=https://your-railway-url.up.railway.app`
4. Deploy

### Local Development
```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in keys
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
cp .env.example .env.local   # fill in keys
npm run dev
```

---

## COMMON ERRORS & FIXES

| Error | Cause | Fix |
|---|---|---|
| `no_text` from /extract | Blurry image or bad lighting | Show retry message to user, keep image in state |
| `JSONDecodeError` in llm.py | Claude added markdown fences | Already handled — strip in code |
| CORS error in browser | Backend CORS not set | Already set in main.py with `allow_origins=["*"]` |
| Firebase init error | Wrong private key format | Ensure `\\n` → `\n` replacement in firebase.py |
| Resend 422 error | Unverified sender email | Use `onboarding@resend.dev` for demo |
| Cold start slow | Railway free tier | Upgrade to $5/mo paid or use always-on |

---

## BUILD ORDER (follow exactly)

1. Set up Firebase project → get config keys
2. Set up Google Cloud project → enable Vision API → get API key
3. Sign up Resend → verify email → get API key
4. Get Anthropic API key
5. Build backend first → test `/health`, `/extract`, `/send-email` with curl or Postman
6. Build frontend → wire up to local backend → test full flow
7. Deploy backend to Railway → update `VITE_API_URL`
8. Deploy frontend to Vercel

---

*CardSnap MVP — Python + React — Built to ship in 7 days*
