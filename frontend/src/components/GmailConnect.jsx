import { useState } from 'react'
import { startGmailAuthRedirect } from '../lib/firebase'
import { disconnectGmail } from '../lib/api'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
)

export default function GmailConnect({ user, gmailConnected, onStatusChange }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleConnect = () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      // Redirect to Google OAuth — page will navigate away
      startGmailAuthRedirect()
    } catch (err) {
      setError(err.message || 'Failed to start Gmail connection')
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      await disconnectGmail(user.uid)
      onStatusChange(false)
    } catch (err) {
      setError(err.message || 'Failed to disconnect')
    } finally {
      setLoading(false)
    }
  }

  if (gmailConnected) {
    return (
      <div
        className="rounded-2xl overflow-hidden bg-surface"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#F0FDF4' }}
          >
            <span className="text-sm">✓</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-tx-primary">Gmail Connected</p>
            <p className="text-xs text-tx-muted truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="text-xs font-medium text-tx-muted hover:text-error transition-colors px-2 py-1"
          >
            {loading ? '...' : 'Disconnect'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleConnect}
        disabled={loading || !user}
        className="flex items-center justify-center gap-2.5 rounded-2xl font-medium text-sm transition-all active:scale-95 disabled:opacity-50"
        style={{
          height: '48px',
          background: '#fff',
          color: '#0F1B2D',
          border: '1.5px solid #E8E5E0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        }}
      >
        {loading ? (
          <div className="w-4 h-4 rounded-full border-2 border-border border-t-accent animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        <span>{loading ? 'Redirecting to Google...' : 'Connect Gmail to send emails'}</span>
      </button>
      {error && (
        <p className="text-xs text-error text-center px-2">{error}</p>
      )}
    </div>
  )
}
