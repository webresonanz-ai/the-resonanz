// ============================================================
// Guest ticket PDF generation
// Uses the workshop ticket-design PDF stored in Google Drive as the
// first page, then draws the guest name, vocal range and QR code.
// Shared by the download and email actions in the audience section.
// ============================================================
import { fetchDriveFile } from './drive'

export function ticketGuestName(name) {
  const value = String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!value) return 'Guest'
  if (value.length <= 25) return value

  const words = value.split(' ')
  const kept = []
  let length = 0

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]
    const nextLength = length + (kept.length ? 1 : 0) + word.length
    if (nextLength > 25) {
      const initials = words.slice(index).map((remaining) => `${remaining[0].toUpperCase()}.`)
      return [...kept, ...initials].join(' ')
    }
    kept.push(word)
    length = nextLength
  }

  return kept.join(' ')
}

export function ticketFilename(guest) {
  const base = `${guest.eventTitle || 'workshop'}-${guest.name || 'guest'}-${guest.ticketId || ''}`
  return `${base.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-').slice(0, 150)}.pdf`
}

export async function generateTicketPdf(guest) {
  if (!guest.ticketDesignURL) {
    throw new Error(
      `Upload a ticket design for "${guest.eventTitle || 'this event'}" before sending tickets.`,
    )
  }
  if (!guest.ticketId) {
    throw new Error(`No ticket ID is available for ${guest.name || 'this guest'}.`)
  }

  const [designBlob, { PDFDocument, rgb, StandardFonts }, QRCode] = await Promise.all([
    fetchDriveFile(guest.ticketDesignURL),
    import('pdf-lib'),
    import('qrcode'),
  ])
  const pdf = await PDFDocument.load(await designBlob.arrayBuffer())
  const pages = pdf.getPages()
  if (!pages.length) throw new Error('The ticket design PDF has no pages.')
  for (let index = pages.length - 1; index > 0; index -= 1) pdf.removePage(index)

  const page = pdf.getPages()[0]
  const { width, height } = page.getSize()
  const margin = width * 0.06
  const contentWidth = width * 0.8
  const contentCenterX = width / 2
  const nameSize = height * 0.025
  const nameLineHeight = height * 0.04
  const vocalRangeSize = height * 0.02
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)
  const qrCodeDataUrl = await QRCode.toDataURL(guest.ticketId, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 400,
  })
  const qrCodeBytes = Uint8Array.from(atob(qrCodeDataUrl.split(',')[1]), (character) =>
    character.charCodeAt(0),
  )
  const qrCode = await pdf.embedPng(qrCodeBytes)

  const nameLines = []
  let currentLine = ''
  for (const word of ticketGuestName(guest.name).split(/\s+/)) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (currentLine && boldFont.widthOfTextAtSize(candidate, nameSize) > contentWidth) {
      nameLines.push(currentLine)
      currentLine = word
    } else {
      currentLine = candidate
    }
  }
  if (currentLine) nameLines.push(currentLine)

  let textY = height - margin - nameSize - 365
  for (const line of nameLines) {
    const lineWidth = boldFont.widthOfTextAtSize(line, nameSize)
    page.drawText(line, {
      x: contentCenterX - lineWidth / 2,
      y: textY,
      size: nameSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    })
    textY -= nameLineHeight
  }

  textY -= height * 0.025
  const vocalRange = guest.vocalRange || 'Not specified'
  page.drawText(vocalRange, {
    x: contentCenterX - boldFont.widthOfTextAtSize(vocalRange, vocalRangeSize) / 2,
    y: textY,
    size: vocalRangeSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  })

  const qrSize = Math.min(width * 0.2, height * 0.15)
  const qrX = contentCenterX - qrSize / 2
  const qrY = textY - height * 0.045 - qrSize
  page.drawImage(qrCode, { x: qrX, y: qrY, width: qrSize, height: qrSize })

  const bytes = await pdf.save()
  return { bytes, filename: ticketFilename(guest) }
}
