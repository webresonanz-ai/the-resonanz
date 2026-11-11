// ============================================================
// Schedule-specific Firestore operations
// Workshop registrations live in `schedules/{eventId}/registrations`.
// Registration documents use an incrementing id (000001, 000002, …) and an
// email-and-name lookup document (`registrationEmails/{hash}`) prevents duplicates.
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

export const SCORE_VIEW_OPTIONS = [
  {
    value: 'printed',
    label: 'Printed (will be provided at the venue)',
  },
  {
    value: 'digital',
    label: 'Digital (bring your own iPad / tablet)',
  },
]

function vocalRangeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
}

export function normalizeVocalRange(value) {
  const key = vocalRangeKey(value)
  if (!key) return ''
  return VOCAL_RANGES.find((range) => vocalRangeKey(range) === key) || ''
}

function scoreViewKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[\s_-]+/g, ' ')
    .trim()
}

export function normalizeScoreView(value) {
  const key = scoreViewKey(value)
  if (!key) return ''
  if (['printed', 'print', 'paper', 'hard copy', 'hardcopy'].includes(key)) return 'printed'
  if (['digital', 'electronic', 'tablet', 'ipad', 'device'].includes(key)) return 'digital'
  return ''
}

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

export function generateTicketId(eventCode, registrationId) {
  const code = normalizeEventCode(eventCode) || 'WS'
  const timestamp = String(Date.now()).slice(-9).padStart(9, '0')
  return `${code}_${registrationId}_${timestamp}_${randomTicketSuffix()}`
}

function formatRegistrationId(number) {
  return String(number).padStart(6, '0')
}

async function buildRegistrationLookupId(eventId, email, name) {
  const payload = `${eventId}\n${email}\n${name}`
  const bytes = new TextEncoder().encode(payload)

  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function getDatabase() {
  if (!isFirebaseConfigured || !db) {
    throw new Error(
      'Firebase is not configured. Add your credentials to the .env file and restart the dev server.'
    )
  }
  return db
}

export async function registerForWorkshop(eventId, { name, email, vocalRange, preferredScoreView }) {
  const database = getDatabase()
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedName = name.trim().toLowerCase().replace(/\s+/g, ' ')
  const eventRef = doc(database, 'schedules', eventId)
  const counterRef = doc(database, 'counters', 'registrations')
  const lookupId = await buildRegistrationLookupId(eventId, normalizedEmail, normalizedName)
  const lookupRef = doc(database, 'registrationEmails', lookupId)

  let ticketId = ''
  let registrationId = ''

  await runTransaction(database, async (transaction) => {
    const eventSnap = await transaction.get(eventRef)
    if (!eventSnap.exists()) throw new Error('This event no longer exists.')

    const counterSnap = await transaction.get(counterRef)
    const lookupSnap = await transaction.get(lookupRef)

    const event = eventSnap.data()
    if (event.type !== 'Workshop') {
      throw new Error('This event is not open for workshop registration.')
    }
    if (event.registrationOpen === false) {
      throw new Error('Registration for this workshop is closed.')
    }

    if (lookupSnap.exists()) {
      throw new Error('This name and email are already registered for this workshop.')
    }

    const capacity = Number(event.capacity) || 0
    const registered = Number(event.registrationCount) || 0

    if (capacity < 1) {
      throw new Error('Registration for this workshop is not available.')
    }
    if (registered >= capacity) {
      throw new Error('This workshop is full.')
    }

    const registrationNumber = (Number(counterSnap.data()?.count) || 0) + 1
    registrationId = formatRegistrationId(registrationNumber)
    const registrationRef = doc(database, 'schedules', eventId, 'registrations', registrationId)
    ticketId = generateTicketId(event.eventId || eventId, registrationId)
    const ticketLookupRef = doc(database, 'ticketLookup', ticketId)

    transaction.set(registrationRef, {
      name: name.trim(),
      email: normalizedEmail,
      vocalRange: vocalRange.trim(),
      preferredScoreView: normalizeScoreView(preferredScoreView),
      registrationId,
      registrationNumber,
      lookupId,
      ticketId,
      eventId,
      eventTitle: event.title || '',
      createdAt: serverTimestamp(),
    })
    transaction.set(lookupRef, {
      eventId,
      registrationId,
      createdAt: serverTimestamp(),
    })
    // Direct ticket -> registration mapping for fast, index-free QR check-in.
    transaction.set(ticketLookupRef, {
      eventId,
      registrationId,
      ticketId,
      createdAt: serverTimestamp(),
    })
    if (counterSnap.exists()) {
      transaction.update(counterRef, { count: registrationNumber })
    } else {
      transaction.set(counterRef, { count: registrationNumber })
    }
    transaction.update(eventRef, { registrationCount: registered + 1 })
  })

  return { ticketId, registrationId }
}

/**
 * Import validated rows one by one through the normal registration path so
 * duplicate checks, counters, tickets and capacity limits stay consistent.
 * Rows are processed sequentially to avoid counter races.
 */
export async function importWorkshopRegistrations(eventId, rows, onProgress) {
  const summary = { total: rows.length, imported: 0, failed: 0, errors: [] }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    try {
      await registerForWorkshop(eventId, {
        name: row.name,
        email: row.email,
        vocalRange: row.vocalRange,
        preferredScoreView: row.preferredScoreView,
      })
      summary.imported += 1
    } catch (err) {
      summary.failed += 1
      summary.errors.push({
        row: row.rowNumber,
        name: row.name,
        email: row.email,
        message:
          err?.code === 'permission-denied'
            ? 'This email is already registered, or the workshop is full.'
            : err?.message || 'Unable to import this row.',
      })
    }

    onProgress?.({ ...summary, processed: index + 1 })
  }

  return summary
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

export async function updateWorkshopRegistration(
  eventId,
  registrationId,
  { name, vocalRange, preferredScoreView }
) {
  const database = getDatabase()
  return updateDoc(
    doc(database, 'schedules', eventId, 'registrations', registrationId),
    {
      name: name.trim(),
      vocalRange: vocalRange.trim(),
      preferredScoreView: normalizeScoreView(preferredScoreView),
    }
  )
}
