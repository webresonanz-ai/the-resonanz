<script setup>
import { computed, ref } from 'vue'
import { useContentCollection } from '@/composables/useContentCollection'

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const today = new Date()
today.setHours(0, 0, 0, 0)
const displayedMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const { items: events, loading, error } = useContentCollection('schedules', 'date', 'asc')

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
</script>

<template>
  <div class="space-y-8">
    <div v-reveal>
      <p class="text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-2">Calendar</p>
      <h1 class="text-3xl sm:text-4xl font-serif text-bone-100">Upcoming <span class="text-gold-gradient">Events</span></h1>
      <p class="mt-2 text-bone-500 max-w-xl">Recitals, masterclasses and milestones — everything ahead, beautifully laid out.</p>
    </div>

    <div v-if="loading" class="rounded-2xl border border-maroon-700/60 glass-card p-8 text-center text-bone-400">Loading schedules…</div>
    <div v-else-if="error" role="alert" class="rounded-2xl border border-rose-700/50 bg-rose-950/30 p-5 text-rose-200">{{ error }}</div>
    <template v-else>
      <section aria-labelledby="upcoming-heading" class="space-y-4">
        <div class="flex items-end justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.25em] text-gold-400/80 mb-1">Coming up</p>
            <h2 id="upcoming-heading" class="text-xl sm:text-2xl font-serif text-bone-100">Nearest schedules</h2>
          </div>
          <span class="text-xs text-bone-500">Next 3 events</span>
        </div>

        <div v-if="upcomingEvents.length" class="grid gap-3 md:grid-cols-3">
          <article
            v-for="(event, index) in upcomingEvents"
            :key="event.id"
            v-reveal="index * 80"
            class="lift rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-5"
          >
            <div class="flex items-start gap-4">
              <div class="flex-shrink-0 text-center rounded-xl border border-gold-500/25 bg-gold-500/5 px-3 py-2 min-w-[4.25rem]">
                <p class="text-2xl font-serif text-gold-gradient leading-none">{{ String(eventDate(event).getDate()).padStart(2, '0') }}</p>
                <p class="text-[10px] text-bone-500 uppercase tracking-wider mt-1">{{ monthNames[eventDate(event).getMonth()].slice(0, 3) }}</p>
              </div>
              <div class="min-w-0">
                <span
                  class="inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium border mb-2"
                  :class="accentFor(event.type) === 'gold'
                    ? 'bg-gold-500/10 text-gold-300 border-gold-500/30'
                    : 'bg-maroon-500/20 text-maroon-400 border-maroon-500/40'"
                >{{ event.type }}</span>
                <h3 class="font-semibold text-bone-200 leading-snug">{{ event.title }}</h3>
                <p class="text-xs text-bone-500 mt-1">{{ event.venue }} · {{ formatTime(event) }}</p>
              </div>
            </div>
          </article>
        </div>
        <p v-else class="rounded-2xl border border-maroon-700/60 glass-card p-5 text-bone-400">There are no upcoming schedules.</p>
      </section>

      <section aria-label="Event calendar" class="rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-6">
        <div class="flex items-center justify-between gap-4 mb-5">
          <div>
            <p class="text-xs uppercase tracking-[0.25em] text-gold-400/80 mb-1">Schedule</p>
            <h2 class="text-xl sm:text-2xl font-serif text-bone-100">
              {{ monthNames[displayedMonth.getMonth()] }} <span class="text-gold-300">{{ displayedMonth.getFullYear() }}</span>
            </h2>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" aria-label="Previous month" class="w-10 h-10 rounded-xl border border-maroon-700/60 text-bone-300 hover:text-gold-300 hover:border-gold-500/40 transition-colors" @click="changeMonth(-1)">
              <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m15 18-6-6 6-6" /></svg>
            </button>
            <button type="button" aria-label="Next month" class="w-10 h-10 rounded-xl border border-maroon-700/60 text-bone-300 hover:text-gold-300 hover:border-gold-500/40 transition-colors" @click="changeMonth(1)">
              <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <div class="min-w-[600px]">
            <div class="grid grid-cols-7 border-b border-maroon-700/60">
              <div v-for="weekday in weekdays" :key="weekday" class="py-3 text-center text-xs uppercase tracking-wider text-bone-500">{{ weekday }}</div>
            </div>
            <div class="grid grid-cols-7">
              <div
                v-for="(day, index) in calendarDays"
                :key="`${displayedMonth.getMonth()}-${index}`"
                class="min-h-24 border-b border-r border-maroon-700/40 p-2 sm:p-3 last:border-r-0"
                :class="{ 'bg-gold-500/[0.03]': isToday(day) }"
              >
                <template v-if="day">
                  <span class="inline-flex w-7 h-7 items-center justify-center rounded-full text-sm" :class="isToday(day) ? 'bg-gold-500 text-maroon-950 font-semibold' : 'text-bone-300'">{{ day }}</span>
                  <div class="mt-1 space-y-1">
                    <div
                      v-for="event in eventsOnDay(day)"
                      :key="event.id"
                      class="rounded-md border-l-2 px-1.5 py-1 text-[10px] leading-tight truncate"
                      :class="accentFor(event.type) === 'gold'
                        ? 'border-gold-400 bg-gold-500/10 text-gold-200'
                        : 'border-maroon-400 bg-maroon-500/15 text-bone-300'"
                      :title="`${event.title} · ${formatTime(event)}`"
                    >{{ event.title }}</div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
