# CARDSNAP — FULL END-TO-END TEST PROMPT
# Paste this entire prompt to Claude Opus 4.6 in Antigravity

---

<role>
You are a senior QA engineer and DevOps specialist. Your job is to run, test, and validate the CardSnap application end-to-end. You are methodical, thorough, and you never skip a test. You report every result — pass, fail, or warning — with exact details. You fix issues you find inline and re-test immediately.
</role>

<task>
Start the CardSnap backend, run every test in the sequence below, fix any failures, and produce a full test report at the end. Do not stop at the first failure — run all tests, note what failed, fix, re-test, then report.
</task>

<thinking_protocol>
Before running any test, think through:
1. What is the current working directory? Confirm backend/ exists.
2. Is the .env file present and populated? Read it (mask secret values in output).
3. What port will the backend run on? Default: 8000.
4. Which tests depend on real external APIs (Vision, Bedrock, Resend, Firebase)?
5. What is the minimum passing criteria for each test?
Only then begin.
</thinking_protocol>

---

## PHASE 1 — ENVIRONMENT VALIDATION

Run these checks before starting the server. Fix any issue found before moving to Phase 2.

```bash
# 1.1 Confirm project structure
find . -type f -name "*.py" | sort
find . -type f -name "*.jsx" | sort
find . -type f -name "*.json" | grep -v node_modules | sort

# 1.2 Confirm .env exists and all keys are populated (mask values)
python3 -c "
from dotenv import load_dotenv
import os
load_dotenv()
keys = [
    'GOOGLE_VISION_API_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY', 
    'AWS_REGION',
    'RESEND_API_KEY',
    'SENDER_EMAIL',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
]
print('=== ENV CHECK ===')
all_ok = True
for k in keys:
    v = os.getenv(k)
    if v:
        masked = v[:6] + '...' + v[-4:] if len(v) > 10 else '***'
        print(f'  ✓ {k} = {masked}')
    else:
        print(f'  ✗ {k} = MISSING')
        all_ok = False
print()
print('ENV STATUS:', 'ALL OK' if all_ok else 'MISSING KEYS — FIX BEFORE CONTINUING')
"

# 1.3 Install dependencies
pip install -r requirements.txt -q

# 1.4 Validate all Python imports resolve
python3 -c "
imports = [
    'fastapi', 'uvicorn', 'boto3', 'httpx',
    'firebase_admin', 'resend', 'pydantic', 'dotenv'
]
print('=== IMPORT CHECK ===')
for pkg in imports:
    try:
        __import__(pkg)
        print(f'  ✓ {pkg}')
    except ImportError as e:
        print(f'  ✗ {pkg} — {e}')
"

# 1.5 Validate AWS Bedrock credentials
python3 -c "
import boto3, os
from dotenv import load_dotenv
load_dotenv()
try:
    client = boto3.client(
        'bedrock-runtime',
        region_name=os.getenv('AWS_REGION', 'us-east-1'),
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    )
    # List foundation models to validate credentials
    br = boto3.client(
        'bedrock',
        region_name=os.getenv('AWS_REGION', 'us-east-1'),
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    )
    models = br.list_foundation_models(byProvider='Anthropic')
    model_ids = [m['modelId'] for m in models['modelSummaries']]
    target = 'anthropic.claude-sonnet-4-5'
    if any(target in m for m in model_ids):
        print(f'  ✓ AWS Bedrock credentials valid')
        print(f'  ✓ Claude Sonnet accessible')
    else:
        print(f'  ⚠ Credentials valid but {target} not found in available models')
        print(f'  Available Anthropic models: {model_ids}')
except Exception as e:
    print(f'  ✗ AWS Bedrock error: {e}')
"

# 1.6 Validate Firebase connection
python3 -c "
import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv
load_dotenv()
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate({
            'type': 'service_account',
            'project_id': os.getenv('FIREBASE_PROJECT_ID'),
            'private_key': os.getenv('FIREBASE_PRIVATE_KEY', '').replace('\\\\n', '\n'),
            'client_email': os.getenv('FIREBASE_CLIENT_EMAIL'),
            'token_uri': 'https://oauth2.googleapis.com/token',
        })
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    # Try a read
    db.collection('_test').limit(1).get()
    print('  ✓ Firebase Firestore connection successful')
except Exception as e:
    print(f'  ✗ Firebase error: {e}')
"

# 1.7 Validate Google Vision API key
python3 -c "
import httpx, os, base64
from dotenv import load_dotenv
load_dotenv()

# Tiny 1x1 white pixel JPEG in base64
pixel = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k='

api_key = os.getenv('GOOGLE_VISION_API_KEY')
try:
    r = httpx.post(
        f'https://vision.googleapis.com/v1/images:annotate?key={api_key}',
        json={'requests': [{'image': {'content': pixel}, 'features': [{'type': 'TEXT_DETECTION'}]}]},
        timeout=10
    )
    if r.status_code == 200:
        print('  ✓ Google Vision API key valid')
    elif r.status_code == 400:
        print('  ✓ Google Vision API key valid (400 = image too small, key works)')
    else:
        print(f'  ✗ Google Vision API error: {r.status_code} — {r.text[:200]}')
except Exception as e:
    print(f'  ✗ Google Vision error: {e}')
"

# 1.8 Validate Resend API key
python3 -c "
import httpx, os
from dotenv import load_dotenv
load_dotenv()
try:
    r = httpx.get(
        'https://api.resend.com/domains',
        headers={'Authorization': f'Bearer {os.getenv(\"RESEND_API_KEY\")}'},
        timeout=10
    )
    if r.status_code in [200, 404]:
        print('  ✓ Resend API key valid')
    else:
        print(f'  ✗ Resend error: {r.status_code} — {r.text[:200]}')
except Exception as e:
    print(f'  ✗ Resend error: {e}')
"
```

