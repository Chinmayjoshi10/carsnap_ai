const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Safe JSON parse — tolerates empty bodies (502/504 from sleeping Render dynos
// often return HTML or nothing, and res.json() then throws "unexpected end of
// JSON input" which masks the real status).
async function readJsonSafe(res) {
  const text = await res.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return null }
}

async function unwrap(res, fallbackMsg) {
  if (res.ok) {
    const body = await readJsonSafe(res)
    if (body === null) throw new Error(`${fallbackMsg} — backend returned an empty response (${res.status}). It may still be waking up; please retry.`)
    return body
  }
  const body = await readJsonSafe(res)
  const detail = body?.detail || `${fallbackMsg} (HTTP ${res.status})`
  throw new Error(detail)
}

// One-shot health ping — fired on app mount to wake a sleeping Render dyno.
// Fire-and-forget; never throws. ~5s timeout so we don't hang the UI thread.
let _warmedUp = false
export function warmupBackend() {
  if (_warmedUp) return
  _warmedUp = true
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 5_000)
  fetch(`${BASE}/health`, { signal: ctl.signal })
    .catch(() => {})
    .finally(() => clearTimeout(t))
}

export async function extractCard(frontImage, backImage = null) {
  const res = await fetch(`${BASE}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ front_image: frontImage, back_image: backImage })
  })
  return unwrap(res, 'Extraction failed')
}

export async function sendEmail(to, subject, body, uid = null) {
  const res = await fetch(`${BASE}/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body, uid })
  })
  return unwrap(res, 'Email send failed')
}

export async function saveContact(contact) {
  const res = await fetch(`${BASE}/save-contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contact)
  })
  return unwrap(res, 'Save failed')
}

export async function getContacts() {
  const res = await fetch(`${BASE}/contacts`)
  return unwrap(res, 'Fetch failed')
}

export async function updateContact(id, updates) {
  const res = await fetch(`${BASE}/contacts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  return unwrap(res, 'Update failed')
}

// ─── Gmail OAuth endpoints ───

export async function connectGmail({ code, redirectUri, uid, email, displayName, photoUrl }) {
  const res = await fetch(`${BASE}/auth/google/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      redirect_uri: redirectUri,
      uid,
      email,
      display_name: displayName || '',
      photo_url: photoUrl || '',
    })
  })
  return unwrap(res, 'Gmail connect failed')
}

export async function disconnectGmail(uid) {
  const res = await fetch(`${BASE}/auth/google/disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid })
  })
  return unwrap(res, 'Gmail disconnect failed')
}

export async function getGmailStatus(uid) {
  const res = await fetch(`${BASE}/auth/google/status/${uid}`)
  if (!res.ok) return { gmail_connected: false }
  const body = await readJsonSafe(res)
  return body || { gmail_connected: false }
}

// ─── Batch processing ───

export async function batchSend(cards, uid) {
  const res = await fetch(`${BASE}/batch-send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cards, uid })
  })
  return unwrap(res, 'Batch processing failed')
}
