import { createContext, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { auth, signInWithGoogle, signOutUser, checkGmailRedirect } from './lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { getGmailStatus, connectGmail } from './lib/api'
import Capture from './pages/Capture'
import Contacts from './pages/Contacts'

// Auth context shared across pages
export const AuthContext = createContext(null)

function Nav({ user, onSignIn, onSignOut }) {
  const { pathname } = useLocation()
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy h-14"
         style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.06)' }}>
      <div className="max-w-lg mx-auto px-5 h-full flex items-center justify-between">
        <span className="text-white font-semibold text-sm tracking-tight flex items-center gap-2">
          <span>📇</span> CardSnap
        </span>
        <div className="flex items-center gap-5">
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

          {/* Auth button */}
          {user ? (
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 ml-1"
              title={`Signed in as ${user.email}`}
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full border border-white/20" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-medium">
                  {user.displayName?.[0] || user.email?.[0] || '?'}
                </div>
              )}
            </button>
          ) : (
            <button
              onClick={onSignIn}
              className="text-xs text-white/60 hover:text-white transition-colors ml-1"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [oauthStatus, setOauthStatus] = useState(null) // for redirect result messages

  // Listen for auth state changes
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        // Check Gmail connection status
        try {
          const status = await getGmailStatus(firebaseUser.uid)
          setGmailConnected(status.gmail_connected)
        } catch {
          setGmailConnected(false)
        }

        // Handle Gmail OAuth redirect return
        try {
          const code = checkGmailRedirect()
          if (code) {
            setOauthStatus('connecting')
            await connectGmail({
              code,
              redirectUri: window.location.origin,
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoUrl: firebaseUser.photoURL,
            })
            setGmailConnected(true)
            setOauthStatus('connected')
            setTimeout(() => setOauthStatus(null), 3000)
          }
        } catch (err) {
          console.error('Gmail connect failed:', err.message)
          setOauthStatus('error')
          setTimeout(() => setOauthStatus(null), 4000)
        }
      } else {
        setGmailConnected(false)
      }
      setAuthLoading(false)
    })
    return unsubscribe
  }, [])

  const handleSignIn = async () => {
    try {
      await signInWithGoogle()
    } catch (err) {
      console.error('Sign in failed:', err.message)
    }
  }

  const handleSignOut = async () => {
    await signOutUser()
    setGmailConnected(false)
  }

  return (
    <AuthContext.Provider value={{ user, gmailConnected, setGmailConnected, authLoading }}>
      <BrowserRouter>
        <div className="max-w-lg mx-auto min-h-screen bg-bg">
          <Nav user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} />
          <div className="pt-14">
            {/* Gmail OAuth status banner */}
            {oauthStatus === 'connecting' && (
              <div className="mx-4 mt-3 px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2"
                   style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                <div className="w-4 h-4 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                Connecting Gmail...
              </div>
            )}
            {oauthStatus === 'connected' && (
              <div className="mx-4 mt-3 px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2"
                   style={{ background: '#F0FDF4', color: '#166534' }}>
                <span>✓</span> Gmail connected successfully!
              </div>
            )}
            {oauthStatus === 'error' && (
              <div className="mx-4 mt-3 px-4 py-3 rounded-2xl text-sm font-medium"
                   style={{ background: '#FEF2F2', color: '#991B1B' }}>
                Gmail connection failed. Please try again.
              </div>
            )}
            <Routes>
              <Route path="/" element={<Capture />} />
              <Route path="/contacts" element={<Contacts />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
