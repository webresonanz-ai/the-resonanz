import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '@/firebase/config'
import { claimUserSession, ensureUserProfile, getUserProfile, releaseUserSession } from '@/firebase/users'

/* ---- helpers ---- */
function mapUser(u) {
  if (!u) return null
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
    provider: u.providerData?.[0]?.providerId || null,
    createdAt: u.metadata?.creationTime || null,
    role: 'guest',
  }
}

const authErrorMessages = {
  'session/device-in-use': 'This account is already active on another device. Please log out there first, then try again.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/missing-password': 'Please enter your password.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Pop-up was blocked. Please allow pop-ups and try again.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
  'auth/network-request-failed': 'Network error. Please check your connection.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase.',
}

function friendlyError(err) {
  return (
    authErrorMessages[err?.code] ||
    err?.message?.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '') ||
    'Something went wrong. Please try again.'
  )
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const initialized = ref(false)

  let initPromise = null

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  // Scanners and admins can both access the QR check-in page.
  const isScanner = computed(
    () => user.value?.role === 'scanner' || user.value?.role === 'admin'
  )
  const isConfigured = isFirebaseConfigured

  const displayName = computed(
    () =>
      user.value?.displayName ||
      (user.value?.email ? user.value.email.split('@')[0] : 'Maestro')
  )

  const initials = computed(() => {
    const base =
      user.value?.displayName ||
      (user.value?.email ? user.value.email.split('@')[0] : 'M')
    const parts = base.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return base.slice(0, 2).toUpperCase()
  })

  /** Start the auth-state listener. Resolves once the first snapshot arrives. */
  function init() {
    if (initPromise) return initPromise
    if (!isFirebaseConfigured) {
      initialized.value = true
      initPromise = Promise.resolve()
      return initPromise
    }
    initPromise = new Promise((resolve) => {
      onAuthStateChanged(auth, async (u) => {
        let profile = null
        if (u) {
          try {
            profile = await getUserProfile(u)
            if (profile && !(await claimUserSession(u))) {
              await signOut(auth)
              user.value = null
              error.value = authErrorMessages['session/device-in-use']
              if (!initialized.value) {
                initialized.value = true
                resolve()
              }
              return
            }
          } catch (err) {
            console.warn('Failed to load user profile from Firestore:', err)
            await signOut(auth)
            user.value = null
            error.value = 'Unable to verify this account session. Please try again.'
            if (!initialized.value) {
              initialized.value = true
              resolve()
            }
            return
          }
        }
        user.value = u ? { ...mapUser(u), role: profile?.role || 'guest' } : null
        if (!initialized.value) {
          initialized.value = true
          resolve()
        }
      })
    })
    return initPromise
  }

  function clearError() {
    error.value = null
  }

  async function login(email, password) {
    if (!isFirebaseConfigured) {
      error.value =
        'Firebase is not configured. Add your credentials to the .env file and restart the dev server.'
      return false
    }
    loading.value = true
    error.value = null
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const profile = await ensureUserProfile(cred.user)
      if (!(await claimUserSession(cred.user))) {
        await signOut(auth)
        throw { code: 'session/device-in-use' }
      }
      user.value = { ...mapUser(cred.user), role: profile?.role || 'guest' }
      return true
    } catch (err) {
      error.value = friendlyError(err)
      return false
    } finally {
      loading.value = false
    }
  }

  async function register(name, email, password) {
    if (!isFirebaseConfigured) {
      error.value =
        'Firebase is not configured. Add your credentials to the .env file and restart the dev server.'
      return false
    }
    loading.value = true
    error.value = null
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (name) await updateProfile(cred.user, { displayName: name })
      const profile = await ensureUserProfile(cred.user)
      if (!(await claimUserSession(cred.user))) {
        await signOut(auth)
        throw { code: 'session/device-in-use' }
      }
      user.value = { ...mapUser(cred.user), role: profile?.role || 'guest' }
      return true
    } catch (err) {
      error.value = friendlyError(err)
      return false
    } finally {
      loading.value = false
    }
  }

  async function loginWithGoogle() {
    if (!isFirebaseConfigured) {
      error.value =
        'Firebase is not configured. Add your credentials to the .env file and restart the dev server.'
      return false
    }
    loading.value = true
    error.value = null
    try {
      const cred = await signInWithPopup(auth, googleProvider)
      const profile = await ensureUserProfile(cred.user)
      if (!(await claimUserSession(cred.user))) {
        await signOut(auth)
        throw { code: 'session/device-in-use' }
      }
      user.value = { ...mapUser(cred.user), role: profile?.role || 'guest' }
      return true
    } catch (err) {
      error.value = friendlyError(err)
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    if (!isFirebaseConfigured) {
      user.value = null
      return
    }
    if (auth.currentUser) await releaseUserSession(auth.currentUser)
    await signOut(auth)
    user.value = null
  }

  return {
    user,
    loading,
    error,
    initialized,
    isAuthenticated,
    isAdmin,
    isScanner,
    isConfigured,
    displayName,
    initials,
    init,
    clearError,
    login,
    register,
    loginWithGoogle,
    logout,
  }
})