---

## PHASE 2 — SERVER STARTUP

```bash
# 2.1 Start the FastAPI server in background
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for startup
sleep 3

# 2.2 Health check
echo "=== HEALTH CHECK ==="
curl -s http://localhost:8000/health | python3 -m json.tool

# 2.3 Check all routes are registered
echo "=== REGISTERED ROUTES ==="
curl -s http://localhost:8000/openapi.json | python3 -c "
import json, sys
spec = json.load(sys.stdin)
for path, methods in spec['paths'].items():
    for method in methods:
        print(f'  {method.upper()} {path}')
"
```

Expected routes:
- GET /health
- POST /extract
- POST /send-email
- POST /save-contact
- GET /contacts
- PATCH /contacts/{contact_id}

---

## PHASE 3 — API UNIT TESTS

### Test 3.1 — /extract with a real visiting card image
```bash
# Generate a synthetic visiting card as base64 for testing
python3 -c "
from PIL import Image, ImageDraw, ImageFont
import base64, io

img = Image.new('RGB', (600, 300), color='white')
draw = ImageDraw.Draw(img)

# Simulate visiting card text
lines = [
    ('Priya Sharma', (40, 40), 28),
    ('Head of Procurement', (40, 90), 18),
    ('Acme Corporation', (40, 130), 22),
    ('priya.sharma@acmecorp.com', (40, 180), 16),
    ('+91 98765 43210', (40, 220), 16),
    ('www.acmecorp.com', (40, 255), 14),
]

for text, pos, size in lines:
    draw.text(pos, text, fill='black')

buf = io.BytesIO()
img.save(buf, format='JPEG')
b64 = base64.b64encode(buf.getvalue()).decode()
print(f'data:image/jpeg;base64,{b64}')
" > /tmp/test_card_b64.txt

echo "=== TEST 3.1: /extract with synthetic card ==="
curl -s -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(cat /tmp/test_card_b64.txt)\"}" \
  | python3 -m json.tool
```

**Expected:** JSON with name, email, company, phone, job_title, email_draft, raw_text all populated.

