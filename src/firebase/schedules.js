// ============================================================
// Schedule-specific Firestore operations
// Workshop registrations live in `schedules/{eventId}/registrations`.
// The email is used as the document id so a guest cannot register twice.
// ============================================================
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './config'

export const VOCAL_RANGES = [
  'Soprano',
  'Mezzo-Soprano',
  'Alto',
  'Contralto',
  'Countertenor',
  'Tenor',
  'Baritone',
  'Bass',
]

function getDatabase() {
  if (!isFirebaseConfigured || !db) {
    throw new Error(
      'Firebase is not configured. Add your credentials to the .env file and restart the dev server.'
    )
  }
  return db
}

export async function registerForWorkshop(eventId, { name, email, vocalRange }) {
  const database = getDatabase()
  const normalizedEmail = email.trim().toLowerCase()
  const eventRef = doc(database, 'schedules', eventId)
  const registrationRef = doc(
    database,
    'schedules',
    eventId,
    'registrations',
    normalizedEmail
  )

  await runTransaction(database, async (transaction) => {
    const eventSnap = await transaction.get(eventRef)
    if (!eventSnap.exists()) throw new Error('This event no longer exists.')

    const event = eventSnap.data()
    if (event.type !== 'Workshop') {
      throw new Error('This event is not open for workshop registration.')
    }

    const capacity = Number(event.capacity) || 0
    const registered = Number(event.registrationCount) || 0

    if (capacity < 1) {
      throw new Error('Registration for this workshop is not available.')
    }
    if (registered >= capacity) {
      throw new Error('This workshop is full.')
    }

    transaction.set(registrationRef, {
      name: name.trim(),
      email: normalizedEmail,
      vocalRange: vocalRange.trim(),
      eventId,
      eventTitle: event.title || '',
      createdAt: serverTimestamp(),
    })
    transaction.update(eventRef, { registrationCount: registered + 1 })
  })
}
