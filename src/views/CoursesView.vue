<script setup>
const courses = [
  { name: 'Classical Piano', duration: '12 Weeks', level: 'Beginner', fee: '$450.00', accent: 'emerald' },
  { name: 'Jazz Composition', duration: '8 Weeks', level: 'Intermediate', fee: '$600.00', accent: 'sky' },
  { name: 'Violin Performance', duration: '10 Weeks', level: 'Advanced', fee: '$720.00', accent: 'rose' },
  { name: 'Music Theory & Harmony', duration: '6 Weeks', level: 'Beginner', fee: '$300.00', accent: 'emerald' },
  { name: 'Voice & Vocal Technique', duration: '14 Weeks', level: 'Intermediate', fee: '$580.00', accent: 'sky' },
  { name: 'Chamber Ensemble', duration: '16 Weeks', level: 'Advanced', fee: '$850.00', accent: 'rose' },
]

const totals = [
  { label: 'Total Courses', value: '06' },
  { label: 'Avg. Duration', value: '11 wks' },
  { label: 'Avg. Fee', value: '$583' },
]
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div v-reveal>
      <p class="text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-2">Catalogue</p>
      <h1 class="text-3xl sm:text-4xl font-serif text-bone-100">Courses &amp; Fee <span class="text-gold-gradient">Structure</span></h1>
      <p class="mt-2 text-bone-500 max-w-xl">A curated curriculum crafted to elevate every musician's craft, from first notes to concert stage.</p>
    </div>

    <!-- Mini stats -->
    <div class="grid grid-cols-3 gap-4 sm:gap-6">
      <div v-for="(t, i) in totals" :key="t.label" v-reveal="i * 100" class="rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-6">
        <p class="text-xs uppercase tracking-wider text-bone-500">{{ t.label }}</p>
        <p class="mt-1 text-2xl sm:text-3xl font-serif text-gold-gradient">{{ t.value }}</p>
      </div>
    </div>

    <!-- Table -->
    <div v-reveal class="rounded-2xl border border-maroon-700/60 glass-card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left min-w-[640px]">
          <thead>
            <tr class="bg-maroon-850/80 text-gold-400 uppercase text-xs tracking-wider border-b border-maroon-700/60">
              <th class="px-6 py-4 font-semibold">Course Name</th>
              <th class="px-6 py-4 font-semibold">Duration</th>
              <th class="px-6 py-4 font-semibold">Level</th>
              <th class="px-6 py-4 font-semibold text-right">Fee (USD)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-maroon-800/70">
            <tr
              v-for="(c, i) in courses"
              :key="c.name"
              v-reveal="i * 80"
              class="group hover:bg-maroon-800/50 transition-colors duration-300"
            >
              <td class="px-6 py-4 font-medium text-bone-200 group-hover:text-gold-300 transition-colors flex items-center gap-3">
                <span class="w-1.5 h-8 rounded-full bg-gradient-to-b from-gold-400 to-gold-700 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                {{ c.name }}
              </td>
              <td class="px-6 py-4 text-bone-400">{{ c.duration }}</td>
              <td class="px-6 py-4">
                <span
                  class="px-2.5 py-1 rounded-full text-xs font-medium border"
                  :class="{
                    'bg-emerald-900/40 text-emerald-300 border-emerald-700/40': c.accent === 'emerald',
                    'bg-sky-900/40 text-sky-300 border-sky-700/40': c.accent === 'sky',
                    'bg-rose-900/40 text-rose-300 border-rose-700/40': c.accent === 'rose',
                  }"
                >
                  {{ c.level }}
                </span>
              </td>
              <td class="px-6 py-4 text-right text-gold-400 font-mono font-semibold">{{ c.fee }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
