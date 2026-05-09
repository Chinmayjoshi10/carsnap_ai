import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Firebase Auth is optional — app works without it (just no Gmail OAuth)
let app = null
let db = null
let auth = null

try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    auth = getAuth(app)
  } else {
    console.warn('Firebase API key not configured — auth features disabled')
  }
} catch (e) {
  console.warn('Firebase init failed:', e.message)
}

export { db, auth }

/**
 * Sign in with Google via Firebase Auth popup.
 */
export async function signInWithGoogle() {
  if (!auth) throw new Error('Firebase Auth not configured')

  const provider = new GoogleAuthProvider()
  provider.addScope('https://www.googleapis.com/auth/gmail.send')
  provider.setCustomParameters({
    access_type: 'offline',
    prompt: 'consent',
  })

  const result = await signInWithPopup(auth, provider)
  const credential = GoogleAuthProvider.credentialFromResult(result)

  return {
    user: result.user,
    accessToken: credential?.accessToken,
  }
}

/**
 * Start Gmail OAuth redirect flow.
 * Saves current state to sessionStorage, then redirects to Google.
 * After consent, Google redirects back to the app with ?code= in the URL.
 */
export function startGmailAuthRedirect() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId || clientId.startsWith('YOUR_')) {
    throw new Error('Google Client ID not configured')
  }

  // Save a flag so we know to handle the redirect on return
  sessionStorage.setItem('gmail_oauth_pending', 'true')

  const redirectUri = window.location.origin
  const scope = 'https://www.googleapis.com/auth/gmail.send'

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('include_granted_scopes', 'true')

  // Full-page redirect — bypasses all COOP issues
  window.location.href = authUrl.toString()
}

/**
 * Check if the current URL has a Gmail OAuth code (after redirect back).
 * Returns the code if found, null otherwise.
 */
export function checkGmailRedirect() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const pending = sessionStorage.getItem('gmail_oauth_pending')

  if (code && pending) {
    // Clean up URL and session flag
    sessionStorage.removeItem('gmail_oauth_pending')
    url.searchParams.delete('code')
    url.searchParams.delete('scope')
    window.history.replaceState({}, '', url.pathname)
    return code
  }

  // Also check for error
  const error = url.searchParams.get('error')
  if (error && pending) {
    sessionStorage.removeItem('gmail_oauth_pending')
    url.searchParams.delete('error')
    window.history.replaceState({}, '', url.pathname)
    throw new Error(`Gmail authorization denied: ${error}`)
  }

  return null
}

export async function signOutUser() {
  if (auth) await signOut(auth)
}
