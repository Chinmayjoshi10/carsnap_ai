const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function extractCard(frontImage, backImage = null) {
  const res = await fetch(`${BASE}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ front_image: frontImage, back_image: backImage })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Extraction failed')
  }
  return res.json()
}

export async function sendEmail(to, subject, body, uid = null) {
  const res = await fetch(`${BASE}/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body, uid })
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
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Gmail connect failed')
  }
  return res.json()
}

export async function disconnectGmail(uid) {
  const res = await fetch(`${BASE}/auth/google/disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Gmail disconnect failed')
  }
  return res.json()
}

export async function getGmailStatus(uid) {
  const res = await fetch(`${BASE}/auth/google/status/${uid}`)
  if (!res.ok) return { gmail_connected: false }
  return res.json()
}
