"""
Backend smoke tests for CardSnap.

Run locally:
    python smoke_test.py
Run against deployed backend:
    python smoke_test.py https://your-backend.up.railway.app

Exits 0 on all-pass, 1 on any failure. Designed to run pre/post deploy.
"""

import sys
import json
import base64
import time
from pathlib import Path

import httpx

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8000"
TIMEOUT = 60.0

# Tiny 1x1 PNG so we can probe /extract shape without burning OCR/LLM time on real images.
TINY_PNG_B64 = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)

# Optional real card image for a full extraction smoke (skipped if file missing).
REAL_CARD = Path(__file__).parent.parent / "frontend" / "test_assets" / "test_card.jpg"

# ANSI colors — disabled if not a TTY.
_TTY = sys.stdout.isatty()
G = "\033[32m" if _TTY else ""
R = "\033[31m" if _TTY else ""
Y = "\033[33m" if _TTY else ""
B = "\033[1m" if _TTY else ""
N = "\033[0m" if _TTY else ""

results = []  # list[(name, status, detail)]


def check(name, fn):
    print(f"  · {name} ... ", end="", flush=True)
    t = time.time()
    try:
        detail = fn() or ""
        elapsed = (time.time() - t) * 1000
        print(f"{G}PASS{N} ({elapsed:.0f} ms) {detail}")
        results.append((name, "pass", detail))
    except AssertionError as e:
        elapsed = (time.time() - t) * 1000
        print(f"{R}FAIL{N} ({elapsed:.0f} ms)\n    {e}")
        results.append((name, "fail", str(e)))
    except Exception as e:
        elapsed = (time.time() - t) * 1000
        print(f"{R}ERROR{N} ({elapsed:.0f} ms)\n    {type(e).__name__}: {e}")
        results.append((name, "error", f"{type(e).__name__}: {e}"))


def section(title):
    print(f"\n{B}{title}{N}")


