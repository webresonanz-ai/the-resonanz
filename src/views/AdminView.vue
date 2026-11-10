<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { Timestamp } from 'firebase/firestore'
import {
  CONTENT_COLLECTIONS,
  createContent,
  deleteContent,
  subscribeToContent,
  updateContent,
} from '@/firebase/content'

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
    ],
  },
  teachers: {
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, maxlength: 100 },
      { key: 'specialty', label: 'Specialty', type: 'text', required: true, maxlength: 100 },
      { key: 'bio', label: 'Biography', type: 'textarea', required: true, maxlength: 500 },
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
let unsubscribe

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
  error.value = ''
  notice.value = ''
}

function toFirestoreFields() {
  const fields = { ...form.value }
  if (activeCollection.value === 'courses') fields.fee = Number(fields.fee)
  if (activeCollection.value === 'schedules') {
    fields.date = Timestamp.fromDate(new Date(`${fields.date}T12:00:00`))
  }
  if (activeCollection.value === 'news') {
    fields.date = Timestamp.fromDate(new Date(fields.date))
  }
  return fields
}

async function saveRecord() {
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

watch(activeCollection, loadCollection, { immediate: true })
onUnmounted(() => unsubscribe?.())
</script>

<template>
  <div class="space-y-8">
    <header>
      <p class="text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-2">Administration</p>
      <h1 class="text-3xl sm:text-4xl font-serif text-bone-100">Content <span class="text-gold-gradient">Manager</span></h1>
      <p class="mt-2 text-bone-500 max-w-2xl">Create, edit and remove the content shown across the public sections.</p>
    </header>

    <div class="flex flex-wrap gap-2" aria-label="Content section">
      <button
        v-for="(section, key) in CONTENT_COLLECTIONS"
        :key="key"
        type="button"
        class="px-4 py-2 rounded-xl border text-sm font-medium transition-colors"
        :class="activeCollection === key ? 'border-gold-500/50 bg-gold-500/10 text-gold-300' : 'border-maroon-700/60 text-bone-400 hover:text-bone-200'"
        @click="activeCollection = key"
      >{{ section.label }}</button>
    </div>

    <div v-if="error" role="alert" class="rounded-xl border border-rose-700/50 bg-rose-950/30 p-4 text-rose-200">{{ error }}</div>
    <div v-if="notice" role="status" class="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4 text-emerald-200">{{ notice }}</div>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      <section class="rounded-2xl border border-maroon-700/60 glass-card overflow-hidden">
        <div class="flex items-center justify-between gap-4 p-5 border-b border-maroon-700/50">
          <div>
            <h2 class="text-lg font-serif text-bone-100">{{ CONTENT_COLLECTIONS[activeCollection].label }}</h2>
            <p class="text-xs text-bone-500 mt-1">{{ records.length }} record{{ records.length === 1 ? '' : 's' }}</p>
          </div>
          <button type="button" class="px-4 py-2 rounded-lg bg-gold-500 text-maroon-950 text-sm font-semibold hover:bg-gold-400 transition-colors" @click="beginCreate">
            Add new
          </button>
        </div>

        <div v-if="loading" class="p-6 text-bone-400">Loading records…</div>
        <div v-else-if="!records.length" class="p-6 text-bone-400">No records yet. Add the first one using the form.</div>
        <ul v-else class="divide-y divide-maroon-800/70 max-h-[34rem] overflow-y-auto">
          <li v-for="record in records" :key="record.id" class="flex items-center gap-3 p-4 hover:bg-maroon-800/30">
            <button type="button" class="flex-1 min-w-0 text-left" @click="beginEdit(record)">
              <span class="block text-sm font-medium text-bone-200 truncate">{{ record.title || record.name }}</span>
              <span class="block text-xs text-bone-500 mt-1 truncate">{{ record.category || record.type || record.specialty || record.duration || record.venue || '' }}</span>
            </button>
            <button type="button" class="px-3 py-1.5 rounded-lg border border-maroon-700/60 text-xs text-bone-300 hover:text-gold-300" @click="beginEdit(record)">Edit</button>
            <button type="button" class="px-3 py-1.5 rounded-lg border border-rose-800/50 text-xs text-rose-300 hover:bg-rose-950/40" @click="removeRecord(record)">Delete</button>
          </li>
        </ul>
      </section>

      <section class="rounded-2xl border border-maroon-700/60 glass-card p-5 sm:p-6">
        <h2 class="text-lg font-serif text-bone-100 mb-5">{{ editingId ? 'Edit record' : 'Create record' }}</h2>
        <form class="space-y-4" @submit.prevent="saveRecord">
          <div v-for="field in schemas[activeCollection].fields" :key="field.key">
            <label :for="`admin-${field.key}`" class="block text-xs font-medium text-bone-400 mb-1.5">{{ field.label }}</label>
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
              class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2.5 text-sm text-bone-200 outline-none focus:border-gold-500/60"
            />
            <select
              v-else-if="field.type === 'select'"
              :id="`admin-${field.key}`"
              v-model="form[field.key]"
              :required="field.required"
              class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2.5 text-sm text-bone-200 outline-none focus:border-gold-500/60"
            >
              <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
            </select>
            <textarea
              v-else-if="field.type === 'textarea'"
              :id="`admin-${field.key}`"
              v-model="form[field.key]"
              :required="field.required"
              :maxlength="field.maxlength"
              rows="4"
              class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2.5 text-sm text-bone-200 outline-none focus:border-gold-500/60 resize-y"
            ></textarea>
            <label v-else class="flex items-center gap-3 rounded-lg border border-maroon-700/60 bg-maroon-950/40 px-3 py-3 text-sm text-bone-300">
              <input :id="`admin-${field.key}`" v-model="form[field.key]" type="checkbox" class="accent-yellow-500" />
              {{ field.label }}
            </label>
          </div>

          <div class="flex gap-3 pt-2">
            <button type="submit" :disabled="saving" class="flex-1 rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-semibold text-maroon-950 hover:bg-gold-400 disabled:opacity-50">
              {{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Create record' }}
            </button>
            <button v-if="editingId" type="button" class="rounded-lg border border-maroon-700/60 px-4 py-2.5 text-sm text-bone-300 hover:text-bone-100" @click="beginCreate">Cancel</button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>
