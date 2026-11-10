<script setup>
const events = [
  { day: '15', month: 'MAY', title: 'Spring Student Recital', venue: 'Main Auditorium', time: '18:00 — 20:00', type: 'Recital', accent: 'gold' },
  { day: '22', month: 'MAY', title: 'Masterclass: Strings', venue: 'Room 302', time: '14:00 — 16:00', type: 'Masterclass', accent: 'maroon' },
  { day: '03', month: 'JUN', title: 'Faculty Concert Evening', venue: 'Main Auditorium', time: '19:30 — 21:30', type: 'Concert', accent: 'gold' },
  { day: '11', month: 'JUN', title: 'Composition Workshop', venue: 'Studio B', time: '10:00 — 12:00', type: 'Workshop', accent: 'maroon' },
  { day: '24', month: 'JUN', title: 'Term Final Examinations', venue: 'Various Halls', time: '09:00 — 17:00', type: 'Exam', accent: 'maroon' },
]
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div v-reveal>
      <p class="text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-2">Calendar</p>
      <h1 class="text-3xl sm:text-4xl font-serif text-bone-100">Upcoming <span class="text-gold-gradient">Events</span></h1>
      <p class="mt-2 text-bone-500 max-w-xl">Recitals, masterclasses and milestones — everything ahead, beautifully laid out.</p>
    </div>

    <!-- Event list -->
    <div class="space-y-4">
      <div
        v-for="(e, i) in events"
        :key="i"
        v-reveal="i * 90"
        class="lift group flex items-center p-5 sm:p-6 rounded-2xl border border-maroon-700/60 glass-card cursor-pointer"
      >
        <!-- Date block -->
        <div class="text-center mr-5 sm:mr-6 pr-5 sm:pr-6 border-r border-maroon-700/60 flex-shrink-0">
          <p class="text-3xl sm:text-4xl font-serif text-gold-gradient leading-none">{{ e.day }}</p>
          <p class="text-xs text-bone-500 uppercase tracking-wider mt-1">{{ e.month }}</p>
        </div>

        <!-- Details -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 flex-wrap">
            <h3 class="text-base sm:text-lg font-semibold text-bone-200 group-hover:text-gold-300 transition-colors">{{ e.title }}</h3>
            <span
              class="px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium border"
              :class="e.accent === 'gold'
                ? 'bg-gold-500/10 text-gold-300 border-gold-500/30'
                : 'bg-maroon-500/20 text-maroon-400 border-maroon-500/40'"
            >
              {{ e.type }}
            </span>
          </div>
          <p class="text-sm text-bone-400 mt-1 flex items-center gap-2 flex-wrap">
            <span class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {{ e.venue }}
            </span>
            <span class="text-maroon-700">·</span>
            <span class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {{ e.time }}
            </span>
          </p>
        </div>

        <!-- Arrow -->
        <div class="ml-3 sm:ml-5 text-gold-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 flex-shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" /></svg>
        </div>
      </div>
    </div>
  </div>
</template>
