<script setup>
import { computed, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useContentCollection } from '@/composables/useContentCollection'
import { registerForWorkshop, VOCAL_RANGES } from '@/firebase/schedules'

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const today = new Date()
today.setHours(0, 0, 0, 0)
const displayedMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const { items: events, loading, error } = useContentCollection('schedules', 'date', 'asc')

const authStore = useAuthStore()
const selectedEventId = ref('')
const eventModalOpen = ref(false)
const submitting = ref(false)
const registrationMessage = ref('')
const registrationError = ref('')
const registrationTicket = ref('')
const registration = reactive({ name: '', vocalRange: '', email: '' })
const registrationErrors = reactive({ name: '', vocalRange: '', email: '' })

const inputBase =
  'w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 placeholder:text-bone-500 outline-none focus:border-gold-500/60'

const selectedEvent = computed(
  () => events.value.find((event) => event.id === selectedEventId.value) || null,
)

function eventDate(event) {
  return event.date?.toDate ? event.date.toDate() : new Date(event.date)
}

function eventStart(event) {
  const date = eventDate(event)
  const [hours, minutes] = (event.startTime || '00:00').split(':').map(Number)
  date.setHours(hours, minutes, 0, 0)
  return date
}

const upcomingEvents = computed(() =>
  events.value
    .filter((event) => eventStart(event) >= new Date())
    .sort((a, b) => eventStart(a) - eventStart(b))
    .slice(0, 3),
)

const calendarDays = computed(() => {
  const year = displayedMonth.value.getFullYear()
  const month = displayedMonth.value.getMonth()
  const offset = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
})

function eventsOnDay(day) {
  if (!day) return []
  return events.value
    .filter((event) => {
      const date = eventDate(event)
      return date.getFullYear() === displayedMonth.value.getFullYear()
        && date.getMonth() === displayedMonth.value.getMonth()
        && date.getDate() === day
    })
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
}

function changeMonth(offset) {
  displayedMonth.value = new Date(
    displayedMonth.value.getFullYear(),
    displayedMonth.value.getMonth() + offset,
    1,
  )
}

function isToday(day) {
  return day
    && displayedMonth.value.getFullYear() === today.getFullYear()
    && displayedMonth.value.getMonth() === today.getMonth()
    && day === today.getDate()
}

function accentFor(type) {
  return ['Recital', 'Concert'].includes(type) ? 'gold' : 'maroon'
}

function formatTime(event) {
  return event.endTime ? `${event.startTime} — ${event.endTime}` : event.startTime
}

function isWorkshop(event) {
  return event?.type === 'Workshop'
}

function isConcert(event) {
  return event?.type === 'Concert'
}

function hasTicket(event) {
  return isConcert(event) && Boolean(event?.ticketURL)
}

function capacityOf(event) {
  return Number(event?.capacity) || 0
}

function registeredOf(event) {
  return Number(event?.registrationCount) || 0
}

function spotsLeft(event) {
  return Math.max(0, capacityOf(event) - registeredOf(event))
}

function isFull(event) {
  return capacityOf(event) > 0 && registeredOf(event) >= capacityOf(event)
}

function openEvent(event) {
  selectedEventId.value = event.id
  registration.name = authStore.user?.displayName || ''
  registration.vocalRange = ''
  registration.email = authStore.user?.email || ''
  registrationErrors.name = ''
  registrationErrors.vocalRange = ''
  registrationErrors.email = ''
  registrationMessage.value = ''
  registrationError.value = ''
  registrationTicket.value = ''
  eventModalOpen.value = true
}

function closeEventModal() {
  eventModalOpen.value = false
  selectedEventId.value = ''
  registrationTicket.value = ''
}

function validateRegistration() {
  registrationErrors.name = ''
  registrationErrors.vocalRange = ''
  registrationErrors.email = ''

  if (!registration.name.trim()) registrationErrors.name = 'Name is required.'
  if (!registration.vocalRange) registrationErrors.vocalRange = 'Select your vocal range.'
  if (!registration.email) registrationErrors.email = 'Email is required.'
  else if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(registration.email)) {
    registrationErrors.email = 'Enter a valid email address.'
  }

  return !registrationErrors.name && !registrationErrors.vocalRange && !registrationErrors.email
}

