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
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

GMAIL_SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


def build_mime_message(to: str, subject: str, body_text: str, from_email: str = None, cc: str = None) -> str:
    """
    Build a RFC 2822 MIME message with both plain text and HTML parts.
    Returns base64url-encoded raw message string for Gmail API.
    """
    msg = MIMEMultipart("alternative")
    msg["To"] = to
    msg["Subject"] = subject
    if from_email:
        msg["From"] = from_email
    if cc:
        msg["Cc"] = cc

    # Plain text part
    msg.attach(MIMEText(body_text, "plain"))

    # HTML part — simple styling
    html_body = body_text.replace("\n", "<br/>")
    html_content = f"""
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:0 auto;line-height:1.7;color:#1E293B;font-size:14px">
        {html_body}
    </div>
    """
    msg.attach(MIMEText(html_content, "html"))

    # Gmail API requires base64url encoding (no padding)
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")
    return raw


async def send_via_gmail(access_token: str, to: str, subject: str, body: str, from_email: str = None, cc: str = None) -> dict:
    """
    Send an email through Gmail API using an access_token.

    Returns: Gmail API response dict (with 'id', 'threadId', 'labelIds')
    Raises: Exception with detail on failure
    """
    raw_message = build_mime_message(to, subject, body, from_email, cc)

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
