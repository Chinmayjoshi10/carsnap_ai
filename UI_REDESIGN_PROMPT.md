# CARDSNAP — UI REDESIGN PROMPT
# Paste this entire prompt to Claude Opus 4.6 in Antigravity
# Run from the frontend/ directory

---

<role>
You are a senior product designer and frontend engineer. You build interfaces that feel premium, intentional, and alive — not generic. You understand that great mobile UI is about feel as much as looks: the right weight, the right spacing, the right motion. You write production React + Tailwind code. You never break working functionality while improving aesthetics.
</role>

<task>
Redesign the CardSnap frontend UI to look and feel premium, modern, and polished — while keeping every piece of functionality exactly as it works today. Camera capture must still work. API calls must still work. All routes must still work. Only the visual layer changes.
</task>

<thinking_protocol>
Before writing any code, think through:

1. READ all existing component files completely — understand every prop, every state, every handler before touching anything
2. MAP which parts are pure visual (safe to change freely) vs functional (change with care):
   - input[type="file"] capture="environment" accept="image/*" — MUST stay exactly as-is
   - All onClick, onChange handlers — MUST stay exactly as-is  
   - All API calls in lib/api.js — DO NOT touch
   - All Firebase calls — DO NOT touch
   - React Router routes — DO NOT touch
   - className is the ONLY thing you are changing in most components
3. CHOOSE a design direction before writing a single line (see Design Direction below)
4. PLAN the color system as CSS variables first
5. CONFIRM: after your redesign, does input[type="file"] with capture="environment" still exist? Yes/No.

Only after this thinking, write code.
</thinking_protocol>

---

## DESIGN DIRECTION

**Aesthetic:** Refined dark-light hybrid. Clean white cards on a very light warm-gray background. Deep navy accents. Subtle depth via shadows not borders. Feels like a premium fintech or productivity app — think Linear, Notion, or Vercel's own dashboard.

**NOT:** Bright blue gradients, purple anything, glassmorphism, neon, busy backgrounds.

**Typography:** Use Google Fonts — `DM Sans` for all UI text (clean, modern, slightly geometric). Load via index.html `<link>` tag.

**Color System (implement as Tailwind config extensions):**
```
background:  #F7F6F3  (warm off-white, never pure white)
surface:     #FFFFFF  (cards, inputs)
navy:        #0F1B2D  (primary actions, nav)
navy-light:  #1A2E4A  (hover states)
accent:      #2563EB  (links, focus rings, active states)
success:     #059669
warning:     #D97706
error:       #DC2626
text-primary:   #0F1B2D
text-secondary: #6B7280
text-muted:     #9CA3AF
border:      #E8E5E0  (warm gray border)
```

**Shadow system:**
```
shadow-card:   0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)
shadow-lifted: 0 4px 12px rgba(0,0,0,0.08), 0 16px 40px rgba(0,0,0,0.06)
shadow-btn:    0 1px 2px rgba(0,0,0,0.12)
```

---

## COMPONENT-BY-COMPONENT REDESIGN SPEC

### `src/index.css`
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: 'DM Sans', sans-serif;
  background: #F7F6F3;
  color: #0F1B2D;
  -webkit-font-smoothing: antialiased;
}

