<script setup>
import { computed } from 'vue'
import { useContentCollection } from '@/composables/useContentCollection'

const { items: courses, loading, error } = useContentCollection('courses', 'name', 'asc')

const averageDuration = computed(() => {
  const weeks = courses.value
    .map((course) => Number(course.duration.match(/\d+/)?.[0]))
    .filter(Number.isFinite)

  if (!weeks.length) return '—'
  return `${Math.round(weeks.reduce((sum, value) => sum + value, 0) / weeks.length)} wks`
})

const averageFee = computed(() => {
  if (!courses.value.length) return '—'
  const total = courses.value.reduce((sum, course) => sum + Number(course.fee), 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(total / courses.value.length)
})

const totals = computed(() => [
  { label: 'Total Courses', value: String(courses.value.length).padStart(2, '0') },
  { label: 'Avg. Duration', value: averageDuration.value },
  { label: 'Avg. Fee', value: averageFee.value },
])

function formatFee(fee) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fee)
}

function levelClass(level) {
  return {
    'bg-emerald-900/40 text-emerald-300 border-emerald-700/40': level === 'Beginner',
    'bg-sky-900/40 text-sky-300 border-sky-700/40': level === 'Intermediate',
    'bg-rose-900/40 text-rose-300 border-rose-700/40': level === 'Advanced',
  }
}
</script>

<template>
  <div class="space-y-5 sm:space-y-8">
    <div v-reveal>
      <p class="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-1.5 sm:mb-2">Catalogue</p>
      <h1 class="text-2xl sm:text-4xl font-serif text-bone-100">Courses &amp; Fee <span class="text-gold-gradient">Structure</span></h1>
      <p class="mt-2 text-[13px] sm:text-base text-bone-500 max-w-xl">A curated curriculum crafted to elevate every musician's craft, from first notes to concert stage.</p>
    </div>

    <div class="grid grid-cols-3 gap-2.5 sm:gap-6">
      <div v-for="(total, index) in totals" :key="total.label" v-reveal="index * 100" class="rounded-xl sm:rounded-2xl border border-maroon-700/60 glass-card p-3 sm:p-6">
        <p class="text-[10px] sm:text-xs uppercase tracking-wider text-bone-500">{{ total.label }}</p>
        <p class="mt-1 text-lg sm:text-3xl font-serif text-gold-gradient">{{ total.value }}</p>
      </div>
    </div>

    <div v-if="loading" class="rounded-xl sm:rounded-2xl border border-maroon-700/60 glass-card p-5 sm:p-8 text-center text-bone-400">Loading courses…</div>
    <div v-else-if="error" role="alert" class="rounded-xl sm:rounded-2xl border border-rose-700/50 bg-rose-950/30 p-4 sm:p-5 text-rose-200">{{ error }}</div>
    <div v-else-if="!courses.length" class="rounded-xl sm:rounded-2xl border border-maroon-700/60 glass-card p-5 sm:p-8 text-center text-bone-400">
      No courses have been published yet.
    </div>
    <div v-else v-reveal class="rounded-xl sm:rounded-2xl border border-maroon-700/60 glass-card overflow-hidden">
      <!-- Mobile card list -->
      <div class="md:hidden divide-y divide-maroon-800/70">
        <div v-for="course in courses" :key="course.id" class="p-3.5">
          <div class="flex items-start justify-between gap-3">
            <p class="font-medium text-bone-200 text-sm leading-snug">{{ course.name }}</p>
            <p class="text-gold-400 font-mono font-semibold text-sm whitespace-nowrap">{{ formatFee(course.fee) }}</p>
          </div>
          <div class="mt-2 flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-medium border" :class="levelClass(course.level)">{{ course.level }}</span>
            <span class="text-[11px] text-bone-500">{{ course.duration }}</span>
          </div>
        </div>
      </div>

      <!-- Desktop table -->
      <div class="hidden md:block overflow-x-auto">
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
            <tr v-for="course in courses" :key="course.id" class="group hover:bg-maroon-800/50 transition-colors duration-300">
              <td class="px-6 py-4 font-medium text-bone-200 group-hover:text-gold-300 transition-colors">{{ course.name }}</td>
              <td class="px-6 py-4 text-bone-400">{{ course.duration }}</td>
              <td class="px-6 py-4">
                <span class="px-2.5 py-1 rounded-full text-xs font-medium border" :class="levelClass(course.level)">{{ course.level }}</span>
              </td>
              <td class="px-6 py-4 text-right text-gold-400 font-mono font-semibold">{{ formatFee(course.fee) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
