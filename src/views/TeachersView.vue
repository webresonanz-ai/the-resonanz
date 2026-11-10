<script setup>
const teachers = [
  { name: 'Eleanor Vance', specialty: 'Classical Piano', initials: 'EV', bio: 'Concert pianist with 20+ years on international stages.', hue: 'from-gold-400 to-maroon-600' },
  { name: 'Marcus Bellini', specialty: 'Violin & Strings', initials: 'MB', bio: 'Former first violinist of the Verona Chamber Orchestra.', hue: 'from-maroon-500 to-gold-700' },
  { name: 'Sofia Almeida', specialty: 'Voice & Opera', initials: 'SA', bio: 'Soprano and vocal coach trained at the Royal Academy.', hue: 'from-gold-500 to-maroon-500' },
  { name: 'Daniel Cho', specialty: 'Jazz Composition', initials: 'DC', bio: 'Award-winning composer blending jazz and modern harmony.', hue: 'from-maroon-600 to-gold-500' },
  { name: 'Amara Okonkwo', specialty: 'Cello & Chamber', initials: 'AO', bio: 'Cellist devoted to chamber and contemporary repertoire.', hue: 'from-gold-400 to-maroon-700' },
  { name: 'Henrik Larsen', specialty: 'Theory & Harmony', initials: 'HL', bio: 'Musicologist publishing on renaissance counterpoint.', hue: 'from-maroon-500 to-gold-600' },
]
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div v-reveal>
      <p class="text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-2">Faculty</p>
      <h1 class="text-3xl sm:text-4xl font-serif text-bone-100">Our <span class="text-gold-gradient">Masters</span></h1>
      <p class="mt-2 text-bone-500 max-w-xl">World-class performers and pedagogues devoted to shaping the next generation of artists.</p>
    </div>

    <!-- Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="(t, i) in teachers"
        :key="i"
        v-reveal="i * 100"
        class="lift group rounded-2xl border border-maroon-700/60 glass-card p-6 text-center relative overflow-hidden"
      >
        <!-- hover glow -->
        <div class="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style="background: radial-gradient(220px circle at 50% 0%, rgba(212,175,55,0.10), transparent 60%)"></div>

        <!-- Avatar -->
        <div class="relative inline-block mb-4">
          <div class="absolute inset-0 rounded-full bg-gradient-to-br from-gold-400 to-maroon-600 blur-md opacity-50 group-hover:opacity-80 transition-opacity duration-500"></div>
          <div
            class="relative w-24 h-24 rounded-full bg-gradient-to-br flex items-center justify-center text-2xl font-serif font-bold text-maroon-950 ring-2 ring-gold-500/30 group-hover:ring-gold-400/60 transition-all duration-500 group-hover:scale-105"
            :class="t.hue"
          >
            {{ t.initials }}
          </div>
        </div>

        <h3 class="text-xl font-serif text-bone-100 group-hover:text-gold-300 transition-colors">{{ t.name }}</h3>
        <p class="text-gold-400 text-sm mt-1 uppercase tracking-wider">{{ t.specialty }}</p>
        <p class="text-bone-500 text-sm mt-3 leading-relaxed">{{ t.bio }}</p>

        <!-- Social -->
        <div class="mt-5 flex items-center justify-center gap-3">
          <button class="w-9 h-9 rounded-lg bg-maroon-800/60 border border-maroon-700/50 flex items-center justify-center text-bone-400 hover:text-gold-400 hover:border-gold-500/40 transition-all" aria-label="Email">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </button>
          <button class="w-9 h-9 rounded-lg bg-maroon-800/60 border border-maroon-700/50 flex items-center justify-center text-bone-400 hover:text-gold-400 hover:border-gold-500/40 transition-all" aria-label="Profile">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
