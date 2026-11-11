<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Timestamp } from 'firebase/firestore'
import {
  CONTENT_COLLECTIONS,
  createContent,
  deleteContent,
  subscribeToContent,
  updateContent,
} from '@/firebase/content'
import {
  preloadGoogleIdentityServices,
  uploadBannerToDrive,
  uploadTicketDesignToDrive,
  uploadTeacherPhotoToDrive,
  ensureDriveAccessToken,
  hasValidAccessToken,
  toDriveImageUrl,
} from '@/firebase/drive'

const schemas = {
  courses: {
    fields: [
      { key: 'name', label: 'Course name', type: 'text', required: true, maxlength: 100 },
      { key: 'duration', label: 'Duration', type: 'text', required: true, maxlength: 50, placeholder: '12 Weeks' },
      { key: 'level', label: 'Level', type: 'select', required: true, options: ['Beginner', 'Intermediate', 'Advanced'] },
      { key: 'fee', label: 'Fee (USD)', type: 'number', required: true, min: 0, max: 100000, step: 0.01 },
    ],
  },
  schedules: {
    fields: [
      { key: 'title', label: 'Event title', type: 'text', required: true, maxlength: 120 },
      { key: 'type', label: 'Event type', type: 'select', required: true, options: ['Recital', 'Masterclass', 'Concert', 'Workshop', 'Exam'] },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'startTime', label: 'Start time', type: 'time', required: true },
      { key: 'endTime', label: 'End time', type: 'time', required: true },
      { key: 'venue', label: 'Venue', type: 'text', required: true, maxlength: 100 },
      {
        key: 'eventId',
        label: 'Event ID',
        type: 'text',
        maxlength: 100,
        placeholder: 'workshop-2026-vocal',
        showWhen: { key: 'type', values: ['Workshop'] },
      },
      {
        key: 'ticketURL',
        label: 'Ticket purchase URL',
        type: 'url',
        required: true,
        maxlength: 500,
        placeholder: 'https://tickets.example.com/concert',
        showWhen: { key: 'type', values: ['Concert'] },
      },
      {
        key: 'capacity',
        label: 'Maximum capacity',
        type: 'number',
        required: true,
        min: 1,
        max: 100000,
        step: 1,
        showWhen: { key: 'type', values: ['Workshop'] },
      },
    ],
  },
  teachers: {
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, maxlength: 100 },
      { key: 'specialty', label: 'Specialty', type: 'text', required: true, maxlength: 100 },
      { key: 'bio', label: 'Biography', type: 'textarea', required: true, rows: 8 },
      { key: 'photoURL', label: 'Photo URL (optional)', type: 'url', maxlength: 500 },
      { key: 'email', label: 'Email (optional)', type: 'email', maxlength: 254 },
      { key: 'profileURL', label: 'Profile URL (optional)', type: 'url', maxlength: 500 },
    ],
  },
  news: {
    fields: [
      { key: 'category', label: 'Category', type: 'select', required: true, options: ['Announcement', 'Event', 'Faculty', 'Student', 'Campus'] },
      { key: 'title', label: 'Headline', type: 'text', required: true, maxlength: 140 },
      { key: 'excerpt', label: 'Summary', type: 'textarea', required: true, maxlength: 1000 },
      { key: 'date', label: 'Publish date and time', type: 'datetime-local', required: true },
      { key: 'readTime', label: 'Read time (optional)', type: 'text', maxlength: 30, placeholder: '4 min read' },
      { key: 'featured', label: 'Feature this article', type: 'checkbox' },
    ],
  },
}

const activeCollection = ref('courses')
const records = ref([])
const loading = ref(true)
const saving = ref(false)
const editingId = ref('')
const error = ref('')
const notice = ref('')
const form = ref({})
const scheduleModalOpen = ref(false)
const bannerFileInput = ref(null)
const ticketDesignFileInput = ref(null)
const teacherPhotoFileInput = ref(null)
const uploadingBanner = ref(false)
const uploadingTicketDesign = ref(false)
const uploadingTeacherPhoto = ref(false)
const driveReady = ref(false)
const driveFailed = ref(false)
const driveConnected = ref(false)
let unsubscribe

