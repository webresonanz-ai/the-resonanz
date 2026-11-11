<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useContentCollection } from '@/composables/useContentCollection'
import { useAuthStore } from '@/stores/auth'
import {
  importWorkshopRegistrations,
  normalizeScoreView,
  normalizeVocalRange,
  SCORE_VIEW_OPTIONS,
  subscribeToWorkshopRegistrations,
  updateWorkshopRegistration,
  VOCAL_RANGES,
} from '@/firebase/schedules'
import { generateTicketPdf } from '@/firebase/tickets'
import { sendAudienceConfirmationEmail } from '@/firebase/email'
import { manuallyCheckIn, removeCheckIn } from '@/firebase/checkin'

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
const scoreViewFilter = ref('')
const checkInFilter = ref('')
const page = ref(1)
const PAGE_SIZE = 8
const editing = ref(null)
const form = ref({ name: '', vocalRange: '', preferredScoreView: '' })
const formError = ref('')
const saving = ref(false)
const ticketDownloadError = ref('')
const downloadingTicketId = ref('')
const sendingEmailId = ref('')
const emailError = ref('')
const checkInBusyKey = ref('')
const checkInError = ref('')
const pendingRemoveCheckIn = ref(null)
const removingCheckIn = ref(false)
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
      eventType: event.type,
      ticketDesignURL: event.ticketDesignURL || '',
    })),
  ),
)

