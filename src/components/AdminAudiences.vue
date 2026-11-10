<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useContentCollection } from '@/composables/useContentCollection'
import {
  subscribeToWorkshopRegistrations,
  updateWorkshopRegistration,
  VOCAL_RANGES,
} from '@/firebase/schedules'

const {
  items: events,
  loading: eventsLoading,
  error: eventsError,
} = useContentCollection('schedules', 'date', 'asc')

const registrationsByEvent = ref({})
const registrationError = ref('')
const notice = ref('')
const search = ref('')
const editing = ref(null)
const form = ref({ name: '', vocalRange: '' })
const formError = ref('')
const saving = ref(false)
const registrationUnsubs = new Map()

const workshopEvents = computed(() => events.value.filter((event) => event.type === 'Workshop'))

const audiences = computed(() =>
  workshopEvents.value.flatMap((event) =>
    (registrationsByEvent.value[event.id] || []).map((registration) => ({
      ...registration,
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.date,
    })),
  ),
)

const filteredAudiences = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return audiences.value
  return audiences.value.filter((guest) =>
    [guest.name, guest.email, guest.vocalRange, guest.eventTitle, guest.ticketId].some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(term),
    ),
  )
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

function initials(guest) {
  const base = guest.name || guest.email || '?'
  const parts = base.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
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
    await updateWorkshopRegistration(editing.value.eventId, editing.value.email, form.value)
    notice.value = 'Guest details updated.'
    closeEdit()
  } catch (err) {
    formError.value = err.message || 'Unable to update this guest.'
  } finally {
    saving.value = false
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

    <section class="rounded-2xl border border-maroon-700/60 glass-card overflow-hidden">
      <div
        class="flex flex-wrap items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 border-b border-maroon-700/50"
      >
        <div>
          <h2 class="text-base sm:text-lg font-serif text-bone-100">Workshop audiences</h2>
          <p class="text-xs text-bone-500 mt-1">
            {{ audiences.length }} registered guest{{ audiences.length === 1 ? '' : 's' }} across
            {{ workshopEvents.length }} workshop{{ workshopEvents.length === 1 ? '' : 's' }}
          </p>
        </div>
        <div class="relative w-full sm:w-64">
          <input
            v-model="search"
            type="search"
            placeholder="Search name, email, ticket or event…"
            class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 placeholder:text-bone-500 outline-none focus:border-gold-500/60"
          />
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
          search ? 'No guests match your search.' : 'No guests have registered for a workshop yet.'
        }}
      </div>
      <ul
        v-else
        class="divide-y divide-maroon-800/70 max-h-[30rem] sm:max-h-[38rem] overflow-y-auto"
      >
        <li
          v-for="guest in filteredAudiences"
          :key="`${guest.eventId}-${guest.email}`"
          class="flex flex-wrap items-center gap-3 p-3 sm:p-4 hover:bg-maroon-800/30"
        >
          <div
            class="flex w-10 h-10 flex-shrink-0 items-center justify-center rounded-full border border-gold-500/25 bg-gold-500/10 text-sm font-semibold text-gold-300"
          >
            {{ initials(guest) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span class="text-sm font-medium text-bone-200 truncate">{{ guest.name }}</span>
              <span
                class="px-2 py-0.5 rounded-full border border-maroon-600/50 bg-maroon-800/40 text-[10px] uppercase tracking-wider text-bone-400"
                >{{ guest.vocalRange }}</span
              >
            </div>
            <p class="text-xs text-bone-500 mt-0.5 truncate">{{ guest.email }}</p>
            <p class="text-xs font-mono text-gold-300/80 mt-0.5 truncate">
              {{ guest.ticketId || 'No ticket ID' }}
            </p>
            <p class="text-xs text-bone-500 mt-1 truncate">
              {{ guest.eventTitle
              }}<template v-if="guest.eventDate"> · {{ formatDate(guest.eventDate) }}</template>
            </p>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border border-maroon-700/60 text-xs text-bone-300 hover:text-gold-300"
            @click="openEdit(guest)"
          >
            Edit
          </button>
        </li>
      </ul>
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
                  Email is the registration identifier and cannot be changed.
                </p>
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
  </div>
</template>