const visibleFields = computed(() => {
  const fields = schemas[activeCollection.value].fields
  if (activeCollection.value !== 'schedules') return fields
  return fields.filter((field) => {
    if (!field.showWhen) return true
    return field.showWhen.values.includes(form.value[field.showWhen.key])
  })
})

function emptyForm(collectionName) {
  const values = {}
  for (const field of schemas[collectionName].fields) {
    if (field.type === 'checkbox') values[field.key] = false
    else if (field.type === 'select') values[field.key] = field.options[0]
    else if (field.type === 'number') values[field.key] = 0
    else values[field.key] = ''
  }
  if (collectionName === 'schedules') {
    values.date = localDateValue(new Date())
    values.startTime = '18:00'
    values.endTime = '20:00'
    values.ticketURL = ''
    values.capacity = 0
    values.registrationCount = 0
    values.bannerURL = ''
    values.ticketDesignURL = ''
    values.eventId = ''
    values.registrationOpen = true
  }
  if (collectionName === 'news') values.date = localDateTimeValue(new Date())
  return values
}

function localDateValue(date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function localDateTimeValue(date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function toInputValue(field, value) {
  if (field.type === 'checkbox') return Boolean(value)
  if (field.type === 'date' || field.type === 'datetime-local') {
    const date = value?.toDate ? value.toDate() : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return field.type === 'date' ? localDateValue(date) : localDateTimeValue(date)
  }
  return value ?? ''
}

function beginCreate() {
  editingId.value = ''
  form.value = emptyForm(activeCollection.value)
  error.value = ''
  notice.value = ''
}

function beginEdit(record) {
  editingId.value = record.id
  form.value = Object.fromEntries(
    schemas[activeCollection.value].fields.map((field) => [
      field.key,
      toInputValue(field, record[field.key]),
    ]),
  )
  if (activeCollection.value === 'schedules') {
    form.value.registrationCount = record.registrationCount ?? 0
    form.value.bannerURL = record.bannerURL ?? ''
    form.value.ticketDesignURL = record.ticketDesignURL ?? ''
    form.value.registrationOpen = record.registrationOpen ?? true
  }
  error.value = ''
  notice.value = ''
}

function handleAdd() {
  beginCreate()
  if (activeCollection.value === 'schedules') scheduleModalOpen.value = true
}

function handleEdit(record) {
  beginEdit(record)
  if (activeCollection.value === 'schedules') scheduleModalOpen.value = true
}

function closeScheduleModal() {
  scheduleModalOpen.value = false
}

function selectSection(key) {
  if (activeCollection.value === key) return
  activeCollection.value = key
}

async function triggerDriveUpload(fileInput) {
  error.value = ''
  notice.value = ''
  if (driveFailed.value) {
    error.value = 'Google Drive is unavailable.'
    return
  }
  if (!driveReady.value) {
    error.value = 'Google Drive is still loading. Try again in a moment.'
    return
  }

  // Already authorized — open the file picker directly from this click.
  if (driveConnected.value && hasValidAccessToken()) {
    fileInput.value?.click()
    return
  }

  // First time — authorize now. This opens the Google consent popup, which
  // must happen inside a user gesture (this click) or the browser blocks it.
  try {
    await ensureDriveAccessToken()
    driveConnected.value = true
    notice.value = 'Connected to Google Drive — click again to choose a file.'
  } catch (err) {
    error.value = err.message || 'Unable to authorize Google Drive.'
  }
}

function triggerBannerUpload() {
  return triggerDriveUpload(bannerFileInput)
}

function triggerTicketDesignUpload() {
  return triggerDriveUpload(ticketDesignFileInput)
}

function triggerTeacherPhotoUpload() {
  return triggerDriveUpload(teacherPhotoFileInput)
}

function ticketDesignPreviewURL(value) {
  try {
    const url = new URL(value)
    const fileId = url.searchParams.get('id') || url.pathname.match(/\/file\/d\/([^/]+)/)?.[1]
    return fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview` : value
  } catch {
    return value
  }
}

async function handleBannerFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  uploadingBanner.value = true
  error.value = ''
  notice.value = ''
  try {
    form.value.bannerURL = await uploadBannerToDrive(file)
    notice.value = 'Banner uploaded to Google Drive.'
  } catch (err) {
    error.value = err.message || 'Unable to upload the banner.'
    // If the Drive authorization expired, require a fresh connect.
    if (!hasValidAccessToken()) driveConnected.value = false
  } finally {
    uploadingBanner.value = false
  }
}

async function handleTicketDesignFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  uploadingTicketDesign.value = true
  error.value = ''
  notice.value = ''
  try {
    form.value.ticketDesignURL = await uploadTicketDesignToDrive(file)
    notice.value = 'Ticket design uploaded to Google Drive.'
  } catch (err) {
    error.value = err.message || 'Unable to upload the ticket design.'
    if (!hasValidAccessToken()) driveConnected.value = false
  } finally {
    uploadingTicketDesign.value = false
  }
}

async function handleTeacherPhotoFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  uploadingTeacherPhoto.value = true
  error.value = ''
  notice.value = ''
  try {
    form.value.photoURL = await uploadTeacherPhotoToDrive(file)
    notice.value = 'Teacher photo uploaded to Google Drive.'
  } catch (err) {
    error.value = err.message || 'Unable to upload the teacher photo.'
    if (!hasValidAccessToken()) driveConnected.value = false
  } finally {
    uploadingTeacherPhoto.value = false
  }
}

function validateSchedule() {
  if (activeCollection.value !== 'schedules') return true

  const banner = String(form.value.bannerURL || '').trim()
  if (banner && !/^https:\/\//i.test(banner)) {
    error.value = 'Banner URL must start with https://.'
    return false
  }

  const ticketDesign = String(form.value.ticketDesignURL || '').trim()
  if (ticketDesign && !/^https:\/\//i.test(ticketDesign)) {
    error.value = 'Ticket design URL must start with https://.'
    return false
  }

  if (form.value.type === 'Concert') {
    const url = String(form.value.ticketURL || '').trim()
    if (!url) {
      error.value = 'A ticket purchase URL is required for concerts.'
      return false
    }
    if (!/^https:\/\//i.test(url)) {
      error.value = 'The ticket URL must start with https://.'
      return false
    }
  }

  if (form.value.type === 'Workshop') {
    const capacity = Number(form.value.capacity)
    if (!Number.isInteger(capacity) || capacity < 1) {
      error.value = 'Workshop capacity must be at least 1.'
      return false
    }
    const registered = Number(form.value.registrationCount) || 0
    if (capacity < registered) {
      error.value = `Capacity cannot be lower than the ${registered} guest(s) already registered.`
      return false
    }
  }

  return true
}

function toFirestoreFields() {
  const fields = { ...form.value }
  if (activeCollection.value === 'courses') fields.fee = Number(fields.fee)
  if (activeCollection.value === 'schedules') {
    fields.date = Timestamp.fromDate(new Date(`${fields.date}T12:00:00`))
    fields.ticketURL = String(fields.ticketURL || '').trim()
    fields.bannerURL = String(fields.bannerURL || '').trim()
    fields.ticketDesignURL = fields.type === 'Workshop'
      ? String(fields.ticketDesignURL || '').trim()
      : ''
    fields.capacity = Math.max(0, Math.floor(Number(fields.capacity) || 0))
    fields.registrationCount = Math.max(0, Math.floor(Number(fields.registrationCount) || 0))
    fields.eventId = fields.type === 'Workshop' ? String(fields.eventId || '').trim() : ''
    fields.registrationOpen = fields.type === 'Workshop' && Boolean(fields.registrationOpen)
    if (fields.type !== 'Concert') fields.ticketURL = ''
  }
  if (activeCollection.value === 'news') {
    fields.date = Timestamp.fromDate(new Date(fields.date))
  }
  return fields
}

async function saveRecord() {
  if (!validateSchedule()) return
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const fields = toFirestoreFields()
    if (editingId.value) {
      await updateContent(activeCollection.value, editingId.value, fields)
      notice.value = 'Changes saved.'
    } else {
      await createContent(activeCollection.value, fields)
      beginCreate()
      notice.value = 'Record created.'
    }
    if (activeCollection.value === 'schedules') scheduleModalOpen.value = false
  } catch (err) {
    error.value = err.message || 'Unable to save this record.'
  } finally {
    saving.value = false
  }
}

async function removeRecord(record) {
  if (!window.confirm(`Delete "${record.title || record.name}"? This cannot be undone.`)) return

  error.value = ''
  notice.value = ''
  try {
    await deleteContent(activeCollection.value, record.id)
    if (editingId.value === record.id) beginCreate()
    notice.value = 'Record deleted.'
  } catch (err) {
    error.value = err.message || 'Unable to delete this record.'
  }
}

function loadCollection(collectionName) {
  unsubscribe?.()
  records.value = []
  loading.value = true
  error.value = ''
  notice.value = ''
  scheduleModalOpen.value = false
  beginCreate()

  try {
    if (!CONTENT_COLLECTIONS[collectionName]) throw new Error('Unknown content section.')
    unsubscribe = subscribeToContent(
      collectionName,
      'createdAt',
      'desc',
      (items) => {
        records.value = items
        loading.value = false
      },
      (err) => {
        error.value = err.message || 'Unable to load records from Firestore.'
        loading.value = false
      },
    )
  } catch (err) {
    error.value = err.message || 'Unable to load records from Firestore.'
    loading.value = false
  }
}

watch(
  () => form.value.type,
  (type) => {
    if (
      activeCollection.value === 'schedules' &&
      type === 'Workshop' &&
      !Number(form.value.capacity)
    ) {
      form.value.capacity = 20
    }
  },
)

watch(activeCollection, loadCollection, { immediate: true })
onMounted(async () => {
  try {
    await preloadGoogleIdentityServices()
    driveReady.value = true
  } catch {
    driveFailed.value = true
  }
})
onUnmounted(() => unsubscribe?.())
</script>

<template>
  <div class="space-y-5 sm:space-y-8">
    <header>
      <p class="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-1.5 sm:mb-2">Administration</p>
      <h1 class="text-2xl sm:text-4xl font-serif text-bone-100">Content <span class="text-gold-gradient">Manager</span></h1>
      <p class="mt-2 text-[13px] sm:text-base text-bone-500 max-w-2xl">Create, edit and remove the content shown across the public sections.</p>
    </header>

    <div class="flex flex-wrap gap-2" aria-label="Content section">
      <button
        v-for="(section, key) in CONTENT_COLLECTIONS"
        :key="key"
        type="button"
        class="px-3 py-1.5 rounded-xl border text-[13px] sm:text-sm font-medium transition-colors"
        :class="activeCollection === key ? 'border-gold-500/50 bg-gold-500/10 text-gold-300' : 'border-maroon-700/60 text-bone-400 hover:text-bone-200'"
        @click="selectSection(key)"
      >{{ section.label }}</button>
    </div>

    <div v-if="error && !scheduleModalOpen" role="alert" class="rounded-xl border border-rose-700/50 bg-rose-950/30 p-3 sm:p-4 text-sm text-rose-200">{{ error }}</div>
    <div v-if="notice && !scheduleModalOpen" role="status" class="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-3 sm:p-4 text-sm text-emerald-200">{{ notice }}</div>

    <div :class="activeCollection === 'schedules' ? '' : 'grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]'">
      <section class="rounded-2xl border border-maroon-700/60 glass-card overflow-hidden">
        <div class="flex items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 border-b border-maroon-700/50">
          <div>
            <h2 class="text-base sm:text-lg font-serif text-bone-100">{{ CONTENT_COLLECTIONS[activeCollection].label }}</h2>
            <p class="text-xs text-bone-500 mt-1">{{ records.length }} record{{ records.length === 1 ? '' : 's' }}</p>
          </div>
          <button type="button" class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-gold-500 text-maroon-950 text-[13px] sm:text-sm font-semibold hover:bg-gold-400 transition-colors" @click="handleAdd">
            Add new
          </button>
        </div>

        <div v-if="loading" class="p-4 sm:p-6 text-bone-400">Loading records…</div>
        <div v-else-if="!records.length" class="p-4 sm:p-6 text-bone-400">No records yet. Add the first one using the form.</div>
        <ul v-else class="divide-y divide-maroon-800/70 max-h-[26rem] sm:max-h-[34rem] overflow-y-auto">
          <li v-for="record in records" :key="record.id" class="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 hover:bg-maroon-800/30">
            <button type="button" class="flex-1 min-w-0 text-left" @click="handleEdit(record)">
              <span class="block text-sm font-medium text-bone-200 truncate">{{ record.title || record.name }}</span>
              <span class="block text-xs text-bone-500 mt-1 truncate">
                {{ record.category || record.type || record.specialty || record.duration || record.venue || '' }}
                <template v-if="activeCollection === 'schedules' && record.type === 'Workshop'">
                  · {{ record.registrationCount || 0 }}/{{ record.capacity || 0 }} registered
                </template>
              </span>
            </button>
            <button type="button" class="px-3 py-1.5 rounded-lg border border-maroon-700/60 text-xs text-bone-300 hover:text-gold-300" @click="handleEdit(record)">Edit</button>
            <button type="button" class="px-3 py-1.5 rounded-lg border border-rose-800/50 text-xs text-rose-300 hover:bg-rose-950/40" @click="removeRecord(record)">Delete</button>
          </li>
        </ul>
      </section>

      <section v-if="activeCollection !== 'schedules'" class="rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-6">
        <h2 class="text-base sm:text-lg font-serif text-bone-100 mb-4 sm:mb-5">{{ editingId ? 'Edit record' : 'Create record' }}</h2>
        <form class="space-y-4" @submit.prevent="saveRecord">
          <input ref="teacherPhotoFileInput" type="file" accept="image/*" class="hidden" @change="handleTeacherPhotoFile" />
          <div v-for="field in visibleFields" :key="field.key">
            <div v-if="activeCollection === 'teachers' && field.key === 'photoURL' && form.photoURL" class="relative mb-2 overflow-hidden rounded-lg border border-maroon-700/60">
              <img :src="toDriveImageUrl(form.photoURL)" alt="Teacher photo preview" referrerpolicy="no-referrer" class="w-full h-32 sm:h-44 object-cover" />
              <button type="button" class="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur text-xs text-bone-200 hover:bg-rose-900/80 transition-colors" @click="form.photoURL = ''">
                Remove
              </button>
            </div>
            <label :for="`admin-${field.key}`" class="block text-[11px] sm:text-xs font-medium text-bone-400 mb-1.5">{{ field.label }}</label>
            <input
              v-if="field.type !== 'select' && field.type !== 'textarea' && field.type !== 'checkbox'"
              :id="`admin-${field.key}`"
              v-model="form[field.key]"
              :type="field.type"
              :required="field.required"
              :maxlength="field.maxlength"
              :min="field.min"
              :max="field.max"
              :step="field.step"
              :placeholder="field.placeholder"
              class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold-500/60"
            />
            <select
              v-else-if="field.type === 'select'"
              :id="`admin-${field.key}`"
              v-model="form[field.key]"
              :required="field.required"
              class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold-500/60"
            >
              <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
            </select>
            <textarea
              v-else-if="field.type === 'textarea'"
              :id="`admin-${field.key}`"
              v-model="form[field.key]"
              :required="field.required"
              :maxlength="field.maxlength"
              :rows="field.rows || 4"
              class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold-500/60 resize-y"
            ></textarea>
            <label v-else class="flex items-center gap-3 rounded-lg border border-maroon-700/60 bg-maroon-950/40 px-3 py-3 text-sm text-bone-300">
              <input :id="`admin-${field.key}`" v-model="form[field.key]" type="checkbox" class="accent-yellow-500" />
              {{ field.label }}
            </label>
            <div v-if="activeCollection === 'teachers' && field.key === 'photoURL'" class="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                :disabled="uploadingTeacherPhoto || !driveReady"
                class="px-3 py-1.5 rounded-lg border border-gold-500/40 text-xs font-medium text-gold-300 hover:bg-gold-500/10 transition-colors disabled:opacity-60"
                @click="triggerTeacherPhotoUpload"
              >{{ uploadingTeacherPhoto ? 'Uploading…' : !driveReady ? (driveFailed ? 'Google Drive unavailable' : 'Loading Google…') : driveConnected ? 'Upload photo to Google Drive' : 'Connect Google Drive' }}</button>
              <span class="text-xs text-bone-500">or paste an image URL above</span>
            </div>
          </div>

          <div class="flex gap-3 pt-2">
            <button type="submit" :disabled="saving" class="flex-1 rounded-lg bg-gold-500 px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-semibold text-maroon-950 hover:bg-gold-400 disabled:opacity-50">
              {{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Create record' }}
            </button>
            <button v-if="editingId" type="button" class="rounded-lg border border-maroon-700/60 px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-bone-300 hover:text-bone-100" @click="beginCreate">Cancel</button>
          </div>
        </form>
      </section>
    </div>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="scheduleModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeScheduleModal"></div>

          <div class="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-maroon-700/60 bg-maroon-900 p-4 sm:p-6 shadow-2xl shadow-black/60 animate-scale-in">
            <div class="flex items-start justify-between gap-4 mb-5">
              <div>
                <p class="text-xs uppercase tracking-[0.25em] text-gold-400/80 mb-1">Schedules</p>
                <h2 class="text-xl font-serif text-bone-100">{{ editingId ? 'Edit event' : 'Add event' }}</h2>
              </div>
              <button type="button" class="p-2 rounded-lg text-bone-400 hover:text-gold-300 hover:bg-maroon-800/60 transition-colors" aria-label="Close" @click="closeScheduleModal">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div v-if="error" role="alert" class="mb-4 rounded-xl border border-rose-700/50 bg-rose-950/30 p-3 text-sm text-rose-200">{{ error }}</div>
            <div v-if="notice" role="status" class="mb-4 rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-3 text-sm text-emerald-200">{{ notice }}</div>

            <form class="space-y-4" @submit.prevent="saveRecord">
              <div class="rounded-xl border border-maroon-700/60 bg-maroon-950/40 p-3">
                <label class="block text-[11px] sm:text-xs font-medium text-bone-400 mb-1.5">Event banner</label>

                <div v-if="form.bannerURL" class="relative mb-2 overflow-hidden rounded-lg border border-maroon-700/60">
                  <img :src="form.bannerURL" alt="Event banner preview" class="w-full h-28 sm:h-36 object-cover" />
                  <button type="button" class="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur text-xs text-bone-200 hover:bg-rose-900/80 transition-colors" @click="form.bannerURL = ''">
                    Remove
                  </button>
                </div>

                <input
                  v-model="form.bannerURL"
                  type="url"
                  maxlength="500"
                  placeholder="https://example.com/banner.jpg"
                  class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold-500/60"
                />

                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <input ref="bannerFileInput" type="file" accept="image/*" class="hidden" @change="handleBannerFile" />
                  <button
                    type="button"
                    :disabled="uploadingBanner || !driveReady"
                    class="px-3 py-1.5 rounded-lg border border-gold-500/40 text-xs font-medium text-gold-300 hover:bg-gold-500/10 transition-colors disabled:opacity-60"
                    @click="triggerBannerUpload"
                  >{{ uploadingBanner ? 'Uploading…' : !driveReady ? (driveFailed ? 'Google Drive unavailable' : 'Loading Google…') : driveConnected ? 'Upload image to Google Drive' : 'Connect Google Drive' }}</button>
                  <span class="text-xs text-bone-500">or paste an image URL above</span>
                </div>
              </div>

              <div v-if="form.type === 'Workshop'" class="rounded-xl border border-maroon-700/60 bg-maroon-950/40 p-3">
                <div class="mb-3 flex items-center justify-between gap-4 rounded-lg border border-maroon-700/50 bg-maroon-900/50 px-3 py-3">
                  <div>
                    <p class="text-sm font-medium text-bone-200">Workshop registration</p>
                    <p class="mt-0.5 text-xs text-bone-500">{{ form.registrationOpen ? 'Guests can register while spaces are available.' : 'Registration is closed for this workshop.' }}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="form.registrationOpen"
                    :aria-label="form.registrationOpen ? 'Close workshop registration' : 'Open workshop registration'"
                    class="relative h-7 w-12 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-gold-400/60"
                    :class="form.registrationOpen ? 'border-gold-400/60 bg-gold-500/80' : 'border-maroon-600 bg-maroon-800'"
                    @click="form.registrationOpen = !form.registrationOpen"
                  >
                    <span
                      class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-bone-100 shadow-md transition-transform duration-200 ease-out"
                      :class="form.registrationOpen ? 'translate-x-6' : 'translate-x-0'"
                    ></span>
                  </button>
                </div>
                <label class="block text-[11px] sm:text-xs font-medium text-bone-400 mb-1.5">Ticket design</label>

                <div v-if="form.ticketDesignURL" class="relative mb-2 overflow-hidden rounded-lg border border-maroon-700/60">
                  <iframe
                    :src="ticketDesignPreviewURL(form.ticketDesignURL)"
                    title="Workshop ticket design PDF preview"
                    class="w-full h-40 bg-maroon-950"
                  ></iframe>
                  <button type="button" class="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur text-xs text-bone-200 hover:bg-rose-900/80 transition-colors" @click="form.ticketDesignURL = ''">
                    Remove
                  </button>
                </div>

                <input ref="ticketDesignFileInput" type="file" accept="application/pdf,.pdf" class="hidden" @change="handleTicketDesignFile" />
                <button
                  type="button"
                  :disabled="uploadingTicketDesign || !driveReady"
                  class="px-3 py-1.5 rounded-lg border border-gold-500/40 text-xs font-medium text-gold-300 hover:bg-gold-500/10 transition-colors disabled:opacity-60"
                  @click="triggerTicketDesignUpload"
                >{{ uploadingTicketDesign ? 'Uploading…' : !driveReady ? (driveFailed ? 'Google Drive unavailable' : 'Loading Google…') : driveConnected ? 'Upload ticket design PDF to Google Drive' : 'Connect Google Drive' }}</button>
                <p class="mt-1.5 text-xs text-bone-500">PDF files up to 5 MB are saved to the configured ticket folder.</p>
              </div>

              <div v-for="field in visibleFields" :key="field.key">
                <label :for="`schedule-${field.key}`" class="block text-[11px] sm:text-xs font-medium text-bone-400 mb-1.5">{{ field.label }}</label>
                <input
                  v-if="field.type !== 'select' && field.type !== 'textarea' && field.type !== 'checkbox'"
                  :id="`schedule-${field.key}`"
                  v-model="form[field.key]"
                  :type="field.type"
                  :required="field.required"
                  :maxlength="field.maxlength"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step"
                  :placeholder="field.placeholder"
                  class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold-500/60"
                />
                <select
                  v-else-if="field.type === 'select'"
                  :id="`schedule-${field.key}`"
                  v-model="form[field.key]"
                  :required="field.required"
                  class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold-500/60"
                >
                  <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
                </select>
                <p v-if="field.key === 'ticketURL'" class="mt-1.5 text-xs text-bone-500">Guests will be redirected here to purchase concert tickets.</p>
                <p v-if="field.key === 'capacity'" class="mt-1.5 text-xs text-bone-500">
                  Guests can register until this limit is reached.
                  <template v-if="editingId">Currently {{ form.registrationCount || 0 }} registered.</template>
                </p>
              </div>

              <div class="flex gap-3 pt-2">
                <button type="submit" :disabled="saving" class="flex-1 rounded-lg bg-gold-500 px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-semibold text-maroon-950 hover:bg-gold-400 disabled:opacity-50">
                  {{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Create event' }}
                </button>
                <button type="button" class="rounded-lg border border-maroon-700/60 px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-bone-300 hover:text-bone-100" @click="closeScheduleModal">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
