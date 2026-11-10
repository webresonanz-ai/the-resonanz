// ============================================================
// Firestore user profiles
// Stores each authenticated user under `users/{uid}`.
// New users always start with the `guest` role.
// ============================================================
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './config'

export const DEFAULT_ROLE = 'guest'

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
      await setDoc(
        ref,
        { lastLoginAt: serverTimestamp(), updatedAt: serverTimestamp() },
        { merge: true }
      )
      return { uid: user.uid, ...snap.data() }
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
    }

    await setDoc(ref, profile)
    return profile
  } catch (err) {
    console.warn('Failed to save user profile to Firestore:', err)
    return null
  }
}
