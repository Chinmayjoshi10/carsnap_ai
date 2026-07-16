"""
Gmail API sender service — sends emails via user's Gmail using refresh tokens.

Flow for every email send:
1. Load refresh_token from Firestore for the user
2. Exchange refresh_token for a fresh access_token
3. Build MIME message (plain text + HTML)
4. Send via Gmail API
5. If access_token fails, retry once with a fresh token
6. If refresh_token itself is invalid, mark gmail_connected=false
"""

import base64
import httpx
import uuid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid

GMAIL_SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


def build_mime_message(to: str, subject: str, body_text: str, from_email: str = None, cc: str = None, bcc: str = None) -> str:
    """
    Build a RFC 2822 MIME message with both plain text and HTML parts.
    Returns base64url-encoded raw message string for Gmail API.

    Includes all critical headers (Date, Message-ID, Reply-To) that spam
    filters expect from legitimate email.
    """
    msg = MIMEMultipart("alternative")
    msg["To"] = to
    msg["Subject"] = subject

    # --- Critical headers that prevent spam classification ---
    # RFC 2822 Date header — missing = "forged/bot" signal to spam filters
    msg["Date"] = formatdate(localtime=True)
    # Unique Message-ID — missing = massive spam indicator
    domain = from_email.split("@")[1] if from_email and "@" in from_email else "gmail.com"
    msg["Message-ID"] = make_msgid(domain=domain)
    # MIME-Version (Python usually adds it, but being explicit is safer)
    msg["MIME-Version"] = "1.0"

    if from_email:
        msg["From"] = from_email
        # Reply-To matches From — signals legitimacy to spam filters
        msg["Reply-To"] = from_email
    if cc:
        msg["Cc"] = cc
    if bcc:
        msg["Bcc"] = bcc

    # Plain text part
    msg.attach(MIMEText(body_text, "plain", "utf-8"))

    # HTML part — proper document structure (fragments trigger spam filters)
    html_body = body_text.replace("\n", "<br/>")
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
  <div style="font-family:'DM Sans',Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;line-height:1.7;color:#1E293B;font-size:14px;">
    {html_body}
  </div>
</body>
</html>"""
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    # Gmail API requires base64url encoding (no padding)
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")
    return raw


async def send_via_gmail(access_token: str, to: str, subject: str, body: str, from_email: str = None, cc: str = None, bcc: str = None) -> dict:
    """
    Send an email through Gmail API using an access_token.

    Returns: Gmail API response dict (with 'id', 'threadId', 'labelIds')
    Raises: Exception with detail on failure
    """
    raw_message = build_mime_message(to, subject, body, from_email, cc, bcc)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GMAIL_SEND_ENDPOINT,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={"raw": raw_message},
            timeout=30.0,
        )

    data = resp.json()

    if resp.status_code == 401:
        raise TokenExpiredError("Access token expired or invalid")

    if resp.status_code != 200:
        error_msg = data.get("error", {}).get("message", f"Gmail API error {resp.status_code}")
        raise Exception(f"Gmail send failed: {error_msg}")

    return data


class TokenExpiredError(Exception):
    """Raised when the access token is expired/invalid and needs refresh."""
    pass
