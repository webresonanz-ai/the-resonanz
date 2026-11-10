<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useContentCollection } from '@/composables/useContentCollection'
import { useAuthStore } from '@/stores/auth'
import {
  importWorkshopRegistrations,
  normalizeVocalRange,
  subscribeToWorkshopRegistrations,
  updateWorkshopRegistration,
  VOCAL_RANGES,
} from '@/firebase/schedules'
import { fetchDriveFile } from '@/firebase/drive'

const authStore = useAuthStore()
const {
  items: events,
  loading: eventsLoading,
  error: eventsError,
} = useContentCollection('schedules', 'date', 'asc')

const registrationsByEvent = ref({})
const registrationError = ref('')
const notice = ref('')
const search = ref('')
const selectedEventId = ref('')
const page = ref(1)
const PAGE_SIZE = 8
const editing = ref(null)
const form = ref({ name: '', vocalRange: '' })
const formError = ref('')
const saving = ref(false)
const ticketDownloadError = ref('')
const downloadingTicketId = ref('')
const registrationUnsubs = new Map()
const importOpen = ref(false)
const importStep = ref(1)
const importEventId = ref('')
const importFile = ref(null)
const importFileName = ref('')
const importFileInput = ref(null)
const importError = ref('')
const importProgress = ref('')
const importSummary = ref(null)
const importing = ref(false)
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

const workshopEvents = computed(() => events.value.filter((event) => event.type === 'Workshop'))

const importEvent = computed(
  () => workshopEvents.value.find((event) => event.id === importEventId.value) || null,
)

const importSpotsLeft = computed(() => {
  if (!importEvent.value) return 0
  return Math.max(
    0,
    (Number(importEvent.value.capacity) || 0) - (Number(importEvent.value.registrationCount) || 0),
  )
})

const importIssues = computed(() => {
  if (!importSummary.value) return []
  const invalid = importSummary.value.invalidRows.map((row) => ({
    row: row.rowNumber,
    name: row.name,
    message: row.message,
  }))
  const failed = importSummary.value.errors.map((row) => ({
    row: row.row,
    name: row.name,
    message: row.message,
  }))
  return [...invalid, ...failed].sort((a, b) => a.row - b.row)
})

const importSkipped = computed(() => {
  if (!importSummary.value) return 0
  return importSummary.value.invalidRows.length + importSummary.value.failed
})

const audiences = computed(() =>
  workshopEvents.value.flatMap((event) =>
    (registrationsByEvent.value[event.id] || []).map((registration) => ({
      ...registration,
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.date,
      ticketDesignURL: event.ticketDesignURL || '',
    })),
  ),
)

const filteredAudiences = computed(() => {
  const term = search.value.trim().toLowerCase()
  return audiences.value.filter((guest) => {
    if (selectedEventId.value && guest.eventId !== selectedEventId.value) return false
    if (!term) return true
    return [
      guest.name,
      guest.email,
      guest.vocalRange,
      guest.eventTitle,
      guest.ticketId,
      guest.registrationId,
    ].some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(term),
    )
  })
})

const pageCount = computed(() =>
  Math.max(1, Math.ceil(filteredAudiences.value.length / PAGE_SIZE)),
)

const paginatedAudiences = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredAudiences.value.slice(start, start + PAGE_SIZE)
})

const pageStart = computed(() =>
  filteredAudiences.value.length ? (page.value - 1) * PAGE_SIZE + 1 : 0,
)

const pageEnd = computed(() =>
  Math.min(page.value * PAGE_SIZE, filteredAudiences.value.length),
)

watch([search, selectedEventId], () => {
  page.value = 1
})

watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

