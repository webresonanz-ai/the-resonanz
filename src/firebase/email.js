// ============================================================
// Audience confirmation emails
// Posts to the Google Apps Script Web App in apps-script/Code.gs.
// The script verifies the signed-in admin and sends from its own
// Gmail account, so no Gmail app password ships to the browser.
// ============================================================
import { auth, isFirebaseConfigured } from './config'

const EMAIL_ENDPOINT = import.meta.env.VITE_APPS_SCRIPT_EMAIL_URL

function bytesToBase64(bytes) {
  const chunkSize = 0x8000
  let binary = ''
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

export async function sendAudienceConfirmationEmail({ eventId, registrationId, pdfBytes }) {
  if (!isFirebaseConfigured || !auth) {
    throw new Error(
      'Firebase is not configured. Add your credentials to the .env file and restart the dev server.',
    )
  }
  if (!EMAIL_ENDPOINT) {
    throw new Error(
      'Email is not configured. Add VITE_APPS_SCRIPT_EMAIL_URL to the .env file and restart the dev server.',
    )
  }
  if (!eventId || !registrationId) {
    throw new Error('The audience event and registration are required.')
  }
  if (!pdfBytes?.length) {
    throw new Error('The ticket PDF could not be generated.')
  }

  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) {
    throw new Error('Sign in as an admin to send audience emails.')
  }

  let response
  try {
    response = await fetch(EMAIL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        idToken,
        eventId,
        registrationId,
        pdfBase64: bytesToBase64(pdfBytes),
      }),
    })
  } catch (err) {
    throw new Error('Unable to reach the email service. Check your connection.', { cause: err })
  }

  const data = await response.json().catch(() => ({}))
  if (!data.ok) {
    throw new Error(data.error || 'Unable to send the confirmation email.')
  }
  return data
}
