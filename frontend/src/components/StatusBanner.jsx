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