watch(
  workshopEvents,
  (list) => {
    const ids = new Set(list.map((event) => event.id))

    for (const [id, unsubscribe] of registrationUnsubs) {
      if (ids.has(id)) continue
      unsubscribe()
      registrationUnsubs.delete(id)
      const remaining = { ...registrationsByEvent.value }
      delete remaining[id]
      registrationsByEvent.value = remaining
    }

    for (const event of list) {
      if (registrationUnsubs.has(event.id)) continue
      try {
        const unsubscribe = subscribeToWorkshopRegistrations(
          event.id,
          (registrations) => {
            registrationsByEvent.value = {
              ...registrationsByEvent.value,
              [event.id]: registrations,
            }
          },
          (err) => {
            registrationError.value =
              err.message || 'Unable to load guest registrations from Firestore.'
          },
        )
        registrationUnsubs.set(event.id, unsubscribe)
      } catch (err) {
        registrationError.value = err.message || 'Unable to load guest registrations.'
      }
    }
  },
  { immediate: true },
)

function eventDate(value) {
  return value?.toDate ? value.toDate() : new Date(value)
}

function formatDate(value) {
  const date = eventDate(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(value) {
  if (!value) return ''
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function initials(guest) {
  const base = guest.name || guest.email || '?'
  const parts = base.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

function ticketGuestName(name) {
  const value = String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!value) return 'Guest'
  if (value.length <= 25) return value

  const clipped = value.slice(0, 25)
  if (value[25] === ' ') return clipped

  const lastSpace = clipped.lastIndexOf(' ')
  return (lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).trim() || 'Guest'
}

function ticketFilename(guest) {
  const base = `${guest.eventTitle || 'workshop'}-${guest.name || 'guest'}-${guest.ticketId || ''}`
  return `${base.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-').slice(0, 150)}.pdf`
}

async function downloadTicket(guest) {
  ticketDownloadError.value = ''
  if (!guest.ticketDesignURL) {
    ticketDownloadError.value = `Upload a ticket design for "${guest.eventTitle}" before downloading tickets.`
    return
  }
  if (!guest.ticketId) {
    ticketDownloadError.value = `No ticket ID is available for ${guest.name || 'this guest'}.`
    return
  }

  downloadingTicketId.value = `${guest.eventId}-${guest.registrationId || guest.id}`
  try {
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
    const contentWidth = width * 0.44
    const contentCenterX = width - margin - contentWidth / 2
    const nameSize = height * 0.033
    const nameLineHeight = height * 0.098
    const vocalRangeSize = height * 0.03
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)
    const qrCodeDataUrl = await QRCode.toDataURL(guest.ticketId, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 400,
    })
    const qrCodeBytes = Uint8Array.from(
      atob(qrCodeDataUrl.split(',')[1]),
      (character) => character.charCodeAt(0),
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

    let textY = height - margin - nameSize - 105
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

    const qrSize = Math.min(width * 0.3, height * 0.27)
    const qrX = contentCenterX - qrSize / 2
    const qrY = textY - height * 0.08 - qrSize
    page.drawImage(qrCode, { x: qrX, y: qrY, width: qrSize, height: qrSize })

    const output = await pdf.save()
    const objectUrl = URL.createObjectURL(new Blob([output], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = ticketFilename(guest)
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch (err) {
    ticketDownloadError.value = err.message || 'Unable to generate this ticket PDF.'
  } finally {
    downloadingTicketId.value = ''
  }
}

function openEdit(guest) {
  editing.value = guest
  form.value = { name: guest.name || '', vocalRange: guest.vocalRange || '' }
  formError.value = ''
  notice.value = ''
}

function closeEdit() {
  editing.value = null
  formError.value = ''
}

async function saveGuest() {
  if (!editing.value) return
  formError.value = ''

  if (!form.value.name.trim()) {
    formError.value = 'Name is required.'
    return
  }
  if (!form.value.vocalRange) {
    formError.value = 'Select the guest vocal range.'
    return
  }

  saving.value = true
  try {
    await updateWorkshopRegistration(
      editing.value.eventId,
      editing.value.registrationId || editing.value.id,
      form.value,
    )
    notice.value = 'Guest details updated.'
    closeEdit()
  } catch (err) {
    formError.value = err.message || 'Unable to update this guest.'
  } finally {
    saving.value = false
  }
}

function resetImport() {
  importStep.value = 1
  importEventId.value = ''
  importFile.value = null
  importFileName.value = ''
  importError.value = ''
  importProgress.value = ''
  importSummary.value = null
  importing.value = false
  if (importFileInput.value) importFileInput.value.value = ''
}

function openImport() {
  if (!authStore.isAdmin) return
  resetImport()
  importOpen.value = true
}

function closeImport() {
  if (importing.value) return
  importOpen.value = false
}

function continueImport() {
  importError.value = ''
  if (!importEventId.value) {
    importError.value = 'Choose the workshop to import guests into.'
    return
  }
  importStep.value = 2
}

function onImportFileChange(event) {
  const file = event.target.files?.[0] || null
  importError.value = ''
  importSummary.value = null
  importProgress.value = ''
  importFile.value = file
  importFileName.value = file?.name || ''
}

function importAnother() {
  importSummary.value = null
  importFile.value = null
  importFileName.value = ''
  importError.value = ''
  importProgress.value = ''
  if (importFileInput.value) importFileInput.value.value = ''
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
}

async function parseImportFile(file) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('The spreadsheet has no sheets.')

  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  })
  if (!matrix.length) throw new Error('The selected spreadsheet is empty.')

  const headers = matrix[0].map(normalizeHeader)
  const nameIndex = headers.indexOf('name')
  const emailIndex = headers.indexOf('email')
  const vocalRangeIndex = headers.findIndex((header) =>
    ['vocal range', 'vocalrange', 'voice', 'range'].includes(header),
  )

  if (nameIndex === -1 || emailIndex === -1 || vocalRangeIndex === -1) {
    throw new Error('The first row must include "Name", "Vocal Range" and "Email" columns.')
  }

  const validRows = []
  const invalidRows = []

  for (let index = 1; index < matrix.length; index += 1) {
    const cells = matrix[index]
    const name = String(cells[nameIndex] ?? '').trim()
    const email = String(cells[emailIndex] ?? '').trim().toLowerCase()
    const vocalRangeRaw = String(cells[vocalRangeIndex] ?? '').trim()

    if (!name && !email && !vocalRangeRaw) continue

    const rowNumber = index + 1
    const vocalRange = normalizeVocalRange(vocalRangeRaw)
    const problems = []

    if (!name) problems.push('name is missing')
    else if (name.length > 100) problems.push('name is longer than 100 characters')

    if (!email) problems.push('email is missing')
    else if (email.length > 254 || !EMAIL_PATTERN.test(email)) problems.push('email is invalid')

    if (!vocalRangeRaw) problems.push('vocal range is missing')
    else if (!vocalRange) problems.push(`vocal range "${vocalRangeRaw}" is not recognised`)

    if (problems.length) {
      invalidRows.push({ rowNumber, name, email, message: problems.join('; ') })
    } else {
      validRows.push({ rowNumber, name, email, vocalRange })
    }
  }

  if (!validRows.length && !invalidRows.length) {
    throw new Error('No audience rows were found below the header row.')
  }

  return { validRows, invalidRows }
}

async function runImport() {
  if (!importEvent.value || importing.value) return
  importError.value = ''
  importSummary.value = null

  if (!importFile.value) {
    importError.value = 'Choose an Excel file to import.'
    return
  }

  importing.value = true
  importProgress.value = 'Reading file…'

  try {
    const { validRows, invalidRows } = await parseImportFile(importFile.value)
    const summary = await importWorkshopRegistrations(
      importEvent.value.id,
      validRows,
      (progress) => {
        importProgress.value = `Importing ${progress.processed} of ${progress.total}…`
      },
    )

    importSummary.value = {
      ...summary,
      invalidRows,
      totalRows: validRows.length + invalidRows.length,
    }

    if (summary.imported) {
      notice.value = `Imported ${summary.imported} guest${summary.imported === 1 ? '' : 's'} into "${importEvent.value.title}".`
    }
  } catch (err) {
    importError.value = err.message || 'Unable to import this spreadsheet.'
  } finally {
    importing.value = false
    importProgress.value = ''
  }
}

onUnmounted(() => {
  for (const unsubscribe of registrationUnsubs.values()) unsubscribe()
  registrationUnsubs.clear()
})
</script>

<template>
  <div class="space-y-5 sm:space-y-6">
    <div
      v-if="registrationError"
      role="alert"
      class="rounded-xl border border-rose-700/50 bg-rose-950/30 p-3 sm:p-4 text-sm text-rose-200"
    >
      {{ registrationError }}
    </div>
    <div
      v-if="notice"
      role="status"
      class="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-3 sm:p-4 text-sm text-emerald-200"
    >
      {{ notice }}
    </div>
    <div
      v-if="ticketDownloadError"
      role="alert"
      class="rounded-xl border border-rose-700/50 bg-rose-950/30 p-3 sm:p-4 text-sm text-rose-200"
    >
      {{ ticketDownloadError }}
    </div>

    <section class="rounded-2xl border border-maroon-700/60 glass-card overflow-hidden">
      <div
        class="flex flex-col gap-3 sm:gap-4 p-4 sm:p-5 border-b border-maroon-700/50 lg:flex-row lg:items-center lg:justify-between"
      >
        <div>
          <h2 class="text-base sm:text-lg font-serif text-bone-100">Workshop audiences</h2>
          <p class="text-xs text-bone-500 mt-1">
            <template v-if="search || selectedEventId">
              {{ filteredAudiences.length }} of {{ audiences.length }} guest{{
                audiences.length === 1 ? '' : 's'
              }}
            </template>
            <template v-else>
              {{ audiences.length }} registered guest{{ audiences.length === 1 ? '' : 's' }} across
              {{ workshopEvents.length }} workshop{{ workshopEvents.length === 1 ? '' : 's' }}
            </template>
          </p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            v-if="authStore.isAdmin"
            type="button"
            class="w-full sm:w-auto rounded-lg bg-gold-500 px-3 py-2 text-sm font-semibold text-maroon-950 hover:bg-gold-400"
            @click="openImport"
          >
            Import Excel
          </button>
          <label class="sr-only" for="audience-event-filter">Filter by workshop</label>
          <select
            id="audience-event-filter"
            v-model="selectedEventId"
            class="w-full sm:w-52 rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold-500/60"
          >
            <option value="">All workshops</option>
            <option v-for="event in workshopEvents" :key="event.id" :value="event.id">
              {{ event.title }}
            </option>
          </select>
          <div class="relative w-full sm:w-64">
            <input
              v-model="search"
              type="search"
              placeholder="Search name, email, ticket…"
              class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 placeholder:text-bone-500 outline-none focus:border-gold-500/60"
            />
          </div>
        </div>
      </div>

      <div v-if="eventsError" role="alert" class="p-4 sm:p-6 text-sm text-rose-200">
        {{ eventsError }}
      </div>
      <div v-else-if="eventsLoading" class="p-4 sm:p-6 text-bone-400">Loading audiences…</div>
      <div v-else-if="!workshopEvents.length" class="p-4 sm:p-6 text-bone-400">
        No workshop events yet. Add a workshop in the Schedules section to collect guests.
      </div>
      <div v-else-if="!filteredAudiences.length" class="p-4 sm:p-6 text-bone-400">
        {{
          search || selectedEventId
            ? 'No guests match your filters.'
            : 'No guests have registered for a workshop yet.'
        }}
      </div>
      <template v-else>
        <ul class="divide-y divide-maroon-800/70">
          <li
            v-for="guest in paginatedAudiences"
            :key="`${guest.eventId}-${guest.email}`"
            class="p-3 sm:p-4 hover:bg-maroon-800/30"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div class="flex min-w-0 flex-1 items-start gap-3">
                <div
                  class="flex w-10 h-10 flex-shrink-0 items-center justify-center rounded-full border border-gold-500/25 bg-gold-500/10 text-sm font-semibold text-gold-300"
                >
                  {{ initials(guest) }}
                </div>
                <div class="min-w-0 flex-1 space-y-1.5">
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span class="text-sm font-medium text-bone-200 break-words">{{
                      guest.name
                    }}</span>
                    <span
                      class="px-2 py-0.5 rounded-full border border-maroon-600/50 bg-maroon-800/40 text-[10px] uppercase tracking-wider text-bone-400"
                      >{{ guest.vocalRange }}</span
                    >
                    <span
                      v-if="guest.registrationId"
                      class="px-2 py-0.5 rounded-full border border-gold-500/20 bg-gold-500/5 text-[10px] font-mono text-gold-300"
                      >#{{ guest.registrationId }}</span
                    >
                    <span
                      class="px-2 py-0.5 rounded-full border text-[10px] font-medium"
                      :class="
                        guest.checkedIn
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-maroon-600/50 bg-maroon-800/40 text-bone-400'
                      "
                    >
                      {{ guest.checkedIn ? 'Checked in' : 'Not checked in' }}
                    </span>
                  </div>
                  <p class="text-xs text-bone-500 break-all sm:truncate">{{ guest.email }}</p>
                  <div
                    class="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3"
                  >
                    <p class="min-w-0">
                      <span class="text-bone-500">Ticket </span>
                      <span class="font-mono text-gold-300/80 break-all">{{
                        guest.ticketId || '—'
                      }}</span>
                    </p>
                    <p class="min-w-0">
                      <span class="text-bone-500">Workshop </span>
                      <span class="text-bone-300">{{ guest.eventTitle }}</span>
                      <span v-if="guest.eventDate" class="text-bone-500"
                        >· {{ formatDate(guest.eventDate) }}</span
                      >
                    </p>
                    <p class="min-w-0">
                      <span class="text-bone-500">Check-in </span>
                      <span :class="guest.checkedIn ? 'text-emerald-300' : 'text-bone-500'">{{
                        guest.checkedIn ? formatDateTime(guest.checkedInAt) || 'Checked in' : '—'
                      }}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div class="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                <button
                  type="button"
                  :disabled="!guest.ticketDesignURL || !guest.ticketId || Boolean(downloadingTicketId)"
                  :title="!guest.ticketDesignURL ? 'Upload a ticket design for this workshop first' : !guest.ticketId ? 'Ticket ID unavailable' : 'Download ticket PDF'"
                  class="flex-1 rounded-lg border border-gold-500/30 px-3 py-1.5 text-xs text-gold-300 hover:bg-gold-500/10 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                  @click="downloadTicket(guest)"
                >
                  {{
                    downloadingTicketId === `${guest.eventId}-${guest.registrationId || guest.id}`
                      ? 'Generating…'
                      : 'Download ticket PDF'
                  }}
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-lg border border-maroon-700/60 px-3 py-1.5 text-xs text-bone-300 hover:text-gold-300 sm:flex-none"
                  @click="openEdit(guest)"
                >
                  Edit
                </button>
              </div>
            </div>
          </li>
        </ul>

        <div
          class="flex flex-col gap-3 border-t border-maroon-700/50 px-4 sm:px-5 py-3 text-xs text-bone-400 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            Showing {{ pageStart }}–{{ pageEnd }} of {{ filteredAudiences.length }} guest{{
              filteredAudiences.length === 1 ? '' : 's'
            }}
          </p>
          <div class="flex items-center justify-between gap-2 sm:justify-end">
            <button
              type="button"
              :disabled="page <= 1"
              class="px-3 py-1.5 rounded-lg border border-maroon-700/60 text-xs text-bone-300 hover:text-gold-300 disabled:cursor-not-allowed disabled:opacity-40"
              @click="page -= 1"
            >
              Previous
            </button>
            <span class="px-1 text-bone-500">Page {{ page }} of {{ pageCount }}</span>
            <button
              type="button"
              :disabled="page >= pageCount"
              class="px-3 py-1.5 rounded-lg border border-maroon-700/60 text-xs text-bone-300 hover:text-gold-300 disabled:cursor-not-allowed disabled:opacity-40"
              @click="page += 1"
            >
              Next
            </button>
          </div>
        </div>
      </template>
    </section>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="editing" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeEdit"></div>

          <div
            class="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-maroon-700/60 bg-maroon-900 p-4 sm:p-6 shadow-2xl shadow-black/60 animate-scale-in"
          >
            <div class="flex items-start justify-between gap-4 mb-5">
              <div>
                <p class="text-xs uppercase tracking-[0.25em] text-gold-400/80 mb-1">Audiences</p>
                <h2 class="text-xl font-serif text-bone-100">Edit guest</h2>
              </div>
              <button
                type="button"
                class="p-2 rounded-lg text-bone-400 hover:text-gold-300 hover:bg-maroon-800/60 transition-colors"
                aria-label="Close"
                @click="closeEdit"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div
              v-if="formError"
              role="alert"
              class="mb-4 rounded-xl border border-rose-700/50 bg-rose-950/30 p-3 text-sm text-rose-200"
            >
              {{ formError }}
            </div>

            <form class="space-y-4" @submit.prevent="saveGuest">
              <div>
                <label class="block text-xs font-medium text-bone-400 mb-1.5">Name</label>
                <input
                  v-model="form.name"
                  type="text"
                  maxlength="100"
                  class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold-500/60"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-bone-400 mb-1.5">Vocal range</label>
                <select
                  v-model="form.vocalRange"
                  class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold-500/60"
                >
                  <option value="" disabled>Select a vocal range</option>
                  <option v-for="range in VOCAL_RANGES" :key="range" :value="range">
                    {{ range }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium text-bone-400 mb-1.5">Email</label>
                <input
                  :value="editing.email"
                  type="email"
                  disabled
                  class="w-full rounded-lg border border-maroon-700/40 bg-maroon-950/40 px-3 py-2 text-sm text-bone-500 cursor-not-allowed"
                />
                <p class="mt-1.5 text-xs text-bone-500">
                  Email is used for duplicate checks and cannot be changed.
                </p>
              </div>

              <div>
                <label class="block text-xs font-medium text-bone-400 mb-1.5"
                  >Registration ID</label
                >
                <input
                  :value="editing.registrationId || '—'"
                  type="text"
                  disabled
                  class="w-full rounded-lg border border-maroon-700/40 bg-maroon-950/40 px-3 py-2 text-sm font-mono text-gold-300/80 cursor-not-allowed"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-bone-400 mb-1.5">Ticket ID</label>
                <input
                  :value="editing.ticketId || 'No ticket ID'"
                  type="text"
                  disabled
                  class="w-full rounded-lg border border-maroon-700/40 bg-maroon-950/40 px-3 py-2 text-sm font-mono text-gold-300/80 cursor-not-allowed"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-bone-400 mb-1.5">Workshop</label>
                <input
                  :value="editing.eventTitle"
                  type="text"
                  disabled
                  class="w-full rounded-lg border border-maroon-700/40 bg-maroon-950/40 px-3 py-2 text-sm text-bone-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-bone-400 mb-1.5">Check-in status</label>
                <div
                  class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                  :class="
                    editing.checkedIn
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-maroon-700/40 bg-maroon-950/40 text-bone-500'
                  "
                >
                  <span
                    class="w-2 h-2 rounded-full"
                    :class="editing.checkedIn ? 'bg-emerald-400' : 'bg-bone-600'"
                  ></span>
                  {{ editing.checkedIn ? 'Checked in' : 'Not checked in yet' }}
                </div>
              </div>

              <div v-if="editing.checkedIn">
                <label class="block text-xs font-medium text-bone-400 mb-1.5">Check-in time</label>
                <input
                  :value="formatDateTime(editing.checkedInAt) || '—'"
                  type="text"
                  disabled
                  class="w-full rounded-lg border border-maroon-700/40 bg-maroon-950/40 px-3 py-2 text-sm text-bone-300 cursor-not-allowed"
                />
                <p v-if="editing.checkedInByName || editing.checkedInBy" class="mt-1.5 text-xs text-bone-500">
                  Checked in by {{ editing.checkedInByName || editing.checkedInBy }}
                </p>
              </div>

              <div class="flex gap-3 pt-2">
                <button
                  type="submit"
                  :disabled="saving"
                  class="flex-1 rounded-lg bg-gold-500 px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-semibold text-maroon-950 hover:bg-gold-400 disabled:opacity-50"
                >
                  {{ saving ? 'Saving…' : 'Save changes' }}
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-maroon-700/60 px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-bone-300 hover:text-bone-100"
                  @click="closeEdit"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="importOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeImport"></div>

          <div
            class="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-maroon-700/60 bg-maroon-900 p-4 sm:p-6 shadow-2xl shadow-black/60 animate-scale-in"
          >
            <div class="flex items-start justify-between gap-4 mb-5">
              <div>
                <p class="text-xs uppercase tracking-[0.25em] text-gold-400/80 mb-1">Audiences</p>
                <h2 class="text-xl font-serif text-bone-100">Import guests from Excel</h2>
              </div>
              <button
                type="button"
                class="p-2 rounded-lg text-bone-400 hover:text-gold-300 hover:bg-maroon-800/60 transition-colors disabled:opacity-40"
                aria-label="Close"
                :disabled="importing"
                @click="closeImport"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div class="mb-5 flex items-center gap-2 text-[11px] uppercase tracking-wider">
              <span :class="importStep === 1 ? 'text-gold-300' : 'text-bone-500'">
                1. Workshop
              </span>
              <span class="text-bone-600">/</span>
              <span :class="importStep === 2 ? 'text-gold-300' : 'text-bone-500'">2. Excel file</span>
            </div>

            <template v-if="importStep === 1">
              <div
                v-if="!workshopEvents.length"
                class="rounded-xl border border-maroon-700/60 bg-maroon-950/40 p-4 text-sm text-bone-400"
              >
                No workshop events yet. Add a workshop in the Schedules section before importing
                guests.
              </div>
              <template v-else>
                <div>
                  <label class="block text-xs font-medium text-bone-400 mb-1.5" for="import-event">
                    Event schedule
                  </label>
                  <select
                    id="import-event"
                    v-model="importEventId"
                    class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold-500/60"
                  >
                    <option value="" disabled>Select a workshop</option>
                    <option v-for="event in workshopEvents" :key="event.id" :value="event.id">
                      {{ event.title }} — {{ formatDate(event.date) }}
                    </option>
                  </select>
                  <p
                    v-if="importEvent"
                    class="mt-2 text-xs"
                    :class="importSpotsLeft ? 'text-bone-500' : 'text-rose-300'"
                  >
                    {{ importSpotsLeft }} spot{{ importSpotsLeft === 1 ? '' : 's' }} left ·
                    {{ Number(importEvent.registrationCount) || 0 }} /
                    {{ Number(importEvent.capacity) || 0 }} registered
                  </p>
                </div>

                <div
                  v-if="importError"
                  role="alert"
                  class="mt-4 rounded-xl border border-rose-700/50 bg-rose-950/30 p-3 text-sm text-rose-200"
                >
                  {{ importError }}
                </div>

                <div class="flex gap-3 pt-5">
                  <button
                    type="button"
                    :disabled="!importEventId"
                    class="flex-1 rounded-lg bg-gold-500 px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-semibold text-maroon-950 hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
                    @click="continueImport"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-maroon-700/60 px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-bone-300 hover:text-bone-100"
                    @click="closeImport"
                  >
                    Cancel
                  </button>
                </div>
              </template>
            </template>

            <template v-else>
              <div
                class="mb-4 rounded-xl border border-maroon-700/60 bg-maroon-950/40 px-3 py-2 text-sm text-bone-300"
              >
                <span class="text-bone-500">Workshop </span>{{ importEvent?.title }}
              </div>

              <template v-if="importSummary">
                <div
                  class="rounded-xl border p-3 text-sm"
                  :class="
                    importSummary.imported
                      ? 'border-emerald-700/40 bg-emerald-950/20 text-emerald-200'
                      : 'border-rose-700/50 bg-rose-950/30 text-rose-200'
                  "
                >
                  Imported {{ importSummary.imported }} of {{ importSummary.totalRows }} row{{
                    importSummary.totalRows === 1 ? '' : 's'
                  }}.
                </div>

                <div
                  v-if="importSkipped"
                  class="mt-3 rounded-xl border border-gold-500/25 bg-gold-500/5 p-3 text-xs text-gold-100"
                >
                  <p class="font-medium text-gold-200">
                    {{ importSkipped }} row{{ importSkipped === 1 ? '' : 's' }} skipped
                  </p>
                  <ul class="mt-2 max-h-44 space-y-1 overflow-y-auto">
                    <li v-for="issue in importIssues" :key="`${issue.row}-${issue.message}`">
                      <span class="font-mono text-gold-300/80">Row {{ issue.row }}</span>
                      <span v-if="issue.name"> · {{ issue.name }}</span>
                      <span class="text-gold-200/80"> — {{ issue.message }}</span>
                    </li>
                  </ul>
                </div>

                <div class="flex gap-3 pt-5">
                  <button
                    type="button"
                    class="flex-1 rounded-lg border border-gold-500/30 px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-gold-300 hover:bg-gold-500/10"
                    @click="importAnother"
                  >
                    Import another file
                  </button>
                  <button
                    type="button"
                    class="rounded-lg bg-gold-500 px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-semibold text-maroon-950 hover:bg-gold-400"
                    @click="closeImport"
                  >
                    Done
                  </button>
                </div>
              </template>

              <template v-else>
                <div>
                  <label class="block text-xs font-medium text-bone-400 mb-1.5" for="import-file">
                    Excel file
                  </label>
                  <input
                    id="import-file"
                    ref="importFileInput"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    class="block w-full text-sm text-bone-400 file:mr-3 file:rounded-lg file:border-0 file:bg-gold-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-maroon-950 hover:file:bg-gold-400"
                    @change="onImportFileChange"
                  />
                  <p v-if="importFileName" class="mt-2 text-xs text-bone-300 break-all">
                    {{ importFileName }}
                  </p>
                  <p class="mt-2 text-xs text-bone-500">
                    The first row must contain the columns
                    <span class="text-bone-300">Name</span>,
                    <span class="text-bone-300">Vocal Range</span> and
                    <span class="text-bone-300">Email</span>. Supported vocal ranges:
                    {{ VOCAL_RANGES.join(', ') }}.
                  </p>
                </div>

                <div
                  v-if="importError"
                  role="alert"
                  class="mt-4 rounded-xl border border-rose-700/50 bg-rose-950/30 p-3 text-sm text-rose-200"
                >
                  {{ importError }}
                </div>

                <p v-if="importProgress" class="mt-3 text-sm text-bone-300">{{ importProgress }}</p>

                <div class="flex gap-3 pt-5">
                  <button
                    type="button"
                    :disabled="importing || !importFile"
                    class="flex-1 rounded-lg bg-gold-500 px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-semibold text-maroon-950 hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
                    @click="runImport"
                  >
                    {{ importing ? 'Importing…' : 'Import guests' }}
                  </button>
                  <button
                    type="button"
                    :disabled="importing"
                    class="rounded-lg border border-maroon-700/60 px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-bone-300 hover:text-bone-100 disabled:opacity-40"
                    @click="importStep = 1"
                  >
                    Back
                  </button>
                </div>
              </template>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
