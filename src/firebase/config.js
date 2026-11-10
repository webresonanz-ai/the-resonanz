// ============================================================
// Firebase initialization — single source of truth
// Reads config from env vars (see .env.example).
// Guards against missing credentials so the app still renders
// the login page before credentials are provided.
// ============================================================
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, isSupported as analyticsSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

/**
 * Whether real credentials are present. The UI uses this to show a
 * helpful "not configured" notice instead of crashing at runtime.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
)

let app = null
let auth = null
let db = null
let googleProvider = null
let analytics = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
  googleProvider = new GoogleAuthProvider()
  // Ask Google to show the account chooser each time
  googleProvider.setCustomParameters({ prompt: 'select_account' })

  // Analytics is optional and only works in supported browsers — init lazily.
  analyticsSupported()
    .then((ok) => {
      if (ok) analytics = getAnalytics(app)
    })
    .catch(() => {})
}

export { app, auth, db, googleProvider, analytics }