### Test 3.2 — /extract error handling (empty/blank image)
```bash
echo "=== TEST 3.2: /extract with blank white image (no text) ==="
python3 -c "
from PIL import Image
import base64, io
img = Image.new('RGB', (100,100), color='white')
buf = io.BytesIO()
img.save(buf, format='JPEG')
b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
print(b64)
" > /tmp/blank_b64.txt

curl -s -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(cat /tmp/blank_b64.txt)\"}" \
  | python3 -m json.tool
```

**Expected:** 422 error with message about no text found — NOT a 500 crash.

### Test 3.3 — /extract with missing image field
```bash
echo "=== TEST 3.3: /extract with missing body field ==="
curl -s -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d '{}' \
  | python3 -m json.tool
```

**Expected:** 422 validation error from Pydantic — field required.

### Test 3.4 — /send-email with valid address
```bash
echo "=== TEST 3.4: /send-email real send ==="
# IMPORTANT: Replace test@youremail.com with YOUR actual email to verify receipt
curl -s -X POST http://localhost:8000/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@youremail.com",
    "subject": "CardSnap Test Email — Please Ignore",
    "body": "Hi,\n\nThis is an automated test from CardSnap. If you received this, email sending works correctly.\n\nWarm regards,\nCardSnap Test Suite"
  }' \
  | python3 -m json.tool
```

**Expected:** `{"success": true, "message_id": "...", "message": "Email sent to ..."}` AND email arrives in inbox within 60 seconds.

### Test 3.5 — /send-email with invalid email
```bash
echo "=== TEST 3.5: /send-email with bad email format ==="
curl -s -X POST http://localhost:8000/send-email \
  -H "Content-Type: application/json" \
  -d '{"to": "not-an-email", "subject": "Test", "body": "Test"}' \
  | python3 -m json.tool
```

**Expected:** 400 error — "Invalid email address".

### Test 3.6 — /send-email with missing fields
```bash
echo "=== TEST 3.6: /send-email missing body ==="
curl -s -X POST http://localhost:8000/send-email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}' \
  | python3 -m json.tool
```

**Expected:** 422 validation error.

### Test 3.7 — /save-contact
```bash
echo "=== TEST 3.7: /save-contact ==="
curl -s -X POST http://localhost:8000/save-contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Contact",
    "email": "test@example.com",
    "company": "Test Corp",
    "phone": "+91 99999 00000",
    "job_title": "QA Engineer",
    "email_draft": "Dear Test, great meeting you.",
    "email_sent": false
  }' \
  | python3 -m json.tool
```

**Expected:** `{"success": true, "id": "<firestore_doc_id>"}` — save this ID for Test 3.9.

### Test 3.8 — /contacts (list)
```bash
echo "=== TEST 3.8: GET /contacts ==="
curl -s http://localhost:8000/contacts | python3 -c "
import json, sys
contacts = json.load(sys.stdin)
print(f'Total contacts: {len(contacts)}')
for c in contacts[:3]:
    print(f'  - {c.get(\"name\")} | {c.get(\"email\")} | {c.get(\"company\")}')
"
```

**Expected:** List of contacts, newest first. At minimum the one saved in Test 3.7.

### Test 3.9 — /contacts/{id} PATCH
```bash
# Get the ID from Test 3.7 output and replace below
CONTACT_ID="REPLACE_WITH_ID_FROM_TEST_3_7"
echo "=== TEST 3.9: PATCH /contacts/{id} ==="
curl -s -X PATCH http://localhost:8000/contacts/$CONTACT_ID \
  -H "Content-Type: application/json" \
  -d '{"email_sent": true}' \
  | python3 -m json.tool
```

**Expected:** `{"success": true}` and the contact in Firestore now has `email_sent: true`.

### Test 3.10 — CORS headers
```bash
echo "=== TEST 3.10: CORS headers ==="
curl -s -I -X OPTIONS http://localhost:8000/extract \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  | grep -i "access-control"
```

