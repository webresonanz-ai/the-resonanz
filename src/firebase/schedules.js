// ============================================================
// Schedule-specific Firestore operations
// Workshop registrations live in `schedules/{eventId}/registrations`.
// The email is used as the document id so a guest cannot register twice.
// ============================================================
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
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

const TICKET_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function randomTicketSuffix(length = 4) {
  const values = new Uint32Array(length)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values)
  } else {
    for (let index = 0; index < length; index += 1) {
      values[index] = Math.floor(Math.random() * 0xffffffff)
    }
  }
  return Array.from(
    values,
    (value) => TICKET_ALPHABET[value % TICKET_ALPHABET.length]
  ).join('')
}

function normalizeEventCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function generateTicketId(eventCode) {
  const code = normalizeEventCode(eventCode) || 'WS'
  const timestamp = String(Date.now()).slice(-9).padStart(9, '0')
  return `${code}_${timestamp}_${randomTicketSuffix()}`
}

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

  let ticketId = ''
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

    ticketId = generateTicketId(event.eventId || eventId)

    transaction.set(registrationRef, {
      name: name.trim(),
      email: normalizedEmail,
      vocalRange: vocalRange.trim(),
      ticketId,
      eventId,
      eventTitle: event.title || '',
      createdAt: serverTimestamp(),
    })
    transaction.update(eventRef, { registrationCount: registered + 1 })
  })

  return ticketId
}

export function subscribeToWorkshopRegistrations(eventId, onData, onError) {
  const database = getDatabase()
  const registrationsQuery = query(
    collection(database, 'schedules', eventId, 'registrations'),
    orderBy('createdAt', 'asc')
  )

  return onSnapshot(
    registrationsQuery,
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  )
}

export async function updateWorkshopRegistration(eventId, email, { name, vocalRange }) {
  const database = getDatabase()
  return updateDoc(
    doc(database, 'schedules', eventId, 'registrations', email),
    {
      name: name.trim(),
      vocalRange: vocalRange.trim(),
    }
  )
}