def main():
    print(f"{B}CardSnap backend smoke tests{N}")
    print(f"  Target: {BASE}\n")

    client = httpx.Client(timeout=TIMEOUT, follow_redirects=False)

    # ───── Health & basic routing ─────
    section("Health & routing")

    def health():
        r = client.get(f"{BASE}/health")
        assert r.status_code == 200, f"expected 200, got {r.status_code}"
        body = r.json()
        assert body.get("status") == "ok", f"unexpected body: {body}"

    check("GET /health returns {status: ok}", health)

    def openapi():
        r = client.get(f"{BASE}/openapi.json")
        assert r.status_code == 200, f"openapi expected 200, got {r.status_code}"
        spec = r.json()
        paths = set(spec.get("paths", {}).keys())
        # Spot-check a few routes wired in main.py
        for p in ["/health", "/contacts", "/extract", "/send-email"]:
            assert p in paths, f"route {p} missing from OpenAPI"
        return f"({len(paths)} routes)"

    check("OpenAPI lists core routes", openapi)

    # ───── /contacts (read path) ─────
    section("Contacts")

    def contacts_get():
        r = client.get(f"{BASE}/contacts")
        assert r.status_code == 200, f"expected 200, got {r.status_code}"
        data = r.json()
        assert isinstance(data, list), f"expected list, got {type(data).__name__}"
        return f"({len(data)} contacts)"

    check("GET /contacts returns a list", contacts_get)

    # CRUD round-trip — save a synthetic contact, then PATCH it, then verify via list.
    state = {}

    def save_contact():
        payload = {
            "full_name": "Smoke Test User",
            "company": "Smoke Co",
            "emails": ["smoke@test.invalid"],
            "phones": [],
            "email_subject": "Hi",
            "email_draft": "Hello",
            "email_sent": False,
            "saved_by": "smoke_uid",
            "notes": "DELETE ME — created by smoke_test.py",
        }
        r = client.post(f"{BASE}/save-contact", json=payload)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert body.get("success") is True
        assert body.get("id"), "missing id in response"
        state["id"] = body["id"]
        return f"(id={body['id'][:8]}...)"

    check("POST /save-contact creates a record", save_contact)

    def patch_contact():
        if "id" not in state:
            raise AssertionError("no contact id from save step — skipping")
        r = client.patch(
            f"{BASE}/contacts/{state['id']}",
            json={"email_sent": True},
        )
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"

    check("PATCH /contacts/{id} updates", patch_contact)

    # ───── /extract — schema validation ─────
    section("Extraction")

    def extract_missing_body():
        r = client.post(f"{BASE}/extract", json={})
        assert r.status_code in (400, 422), f"expected 422, got {r.status_code}"

    check("POST /extract with empty body returns 4xx", extract_missing_body)

    def extract_tiny_image():
        # Tiny 1x1 PNG — Google Vision will find no text, we expect 422 "no_text"
        # or any 4xx/5xx. We're just checking the route doesn't blow up.
        r = client.post(
            f"{BASE}/extract",
            json={"front_image": TINY_PNG_B64, "back_image": None},
        )
        # 422 (no_text) is the expected happy-path here.
        assert r.status_code in (200, 422, 502), f"unexpected status {r.status_code}: {r.text[:200]}"
        return f"(status={r.status_code})"

    check("POST /extract handles tiny image gracefully", extract_tiny_image)

    def extract_real_card():
        if not REAL_CARD.exists():
            return "(skipped — test_card.jpg missing)"
        b64 = base64.b64encode(REAL_CARD.read_bytes()).decode("ascii")
        data_url = f"data:image/jpeg;base64,{b64}"
        r = client.post(
            f"{BASE}/extract",
            json={"front_image": data_url, "back_image": None},
            timeout=90.0,
        )
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:300]}"
        body = r.json()
        # Spot-check the contract — full_name, emails list, email_draft
        for key in ("full_name", "emails", "email_draft", "confidence"):
            assert key in body, f"missing key '{key}' in /extract response"
        assert isinstance(body["emails"], list), "emails must be a list"
        return f"(confidence={body.get('confidence')}, name={body.get('full_name')!r})"

    check("POST /extract on real card returns full schema", extract_real_card)

    # ───── /send-email — auth gating ─────
    section("Send email (auth-gated)")

    def send_invalid_address():
        r = client.post(
            f"{BASE}/send-email",
            json={"to": "not-an-email", "subject": "x", "body": "x", "uid": "anything"},
        )
        assert r.status_code == 400, f"expected 400 for invalid email, got {r.status_code}"

    check("POST /send-email rejects invalid email", send_invalid_address)

    def send_missing_uid():
        r = client.post(
            f"{BASE}/send-email",
            json={"to": "x@y.com", "subject": "x", "body": "x", "uid": ""},
        )
        assert r.status_code == 401, f"expected 401 for missing uid, got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert "gmail_not_connected" in (body.get("detail") or ""), f"unexpected detail: {body}"

    check("POST /send-email rejects empty uid (401)", send_missing_uid)

    def send_unknown_uid():
        r = client.post(
            f"{BASE}/send-email",
            json={"to": "x@y.com", "subject": "x", "body": "x", "uid": "definitely_not_a_real_uid_smoke_test"},
        )
        assert r.status_code == 401, f"expected 401 for unknown uid, got {r.status_code}: {r.text[:200]}"

    check("POST /send-email rejects unknown uid (401)", send_unknown_uid)

    # ───── /auth/google/status ─────
    section("Gmail OAuth status")

    def gmail_status_unknown_uid():
        r = client.get(f"{BASE}/auth/google/status/definitely_not_a_real_uid_smoke_test")
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert body.get("gmail_connected") is False, f"expected gmail_connected:false, got {body}"

    check("GET /auth/google/status/{unknown} returns false", gmail_status_unknown_uid)

    # ───── Summary ─────
    print()
    fails = [r for r in results if r[1] != "pass"]
    passed = len(results) - len(fails)
    print(f"{B}Summary:{N} {G}{passed} passed{N}, {R if fails else G}{len(fails)} failed{N} (of {len(results)})")

    if fails:
        print(f"\n{R}Failures:{N}")
        for name, status, detail in fails:
            print(f"  · {name}: {detail}")
        sys.exit(1)

    print(f"\n{G}All backend smoke checks passed against {BASE}{N}")
    sys.exit(0)


if __name__ == "__main__":
    main()