**Expected:** `access-control-allow-origin: *` present in response headers.

---

## PHASE 4 — FULL END-TO-END FLOW TEST

This simulates the complete user journey in one script.

```bash
echo "=== PHASE 4: FULL END-TO-END FLOW ==="
python3 -c "
import httpx, base64, io, json, time
from PIL import Image, ImageDraw

BASE = 'http://localhost:8000'

print('--- Step 1: Generate test visiting card image ---')
img = Image.new('RGB', (600, 300), color='white')
draw = ImageDraw.Draw(img)
draw.text((40, 40), 'Rajesh Kumar', fill='black')
draw.text((40, 90), 'CTO', fill='black')
draw.text((40, 130), 'TechVision India Pvt Ltd', fill='black')
draw.text((40, 175), 'rajesh@techvision.in', fill='black')
draw.text((40, 215), '+91 70000 12345', fill='black')
buf = io.BytesIO()
img.save(buf, format='JPEG')
b64 = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
print('  ✓ Card image generated')

print()
print('--- Step 2: Extract contact from card ---')
t0 = time.time()
r = httpx.post(f'{BASE}/extract', json={'image': b64}, timeout=30)
elapsed = round(time.time() - t0, 2)

if r.status_code == 200:
    data = r.json()
    print(f'  ✓ Extraction successful in {elapsed}s')
    print(f'  name:      {data.get(\"name\")}')
    print(f'  email:     {data.get(\"email\")}')
    print(f'  company:   {data.get(\"company\")}')
    print(f'  phone:     {data.get(\"phone\")}')
    print(f'  job_title: {data.get(\"job_title\")}')
    print(f'  email_draft preview: {str(data.get(\"email_draft\", \"\"))[:80]}...')
    print(f'  raw_text preview: {str(data.get(\"raw_text\", \"\"))[:60]}...')
else:
    print(f'  ✗ Extraction FAILED: {r.status_code} — {r.text[:300]}')
    exit(1)

print()
print('--- Step 3: Save contact to Firestore ---')
save_payload = {
    'name': data.get('name'),
    'email': data.get('email'),
    'company': data.get('company'),
    'phone': data.get('phone'),
    'job_title': data.get('job_title'),
    'email_draft': data.get('email_draft'),
    'email_sent': False,
}
r2 = httpx.post(f'{BASE}/save-contact', json=save_payload, timeout=15)
if r2.status_code == 200:
    contact_id = r2.json().get('id')
    print(f'  ✓ Contact saved — Firestore ID: {contact_id}')
else:
    print(f'  ✗ Save FAILED: {r2.status_code} — {r2.text}')
    exit(1)

print()
print('--- Step 4: Verify contact appears in list ---')
r3 = httpx.get(f'{BASE}/contacts', timeout=15)
contacts = r3.json()
found = any(c.get('id') == contact_id for c in contacts)
print(f'  ✓ Contact found in list: {found}')
print(f'  Total contacts in DB: {len(contacts)}')

print()
print('--- Step 5: Send follow-up email ---')
email = data.get('email')
if email:
    t1 = time.time()
    r4 = httpx.post(f'{BASE}/send-email', json={
        'to': email,
        'subject': f'Great connecting with you, {(data.get(\"name\") or \"\").split()[0]}',
        'body': data.get('email_draft', '')
    }, timeout=15)
    elapsed2 = round(time.time() - t1, 2)
    if r4.status_code == 200:
        print(f'  ✓ Email sent in {elapsed2}s — message_id: {r4.json().get(\"message_id\")}')
    else:
        print(f'  ✗ Email FAILED: {r4.status_code} — {r4.text}')
else:
    print('  ⚠ No email on card — skipping send test')

print()
print('--- Step 6: Mark email sent in Firestore ---')
r5 = httpx.patch(f'{BASE}/contacts/{contact_id}', json={'email_sent': True}, timeout=15)
print(f'  ✓ Updated email_sent: {r5.json()}')

print()
print('=== END-TO-END FLOW: COMPLETE ===')
"
```