async function submitRegistration() {
  if (!selectedEvent.value) return
  registrationError.value = ''
  registrationMessage.value = ''
  registrationTicket.value = ''
  if (!validateRegistration()) return

  if (isFull(selectedEvent.value)) {
    registrationError.value = 'This workshop is full.'
    return
  }

  submitting.value = true
  try {
    const result = await registerForWorkshop(selectedEvent.value.id, {
      name: registration.name,
      email: registration.email,
      vocalRange: registration.vocalRange,
    })
    registrationTicket.value = result.ticketId
    registrationMessage.value = 'You are registered! We look forward to seeing you.'
    registration.name = ''
    registration.vocalRange = ''
    registration.email = ''
  } catch (err) {
    registrationError.value = err?.code === 'permission-denied'
      ? 'This email is already registered, or the workshop is full.'
      : err.message || 'Unable to complete registration.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-5 sm:space-y-8">
    <div v-reveal>
      <p class="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-1.5 sm:mb-2">Calendar</p>
      <h1 class="text-2xl sm:text-4xl font-serif text-bone-100">Upcoming <span class="text-gold-gradient">Events</span></h1>
      <p class="mt-2 text-[13px] sm:text-base text-bone-500 max-w-xl">Recitals, masterclasses and milestones — everything ahead, beautifully laid out.</p>
    </div>

    <div v-if="loading" class="rounded-2xl border border-maroon-700/60 glass-card p-5 sm:p-8 text-center text-bone-400">Loading schedules…</div>
    <div v-else-if="error" role="alert" class="rounded-2xl border border-rose-700/50 bg-rose-950/30 p-4 sm:p-5 text-rose-200">{{ error }}</div>
    <template v-else>
      <section aria-labelledby="upcoming-heading" class="space-y-3 sm:space-y-4">
        <div class="flex items-end justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.25em] text-gold-400/80 mb-1">Coming up</p>
            <h2 id="upcoming-heading" class="text-lg sm:text-2xl font-serif text-bone-100">Nearest schedules</h2>
          </div>
          <span class="text-xs text-bone-500">Next 3 events</span>
        </div>

        <div v-if="upcomingEvents.length" class="grid gap-3 md:grid-cols-3">
          <article
            v-for="(event, index) in upcomingEvents"
            :key="event.id"
            v-reveal="index * 80"
            class="lift rounded-2xl border border-maroon-700/60 glass-card overflow-hidden"
          >
            <img v-if="event.bannerURL" :src="event.bannerURL" :alt="`${event.title} banner`" class="w-full h-28 sm:h-36 object-cover" loading="lazy" />
            <div class="p-3.5 sm:p-5">
              <div class="flex items-start gap-4">
              <div class="flex-shrink-0 text-center rounded-xl border border-gold-500/25 bg-gold-500/5 px-2.5 py-1.5 sm:px-3 sm:py-2 min-w-[3.5rem] sm:min-w-[4.25rem]">
                <p class="text-xl sm:text-2xl font-serif text-gold-gradient leading-none">{{ String(eventDate(event).getDate()).padStart(2, '0') }}</p>
                <p class="text-[10px] text-bone-500 uppercase tracking-wider mt-1">{{ monthNames[eventDate(event).getMonth()].slice(0, 3) }}</p>
              </div>
              <div class="min-w-0">
                <span
                  class="inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium border mb-2"
                  :class="accentFor(event.type) === 'gold'
                    ? 'bg-gold-500/10 text-gold-300 border-gold-500/30'
                    : 'bg-maroon-500/20 text-maroon-400 border-maroon-500/40'"
                >{{ event.type }}</span>
                <h3 class="font-semibold text-sm sm:text-base text-bone-200 leading-snug">{{ event.title }}</h3>
                <p class="text-xs text-bone-500 mt-1">{{ event.venue }} · {{ formatTime(event) }}</p>
              </div>
            </div>

            <div class="mt-2.5 sm:mt-3 flex flex-wrap items-center gap-2">
              <button
                v-if="isWorkshop(event)"
                type="button"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                :class="isFull(event)
                  ? 'bg-maroon-800/60 border border-maroon-700/60 text-bone-500'
                  : 'bg-gold-500 text-maroon-950 hover:bg-gold-400'"
                @click="openEvent(event)"
              >{{ isFull(event) ? 'Workshop full' : 'Register' }}</button>
              <a
                v-else-if="hasTicket(event)"
                :href="event.ticketURL"
                target="_blank"
                rel="noopener noreferrer"
                class="px-3 py-1.5 rounded-lg bg-gold-500 text-maroon-950 text-xs font-semibold hover:bg-gold-400 transition-colors"
              >Buy tickets</a>
              <button
                v-else
                type="button"
                class="px-3 py-1.5 rounded-lg border border-maroon-700/60 text-xs text-bone-300 hover:text-gold-300 transition-colors"
                @click="openEvent(event)"
              >Details</button>
              <span v-if="isWorkshop(event)" class="text-[11px] text-bone-500">
                {{ spotsLeft(event) }} spot{{ spotsLeft(event) === 1 ? '' : 's' }} left
              </span>
            </div>
            </div>
          </article>
        </div>
        <p v-else class="rounded-2xl border border-maroon-700/60 glass-card p-5 text-bone-400">There are no upcoming schedules.</p>
      </section>

      <section aria-label="Event calendar" class="rounded-2xl border border-maroon-700/60 glass-card p-3 sm:p-6">
        <div class="flex items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <div>
            <p class="text-xs uppercase tracking-[0.25em] text-gold-400/80 mb-1">Schedule</p>
            <h2 class="text-lg sm:text-2xl font-serif text-bone-100">
              {{ monthNames[displayedMonth.getMonth()] }} <span class="text-gold-300">{{ displayedMonth.getFullYear() }}</span>
            </h2>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" aria-label="Previous month" class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-maroon-700/60 text-bone-300 hover:text-gold-300 hover:border-gold-500/40 transition-colors" @click="changeMonth(-1)">
              <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m15 18-6-6 6-6" /></svg>
            </button>
            <button type="button" aria-label="Next month" class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-maroon-700/60 text-bone-300 hover:text-gold-300 hover:border-gold-500/40 transition-colors" @click="changeMonth(1)">
              <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <div class="min-w-full">
            <div class="grid grid-cols-7 border-b border-maroon-700/60">
              <div v-for="weekday in weekdays" :key="weekday" class="py-3 text-center text-xs uppercase tracking-wider text-bone-500">{{ weekday }}</div>
            </div>
            <div class="grid grid-cols-7">
              <div
                v-for="(day, index) in calendarDays"
                :key="`${displayedMonth.getMonth()}-${index}`"
                class="min-h-[4.25rem] sm:min-h-24 border-b border-r border-maroon-700/40 p-1 sm:p-2 md:p-3 last:border-r-0"
                :class="{ 'bg-gold-500/[0.03]': isToday(day) }"
              >
                <template v-if="day">
                  <span class="inline-flex w-6 h-6 sm:w-7 sm:h-7 items-center justify-center rounded-full text-[11px] sm:text-sm" :class="isToday(day) ? 'bg-gold-500 text-maroon-950 font-semibold' : 'text-bone-300'">{{ day }}</span>
                  <div class="mt-0.5 sm:mt-1 space-y-1">
                    <button
                      v-for="event in eventsOnDay(day)"
                      :key="event.id"
                      type="button"
                      class="w-full rounded-md border-l-2 px-1 py-0.5 sm:px-1.5 sm:py-1 text-[8px] sm:text-[10px] leading-tight transition-opacity hover:opacity-80"
                      :class="accentFor(event.type) === 'gold'
                        ? 'border-gold-400 bg-gold-500/10 text-gold-200'
                        : 'border-maroon-400 bg-maroon-500/15 text-bone-300'"
                      :title="`${event.title} · ${formatTime(event)}`"
                      @click="openEvent(event)"
                    >
                      <span class="hidden sm:block truncate text-left">{{ event.title }}</span>
                      <span class="sm:hidden mx-auto block w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true"></span>
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="eventModalOpen && selectedEvent" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeEventModal"></div>

          <div class="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-maroon-700/60 bg-maroon-900 shadow-2xl shadow-black/60 animate-scale-in">
            <img v-if="selectedEvent.bannerURL" :src="selectedEvent.bannerURL" :alt="`${selectedEvent.title} banner`" class="w-full h-32 sm:h-48 object-cover rounded-t-2xl" />
            <div class="p-4 sm:p-6">
              <div class="flex items-start justify-between gap-4 mb-4">
              <div class="min-w-0">
                <span
                  class="inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium border mb-2"
                  :class="accentFor(selectedEvent.type) === 'gold'
                    ? 'bg-gold-500/10 text-gold-300 border-gold-500/30'
                    : 'bg-maroon-500/20 text-maroon-400 border-maroon-500/40'"
                >{{ selectedEvent.type }}</span>
                <h2 class="text-lg sm:text-xl font-serif text-bone-100 leading-snug">{{ selectedEvent.title }}</h2>
              </div>
              <button type="button" class="p-2 rounded-lg text-bone-400 hover:text-gold-300 hover:bg-maroon-800/60 transition-colors flex-shrink-0" aria-label="Close" @click="closeEventModal">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div class="space-y-1.5 text-sm text-bone-400">
              <p>{{ monthNames[eventDate(selectedEvent).getMonth()] }} {{ eventDate(selectedEvent).getDate() }}, {{ eventDate(selectedEvent).getFullYear() }} · {{ formatTime(selectedEvent) }}</p>
              <p>{{ selectedEvent.venue }}</p>
            </div>

            <div v-if="isConcert(selectedEvent)" class="mt-5">
              <a
                v-if="hasTicket(selectedEvent)"
                :href="selectedEvent.ticketURL"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-maroon-950 font-semibold hover:shadow-lg hover:shadow-gold-500/30 transition-all"
              >Buy tickets</a>
              <p v-else class="rounded-xl border border-maroon-700/60 bg-maroon-950/40 p-4 text-sm text-bone-400">Ticket purchase link is not available yet.</p>
            </div>

            <div v-else-if="isWorkshop(selectedEvent)" class="mt-5">
              <div class="flex items-center justify-between gap-3 rounded-xl border border-maroon-700/60 bg-maroon-950/40 px-4 py-3 text-sm">
                <span class="text-bone-400">Capacity</span>
                <span class="text-bone-200 font-medium">{{ registeredOf(selectedEvent) }} / {{ capacityOf(selectedEvent) }}</span>
              </div>

              <div v-if="registrationMessage" role="status" class="mt-4 rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4 text-sm text-emerald-200">
                <p>{{ registrationMessage }}</p>
                <div v-if="registrationTicket" class="mt-3 rounded-lg border border-emerald-700/30 bg-emerald-950/30 px-3 py-2">
                  <p class="text-[10px] uppercase tracking-wider text-emerald-300/80 mb-1">Ticket ID</p>
                  <p class="font-mono text-sm sm:text-base break-all text-emerald-100">{{ registrationTicket }}</p>
                </div>
              </div>

              <div v-else-if="isFull(selectedEvent)" role="alert" class="mt-4 rounded-xl border border-rose-700/50 bg-rose-950/30 p-4 text-sm text-rose-200">
                This workshop has reached its maximum capacity.
              </div>

              <form v-else class="mt-4 space-y-4" @submit.prevent="submitRegistration">
                <div>
                  <label for="workshop-name" class="block text-xs font-medium text-bone-400 mb-1.5">Name</label>
                  <input id="workshop-name" v-model="registration.name" type="text" maxlength="100" :class="[inputBase, registrationErrors.name ? 'border-rose-700/60' : '']" />
                  <p v-if="registrationErrors.name" class="mt-1.5 text-xs text-rose-400">{{ registrationErrors.name }}</p>
                </div>

                <div>
                  <label for="workshop-range" class="block text-xs font-medium text-bone-400 mb-1.5">Vocal Range</label>
                  <select id="workshop-range" v-model="registration.vocalRange" :class="[inputBase, registrationErrors.vocalRange ? 'border-rose-700/60' : '']">
                    <option value="" disabled>Select your vocal range</option>
                    <option v-for="range in VOCAL_RANGES" :key="range" :value="range">{{ range }}</option>
                  </select>
                  <p v-if="registrationErrors.vocalRange" class="mt-1.5 text-xs text-rose-400">{{ registrationErrors.vocalRange }}</p>
                </div>

                <div>
                  <label for="workshop-email" class="block text-xs font-medium text-bone-400 mb-1.5">Email</label>
                  <input id="workshop-email" v-model="registration.email" type="email" maxlength="254" :class="[inputBase, registrationErrors.email ? 'border-rose-700/60' : '']" />
                  <p v-if="registrationErrors.email" class="mt-1.5 text-xs text-rose-400">{{ registrationErrors.email }}</p>
                </div>

                <div v-if="registrationError" role="alert" class="rounded-xl border border-rose-700/50 bg-rose-950/30 p-3 text-sm text-rose-200">{{ registrationError }}</div>

                <button type="submit" :disabled="submitting" class="w-full py-3 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-maroon-950 font-semibold hover:shadow-lg hover:shadow-gold-500/30 transition-all disabled:opacity-60">
                  {{ submitting ? 'Registering…' : 'Register for workshop' }}
                </button>
              </form>
            </div>

            <p v-else class="mt-5 rounded-xl border border-maroon-700/60 bg-maroon-950/40 p-4 text-sm text-bone-400">
              This event does not require registration.
            </p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
