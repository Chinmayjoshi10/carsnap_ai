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
      {isSearch ? 'No contacts match' : 'No contacts yet'}
    </p>
    <p className="text-tx-muted text-xs text-center max-w-48">
      {isSearch ? 'Try a different search term' : 'Scan your first visiting card to get started'}
    </p>
  </div>
)

// Helper to get display name — supports both old and new schema
const getName = (c) => c.full_name || c.name || 'No name'
const getEmail = (c) => (c.emails?.[0]) || c.email || ''
const getPhone = (c) => (c.phones?.[0]) || c.phone || ''

export default function ContactList() {
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    getContacts().then(setContacts).finally(() => setLoading(false))
  }, [])

  const filtered = contacts.filter(c => {
    const term = search.toLowerCase()
    return [getName(c), getEmail(c), c.company, c.business_summary]
      .some(f => f?.toLowerCase().includes(term))
  })

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
          style={{ fontFamily: 'DM Sans, sans-serif', boxShadow: 'none' }}
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
          const name = getName(c)
          const email = getEmail(c)
          const [bgColor, textColor] = getAvatarColor(name)
          const isExpanded = expanded === c.id

          return (
            <div
              key={c.id}
              className="bg-surface rounded-2xl overflow-hidden transition-shadow hover:shadow-card"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              {/* Main row — clickable */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : c.id)}
              >
                {/* Avatar or thumbnail */}
                {c.front_image_url ? (
                  <img
                    src={c.front_image_url}
                    alt=""
                    className="w-11 h-11 rounded-2xl object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-semibold flex-shrink-0"
                    style={{ background: bgColor, color: textColor }}
                  >
                    {name[0]?.toUpperCase() || '?'}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-tx-primary text-sm truncate">{name}</p>
                  {(c.job_title || c.company) && (
                    <p className="text-tx-secondary text-xs truncate">
                      {[c.job_title, c.company].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {c.business_summary && (
                    <p className="text-tx-muted text-xs truncate mt-0.5">{c.business_summary}</p>
                  )}
                </div>

                {/* Badges */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {c.email_sent && (
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: '#F0FDF4', color: '#166534' }}
                    >
                      ✓ Sent
                    </span>
                  )}
                  {c.industry_tags?.length > 0 && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{ background: '#F3F4F6', color: '#6B7280' }}
                    >
                      {c.industry_tags[0]}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div
                  className="px-4 pb-4 flex flex-col gap-2"
                  style={{ borderTop: '1px solid #F3F2EF', paddingTop: '12px', animation: 'fadeUp 0.15s ease forwards' }}
                >
                  {email && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-tx-muted">✉️</span>
                      <span className="text-accent">{email}</span>
                    </div>
                  )}
                  {getPhone(c) && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-tx-muted">📞</span>
                      <span className="text-tx-secondary">{getPhone(c)}</span>
                    </div>
                  )}
                  {c.address && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-tx-muted">📍</span>
                      <span className="text-tx-secondary">{c.address}</span>
                    </div>
                  )}
                  {c.website && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-tx-muted">🌐</span>
                      <span className="text-accent">{c.website}</span>
                    </div>
                  )}
                  {c.services?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.services.map((s, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {c.industry_tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.industry_tags.map((t, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#374151' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
