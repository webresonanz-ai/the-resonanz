// ============================================================
// Google Drive banner and ticket-design uploads
// Uses Google Identity Services for OAuth and the Drive REST API
// to upload images into the configured banner folder.
// ============================================================
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID
const FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_BANNER_EVENT_FOLDER_ID
const TICKET_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_TICKET_FOLDER_ID

let gisPromise = null
let tokenCache = { token: '', expiresAt: 0 }

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisPromise) return gisPromise

  gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Unable to load Google authorization.'))
    document.head.appendChild(script)
  })

  return gisPromise
}

export function preloadGoogleIdentityServices() {
  return loadGoogleIdentityServices()
}

/** Whether a cached Drive access token is still valid (no popup needed). */
export function hasValidAccessToken() {
  return Boolean(tokenCache.token && Date.now() < tokenCache.expiresAt)
}

/**
 * Request a Drive access token. On a cache miss this opens the Google
 * consent popup, so it MUST be called from a direct user gesture (e.g. a
 * click handler) — otherwise the browser blocks the popup with
 * "Failed to open popup window".
 */
export async function ensureDriveAccessToken() {
  return getAccessToken()
}

function requestAccessToken() {
  if (!CLIENT_ID) {
    return Promise.reject(
      new Error('Google Drive is not configured. Add VITE_CLIENT_ID to the .env file.')
    )
  }

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error))
          return
        }
        resolve(response)
      },
      error_callback: (error) => {
        reject(new Error(error?.message || 'Google authorization was cancelled.'))
      },
    })

    client.requestAccessToken({ prompt: '' })
  })
}

async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token

  if (!window.google?.accounts?.oauth2) {
    await loadGoogleIdentityServices()
  }

  const response = await requestAccessToken()
  const lifetime = Math.max(60, (Number(response.expires_in) || 3600) - 60)
  tokenCache = {
    token: response.access_token,
    expiresAt: Date.now() + lifetime * 1000,
  }
  return tokenCache.token
}

function buildMultipartBody(file, metadata) {
  const boundary = `resonanz_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const delimiter = `--${boundary}\r\n`
  const closeDelimiter = `--${boundary}--`
  const body = new Blob(
    [
      `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `${delimiter}Content-Type: ${file.type || metadata.mimeType || 'application/octet-stream'}\r\n\r\n`,
      file,
      '\r\n',
      closeDelimiter,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  )
  return { body, boundary }
}

async function uploadFileToDrive(file, folderId, namePrefix, fileType) {
  if (!file) throw new Error(`Choose a ${fileType === 'application/pdf' ? 'PDF' : 'image'} to upload.`)
  if (fileType === 'application/pdf') {
    if (file.type !== fileType && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Please choose a PDF file.')
    }
    const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    if (new TextDecoder().decode(signature) !== '%PDF-') {
      throw new Error('The selected file is not a valid PDF.')
    }
  } else if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error(`${fileType === 'application/pdf' ? 'PDF' : 'Image'} must be 5 MB or smaller.`)
  }

  const token = await getAccessToken()
  const metadata = {
    name: `${namePrefix}-${Date.now()}-${file.name}`,
    mimeType: fileType === 'application/pdf' ? fileType : file.type,
  }
  if (folderId) metadata.parents = [folderId]

  const { body, boundary } = buildMultipartBody(file, metadata)
  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )
  const uploadData = await uploadRes.json().catch(() => ({}))
  if (!uploadRes.ok) {
    throw new Error(uploadData?.error?.message || 'Failed to upload the image to Google Drive.')
  }

  const permissionRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${uploadData.id}/permissions?supportsAllDrives=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }
  )
  if (!permissionRes.ok) {
    const permissionData = await permissionRes.json().catch(() => ({}))
    throw new Error(
      permissionData?.error?.message || 'File uploaded, but it could not be made public.'
    )
  }

  if (fileType === 'application/pdf') {
    return `https://drive.google.com/file/d/${uploadData.id}/view`
  }
  return `https://drive.google.com/thumbnail?id=${uploadData.id}&sz=w1600`
}

export async function uploadBannerToDrive(file) {
  return uploadFileToDrive(file, FOLDER_ID, 'schedule-banner', 'image')
}

export async function uploadTicketDesignToDrive(file) {
  if (!TICKET_FOLDER_ID) {
    throw new Error('Google Drive ticket folder is not configured. Add VITE_GOOGLE_DRIVE_TICKET_FOLDER_ID to the .env file.')
  }
  return uploadFileToDrive(file, TICKET_FOLDER_ID, 'workshop-ticket-design', 'application/pdf')
}

export async function fetchDriveFile(fileUrl) {
  let fileId
  try {
    const url = new URL(fileUrl)
    if (url.hostname !== 'drive.google.com') {
      throw new Error('The ticket design must be a PDF stored in Google Drive.')
    }
    fileId = url.searchParams.get('id') || url.pathname.match(/\/file\/d\/([^/]+)/)?.[1]
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('The ticket design URL is invalid.', { cause: error })
    }
    throw error
  }
  if (!fileId) throw new Error('The ticket design URL does not contain a Google Drive file ID.')

  const token = await getAccessToken()
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data?.error?.message || 'Unable to download the ticket design from Google Drive.')
  }

  const file = await response.blob()
  if (file.type !== 'application/pdf' && file.size > 0) {
    const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    if (new TextDecoder().decode(signature) !== '%PDF-') {
      throw new Error('The Google Drive ticket design is not a valid PDF.')
    }
  }
  return file
}
