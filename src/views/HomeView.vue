<script setup>
import { computed } from 'vue'
import { useContentCollection } from '@/composables/useContentCollection'

const { items: courseItems, loading: coursesLoading, error: coursesError } = useContentCollection('courses', 'name', 'asc')
const { items: scheduleItems, loading: schedulesLoading, error: schedulesError } = useContentCollection('schedules', 'date', 'asc')
const { items: teacherItems, loading: teachersLoading, error: teachersError } = useContentCollection('teachers', 'name', 'asc')
const { items: newsItems, loading: newsLoading, error: newsError } = useContentCollection('news', 'date', 'desc')
const loading = computed(() => coursesLoading.value || schedulesLoading.value || teachersLoading.value || newsLoading.value)
const loadError = computed(() => coursesError.value || schedulesError.value || teachersError.value || newsError.value)

function asDate(value) {
  if (!value) return null
  const date = value?.toDate ? value.toDate() : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function eventStart(event) {
  const date = asDate(event.date)
  if (!date) return null
  const [hours, minutes] = (event.startTime || '00:00').split(':').map(Number)
  date.setHours(hours || 0, minutes || 0, 0, 0)
  return date
}

function formatRelative(value) {
  const date = asDate(value)
  if (!date) return 'Recently'
  const days = Math.floor((Date.now() - date.getTime()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatEventDate(event) {
  const date = eventStart(event)
  if (!date) return 'Date to be announced'
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${event.startTime || 'Time TBA'}`
}

const upcomingEvents = computed(() => scheduleItems.value
  .filter((event) => eventStart(event) && eventStart(event) >= new Date())
  .sort((a, b) => eventStart(a) - eventStart(b))
  .slice(0, 3))
const upcomingEventCount = computed(() => scheduleItems.value.filter((event) =>
  eventStart(event) && eventStart(event) >= new Date(),
).length)
const announcements = computed(() => newsItems.value.slice(0, 4).map((item) => ({
  ...item,
  body: item.excerpt,
  date: formatRelative(item.date),
})))
const recitalCount = computed(() => scheduleItems.value.filter((event) =>
  ['Recital', 'Concert'].includes(event.type)
  && eventStart(event)
  && eventStart(event) >= new Date(),
).length)
const workshopRegistrations = computed(() => scheduleItems.value
  .filter((event) => event.type === 'Workshop' && eventStart(event) && eventStart(event) >= new Date())
  .reduce((total, event) => total + (Number(event.registrationCount) || 0), 0))
const season = computed(() => new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))
</script>

<template>
  <div v-if="loading" class="min-h-[65vh] flex flex-col items-center justify-center text-center px-6">
    <div class="relative flex h-24 w-24 items-center justify-center">
      <div class="absolute inset-0 rounded-full border border-gold-500/15"></div>
      <div class="absolute inset-1 rounded-full border border-transparent border-t-gold-400 animate-spin"></div>
      <div class="absolute inset-3 rounded-full border border-transparent border-b-gold-500/50 animate-spin" style="animation-direction: reverse; animation-duration: 2.4s"></div>
      <svg class="h-8 w-8 text-gold-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.4" d="M9 18V5l12-2v13M9 18c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3zm12-2c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z" /></svg>
    </div>
    <p class="mt-7 text-[10px] uppercase tracking-[0.38em] text-gold-400/80">Resonanz Academy</p>
    <h2 class="mt-2 font-serif text-2xl text-bone-100">Preparing your experience</h2>
    <p class="mt-2 text-sm text-bone-500">Gathering the latest from the academy</p>
    <p v-if="loadError" role="alert" class="mt-5 max-w-md text-sm text-rose-300">{{ loadError }}</p>
  </div>
  <div v-else class="space-y-5 sm:space-y-8">
    <div v-if="loadError" role="alert" class="rounded-xl border border-rose-700/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
      Some dashboard information could not be loaded: {{ loadError }}
    </div>
    <!-- Hero banner -->
    <section
      v-reveal
      class="relative overflow-hidden rounded-xl sm:rounded-2xl border border-maroon-700/50 bg-gradient-to-br from-maroon-800 via-maroon-850 to-maroon-900 p-4 sm:p-8 lg:p-9"
    >
      <div class="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-gold-500/12 blur-3xl animate-float"></div>
      <div class="absolute -left-8 -bottom-12 w-40 h-40 rounded-full bg-maroon-500/20 blur-3xl animate-float" style="animation-delay: -2s"></div>
      <div class="absolute right-6 top-6 hidden sm:block">
        <div class="w-16 h-16 rounded-full border border-gold-500/20 animate-spin-slow flex items-center justify-center">
          <div class="w-10 h-10 rounded-full border border-gold-500/30 flex items-center justify-center text-gold-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3zm12-3c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z" />
            </svg>
          </div>
        </div>
      </div>
      <div class="relative">
        <p class="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold-400/80">Academy · {{ season }}</p>
        <h1 class="mt-2 sm:mt-3 text-2xl sm:text-4xl lg:text-5xl font-serif text-bone-100 leading-tight">
          Where artistry meets <span class="text-shimmer">discipline</span>
        </h1>
        <p class="mt-2 sm:mt-3 max-w-xl text-bone-400 text-[13px] sm:text-base leading-relaxed">
          Welcome to Resonanz, Maestro. Here is a glance at your academy's heartbeat today.
        </p>
      </div>
    </section>

    <!-- Stat cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
      <!-- Active Students -->
      <div v-reveal="0" class="gold-hover group relative overflow-hidden rounded-xl sm:rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-6">
        <div class="absolute -right-6 -top-6 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gold-500/10 blur-2xl group-hover:bg-gold-500/20 transition-colors duration-500"></div>
        <div class="relative flex items-start justify-between">
          <div>
          <p class="text-[10px] sm:text-xs uppercase tracking-wider text-bone-500">Courses</p>
            <p class="mt-1 sm:mt-2 text-2xl sm:text-4xl font-serif text-gold-gradient">{{ courseItems.length }}</p>
          </div>
          <div class="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-maroon-700/50 border border-gold-500/20 flex items-center justify-center text-gold-400 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        </div>
        <p class="relative mt-1.5 sm:mt-3 text-[11px] sm:text-xs text-emerald-400/80 flex items-center gap-1">
          <span class="text-gold-400">♪</span> Programs currently offered
        </p>
      </div>

      <!-- Upcoming Recitals -->
      <div v-reveal="100" class="gold-hover group relative overflow-hidden rounded-xl sm:rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-6">
        <div class="absolute -right-6 -top-6 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-maroon-500/15 blur-2xl group-hover:bg-maroon-500/25 transition-colors duration-500"></div>
        <div class="relative flex items-start justify-between">
          <div>
            <p class="text-[10px] sm:text-xs uppercase tracking-wider text-bone-500">Upcoming Events</p>
            <p class="mt-1 sm:mt-2 text-2xl sm:text-4xl font-serif text-gold-gradient">{{ upcomingEventCount }}</p>
          </div>
          <div class="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-maroon-700/50 border border-gold-500/20 flex items-center justify-center text-gold-400 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3zm12-3c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z" />
            </svg>
          </div>
        </div>
        <p class="relative mt-1.5 sm:mt-3 text-[11px] sm:text-xs text-bone-400 flex items-center gap-1">
          <span class="text-gold-400">●</span> {{ recitalCount }} recitals or concerts
        </p>
      </div>

      <!-- New Enrollments -->
      <div v-reveal="200" class="gold-hover group relative overflow-hidden rounded-xl sm:rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-6">
        <div class="absolute -right-6 -top-6 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gold-500/10 blur-2xl group-hover:bg-gold-500/20 transition-colors duration-500"></div>
        <div class="relative flex items-start justify-between">
          <div>
            <p class="text-[10px] sm:text-xs uppercase tracking-wider text-bone-500">Workshop Registrations</p>
            <p class="mt-1 sm:mt-2 text-2xl sm:text-4xl font-serif text-gold-gradient">{{ workshopRegistrations }}</p>
          </div>
          <div class="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-maroon-700/50 border border-gold-500/20 flex items-center justify-center text-gold-400 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
        </div>
        <p class="relative mt-1.5 sm:mt-3 text-[11px] sm:text-xs text-emerald-400/80 flex items-center gap-1">
          <span class="text-gold-400">♪</span> Across upcoming workshops
        </p>
      </div>

      <!-- Faculty Members -->
      <div v-reveal="300" class="gold-hover group relative overflow-hidden rounded-xl sm:rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-6">
        <div class="absolute -right-6 -top-6 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-maroon-500/15 blur-2xl group-hover:bg-maroon-500/25 transition-colors duration-500"></div>
        <div class="relative flex items-start justify-between">
          <div>
            <p class="text-[10px] sm:text-xs uppercase tracking-wider text-bone-500">Faculty Members</p>
            <p class="mt-1 sm:mt-2 text-2xl sm:text-4xl font-serif text-gold-gradient">{{ teacherItems.length }}</p>
          </div>
          <div class="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-maroon-700/50 border border-gold-500/20 flex items-center justify-center text-gold-400 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 10-8 0 4 4 0 008 0z" />
            </svg>
          </div>
        </div>
        <p class="relative mt-1.5 sm:mt-3 text-[11px] sm:text-xs text-bone-400 flex items-center gap-1">
          <span class="text-gold-400">★</span> Faculty in the directory
        </p>
      </div>
    </div>

    <!-- Announcements + Upcoming -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <!-- Announcements -->
      <div v-reveal class="lg:col-span-2 rounded-xl sm:rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-7 lg:p-8">
        <div class="flex items-center justify-between mb-4 sm:mb-5">
          <h3 class="text-lg sm:text-xl font-serif text-gold-gradient">Announcements</h3>
          <span class="text-[10px] sm:text-xs text-bone-500 uppercase tracking-wider">{{ announcements.length }} latest</span>
        </div>
        <ul class="space-y-1.5 sm:space-y-2">
          <li
            v-for="(a, i) in announcements"
            :key="a.id"
            v-reveal="i * 120"
            class="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl hover:bg-maroon-800/50 transition-colors duration-300 group"
          >
            <span class="mt-0.5 flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gold-500/10 border border-gold-500/25 flex items-center justify-center text-gold-400 group-hover:scale-110 group-hover:bg-gold-500/20 transition-all duration-300">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.593l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
            </span>
            <div class="min-w-0">
              <p class="font-semibold text-sm sm:text-base text-bone-200 group-hover:text-gold-300 transition-colors">{{ a.title }}</p>
              <p class="text-[13px] sm:text-sm text-bone-500 mt-1 leading-relaxed">{{ a.body }}</p>
              <p class="text-[10px] sm:text-xs text-gold-400/70 mt-1.5 sm:mt-2 uppercase tracking-wider">{{ a.date }}</p>
            </div>
          </li>
          <li v-if="!announcements.length" class="rounded-xl border border-maroon-700/40 bg-maroon-850/40 p-4 text-sm text-bone-500">No announcements have been published yet.</li>
        </ul>
      </div>

      <!-- Upcoming -->
      <div v-reveal="200" class="rounded-xl sm:rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-7 lg:p-8">
        <h3 class="text-lg sm:text-xl font-serif text-gold-gradient mb-4 sm:mb-5">Upcoming</h3>
        <ul class="space-y-2.5 sm:space-y-3">
          <li
            v-for="(u, i) in upcomingEvents"
            :key="u.id"
            v-reveal="300 + i * 100"
            class="lift rounded-xl bg-maroon-850/60 border border-maroon-700/50 p-3 sm:p-4 cursor-pointer"
          >
            <div class="flex items-center justify-between gap-2 mb-1">
              <p class="font-semibold text-bone-200 text-[13px] sm:text-sm">{{ u.title }}</p>
              <span class="w-2 h-2 rounded-full bg-gold-500 animate-glow flex-shrink-0"></span>
            </div>
              <p class="text-[11px] sm:text-xs text-bone-500">{{ formatEventDate(u) }}</p>
              <p class="text-[11px] sm:text-xs text-gold-400/70 mt-1">{{ u.venue || 'Venue to be announced' }}</p>
          </li>
          <li v-if="!upcomingEvents.length" class="rounded-xl border border-maroon-700/40 bg-maroon-850/40 p-4 text-sm text-bone-500">No upcoming events have been scheduled.</li>
        </ul>
      </div>
    </div>
  </div>
</template>
