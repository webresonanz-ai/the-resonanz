<script setup>
import { useCountUp } from '@/composables/useCountUp'

const students = useCountUp(124, { delay: 150 })
const recitals = useCountUp(3, { delay: 300 })
const enrollments = useCountUp(12, { delay: 450 })
const faculty = useCountUp(8, { delay: 600 })

const announcements = [
  {
    title: 'Spring Gala Rehearsal Schedule Updated',
    body: 'New timings have been posted for all ensembles. Please review before Friday.',
    date: '2 days ago',
  },
  {
    title: 'Masterclass: Piano Interpretation with Dr. Aris',
    body: 'A special guest session exploring romantic-era phrasing, next Friday at 15:00.',
    date: '5 days ago',
  },
  {
    title: 'New Practice Rooms Now Available',
    body: 'Rooms 7–10 on the third floor are open for booking through the Schedules tab.',
    date: '1 week ago',
  },
]

const upcoming = [
  { title: 'Spring Student Recital', when: 'May 15 · 18:00', place: 'Main Auditorium' },
  { title: 'Masterclass: Strings', when: 'May 22 · 14:00', place: 'Room 302' },
  { title: 'Faculty Concert', when: 'Jun 03 · 19:30', place: 'Main Auditorium' },
]
</script>

<template>
  <div class="space-y-8">
    <!-- Hero banner -->
    <section
      v-reveal
      class="relative overflow-hidden rounded-2xl border border-maroon-700/50 bg-gradient-to-br from-maroon-800 via-maroon-850 to-maroon-900 p-6 sm:p-9"
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
        <p class="text-xs uppercase tracking-[0.3em] text-gold-400/80">Season · Spring 2026</p>
        <h1 class="mt-3 text-3xl sm:text-5xl font-serif text-bone-100 leading-tight">
          Where artistry meets <span class="text-shimmer">discipline</span>
        </h1>
        <p class="mt-3 max-w-xl text-bone-400 text-sm sm:text-base leading-relaxed">
          Welcome to Resonanz, Maestro. Here is a glance at your academy's heartbeat today.
        </p>
      </div>
    </section>

    <!-- Stat cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <!-- Active Students -->
      <div v-reveal="0" class="gold-hover group relative overflow-hidden rounded-2xl border border-maroon-700/60 glass-card p-6">
        <div class="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gold-500/10 blur-2xl group-hover:bg-gold-500/20 transition-colors duration-500"></div>
        <div class="relative flex items-start justify-between">
          <div>
            <p class="text-xs uppercase tracking-wider text-bone-500">Active Students</p>
            <p class="mt-2 text-4xl font-serif text-gold-gradient">{{ students }}</p>
          </div>
          <div class="w-11 h-11 rounded-xl bg-maroon-700/50 border border-gold-500/20 flex items-center justify-center text-gold-400 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        </div>
        <p class="relative mt-3 text-xs text-emerald-400/80 flex items-center gap-1">
          <span>▲</span> 8% growth this term
        </p>
      </div>

      <!-- Upcoming Recitals -->
      <div v-reveal="100" class="gold-hover group relative overflow-hidden rounded-2xl border border-maroon-700/60 glass-card p-6">
        <div class="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-maroon-500/15 blur-2xl group-hover:bg-maroon-500/25 transition-colors duration-500"></div>
        <div class="relative flex items-start justify-between">
          <div>
            <p class="text-xs uppercase tracking-wider text-bone-500">Upcoming Recitals</p>
            <p class="mt-2 text-4xl font-serif text-gold-gradient">{{ recitals }}</p>
          </div>
          <div class="w-11 h-11 rounded-xl bg-maroon-700/50 border border-gold-500/20 flex items-center justify-center text-gold-400 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3zm12-3c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z" />
            </svg>
          </div>
        </div>
        <p class="relative mt-3 text-xs text-bone-400 flex items-center gap-1">
          <span class="text-gold-400">●</span> Next recital in 5 days
        </p>
      </div>

      <!-- New Enrollments -->
      <div v-reveal="200" class="gold-hover group relative overflow-hidden rounded-2xl border border-maroon-700/60 glass-card p-6">
        <div class="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gold-500/10 blur-2xl group-hover:bg-gold-500/20 transition-colors duration-500"></div>
        <div class="relative flex items-start justify-between">
          <div>
            <p class="text-xs uppercase tracking-wider text-bone-500">New Enrollments</p>
            <p class="mt-2 text-4xl font-serif text-gold-gradient">{{ enrollments }}</p>
          </div>
          <div class="w-11 h-11 rounded-xl bg-maroon-700/50 border border-gold-500/20 flex items-center justify-center text-gold-400 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
        </div>
        <p class="relative mt-3 text-xs text-emerald-400/80 flex items-center gap-1">
          <span>▲</span> 12% vs last month
        </p>
      </div>

      <!-- Faculty Members -->
      <div v-reveal="300" class="gold-hover group relative overflow-hidden rounded-2xl border border-maroon-700/60 glass-card p-6">
        <div class="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-maroon-500/15 blur-2xl group-hover:bg-maroon-500/25 transition-colors duration-500"></div>
        <div class="relative flex items-start justify-between">
          <div>
            <p class="text-xs uppercase tracking-wider text-bone-500">Faculty Members</p>
            <p class="mt-2 text-4xl font-serif text-gold-gradient">{{ faculty }}</p>
          </div>
          <div class="w-11 h-11 rounded-xl bg-maroon-700/50 border border-gold-500/20 flex items-center justify-center text-gold-400 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 10-8 0 4 4 0 008 0z" />
            </svg>
          </div>
        </div>
        <p class="relative mt-3 text-xs text-bone-400 flex items-center gap-1">
          <span class="text-gold-400">★</span> 3 new instructors
        </p>
      </div>
    </div>

    <!-- Announcements + Upcoming -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Announcements -->
      <div v-reveal class="lg:col-span-2 rounded-2xl border border-maroon-700/60 glass-card p-6 sm:p-8">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-xl font-serif text-gold-gradient">Announcements</h3>
          <span class="text-xs text-bone-500 uppercase tracking-wider">{{ announcements.length }} new</span>
        </div>
        <ul class="space-y-2">
          <li
            v-for="(a, i) in announcements"
            :key="i"
            v-reveal="i * 120"
            class="flex items-start gap-4 p-4 rounded-xl hover:bg-maroon-800/50 transition-colors duration-300 group"
          >
            <span class="mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg bg-gold-500/10 border border-gold-500/25 flex items-center justify-center text-gold-400 group-hover:scale-110 group-hover:bg-gold-500/20 transition-all duration-300">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.593l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
            </span>
            <div class="min-w-0">
              <p class="font-semibold text-bone-200 group-hover:text-gold-300 transition-colors">{{ a.title }}</p>
              <p class="text-sm text-bone-500 mt-1 leading-relaxed">{{ a.body }}</p>
              <p class="text-xs text-gold-400/70 mt-2 uppercase tracking-wider">{{ a.date }}</p>
            </div>
          </li>
        </ul>
      </div>

      <!-- Upcoming -->
      <div v-reveal="200" class="rounded-2xl border border-maroon-700/60 glass-card p-6 sm:p-8">
        <h3 class="text-xl font-serif text-gold-gradient mb-5">Upcoming</h3>
        <ul class="space-y-3">
          <li
            v-for="(u, i) in upcoming"
            :key="i"
            v-reveal="300 + i * 100"
            class="lift rounded-xl bg-maroon-850/60 border border-maroon-700/50 p-4 cursor-pointer"
          >
            <div class="flex items-center justify-between mb-1">
              <p class="font-semibold text-bone-200 text-sm">{{ u.title }}</p>
              <span class="w-2 h-2 rounded-full bg-gold-500 animate-glow"></span>
            </div>
            <p class="text-xs text-bone-500">{{ u.when }}</p>
            <p class="text-xs text-gold-400/70 mt-1">{{ u.place }}</p>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