/* Smooth page transitions */
.page-enter {
  animation: fadeUp 0.22s ease forwards;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #E8E5E0; border-radius: 4px; }

/* Input focus ring */
input:focus, textarea:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
```

### `tailwind.config.js`
Extend with the full color and shadow system:
```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      colors: {
        bg:      '#F7F6F3',
        surface: '#FFFFFF',
        navy:    { DEFAULT: '#0F1B2D', light: '#1A2E4A' },
        accent:  '#2563EB',
        border:  '#E8E5E0',
        success: '#059669',
        warning: '#D97706',
        error:   '#DC2626',
        tx: {
          primary:   '#0F1B2D',
          secondary: '#6B7280',
          muted:     '#9CA3AF',
        }
      },
      boxShadow: {
        'card':   '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        'lifted': '0 4px 12px rgba(0,0,0,0.08), 0 16px 40px rgba(0,0,0,0.06)',
        'btn':    '0 1px 2px rgba(0,0,0,0.12)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      }
    }
  },
  plugins: [],
}
```

---

### `src/App.jsx`
**Nav redesign:** Navy background. Logo left. Nav links right with active indicator. Clean, confident, no border — just the navy background creates separation.

```jsx
// Design spec for Nav:
// - bg-navy fixed top-0 full width h-14
// - Logo: white text "CardSnap" + small 📇 emoji, font-semibold text-sm tracking-tight
// - Nav links: text-white/60 text-sm, active = text-white font-medium
//   with a 2px white underline on active state (not background highlight)
// - Max width wrapper: max-w-lg mx-auto px-5
// - Subtle bottom shadow: shadow-[0_1px_0_rgba(255,255,255,0.06)]
```

Full implementation:
```jsx
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Capture from './pages/Capture'
import Contacts from './pages/Contacts'

