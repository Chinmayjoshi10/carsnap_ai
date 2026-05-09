const ConfidenceBadge = ({ score }) => {
  let label, color, bg
  if (score >= 0.8) { label = 'High'; color = '#166534'; bg = '#F0FDF4' }
  else if (score >= 0.5) { label = 'Medium'; color = '#9A3412'; bg = '#FFF7ED' }
  else { label = 'Low'; color = '#991B1B'; bg = '#FEF2F2' }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid #F3F2EF' }}>
      <span className="text-xs text-tx-muted uppercase tracking-wider">Confidence</span>
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{ background: bg, color }}
      >
        {label} ({Math.round(score * 100)}%)
      </span>
    </div>
  )
}

const TagList = ({ items, icon, label }) => {
  if (!items || items.length === 0) return null
  return (
    <div className="px-4 py-3" style={{ borderTop: '1px solid #F3F2EF' }}>
      <label className="flex items-center gap-1.5 text-xs font-medium text-tx-muted mb-2">
        <span>{icon}</span>
        <span className="uppercase tracking-wider">{label}</span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: '#F3F4F6', color: '#374151' }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ContactForm({ contact, onChange }) {
  const coreFields = [
    { key: 'full_name', label: 'Full Name',   type: 'text',  icon: '👤' },
    { key: 'job_title', label: 'Designation',  type: 'text',  icon: '💼' },
    { key: 'company',   label: 'Company',      type: 'text',  icon: '🏢' },
  ]

  // Show primary email and phone as editable inputs
  const primaryEmail = contact.emails?.[0] || ''
  const primaryPhone = contact.phones?.[0] || ''

  const extraFields = [
    { key: 'address',   label: 'Address',     type: 'text',  icon: '📍' },
    { key: 'website',   label: 'Website',     type: 'url',   icon: '🌐' },
    { key: 'linkedin',  label: 'LinkedIn',    type: 'text',  icon: '💬' },
  ]

  const visibleExtras = extraFields.filter(
    f => contact[f.key] && contact[f.key].trim() !== ''
  )

  const updateField = (key, value) => {
    onChange({ ...contact, [key]: value })
  }

  const updatePrimaryEmail = (value) => {
    const newEmails = [...(contact.emails || [])]
    newEmails[0] = value
    onChange({ ...contact, emails: newEmails })
  }

  const updatePrimaryPhone = (value) => {
    const newPhones = [...(contact.phones || [])]
    newPhones[0] = value
    onChange({ ...contact, phones: newPhones })
  }

  return (
    <div
      className="rounded-2xl overflow-hidden bg-surface"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}
    >
      {/* Confidence */}
      {contact.confidence > 0 && <ConfidenceBadge score={contact.confidence} />}

      {/* Core fields */}
      {coreFields.map(({ key, label, type, icon }, i) => (
        <div
          key={key}
          className="px-4 py-3"
          style={{ borderTop: (i > 0 || contact.confidence > 0) ? '1px solid #F3F2EF' : 'none' }}
        >
          <label className="flex items-center gap-1.5 text-xs font-medium text-tx-muted mb-1.5">
            <span>{icon}</span>
            <span className="uppercase tracking-wider">{label}</span>
          </label>
          <input
            type={type}
            value={contact[key] || ''}
            onChange={(e) => updateField(key, e.target.value)}
            placeholder={`Enter ${label.toLowerCase()}`}
            className="w-full text-sm text-tx-primary bg-transparent border-none outline-none placeholder-tx-muted font-medium py-0.5"
            style={{ fontFamily: 'DM Sans, sans-serif', boxShadow: 'none' }}
          />
        </div>
      ))}

      {/* Primary email */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid #F3F2EF' }}>
        <label className="flex items-center gap-1.5 text-xs font-medium text-tx-muted mb-1.5">
          <span>✉️</span>
          <span className="uppercase tracking-wider">Email</span>
          {contact.emails?.length > 1 && (
            <span className="text-tx-muted font-normal normal-case">+{contact.emails.length - 1} more</span>
          )}
        </label>
        <input
          type="email"
          value={primaryEmail}
          onChange={(e) => updatePrimaryEmail(e.target.value)}
          placeholder="Enter email"
          className="w-full text-sm text-tx-primary bg-transparent border-none outline-none placeholder-tx-muted font-medium py-0.5"
          style={{ fontFamily: 'DM Sans, sans-serif', boxShadow: 'none' }}
        />
        {/* Additional emails as read-only */}
        {contact.emails?.slice(1).map((email, i) => (
          <p key={i} className="text-xs text-tx-secondary mt-1">{email}</p>
        ))}
      </div>

      {/* Primary phone */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid #F3F2EF' }}>
        <label className="flex items-center gap-1.5 text-xs font-medium text-tx-muted mb-1.5">
          <span>📞</span>
          <span className="uppercase tracking-wider">Phone</span>
          {contact.phones?.length > 1 && (
            <span className="text-tx-muted font-normal normal-case">+{contact.phones.length - 1} more</span>
          )}
        </label>
        <input
          type="tel"
          value={primaryPhone}
          onChange={(e) => updatePrimaryPhone(e.target.value)}
          placeholder="Enter phone"
          className="w-full text-sm text-tx-primary bg-transparent border-none outline-none placeholder-tx-muted font-medium py-0.5"
          style={{ fontFamily: 'DM Sans, sans-serif', boxShadow: 'none' }}
        />
        {contact.phones?.slice(1).map((phone, i) => (
          <p key={i} className="text-xs text-tx-secondary mt-1">{phone}</p>
        ))}
      </div>

      {/* Extra text fields */}
      {visibleExtras.map(({ key, label, type, icon }) => (
        <div key={key} className="px-4 py-3" style={{ borderTop: '1px solid #F3F2EF' }}>
          <label className="flex items-center gap-1.5 text-xs font-medium text-tx-muted mb-1.5">
            <span>{icon}</span>
            <span className="uppercase tracking-wider">{label}</span>
          </label>
          <input
            type={type}
            value={contact[key] || ''}
            onChange={(e) => updateField(key, e.target.value)}
            placeholder={`Enter ${label.toLowerCase()}`}
            className="w-full text-sm text-tx-primary bg-transparent border-none outline-none placeholder-tx-muted font-medium py-0.5"
            style={{ fontFamily: 'DM Sans, sans-serif', boxShadow: 'none' }}
          />
        </div>
      ))}

      {/* Business intelligence sections */}
      <TagList items={contact.services} icon="⚡" label="Services" />
      <TagList items={contact.industry_tags} icon="🏷️" label="Industry" />
      <TagList items={contact.social_handles} icon="📱" label="Social" />

      {/* Business summary */}
      {contact.business_summary && (
        <div className="px-4 py-3" style={{ borderTop: '1px solid #F3F2EF' }}>
          <label className="flex items-center gap-1.5 text-xs font-medium text-tx-muted mb-1.5">
            <span>💡</span>
            <span className="uppercase tracking-wider">Business Summary</span>
          </label>
          <p className="text-sm text-tx-secondary font-medium py-0.5 leading-relaxed">
            {contact.business_summary}
          </p>
        </div>
      )}

      {/* Notes */}
      {contact.notes && (
        <div className="px-4 py-3" style={{ borderTop: '1px solid #F3F2EF' }}>
          <label className="flex items-center gap-1.5 text-xs font-medium text-tx-muted mb-1.5">
            <span>📋</span>
            <span className="uppercase tracking-wider">Notes</span>
          </label>
          <p className="text-sm text-tx-secondary font-medium py-0.5 leading-relaxed">
            {contact.notes}
          </p>
        </div>
      )}
    </div>
  )
}
