// ============================================================
// Workshop audience check-in
//
// Registrations live at schedules/{eventId}/registrations/{registrationId}
// and each carries a unique ticketId — that ticketId is the content encoded
// in the QR code printed on the audience's ticket.
//
// Fast path: every registration also writes a tiny ticketLookup/{ticketId}
// document ({ eventId, registrationId }) in the same transaction. A scan is
// therefore a direct document read + a single registration transaction — no
// collection-group query, no index dependency, ~2 round trips.
//
// Legacy path: registrations created before ticketLookup existed fall back to
// the indexed collection-group query once, then the lookup document is
// backfilled so the next scan of that ticket is fast.
//
// The transaction re-reads the registration so the same QR code can only be
// checked in once — a second scan reports "already checked in" instead of
// overwriting the original check-in record. This stays safe with multiple
// scanners checking guests in concurrently.
// ============================================================
import {
  collectionGroup,
  doc,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './config'

const TICKET_LOOKUP = 'ticketLookup'

// Session cache: ticketId -> { eventId, registrationId }. Repeated scans of
// the same QR skip the lookup read entirely (the transaction still re-reads
// the registration itself for consistency).
const ticketCache = new Map()

function getDatabase() {
  if (!isFirebaseConfigured || !db) {
    throw new Error(
      'Firebase is not configured. Add your credentials to the .env file and restart the dev server.'
    )
  }
  return db
}

/** schedules/{eventId}/registrations/{registrationId} -> { eventId, registrationId } */
function parseRegistrationPath(path) {
  const parts = String(path || '').split('/')
  const index = parts.indexOf('registrations')
  if (index < 2 || index + 1 >= parts.length) return null
  return { eventId: parts[index - 1], registrationId: parts[index + 1] }
}

/**
 * Look up a workshop registration by its QR ticket ID and check the guest in.
 *
 * @param {string} ticketId  The content decoded from the QR code (the registration ticketId).
 * @param {{ uid: string, displayName?: string, email?: string }} scanner  The signed-in scanner or admin.
 * @returns {Promise<{ status: 'checked_in' | 'already_checked_in' | 'not_found', registration: object | null }>}
 */
export async function checkInByTicketId(ticketId, scanner) {
  const database = getDatabase()
  const normalizedTicketId = String(ticketId || '').trim()

  if (!normalizedTicketId) {
    throw new Error('No ticket ID was scanned.')
  }
  if (!scanner?.uid) {
    throw new Error('You must be signed in to check in guests.')
  }

  const scannerName = scanner.displayName || scanner.email || ''
  const lookupRef = doc(database, TICKET_LOOKUP, normalizedTicketId)
  const cached = ticketCache.get(normalizedTicketId)

  let result = { status: 'not_found', registration: null }

  await runTransaction(database, async (transaction) => {
    let eventId = cached?.eventId || ''
    let registrationId = cached?.registrationId || ''
    let needsLookupWrite = false

    // ---- 1. Fast path: direct ticket lookup document -------------------
    if (!eventId || !registrationId) {
      const lookupSnap = await transaction.get(lookupRef)
      if (lookupSnap.exists()) {
        const lookup = lookupSnap.data()
        eventId = lookup.eventId || ''
        registrationId = lookup.registrationId || ''
      }
    }

    let registrationRef =
      eventId && registrationId
        ? doc(database, 'schedules', eventId, 'registrations', registrationId)
        : null

    // ---- 2. Legacy path: indexed collection-group query, once ----------
    if (!registrationRef) {
      const snapshot = await transaction.get(
        query(
          collectionGroup(database, 'registrations'),
          where('ticketId', '==', normalizedTicketId)
        )
      )

      if (snapshot.empty) {
        result = { status: 'not_found', registration: null }
        return
      }

      if (snapshot.size > 1) {
        console.warn(
          `Multiple registrations found for ticketId "${normalizedTicketId}" — using the first match.`
        )
      }

      const match = snapshot.docs[0]
      const parsed = parseRegistrationPath(match.ref.path)
      if (!parsed) {
        result = { status: 'not_found', registration: null }
        return
      }

      registrationRef = match.ref
      eventId = parsed.eventId
      registrationId = parsed.registrationId
      needsLookupWrite = true
    }

    // ---- 3. Read the registration fresh inside the transaction ---------
    const freshSnap = await transaction.get(registrationRef)
    if (!freshSnap.exists()) {
      ticketCache.delete(normalizedTicketId)
      result = { status: 'not_found', registration: null }
      return
    }

    // Backfill the lookup document for legacy registrations so the next
    // scan of this ticket takes the fast path.
    if (needsLookupWrite) {
      transaction.set(lookupRef, {
        eventId,
        registrationId,
        ticketId: normalizedTicketId,
        createdAt: serverTimestamp(),
      })
      ticketCache.set(normalizedTicketId, { eventId, registrationId })
    } else if (!cached) {
      ticketCache.set(normalizedTicketId, { eventId, registrationId })
    }

    const data = freshSnap.data()
    const registration = { id: freshSnap.id, ...data }

    if (data.checkedIn) {
      // Someone already checked this guest in — don't overwrite the record.
      result = { status: 'already_checked_in', registration }
      return
    }

    transaction.update(registrationRef, {
      checkedIn: true,
      checkedInAt: serverTimestamp(),
      checkedInBy: scanner.uid,
      checkedInByName: scannerName,
    })

    result = {
      status: 'checked_in',
      registration: {
        ...registration,
        checkedIn: true,
        checkedInAt: new Date(),
        checkedInBy: scanner.uid,
        checkedInByName: scannerName,
      },
    }
  })

  return result
}