function Nav() {
  const { pathname } = useLocation()
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy h-14"
         style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.06)' }}>
      <div className="max-w-lg mx-auto px-5 h-full flex items-center justify-between">
        <span className="text-white font-semibold text-sm tracking-tight flex items-center gap-2">
          <span>📇</span> CardSnap
        </span>
        <div className="flex gap-6">
          {[['/', 'Capture'], ['/contacts', 'Contacts']].map(([href, label]) => (
            <Link
              key={href}
              to={href}
              className="relative text-sm pb-1 transition-colors"
              style={{ color: pathname === href ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: pathname === href ? 500 : 400 }}
            >
              {label}
              {pathname === href && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
              )}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-lg mx-auto min-h-screen bg-bg">
        <Nav />
        <div className="pt-14">
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

---

### `src/components/CardUploader.jsx`
**Design spec:**
- Large upload zone, generous padding, rounded-3xl
- Dashed border becomes solid on hover/drag with accent color
- Camera icon replaced with a custom SVG scan-lines icon (feels like scanning)
- Subtle animated ring on the icon when idle (pulse)
- After upload: image preview fills the zone with rounded corners, smooth fade-in
- X button: small circular button top-right, white bg, shadow-lifted

**CRITICAL — preserve exactly:**
```
type="file"
accept="image/*"
capture="environment"
onChange handler
```

```jsx
import { useState } from 'react'

const ScanIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <rect x="4" y="4" width="12" height="3" rx="1.5" fill="#2563EB"/>
    <rect x="4" y="4" width="3" height="12" rx="1.5" fill="#2563EB"/>
    <rect x="32" y="4" width="12" height="3" rx="1.5" fill="#2563EB"/>
    <rect x="41" y="4" width="3" height="12" rx="1.5" fill="#2563EB"/>
    <rect x="4" y="41" width="12" height="3" rx="1.5" fill="#2563EB"/>
    <rect x="4" y="32" width="3" height="12" rx="1.5" fill="#2563EB"/>
    <rect x="32" y="41" width="12" height="3" rx="1.5" fill="#2563EB"/>
    <rect x="41" y="32" width="3" height="12" rx="1.5" fill="#2563EB"/>
    <rect x="8" y="23" width="32" height="2" rx="1" fill="#2563EB" opacity="0.3"/>
    <rect x="8" y="23" width="16" height="2" rx="1" fill="#2563EB">
      <animate attributeName="width" values="0;32;32" dur="2s" repeatCount="indefinite"/>
    </rect>
  </svg>
)

export default function CardUploader({ onImageCaptured, previewUrl }) {
  const [dragging, setDragging] = useState(false)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onloadend = () => onImageCaptured(reader.result)
    reader.readAsDataURL(file)
  }

  if (previewUrl) {
    return (
      <div className="relative rounded-3xl overflow-hidden bg-surface shadow-card"
           style={{ animation: 'fadeUp 0.2s ease forwards' }}>
        <img
          src={previewUrl}
          alt="Card preview"
          className="w-full object-cover"
          style={{ maxHeight: '220px' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        <button
          onClick={() => onImageCaptured(null)}
          className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lifted text-tx-secondary text-xs font-medium hover:bg-gray-50 transition-colors"
        >
          ✕
        </button>
        <div className="absolute bottom-3 left-4">
          <span className="text-white text-xs font-medium bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
            Card captured
          </span>
        </div>
      </div>
    )
  }

  return (
    <label
      className="flex flex-col items-center justify-center gap-4 rounded-3xl cursor-pointer transition-all duration-200 select-none"
      style={{
        padding: '40px 24px',
        border: `2px dashed ${dragging ? '#2563EB' : '#E8E5E0'}`,
        background: dragging ? 'rgba(37,99,235,0.03)' : '#FFFFFF',
        boxShadow: dragging ? '0 0 0 4px rgba(37,99,235,0.08)' : '0 1px 3px rgba(0,0,0,0.06)',
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
    >
      {/* CRITICAL: these attributes must not change */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <ScanIcon />
      <div className="text-center">
        <p className="font-semibold text-tx-primary text-base">Scan visiting card</p>
        <p className="text-tx-muted text-sm mt-1">Tap to use camera or upload photo</p>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="w-16 h-px bg-border" />
        <span className="text-tx-muted text-xs">or drag & drop</span>
        <span className="w-16 h-px bg-border" />
      </div>
    </label>
  )
}
```

---

### `src/components/StatusBanner.jsx`
**Design:** Pill-shaped, not full-width rectangle. Icon left, message right. Smooth slide-in animation.

```jsx
export default function StatusBanner({ status, message }) {
  if (!status) return null

  const config = {
    loading: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', icon: (
      <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="#BFDBFE" strokeWidth="2"/>
        <path d="M8 2a6 6 0 0 1 6 6" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    )},
    success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', icon: '✓' },
    error:   { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', icon: '!' },
  }

  const c = config[status]
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        animation: 'fadeUp 0.18s ease forwards',
      }}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center font-bold">
        {c.icon}
      </span>
      <span>{message}</span>
    </div>
  )
}
```

---

### `src/components/ContactForm.jsx`
**Design:** Floating label style. Each field is a clean row — label tiny above, input below. Group them in one card with subtle dividers between fields. No individual card per field.

```jsx
export default function ContactForm({ contact, onChange }) {
  const fields = [
    { key: 'name',      label: 'Full Name',   type: 'text',  icon: '👤' },
    { key: 'email',     label: 'Email',       type: 'email', icon: '✉️' },
    { key: 'company',   label: 'Company',     type: 'text',  icon: '🏢' },
    { key: 'phone',     label: 'Phone',       type: 'tel',   icon: '📞' },
    { key: 'job_title', label: 'Job Title',   type: 'text',  icon: '💼' },
  ]

  return (
    <div
      className="rounded-2xl overflow-hidden bg-surface"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}
    >
      {fields.map(({ key, label, type, icon }, i) => (
        <div
          key={key}
          className="px-4 py-3"
          style={{ borderTop: i > 0 ? '1px solid #F3F2EF' : 'none' }}
        >
          <label className="flex items-center gap-1.5 text-xs font-medium text-tx-muted mb-1.5">
            <span>{icon}</span>
            <span className="uppercase tracking-wider">{label}</span>
          </label>
          <input
            type={type}
            value={contact[key] || ''}
            onChange={(e) => onChange({ ...contact, [key]: e.target.value })}
            placeholder={`Enter ${label.toLowerCase()}`}
            className="w-full text-sm text-tx-primary bg-transparent border-none outline-none placeholder-tx-muted font-medium py-0.5"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          />
        </div>
      ))}
    </div>
  )
}
```

---

### `src/components/EmailEditor.jsx`
**Design:** Feels like composing in a real email client. Header row with label left, char count right. Textarea has no visible border — the card container provides the boundary.

```jsx
export default function EmailEditor({ value, onChange }) {
  const charCount = value?.length || 0
  const isLong = charCount > 500

  return (
    <div
      className="rounded-2xl overflow-hidden bg-surface"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid #F3F2EF' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">✉️</span>
          <span className="text-xs font-medium text-tx-muted uppercase tracking-wider">Follow-up Email</span>
        </div>
        <span
          className="text-xs font-medium tabular-nums"
          style={{ color: isLong ? '#D97706' : '#9CA3AF' }}
        >
          {charCount} chars
        </span>
      </div>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder="AI-generated email will appear here after scanning a card..."
        className="w-full px-4 py-3 text-sm text-tx-primary bg-transparent border-none outline-none resize-none leading-relaxed placeholder-tx-muted"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      />
    </div>
  )
}
```

---

### `src/components/ContactList.jsx`
**Design:**
- Search bar: pill-shaped, icon left inside, clean
- Contact cards: horizontal layout, avatar circle with initial, name + company stacked, email small, sent badge right-aligned
- Avatar: colored based on first letter (not random — deterministic map)
- Empty state: a friendly illustration placeholder (SVG) not just text

```jsx
import { useState, useEffect } from 'react'
import { getContacts } from '../lib/api'

const AVATAR_COLORS = [
  ['#EFF6FF','#1D4ED8'], ['#F0FDF4','#166534'], ['#FFF7ED','#9A3412'],
  ['#FDF4FF','#7E22CE'], ['#FFF1F2','#9F1239'], ['#F0F9FF','#0369A1'],
]

const getAvatarColor = (name) => {
  const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="5" stroke="#9CA3AF" strokeWidth="1.5"/>
    <path d="M11 11l3 3" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const EmptyState = ({ isSearch }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center shadow-card text-3xl">
      {isSearch ? '🔍' : '📋'}
    </div>
    <p className="text-tx-primary font-medium text-sm">
      {isSearch ? 'No matches found' : 'No contacts yet'}
    </p>
    <p className="text-tx-muted text-xs text-center max-w-48">
      {isSearch ? 'Try a different search term' : 'Scan your first visiting card to get started'}
    </p>
  </div>
)

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

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 border-border border-t-accent animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div
        className="flex items-center gap-3 bg-surface rounded-2xl px-4 py-3"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        <SearchIcon />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts..."
          className="flex-1 text-sm text-tx-primary bg-transparent border-none outline-none placeholder-tx-muted"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-tx-muted text-xs">✕</button>
        )}
      </div>

      {/* Count */}
      {contacts.length > 0 && (
        <p className="text-tx-muted text-xs px-1">
          {filtered.length} of {contacts.length} contacts
        </p>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState isSearch={!!search} />
      ) : (
        filtered.map(c => {
          const [bgColor, textColor] = getAvatarColor(c.name)
          return (
            <div
              key={c.id}
              className="flex items-center gap-3 bg-surface rounded-2xl p-4 transition-shadow hover:shadow-card"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              {/* Avatar */}
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-semibold flex-shrink-0"
                style={{ background: bgColor, color: textColor }}
              >
                {c.name?.[0]?.toUpperCase() || '?'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-tx-primary text-sm truncate">
                  {c.name || 'No name'}
                </p>
                {c.company && (
                  <p className="text-tx-secondary text-xs truncate">{c.company}</p>
                )}
                {c.email && (
                  <p className="text-accent text-xs truncate mt-0.5">{c.email}</p>
                )}
              </div>

              {/* Sent badge */}
              {c.email_sent && (
                <div
                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: '#F0FDF4', color: '#166534' }}
                >
                  <span>✓</span>
                  <span>Sent</span>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
```

---

### `src/pages/Capture.jsx`
**Design changes:**
- Page has a gentle top padding with a welcome headline
- Section headers are small uppercase labels with left accent bar
- Action buttons redesigned: Send = full navy, Save = outlined navy. Both tall (52px), rounded-2xl, font-medium
- Space between sections is generous (gap-5)
- All functional logic MUST remain 100% identical

Full redesign — replace className values only, keep all handlers, state, and API calls exactly:

```jsx
import { useState, useRef } from 'react'
import CardUploader from '../components/CardUploader'
import ContactForm from '../components/ContactForm'
import EmailEditor from '../components/EmailEditor'
import StatusBanner from '../components/StatusBanner'
import { extractCard, sendEmail, saveContact, updateContact } from '../lib/api'

const emptyContact = { name: '', email: '', company: '', phone: '', job_title: '' }

const SectionLabel = ({ children }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="w-0.5 h-4 rounded-full bg-accent" />
    <span className="text-xs font-semibold text-tx-secondary uppercase tracking-wider">{children}</span>
  </div>
)

export default function Capture() {
  const [image, setImage] = useState(null)
  const [contact, setContact] = useState(emptyContact)
  const [emailDraft, setEmailDraft] = useState('')
  const [status, setStatus] = useState(null)
  const [extracted, setExtracted] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const lastSentRef = useRef(0)

  const handleImage = async (base64) => {
    if (!base64) {
      setImage(null); setContact(emptyContact)
      setEmailDraft(''); setExtracted(false)
      return
    }
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
      setStatus({ type: 'success', message: 'Card read — review and edit below' })
      setTimeout(() => setStatus(null), 3000)
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Could not read card. Try a clearer photo.' })
    }
  }

  const handleSend = async () => {
    if (!contact.email) return setStatus({ type: 'error', message: 'Add an email address first' })
    if (Date.now() - lastSentRef.current < 60000)
      return setStatus({ type: 'error', message: 'Please wait before sending again' })
    setStatus({ type: 'loading', message: 'Sending email...' })
    try {
      const firstName = contact.name?.split(' ')[0] || ''
      await sendEmail(contact.email, `Great connecting with you${firstName ? ', ' + firstName : ''}`, emailDraft)
      lastSentRef.current = Date.now()
      if (savedId) await updateContact(savedId, { email_sent: true })
      setStatus({ type: 'success', message: `Email sent to ${contact.email}` })
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Email failed. Try again.' })
    }
  }

  const handleSave = async () => {
    setStatus({ type: 'loading', message: 'Saving...' })
    try {
      const result = await saveContact({ ...contact, email_draft: emailDraft, email_sent: false })
      setSavedId(result.id)
      setStatus({ type: 'success', message: 'Contact saved' })
      setTimeout(() => setStatus(null), 3000)
    } catch {
      setStatus({ type: 'error', message: 'Save failed. Try again.' })
    }
  }

  const reset = () => {
    setImage(null); setContact(emptyContact); setEmailDraft('')
    setStatus(null); setExtracted(false); setSavedId(null)
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-10 page-enter">

      {/* Hero text — only show when no card uploaded */}
      {!extracted && !image && (
        <div className="pb-2">
          <h1 className="text-2xl font-semibold text-tx-primary tracking-tight">
            Capture a card
          </h1>
          <p className="text-tx-secondary text-sm mt-1">
            Scan any visiting card to extract contact info and generate a follow-up email instantly.
          </p>
        </div>
      )}

      {/* Card uploader */}
      <CardUploader onImageCaptured={handleImage} previewUrl={image} />

      {/* Status */}
      {status && <StatusBanner status={status.type} message={status.message} />}

      {/* Extracted content */}
      {extracted && (
        <div className="flex flex-col gap-5" style={{ animation: 'fadeUp 0.25s ease forwards' }}>

          <div>
            <SectionLabel>Contact Info</SectionLabel>
            <ContactForm contact={contact} onChange={setContact} />
          </div>

          <div>
            <SectionLabel>Follow-up Email</SectionLabel>
            <EmailEditor value={emailDraft} onChange={setEmailDraft} />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSend}
              disabled={!contact.email}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-medium text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                height: '52px',
                background: contact.email ? '#0F1B2D' : '#0F1B2D',
                color: '#fff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
              }}
            >
              <span>✉</span>
              <span>Send Email</span>
            </button>
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-medium text-sm transition-all active:scale-95"
              style={{
                height: '52px',
                background: '#fff',
                color: '#0F1B2D',
                border: '1.5px solid #E8E5E0',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              }}
            >
              <span>↓</span>
              <span>Save Contact</span>
            </button>
          </div>

          {/* Reset */}
          <button
            onClick={reset}
            className="text-center text-tx-muted text-xs py-1 hover:text-tx-secondary transition-colors"
          >
            ← Capture another card
          </button>
        </div>
      )}
    </div>
  )
}
```

---

### `src/pages/Contacts.jsx`
**Design:** Clean header with contact count badge.

```jsx
import { useState, useEffect } from 'react'
import ContactList from '../components/ContactList'
import { getContacts } from '../lib/api'

export default function Contacts() {
  const [count, setCount] = useState(null)

  useEffect(() => {
    getContacts().then(c => setCount(c.length))
  }, [])

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-10 page-enter">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-tx-primary tracking-tight">Contacts</h1>
        {count !== null && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#EFF6FF', color: '#1D4ED8' }}
          >
            {count} saved
          </span>
        )}
      </div>
      <ContactList />
    </div>
  )
}
```

---

## IMPLEMENTATION RULES

```
MUST preserve exactly (do not touch):
✓ input type="file" accept="image/*" capture="environment" — camera will break if changed
✓ All onChange, onClick, onDrop, onDragOver, onDragLeave handlers
✓ All useState hooks and their names
✓ All imports from lib/api.js and lib/firebase.js
✓ React Router <Routes>, <Route>, <Link> structure
✓ All API call logic in Capture.jsx (handleImage, handleSend, handleSave, reset)
✓ lastSentRef cooldown logic
✓ ContactList useEffect and getContacts call

CHANGE FREELY:
✓ All className values
✓ All inline style values
✓ All static text labels and placeholder strings
✓ All SVG icons
✓ HTML structure within components (add divs, spans, wrappers)
✓ tailwind.config.js and index.css

DO NOT:
✗ Add new npm packages
✗ Add new state variables or hooks
✗ Change any API endpoint URLs
✗ Change the file/folder structure
✗ Add authentication
✗ Change prop names between parent and child components
```

---

## VERIFICATION AFTER REDESIGN

After completing all files, run:

```bash
# 1. Build check — must pass with zero errors
npm run build

# 2. Verify camera attribute preserved
grep -r 'capture="environment"' src/
# Expected: src/components/CardUploader.jsx:        capture="environment"

# 3. Verify accept attribute preserved  
grep -r 'accept="image/\*"' src/
# Expected: src/components/CardUploader.jsx

# 4. Verify API calls preserved
grep -r 'extractCard\|sendEmail\|saveContact\|getContacts\|updateContact' src/
# Expected: calls present in Capture.jsx and ContactList.jsx

# 5. Start and eyeball on mobile viewport
npm run dev
# Open Chrome DevTools → Toggle device toolbar → iPhone 14 Pro (390x844)
# Check: Capture page, upload zone, nav, contacts page, search
```

If build fails → fix before finishing. If camera attributes are missing → re-add them immediately.

---

## FINAL OUTPUT

After all files are written and verified:

1. List every file modified with ✓
2. Describe the visual changes in 3 sentences
3. Confirm: `capture="environment"` is present — YES/NO
4. Confirm: Build passes — YES/NO
5. Share any improvements you made beyond the spec that enhance UX without breaking functionality

---
*CardSnap UI Redesign — DM Sans · Navy + Warm White · Mobile First*