---

## PHASE 5 — PERFORMANCE TEST

```bash
echo "=== PHASE 5: PERFORMANCE ==="
python3 -c "
import httpx, time

BASE = 'http://localhost:8000'

# Health endpoint latency
times = []
for i in range(10):
    t = time.time()
    httpx.get(f'{BASE}/health')
    times.append(round((time.time() - t) * 1000, 1))

avg = round(sum(times)/len(times), 1)
print(f'Health endpoint avg latency: {avg}ms (10 requests)')
print(f'Min: {min(times)}ms  Max: {max(times)}ms')

# Contacts list latency
t = time.time()
r = httpx.get(f'{BASE}/contacts', timeout=10)
contacts_time = round((time.time() - t) * 1000, 1)
print(f'GET /contacts latency: {contacts_time}ms ({len(r.json())} contacts)')
"
```

---

## PHASE 6 — CLEANUP & FINAL REPORT

```bash
# Stop the server
kill $SERVER_PID 2>/dev/null
echo "Server stopped."
```

After running all phases, produce a report in exactly this format:

---

## TEST REPORT — CardSnap API
**Date:** [today]
**Build:** AWS Bedrock + FastAPI + Firebase + Resend

### PHASE 1 — Environment
| Check | Status | Notes |
|---|---|---|
| Project structure | ✓/✗ | |
| All env vars present | ✓/✗ | |
| All imports resolve | ✓/✗ | |
| AWS Bedrock credentials | ✓/✗ | |
| Firebase connection | ✓/✗ | |
| Google Vision API | ✓/✗ | |
| Resend API | ✓/✗ | |

### PHASE 2 — Server Startup
| Check | Status | Notes |
|---|---|---|
| Server starts cleanly | ✓/✗ | |
| Health endpoint responds | ✓/✗ | |
| All 6 routes registered | ✓/✗ | |

### PHASE 3 — API Unit Tests
| Test | Endpoint | Status | Response Time | Notes |
|---|---|---|---|---|
| 3.1 Extract real card | POST /extract | ✓/✗ | Xms | |
| 3.2 Extract blank image | POST /extract | ✓/✗ | Xms | |
| 3.3 Extract missing field | POST /extract | ✓/✗ | Xms | |
| 3.4 Send real email | POST /send-email | ✓/✗ | Xms | |
| 3.5 Send invalid email | POST /send-email | ✓/✗ | Xms | |
| 3.6 Send missing fields | POST /send-email | ✓/✗ | Xms | |
| 3.7 Save contact | POST /save-contact | ✓/✗ | Xms | |
| 3.8 List contacts | GET /contacts | ✓/✗ | Xms | |
| 3.9 Update contact | PATCH /contacts/:id | ✓/✗ | Xms | |
| 3.10 CORS headers | OPTIONS /extract | ✓/✗ | Xms | |

### PHASE 4 — End-to-End Flow
| Step | Status | Time | Notes |
|---|---|---|---|
| Card image → OCR → AI extraction | ✓/✗ | Xs | |
| Save to Firestore | ✓/✗ | Xms | |
| Contact appears in list | ✓/✗ | Xms | |
| Follow-up email sent | ✓/✗ | Xms | |
| Email_sent flag updated | ✓/✗ | Xms | |

### PHASE 5 — Performance
| Metric | Value | Acceptable? |
|---|---|---|
| Health endpoint avg latency | Xms | <100ms = ✓ |
| /contacts avg latency | Xms | <500ms = ✓ |
| Full extract pipeline | Xs | <8s = ✓ |

### ISSUES FOUND & FIXED
List each issue, what caused it, and how it was fixed.

### FINAL VERDICT
**PASS / FAIL / PARTIAL**

If PARTIAL or FAIL — list exactly what is broken and the fix needed.

---
*Generated by CardSnap Test Suite*
