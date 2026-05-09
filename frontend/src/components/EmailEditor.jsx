export default function EmailEditor({ value, onChange, subject, onSubjectChange }) {
  const charCount = value?.length || 0
  const isLong = charCount > 500

  return (
    <div
      className="rounded-2xl overflow-hidden bg-surface"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
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

      {/* Subject line */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid #F3F2EF' }}>
        <label className="flex items-center gap-1.5 text-xs font-medium text-tx-muted mb-1.5">
          <span className="uppercase tracking-wider">Subject</span>
        </label>
        <input
          type="text"
          value={subject || ''}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Email subject line..."
          className="w-full text-sm text-tx-primary bg-transparent border-none outline-none placeholder-tx-muted font-medium py-0.5"
          style={{ fontFamily: 'DM Sans, sans-serif', boxShadow: 'none' }}
        />
      </div>

      {/* Body */}
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder="AI-generated email will appear here after scanning a card..."
        className="w-full px-4 py-3 text-sm text-tx-primary bg-transparent border-none outline-none resize-none leading-relaxed placeholder-tx-muted"
        style={{ fontFamily: 'DM Sans, sans-serif', boxShadow: 'none' }}
      />
    </div>
  )
}
