// ============================================================
// Workshop audience check-in
//
// Registrations live at schedules/{eventId}/registrations/{registrationId}
// and each carries a unique ticketId — that ticketId is the content encoded
// in the QR code printed on the audience's ticket.
//
// checkInByTicketId() looks up the matching registration with a collection
// group query, then atomically marks it as checked-in inside a transaction.
// The transaction re-reads the doc so that the same QR code can only be
// checked in once — a second scan reports "already checked in" instead of
// overwriting the original check-in record.
// ============================================================
import {
  collectionGroup,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './config'

function getDatabase() {
  if (!isFirebaseConfigured || !db) {
    throw new Error(
      'Firebase is not configured. Add your credentials to the .env file and restart the dev server.'
    )
  }
  return db
}

/**
 * Look up a workshop registration by its QR ticket ID and check the guest in.
 *
 * The write happens inside a Firestore transaction so that concurrent scans of
 * the same QR code race safely: the first scan flips `checkedIn` to true and
 * the second one observes the already-checked-in state without overwriting it.
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

  // Search every workshop registration subcollection for this ticketId.
  const ticketQuery = query(
    collectionGroup(database, 'registrations'),
    where('ticketId', '==', normalizedTicketId),
  )
  const snapshot = await getDocs(ticketQuery)

  if (snapshot.empty) {
    return { status: 'not_found', registration: null }
  }

  // Ticket IDs are unique by design; if more than one ever matches, log it
  // and operate on the first so the scanner still gets a usable result.
  if (snapshot.size > 1) {
    console.warn(
      `Multiple registrations found for ticketId "${normalizedTicketId}" — using the first match.`
    )
  }

  const registrationRef = snapshot.docs[0].ref

  let result

  await runTransaction(database, async (transaction) => {
    const freshSnap = await transaction.get(registrationRef)
    if (!freshSnap.exists()) {
      throw new Error('This registration no longer exists.')
    }

    const data = freshSnap.data()
    const registration = { id: freshSnap.id, ...data }

    if (data.checkedIn) {
      // Someone already checked this guest in — don't overwrite the record.
      result = { status: 'already_checked_in', registration }
      return
    }

    const scannerName = scanner.displayName || scanner.email || ''

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
