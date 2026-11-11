// ============================================================
// Google Apps Script — audience confirmation emails
// Deploy this file as a Web App that executes as the Gmail account
// that should send the confirmations (for example webresonanz@gmail.com).
//
// Script Properties required:
//   FIREBASE_PROJECT_ID = the-resonanz
//   FIREBASE_API_KEY    = <same as VITE_FIREBASE_API_KEY>
//
// No Gmail app password is stored here: GmailApp sends from the
// account that owns and deploys this script.
// ============================================================
const MAX_PDF_BYTES = 7 * 1024 * 1024
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

function doGet() {
  return json({ ok: true, service: 'the-resonanz-audience-email' })
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}')
    const result = sendAudienceEmail(payload)
    return json({ ok: true, recipient: result.recipient })
  } catch (error) {
    console.error(error)
    return json({
      ok: false,
      error: (error && error.message) || 'Unable to send the confirmation email.',
    })
  }
}

function sendAudienceEmail(payload) {
  const eventId = String(payload.eventId || '').trim()
  const registrationId = String(payload.registrationId || '').trim()
  if (!eventId || !registrationId) {
    throw new Error('The audience event and registration are required.')
  }

  const user = verifyIdToken(payload.idToken)
  const profile = firestoreGet('users/' + user.localId, payload.idToken)
  const role = profile && profile.fields && profile.fields.role && profile.fields.role.stringValue
  if (role !== 'admin') {
    throw new Error('Only admins can send audience emails.')
  }

  const eventDoc = firestoreGet('schedules/' + encodeURIComponent(eventId), payload.idToken)
  if (!eventDoc) throw new Error('This event no longer exists.')

  const registrationDoc = firestoreGet(
    'schedules/' +
      encodeURIComponent(eventId) +
      '/registrations/' +
      encodeURIComponent(registrationId),
    payload.idToken,
  )
  if (!registrationDoc) throw new Error('This audience registration no longer exists.')

  const event = readFields(eventDoc.fields)
  const registration = readFields(registrationDoc.fields)

  if (registration.eventId && registration.eventId !== eventId) {
    throw new Error('This registration does not belong to the event.')
  }

  const recipient = String(registration.email || '')
    .trim()
    .toLowerCase()
  if (!EMAIL_PATTERN.test(recipient)) {
    throw new Error('This audience has no valid email address.')
  }

  const pdf = decodePdf(payload.pdfBase64)
  const email = buildEmail(event, registration)

  try {
    GmailApp.sendEmail(recipient, email.subject, email.text, {
      htmlBody: email.html,
      name: 'The Resonanz',
      attachments: [
        Utilities.newBlob(pdf, 'application/pdf', ticketFilename(event, registration)),
      ],
    })
  } catch (error) {
    console.error(error)
    throw new Error('Unable to send the confirmation email. Check the Gmail account authorization.')
  }

  return { recipient: recipient }
}

function verifyIdToken(idToken) {
  if (!idToken) throw new Error('Missing sign-in token. Sign in again.')
  const apiKey = getScriptProperty('FIREBASE_API_KEY')
  const response = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey),
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true,
    },
  )
  if (response.getResponseCode() !== 200) {
    throw new Error('Your session has expired. Sign in again.')
  }
  const data = JSON.parse(response.getContentText())
  const user = data.users && data.users[0]
  if (!user || !user.localId) throw new Error('Invalid sign-in token.')
  return user
}

function firestoreGet(path, idToken) {
  const projectId = getScriptProperty('FIREBASE_PROJECT_ID')
  const response = UrlFetchApp.fetch(
    'https://firestore.googleapis.com/v1/projects/' +
      encodeURIComponent(projectId) +
      '/databases/(default)/documents/' +
      path,
    {
      method: 'get',
      headers: { Authorization: 'Bearer ' + idToken },
      muteHttpExceptions: true,
    },
  )
  if (response.getResponseCode() === 404) return null
  if (response.getResponseCode() !== 200) {
    throw new Error('Unable to read the audience data.')
  }
  return JSON.parse(response.getContentText())
}

function getScriptProperty(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name)
  if (!value) throw new Error('Script property ' + name + ' is not configured.')
  return value
}

function readFields(fields) {
  const values = {}
  Object.keys(fields || {}).forEach(function (key) {
    const value = fields[key]
    if (!value) return
    if (value.stringValue !== undefined) values[key] = value.stringValue
    else if (value.integerValue !== undefined) values[key] = value.integerValue
    else if (value.timestampValue !== undefined) values[key] = value.timestampValue
    else if (value.booleanValue !== undefined) values[key] = value.booleanValue
  })
  return values
}

