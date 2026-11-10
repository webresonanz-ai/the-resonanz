<script setup>
import { useContentCollection } from '@/composables/useContentCollection'

const hues = [
  'from-gold-400 to-maroon-600',
  'from-maroon-500 to-gold-700',
  'from-gold-500 to-maroon-500',
  'from-maroon-600 to-gold-500',
  'from-gold-400 to-maroon-700',
  'from-maroon-500 to-gold-600',
]
const { items: teachers, loading, error } = useContentCollection('teachers', 'name', 'asc')

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
</script>

<template>
  <div class="space-y-5 sm:space-y-8">
    <div v-reveal>
      <p class="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-1.5 sm:mb-2">Faculty</p>
      <h1 class="text-2xl sm:text-4xl font-serif text-bone-100">Our <span class="text-gold-gradient">Masters</span></h1>
      <p class="mt-2 text-[13px] sm:text-base text-bone-500 max-w-xl">World-class performers and pedagogues devoted to shaping the next generation of artists.</p>
    </div>

    <div v-if="loading" class="rounded-2xl border border-maroon-700/60 glass-card p-5 sm:p-8 text-center text-bone-400">Loading teachers…</div>
    <div v-else-if="error" role="alert" class="rounded-2xl border border-rose-700/50 bg-rose-950/30 p-4 sm:p-5 text-rose-200">{{ error }}</div>
    <div v-else-if="!teachers.length" class="rounded-2xl border border-maroon-700/60 glass-card p-5 sm:p-8 text-center text-bone-400">
      No teachers have been added yet.
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
      <article
        v-for="(teacher, index) in teachers"
        :key="teacher.id"
        v-reveal="index * 100"
        class="lift group rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-6 text-center relative overflow-hidden"
      >
        <div class="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style="background: radial-gradient(220px circle at 50% 0%, rgba(212,175,55,0.10), transparent 60%)"></div>
        <div class="relative inline-block mb-3 sm:mb-4">
          <div class="absolute inset-0 rounded-full bg-gradient-to-br from-gold-400 to-maroon-600 blur-md opacity-50 group-hover:opacity-80 transition-opacity duration-500"></div>
          <img
            v-if="teacher.photoURL"
            :src="teacher.photoURL"
            :alt="teacher.name"
            class="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-2 ring-gold-500/30 group-hover:ring-gold-400/60 transition-all duration-500"
          />
          <div
            v-else
            class="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br flex items-center justify-center text-xl sm:text-2xl font-serif font-bold text-maroon-950 ring-2 ring-gold-500/30 group-hover:ring-gold-400/60 transition-all duration-500 group-hover:scale-105"
            :class="hues[index % hues.length]"
          >{{ initials(teacher.name) }}</div>
        </div>

        <h3 class="text-lg sm:text-xl font-serif text-bone-100 group-hover:text-gold-300 transition-colors">{{ teacher.name }}</h3>
        <p class="text-gold-400 text-[11px] sm:text-sm mt-1 uppercase tracking-wider">{{ teacher.specialty }}</p>
        <p class="text-bone-500 text-[13px] sm:text-sm mt-2 sm:mt-3 leading-relaxed">{{ teacher.bio }}</p>
        <div v-if="teacher.email || teacher.profileURL" class="mt-4 sm:mt-5 flex items-center justify-center gap-3">
          <a
            v-if="teacher.email"
            :href="`mailto:${teacher.email}`"
            class="w-9 h-9 rounded-lg bg-maroon-800/60 border border-maroon-700/50 flex items-center justify-center text-bone-400 hover:text-gold-400 hover:border-gold-500/40 transition-all"
            :aria-label="`Email ${teacher.name}`"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </a>
          <a
            v-if="teacher.profileURL"
            :href="teacher.profileURL"
            target="_blank"
            rel="noopener noreferrer"
            class="w-9 h-9 rounded-lg bg-maroon-800/60 border border-maroon-700/50 flex items-center justify-center text-bone-400 hover:text-gold-400 hover:border-gold-500/40 transition-all"
            :aria-label="`View ${teacher.name}'s profile`"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </a>
        </div>
      </article>
    </div>
  </div>
</template>