const filteredAudiences = computed(() => {
  const term = search.value.trim().toLowerCase()
  return audiences.value.filter((guest) => {
    if (selectedEventId.value && guest.eventId !== selectedEventId.value) return false
    if (scoreViewFilter.value && guest.preferredScoreView !== scoreViewFilter.value) return false
    if (checkInFilter.value === 'checked' && !guest.checkedIn) return false
    if (checkInFilter.value === 'not-checked' && guest.checkedIn) return false
    if (!term) return true
    return [
      guest.name,
      guest.email,
      guest.vocalRange,
      guest.preferredScoreView,
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

const hasFilters = computed(() =>
  Boolean(search.value || selectedEventId.value || scoreViewFilter.value || checkInFilter.value),
)

const selectedEventName = computed(
  () => workshopEvents.value.find((event) => event.id === selectedEventId.value)?.title || '',
)

const scoreViewFilterLabel = computed(
  () =>
    SCORE_VIEW_OPTIONS.find((option) => option.value === scoreViewFilter.value)?.label.split(' (')[0]
    || '',
)

const checkInFilterLabel = computed(
  () => ({ checked: 'Checked in', 'not-checked': 'Not checked in' })[checkInFilter.value] || '',
)

function clearFilters() {
  search.value = ''
  selectedEventId.value = ''
  scoreViewFilter.value = ''
  checkInFilter.value = ''
}

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

watch([search, selectedEventId, scoreViewFilter, checkInFilter], () => {
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

function guestKey(guest) {
  return `${guest.eventId}-${guest.registrationId || guest.id}`
}

async function downloadTicket(guest) {
  if (!authStore.isAdmin) return
  ticketDownloadError.value = ''
  if (!guest.ticketDesignURL) {
    ticketDownloadError.value = `Upload a ticket design for "${guest.eventTitle}" before downloading tickets.`
    return
  }
  if (!guest.ticketId) {
    ticketDownloadError.value = `No ticket ID is available for ${guest.name || 'this guest'}.`
    return
  }

  downloadingTicketId.value = guestKey(guest)
  try {
    const { bytes, filename } = await generateTicketPdf(guest)
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch (err) {
    ticketDownloadError.value = err.message || 'Unable to generate this ticket PDF.'
  } finally {
    downloadingTicketId.value = ''
  }
}

async function sendTicketEmail(guest) {
  if (!authStore.isAdmin) return
  emailError.value = ''
  notice.value = ''
  if (!guest.email) {
    emailError.value = `No email address is available for ${guest.name || 'this guest'}.`
    return
  }

  sendingEmailId.value = guestKey(guest)
  try {
    const { bytes } = await generateTicketPdf(guest)
    const result = await sendAudienceConfirmationEmail({
      eventId: guest.eventId,
      registrationId: guest.registrationId || guest.id,
      pdfBytes: bytes,
    })
    notice.value = `Confirmation email sent to ${result?.recipient || guest.email}.`
  } catch (err) {
    emailError.value = err.message || 'Unable to send the confirmation email.'
  } finally {
    sendingEmailId.value = ''
  }
}

async function toggleCheckIn(guest, event) {
  if (!authStore.isAdmin) return
  checkInError.value = ''
  notice.value = ''

  if (guest.checkedIn) {
    if (event?.target) event.target.checked = true
    openRemoveCheckIn(guest)
    return
  }

  checkInBusyKey.value = guestKey(guest)
  try {
    await manuallyCheckIn(guest.eventId, guest.registrationId || guest.id, authStore.user)
    notice.value = `${guest.name || 'Guest'} checked in.`
  } catch (err) {
    checkInError.value = err.message || 'Unable to check in this guest.'
    if (event?.target) event.target.checked = false
  } finally {
    checkInBusyKey.value = ''
  }
}

function openRemoveCheckIn(guest) {
  if (!authStore.isAdmin) return
  checkInError.value = ''
  pendingRemoveCheckIn.value = guest
}

function closeRemoveCheckIn() {
  if (removingCheckIn.value) return
  pendingRemoveCheckIn.value = null
}

async function confirmRemoveCheckIn() {
  const guest = pendingRemoveCheckIn.value
  if (!guest || removingCheckIn.value) return

  checkInError.value = ''
  removingCheckIn.value = true
  try {
    await removeCheckIn(guest.eventId, guest.registrationId || guest.id)
    notice.value = `Check-in removed for ${guest.name || 'this guest'}.`
    pendingRemoveCheckIn.value = null
  } catch (err) {
    checkInError.value = err.message || 'Unable to remove this check-in.'
  } finally {
    removingCheckIn.value = false
  }
}

function openEdit(guest) {
  if (!authStore.isAdmin) return
  editing.value = guest
  form.value = {
    name: guest.name || '',
    vocalRange: guest.vocalRange || '',
    preferredScoreView: normalizeScoreView(guest.preferredScoreView),
  }
  formError.value = ''
  notice.value = ''
}

function closeEdit() {
  editing.value = null
  formError.value = ''
}

async function saveGuest() {
  if (!authStore.isAdmin || !editing.value) return
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
  const scoreViewIndex = headers.findIndex((header) =>
    [
      'preferred score view',
      'prefered score view',
      'preferredscoreview',
      'score view',
      'scoreview',
      'score preference',
      'score format',
    ].includes(header),
  )

  if (nameIndex === -1 || emailIndex === -1 || vocalRangeIndex === -1) {
    throw new Error('The first row must include "Name", "Vocal Range" and "Email" columns.')
  }
  if (scoreViewIndex === -1) {
    throw new Error('The first row must include a "Preferred Score View" column.')
  }

  const validRows = []
  const invalidRows = []

  for (let index = 1; index < matrix.length; index += 1) {
    const cells = matrix[index]
    const name = String(cells[nameIndex] ?? '').trim()
    const email = String(cells[emailIndex] ?? '').trim().toLowerCase()
    const vocalRangeRaw = String(cells[vocalRangeIndex] ?? '').trim()
    const scoreViewRaw = String(cells[scoreViewIndex] ?? '').trim()

    if (!name && !email && !vocalRangeRaw && !scoreViewRaw) continue

    const rowNumber = index + 1
    const vocalRange = normalizeVocalRange(vocalRangeRaw)
    const preferredScoreView = normalizeScoreView(scoreViewRaw)
    const problems = []

    if (!name) problems.push('name is missing')
    else if (name.length > 100) problems.push('name is longer than 100 characters')

    if (!email) problems.push('email is missing')
    else if (email.length > 254 || !EMAIL_PATTERN.test(email)) problems.push('email is invalid')

    if (!vocalRangeRaw) problems.push('vocal range is missing')
    else if (!vocalRange) problems.push(`vocal range "${vocalRangeRaw}" is not recognised`)

    if (!scoreViewRaw) problems.push('preferred score view is missing')
    else if (!preferredScoreView) {
      problems.push(`preferred score view "${scoreViewRaw}" is not recognised`)
    }

    if (problems.length) {
      invalidRows.push({ rowNumber, name, email, message: problems.join('; ') })
    } else {
      validRows.push({ rowNumber, name, email, vocalRange, preferredScoreView })
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
    <div
      v-if="emailError"
      role="alert"
      class="rounded-xl border border-rose-700/50 bg-rose-950/30 p-3 sm:p-4 text-sm text-rose-200"
    >
      {{ emailError }}
    </div>
    <div
      v-if="checkInError"
      role="alert"
      class="rounded-xl border border-rose-700/50 bg-rose-950/30 p-3 sm:p-4 text-sm text-rose-200"
    >
      {{ checkInError }}
    </div>

    <section class="rounded-2xl border border-maroon-700/60 glass-card overflow-hidden">
      <div
        class="flex flex-col gap-3 border-b border-maroon-700/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2.5">
            <h2 class="text-base font-serif text-bone-100 sm:text-lg">Workshop audiences</h2>
            <span
              class="inline-flex items-center gap-1 rounded-full border border-gold-500/25 bg-gold-500/10 px-2 py-0.5 text-[10px] font-medium text-gold-300"
            >
              {{ filteredAudiences.length }}
            </span>
          </div>
          <p class="mt-1 text-xs text-bone-500">
            <template v-if="hasFilters">
              {{ filteredAudiences.length }} of {{ audiences.length }} guest{{
                audiences.length === 1 ? '' : 's'
              }}
              match your filters
            </template>
            <template v-else>
              {{ audiences.length }} registered guest{{ audiences.length === 1 ? '' : 's' }} across
              {{ workshopEvents.length }} workshop{{ workshopEvents.length === 1 ? '' : 's' }}
            </template>
          </p>
        </div>
        <button
          v-if="authStore.isAdmin"
          type="button"
          class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gold-500 px-3.5 py-2 text-sm font-semibold text-maroon-950 shadow-sm shadow-gold-500/20 transition-colors hover:bg-gold-400 sm:w-auto"
          @click="openImport"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
              d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
            />
          </svg>
          Import Excel
        </button>
      </div>

      <div class="border-b border-maroon-700/50 bg-maroon-950/25 p-4 sm:p-5">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div class="relative w-full lg:max-w-xs">
            <svg
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bone-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
                d="m21 21-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
              />
            </svg>
            <input
              v-model="search"
              type="text"
              placeholder="Search name, email, ticket…"
              class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 py-2 pl-9 pr-9 text-sm text-bone-200 placeholder:text-bone-500 outline-none transition-colors focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/10"
            />
            <button
              v-if="search"
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-bone-500 transition-colors hover:text-gold-300"
              aria-label="Clear search"
              @click="search = ''"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
            <div class="relative">
              <svg
                class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bone-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
                />
              </svg>
              <label class="sr-only" for="audience-event-filter">Filter by workshop</label>
              <select
                id="audience-event-filter"
                v-model="selectedEventId"
                class="w-full appearance-none rounded-lg border border-maroon-700/60 bg-maroon-950/60 py-2 pl-9 pr-8 text-sm text-bone-200 outline-none transition-colors focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/10 lg:w-48"
                :class="selectedEventId ? 'border-gold-500/40 text-bone-100' : ''"
              >
                <option value="">All workshops</option>
                <option v-for="event in workshopEvents" :key="event.id" :value="event.id">
                  {{ event.title }}
                </option>
              </select>
              <svg
                class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-bone-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  d="m6 9 6 6 6-6"
                />
              </svg>
            </div>

            <div class="relative">
              <svg
                class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bone-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  d="M9 12h6m-6 4h4M7 4h7l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z"
                />
              </svg>
              <label class="sr-only" for="audience-score-filter">
                Filter by preferred score view
              </label>
              <select
                id="audience-score-filter"
                v-model="scoreViewFilter"
                class="w-full appearance-none rounded-lg border border-maroon-700/60 bg-maroon-950/60 py-2 pl-9 pr-8 text-sm text-bone-200 outline-none transition-colors focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/10 lg:w-40"
                :class="scoreViewFilter ? 'border-gold-500/40 text-bone-100' : ''"
              >
                <option value="">All score views</option>
                <option
                  v-for="option in SCORE_VIEW_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label.split(' (')[0] }}
                </option>
              </select>
              <svg
                class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-bone-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  d="m6 9 6 6 6-6"
                />
              </svg>
            </div>

            <div class="relative">
              <svg
                class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bone-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <label class="sr-only" for="audience-checkin-filter">
                Filter by check-in status
              </label>
              <select
                id="audience-checkin-filter"
                v-model="checkInFilter"
                class="w-full appearance-none rounded-lg border border-maroon-700/60 bg-maroon-950/60 py-2 pl-9 pr-8 text-sm text-bone-200 outline-none transition-colors focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/10 lg:w-44"
                :class="checkInFilter ? 'border-gold-500/40 text-bone-100' : ''"
              >
                <option value="">All check-in status</option>
                <option value="checked">Checked in</option>
                <option value="not-checked">Not checked in</option>
              </select>
              <svg
                class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-bone-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  d="m6 9 6 6 6-6"
                />
              </svg>
            </div>
          </div>
        </div>

        <div
          v-if="hasFilters"
          class="mt-3 flex flex-wrap items-center gap-2 border-t border-maroon-700/30 pt-3"
        >
          <span class="text-[10px] uppercase tracking-[0.18em] text-bone-500">Active</span>
          <button
            v-if="search"
            type="button"
            class="inline-flex items-center gap-1 rounded-full border border-maroon-600/50 bg-maroon-800/40 px-2.5 py-1 text-[11px] text-bone-300 transition-colors hover:border-gold-500/40 hover:text-gold-300"
            @click="search = ''"
          >
            “{{ search }}”
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <button
            v-if="selectedEventId"
            type="button"
            class="inline-flex items-center gap-1 rounded-full border border-maroon-600/50 bg-maroon-800/40 px-2.5 py-1 text-[11px] text-bone-300 transition-colors hover:border-gold-500/40 hover:text-gold-300"
            @click="selectedEventId = ''"
          >
            {{ selectedEventName }}
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <button
            v-if="scoreViewFilter"
            type="button"
            class="inline-flex items-center gap-1 rounded-full border border-maroon-600/50 bg-maroon-800/40 px-2.5 py-1 text-[11px] text-bone-300 transition-colors hover:border-gold-500/40 hover:text-gold-300"
            @click="scoreViewFilter = ''"
          >
            {{ scoreViewFilterLabel }} score
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <button
            v-if="checkInFilter"
            type="button"
            class="inline-flex items-center gap-1 rounded-full border border-maroon-600/50 bg-maroon-800/40 px-2.5 py-1 text-[11px] text-bone-300 transition-colors hover:border-gold-500/40 hover:text-gold-300"
            @click="checkInFilter = ''"
          >
            {{ checkInFilterLabel }}
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <button
            type="button"
            class="ml-auto text-[11px] font-medium text-gold-400 transition-colors hover:text-gold-300"
            @click="clearFilters"
          >
            Clear all
          </button>
        </div>
      </div>

      <div v-if="eventsError" role="alert" class="p-4 sm:p-6 text-sm text-rose-200">
        {{ eventsError }}
      </div>
      <div v-else-if="eventsLoading" class="p-4 sm:p-6 text-bone-400">Loading audiences…</div>
      <div v-else-if="!workshopEvents.length" class="p-4 sm:p-6 text-bone-400">
        No workshop events yet. Add a workshop in the Schedules section to collect guests.
      </div>
      <div
        v-else-if="!filteredAudiences.length"
        class="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-full border border-maroon-700/60 bg-maroon-800/30 text-bone-500"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.7"
              d="m21 21-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
            />
          </svg>
        </span>
        <p class="text-sm text-bone-400">
          {{
            hasFilters
              ? 'No guests match your filters.'
              : 'No guests have registered for a workshop yet.'
          }}
        </p>
        <button
          v-if="hasFilters"
          type="button"
          class="text-xs font-medium text-gold-400 transition-colors hover:text-gold-300"
          @click="clearFilters"
        >
          Clear filters
        </button>
      </div>
      <template v-else>
        <div
          class="hidden grid-cols-[minmax(0,1.7fr)_minmax(0,0.75fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_120px] gap-4 border-b border-maroon-700/50 bg-maroon-950/40 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-bone-500 xl:grid"
        >
          <span>Guest</span>
          <span>Vocal range</span>
          <span>Score view</span>
          <span>Workshop</span>
          <span>Check-in</span>
          <span class="text-right">Actions</span>
        </div>

        <ul class="divide-y divide-maroon-800/70">
          <li
            v-for="guest in paginatedAudiences"
            :key="`${guest.eventId}-${guest.email}`"
            class="px-4 py-4 transition-colors hover:bg-maroon-800/25 sm:px-5 xl:grid xl:grid-cols-[minmax(0,1.7fr)_minmax(0,0.75fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_120px] xl:items-center xl:gap-4"
          >
            <div class="flex min-w-0 items-start gap-3">
              <div
                class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-gold-500/25 bg-gradient-to-br from-gold-500/15 to-maroon-700/30 text-sm font-semibold text-gold-300 shadow-inner shadow-gold-500/10"
              >
                {{ initials(guest) }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p class="truncate text-sm font-medium text-bone-100">{{ guest.name }}</p>
                  <span
                    v-if="guest.registrationId"
                    class="rounded-full border border-gold-500/20 bg-gold-500/5 px-1.5 py-0.5 text-[10px] font-mono text-gold-300"
                    >#{{ guest.registrationId }}</span
                  >
                </div>
                <p class="mt-0.5 truncate text-xs text-bone-500">{{ guest.email }}</p>
                <p class="mt-1 truncate font-mono text-[10px] text-bone-600">
                  {{ guest.ticketId || '—' }}
                </p>
              </div>
            </div>

            <div class="hidden xl:block">
              <span
                class="inline-flex rounded-full border border-maroon-600/50 bg-maroon-800/40 px-2 py-0.5 text-[11px] text-bone-300"
              >
                {{ guest.vocalRange || '—' }}
              </span>
            </div>

            <div class="hidden xl:block">
              <span
                v-if="guest.preferredScoreView"
                class="inline-flex items-center gap-1.5 text-xs capitalize text-bone-300"
              >
                <svg
                  class="h-3.5 w-3.5 text-gold-400/80"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                    d="M9 12h6m-6 4h4M7 4h7l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z"
                  />
                </svg>
                {{ guest.preferredScoreView }} score
              </span>
              <span v-else class="text-xs text-bone-600">—</span>
            </div>

            <div class="hidden min-w-0 xl:block">
              <p class="truncate text-xs text-bone-300" :title="guest.eventTitle">
                {{ guest.eventTitle }}
              </p>
              <p v-if="guest.eventDate" class="mt-0.5 text-[10px] text-bone-500">
                {{ formatDate(guest.eventDate) }}
              </p>
            </div>

            <div class="hidden xl:block">
              <div class="flex items-center gap-2">
                <input
                  v-if="authStore.isAdmin"
                  type="checkbox"
                  class="h-4 w-4 flex-shrink-0 cursor-pointer rounded border-maroon-600/70 bg-maroon-950/60 text-emerald-500 accent-emerald-500 outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-wait disabled:opacity-50"
                  :checked="Boolean(guest.checkedIn)"
                  :disabled="checkInBusyKey === guestKey(guest) || removingCheckIn"
                  :aria-label="
                    guest.checkedIn
                      ? `Remove check-in for ${guest.name || 'this guest'}`
                      : `Check in ${guest.name || 'this guest'}`
                  "
                  :title="guest.checkedIn ? 'Remove check-in' : 'Check in guest'"
                  @change="toggleCheckIn(guest, $event)"
                />
                <span
                  v-else
                  class="h-2 w-2 flex-shrink-0 rounded-full"
                  :class="guest.checkedIn ? 'bg-emerald-400' : 'bg-bone-600'"
                ></span>
                <div class="min-w-0">
                  <p
                    class="text-xs font-medium"
                    :class="guest.checkedIn ? 'text-emerald-300' : 'text-bone-400'"
                  >
                    {{ guest.checkedIn ? 'Checked in' : 'Not checked in' }}
                  </p>
                  <p v-if="guest.checkedIn" class="mt-0.5 text-[10px] text-bone-500">
                    {{ formatDateTime(guest.checkedInAt) || '—' }}
                  </p>
                </div>
              </div>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-2 xl:hidden">
              <span
                class="inline-flex rounded-full border border-maroon-600/50 bg-maroon-800/40 px-2 py-0.5 text-[10px] text-bone-300"
              >
                {{ guest.vocalRange || '—' }}
              </span>
              <span
                v-if="guest.preferredScoreView"
                class="inline-flex items-center gap-1 rounded-full border border-gold-500/20 bg-gold-500/5 px-2 py-0.5 text-[10px] capitalize text-gold-300"
              >
                {{ guest.preferredScoreView }} score
              </span>
              <span
                class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                :class="
                  guest.checkedIn
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-maroon-600/50 bg-maroon-800/40 text-bone-400'
                "
              >
                <input
                  v-if="authStore.isAdmin"
                  type="checkbox"
                  class="h-3 w-3 cursor-pointer accent-emerald-500 disabled:cursor-wait disabled:opacity-50"
                  :checked="Boolean(guest.checkedIn)"
                  :disabled="checkInBusyKey === guestKey(guest) || removingCheckIn"
                  :aria-label="
                    guest.checkedIn
                      ? `Remove check-in for ${guest.name || 'this guest'}`
                      : `Check in ${guest.name || 'this guest'}`
                  "
                  @change="toggleCheckIn(guest, $event)"
                />
                <span
                  v-else
                  class="h-1.5 w-1.5 rounded-full"
                  :class="guest.checkedIn ? 'bg-emerald-400' : 'bg-bone-500'"
                ></span>
                {{ guest.checkedIn ? 'Checked in' : 'Not checked in' }}
              </span>
              <span class="min-w-0 max-w-full truncate text-[10px] text-bone-500">
                {{ guest.eventTitle }}
                <template v-if="guest.eventDate"> · {{ formatDate(guest.eventDate) }}</template>
              </span>
            </div>

            <div class="mt-3 flex items-center gap-1.5 xl:mt-0 xl:justify-end">
              <button
                v-if="authStore.isAdmin"
                type="button"
                :disabled="!guest.ticketDesignURL || !guest.ticketId || Boolean(downloadingTicketId) || Boolean(sendingEmailId)"
                :title="!guest.ticketDesignURL ? 'Upload a ticket design for this workshop first' : !guest.ticketId ? 'Ticket ID unavailable' : 'Send confirmation email with ticket PDF'"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gold-500/25 text-gold-300 transition-colors hover:border-gold-500/50 hover:bg-gold-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send confirmation email"
                @click="sendTicketEmail(guest)"
              >
                <svg
                  v-if="sendingEmailId === guestKey(guest)"
                  class="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.7"
                    d="M3 8l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
                  />
                </svg>
              </button>
              <button
                v-if="authStore.isAdmin"
                type="button"
                :disabled="!guest.ticketDesignURL || !guest.ticketId || Boolean(downloadingTicketId) || Boolean(sendingEmailId)"
                :title="!guest.ticketDesignURL ? 'Upload a ticket design for this workshop first' : !guest.ticketId ? 'Ticket ID unavailable' : 'Download ticket PDF'"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gold-500/25 text-gold-300 transition-colors hover:border-gold-500/50 hover:bg-gold-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Download ticket PDF"
                @click="downloadTicket(guest)"
              >
                <svg
                  v-if="downloadingTicketId === guestKey(guest)"
                  class="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.7"
                    d="M12 4v10m0 0-4-4m4 4 4-4M4 18v1a1 1 0 001 1h14a1 1 0 001-1v-1"
                  />
                </svg>
              </button>
              <button
                v-if="authStore.isAdmin"
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-maroon-700/60 text-bone-300 transition-colors hover:border-gold-500/40 hover:bg-gold-500/5 hover:text-gold-300"
                aria-label="Edit guest"
                title="Edit guest"
                @click="openEdit(guest)"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.7"
                    d="m16.5 4.5 3 3M4 20l4.5-1 10-10a2.12 2.12 0 00-3-3l-10 10L4 20z"
                  />
                </svg>
              </button>
            </div>
          </li>
        </ul>

        <div
          class="flex flex-col gap-3 border-t border-maroon-700/50 bg-maroon-950/20 px-4 py-3 text-xs text-bone-400 sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
          <p>
            Showing <span class="font-medium text-bone-300">{{ pageStart }}–{{ pageEnd }}</span> of
            <span class="font-medium text-bone-300">{{ filteredAudiences.length }}</span> guest{{
              filteredAudiences.length === 1 ? '' : 's'
            }}
          </p>
          <div class="flex items-center justify-between gap-2 sm:justify-end">
            <button
              type="button"
              :disabled="page <= 1"
              class="inline-flex items-center gap-1 rounded-lg border border-maroon-700/60 px-2.5 py-1.5 text-xs text-bone-300 transition-colors hover:border-gold-500/40 hover:text-gold-300 disabled:cursor-not-allowed disabled:opacity-40"
              @click="page -= 1"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  d="m15 18-6-6 6-6"
                />
              </svg>
              Previous
            </button>
            <span
              class="rounded-lg border border-maroon-700/40 bg-maroon-900/40 px-3 py-1.5 text-bone-300"
            >
              Page {{ page }} of {{ pageCount }}
            </span>
            <button
              type="button"
              :disabled="page >= pageCount"
              class="inline-flex items-center gap-1 rounded-lg border border-maroon-700/60 px-2.5 py-1.5 text-xs text-bone-300 transition-colors hover:border-gold-500/40 hover:text-gold-300 disabled:cursor-not-allowed disabled:opacity-40"
              @click="page += 1"
            >
              Next
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  d="m9 18 6-6-6-6"
                />
              </svg>
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
                <label class="block text-xs font-medium text-bone-400 mb-1.5">Preferred score view</label>
                <select
                  v-model="form.preferredScoreView"
                  class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold-500/60"
                >
                  <option value="" disabled>Select a preferred score view</option>
                  <option
                    v-for="option in SCORE_VIEW_OPTIONS"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
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
        <div
          v-if="pendingRemoveCheckIn"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeRemoveCheckIn"></div>

          <div
            class="relative w-full max-w-md rounded-2xl border border-maroon-700/60 bg-maroon-900 p-4 sm:p-6 shadow-2xl shadow-black/60 animate-scale-in"
          >
            <div class="mb-4 flex items-start gap-3">
              <span
                class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                    d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                  />
                </svg>
              </span>
              <div class="min-w-0">
                <h2 class="text-lg font-serif text-bone-100">Remove check-in?</h2>
                <p class="mt-1 text-sm text-bone-400">
                  This clears the check-in time and staff record for
                  <span class="font-medium text-bone-200">{{
                    pendingRemoveCheckIn.name || 'this guest'
                  }}</span
                  >. They will show as not checked in.
                </p>
              </div>
            </div>

            <div class="flex gap-3 pt-2">
              <button
                type="button"
                :disabled="removingCheckIn"
                class="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2.5"
                @click="confirmRemoveCheckIn"
              >
                {{ removingCheckIn ? 'Removing…' : 'Remove check-in' }}
              </button>
              <button
                type="button"
                :disabled="removingCheckIn"
                class="rounded-lg border border-maroon-700/60 px-3 py-2 text-sm text-bone-300 transition-colors hover:text-bone-100 disabled:opacity-40 sm:px-4 sm:py-2.5"
                @click="closeRemoveCheckIn"
              >
                Cancel
              </button>
            </div>
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
                    <span class="text-bone-300">Vocal Range</span>,
                    <span class="text-bone-300">Email</span> and
                    <span class="text-bone-300">Preferred Score View</span>. Supported vocal ranges:
                    {{ VOCAL_RANGES.join(', ') }}. Use
                    <span class="text-bone-300">Printed (will be provided at the venue)</span> or
                    <span class="text-bone-300">Digital (bring your own iPad / tablet)</span>
                    for the preferred score view.
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