function decodePdf(value) {
  const clean = String(value || '')
    .replace(/^data:application\/pdf;base64,/, '')
    .replace(/\s+/g, '')
  if (!clean) throw new Error('The ticket PDF is required.')
  if (!/^[A-Za-z0-9+/=]+$/.test(clean)) {
    throw new Error('The ticket PDF is not valid base64 data.')
  }

  const bytes = Utilities.base64Decode(clean)
  if (!bytes.length) throw new Error('The ticket PDF is empty.')
  if (bytes.length > MAX_PDF_BYTES) throw new Error('The ticket PDF is too large to email.')

  const signature = bytes
    .slice(0, 5)
    .map(function (byte) {
      return String.fromCharCode(byte)
    })
    .join('')
  if (signature !== '%PDF-') throw new Error('The attachment is not a valid PDF.')
  return bytes
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value).replace(
    /[&<>"']/g,
    function (character) {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
      return map[character]
    },
  )
}

function formatEventDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (isNaN(date.getTime())) return ''
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'EEEE, MMMM d, yyyy')
}

function formatEventTime(event) {
  const start = String(event.startTime || '').trim()
  const end = String(event.endTime || '').trim()
  if (start && end) return start + ' – ' + end
  return start || end || ''
}

function ticketFilename(event, registration) {
  const base =
    (event.title || 'ticket') +
    '-' +
    (registration.name || 'guest') +
    '-' +
    (registration.ticketId || '')
  return (
    base
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 150) + '.pdf'
  )
}

function buildEmail(event, registration) {
  const type = String(event.type || '').trim()
  const isConcert = type === 'Concert'
  const isWorkshop = type === 'Workshop'
  const label = type || 'event'
  const kind = isConcert ? 'concert' : isWorkshop ? 'workshop' : 'event'

  const name = registration.name || 'Guest'
  const vocalRange = registration.vocalRange || 'Not specified'
  const title = event.title || label
  const date = formatEventDate(event.date)
  const time = formatEventTime(event)
  const venue = event.venue || ''

  const subject = isConcert
    ? 'Your concert confirmation — ' + title
    : isWorkshop
      ? 'Your workshop confirmation — ' + title
      : 'Your event confirmation — ' + title

  const intro = isConcert
    ? 'Thank you for confirming your attendance. Your seat for this concert is reserved — we look forward to seeing you.'
    : isWorkshop
      ? 'Thank you for registering. Your spot in this workshop is confirmed — we look forward to seeing you.'
      : 'Thank you for registering. Your attendance is confirmed — we look forward to seeing you.'

  const details = [
    ['Event', title],
    ['Type', label],
    ['Date', date],
    ['Time', time],
    ['Venue', venue],
    ['Name', name],
    ['Vocal Range', vocalRange],
  ].filter(function (entry) {
    return entry[1]
  })

  const detailRows = details
    .map(function (entry) {
      return (
        '<tr>' +
        '<td style="padding:8px 16px 8px 0;color:#8a7d6b;font-size:13px;white-space:nowrap;vertical-align:top;">' +
        escapeHtml(entry[0]) +
        '</td>' +
        '<td style="padding:8px 0;color:#f5efe3;font-size:14px;font-weight:600;">' +
        escapeHtml(entry[1]) +
        '</td>' +
        '</tr>'
      )
    })
    .join('')

  const html =
    '<!doctype html><html><body style="margin:0;padding:24px;background:#150d0b;font-family:Georgia,\'Times New Roman\',serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;border:1px solid #4a2b25;border-radius:16px;overflow:hidden;background:#1f1210;">' +
    '<tr><td style="padding:28px 28px 20px;border-bottom:1px solid #4a2b25;background:#2a1512;">' +
    '<p style="margin:0 0 6px;color:#d4af6a;font-size:11px;letter-spacing:3px;text-transform:uppercase;">The Resonanz</p>' +
    '<h1 style="margin:0;color:#f5efe3;font-size:22px;font-weight:600;">Your ' +
    escapeHtml(kind) +
    ' is confirmed</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:24px 28px;">' +
    '<p style="margin:0 0 20px;color:#c9bcaa;font-size:14px;line-height:1.7;">' +
    escapeHtml(intro) +
    '</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #3a211c;">' +
    detailRows +
    '</table>' +
    '<p style="margin:24px 0 0;color:#8a7d6b;font-size:12px;line-height:1.7;">Your ticket is attached as a PDF. Please show the QR code at the entrance.</p>' +
    '</td></tr>' +
    '<tr><td style="padding:16px 28px;border-top:1px solid #4a2b25;background:#2a1512;">' +
    '<p style="margin:0;color:#8a7d6b;font-size:11px;">Sent by The Resonanz · Please do not reply to this email.</p>' +
    '</td></tr></table></body></html>'

  const text = [
    'Your ' + kind + ' is confirmed',
    '',
    intro,
    '',
    details
      .map(function (entry) {
        return entry[0] + ': ' + entry[1]
      })
      .join('\n'),
    '',
    'Your ticket is attached as a PDF. Please show the QR code at the entrance.',
  ].join('\n')

  return { subject: subject, html: html, text: text }
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
