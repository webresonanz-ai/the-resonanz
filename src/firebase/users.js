// ============================================================
// Firestore user profiles
// Stores each authenticated user under `users/{uid}`.
// New users always start with the `guest` role.
// ============================================================
import { doc, getDoc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './config'

export const DEFAULT_ROLE = 'guest'

const DEVICE_ID_KEY = 'resonanz.deviceId'

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

/** Claim the account for this browser. Concurrent claims are serialized by Firestore. */
export async function claimUserSession(user) {
  if (!isFirebaseConfigured || !user?.uid) return false

  const deviceId = getDeviceId()
  const ref = doc(db, 'users', user.uid)
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref)
    if (!snap.exists()) return false

    const activeDeviceId = snap.data().activeDeviceId
    if (activeDeviceId && activeDeviceId !== deviceId) return false

    transaction.update(ref, {
      activeDeviceId: deviceId,
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    })
    return true
  })
}

export async function releaseUserSession(user) {
  if (!isFirebaseConfigured || !user?.uid) return

  const deviceId = getDeviceId()
  const ref = doc(db, 'users', user.uid)
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref)
    if (snap.exists() && snap.data().activeDeviceId === deviceId) {
      transaction.update(ref, {
        activeDeviceId: null,
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      })
    }
  })
}

export async function getUserProfile(user) {
  if (!isFirebaseConfigured || !user?.uid) return null

  const snap = await getDoc(doc(db, 'users', user.uid))
  return snap.exists() ? { uid: user.uid, ...snap.data() } : null
}

/**
 * Create the user's Firestore profile if it does not exist yet, otherwise
 * refresh their `lastLoginAt`. The role is only set on creation so an
 * existing role (e.g. admin/teacher) is never overwritten by a login.
 *
 * Never throws: a failed profile write must not block authentication.
 */
export async function ensureUserProfile(user) {
  if (!isFirebaseConfigured || !user?.uid) return null

  try {
    const ref = doc(db, 'users', user.uid)
    const snap = await getDoc(ref)

    if (snap.exists()) {
      const profile = { uid: user.uid, ...snap.data() }
      try {
        await setDoc(
          ref,
          { lastLoginAt: serverTimestamp(), updatedAt: serverTimestamp() },
          { merge: true }
        )
      } catch (err) {
        console.warn('Failed to refresh user profile in Firestore:', err)
      }
      return profile
    }

    const profile = {
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      provider: user.providerData?.[0]?.providerId || null,
      role: DEFAULT_ROLE,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      activeDeviceId: null,
    }

    await setDoc(ref, profile)
    return profile
  } catch (err) {
    console.warn('Failed to save user profile to Firestore:', err)
    return null
  }
}
