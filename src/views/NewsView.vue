<script setup>
const featured = {
  category: 'Announcement',
  title: 'Resonanz Wins National Conservatory Excellence Award',
  excerpt: 'Our faculty and students were recognised among the top music academies of the year, honouring a decade of artistic achievement.',
  date: 'Nov 02, 2026',
  read: '4 min read',
}

const news = [
  { category: 'Event', title: 'Spring Gala 2026 — Programme Revealed', excerpt: 'An evening of chamber works, solo recitals and a world premiere by our composition class.', date: 'Oct 28, 2026', accent: 'gold' },
  { category: 'Faculty', title: 'Dr. Eleanor Vance Joins the Piano Faculty', excerpt: 'The celebrated concert pianist brings her touring repertoire and pedagogy to Resonanz.', date: 'Oct 21, 2026', accent: 'maroon' },
  { category: 'Student', title: 'Three Students Advance to International Finals', excerpt: 'Our violinists earned spots at the prestigious Young Artists Competition finals in Vienna.', date: 'Oct 15, 2026', accent: 'gold' },
  { category: 'Campus', title: 'New Practice Wing Opens This Winter', excerpt: 'Eight soundproofed studios with recording capability will be available for booking.', date: 'Oct 09, 2026', accent: 'maroon' },
]
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div v-reveal>
      <p class="text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-2">Latest</p>
      <h1 class="text-3xl sm:text-4xl font-serif text-bone-100">News &amp; <span class="text-gold-gradient">Stories</span></h1>
    </div>

    <!-- Featured -->
    <article v-reveal class="lift group relative overflow-hidden rounded-2xl border border-maroon-700/60 glass-card p-6 sm:p-8 cursor-pointer">
      <div class="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-gold-500/12 blur-3xl group-hover:bg-gold-500/20 transition-colors duration-500"></div>
      <div class="relative">
        <div class="flex items-center gap-3 mb-4">
          <span class="px-3 py-1 rounded-full text-xs uppercase tracking-wider bg-gold-500/15 text-gold-300 border border-gold-500/30">Featured · {{ featured.category }}</span>
          <span class="text-bone-500 text-xs">{{ featured.date }} · {{ featured.read }}</span>
        </div>
        <h2 class="text-2xl sm:text-3xl font-serif text-bone-100 group-hover:text-gold-300 transition-colors leading-tight">{{ featured.title }}</h2>
        <p class="mt-3 text-bone-400 leading-relaxed max-w-2xl">{{ featured.excerpt }}</p>
        <span class="mt-5 inline-flex items-center gap-2 text-gold-400 text-sm font-medium">
          Read article
          <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" /></svg>
        </span>
      </div>
    </article>

    <!-- Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <article
        v-for="(n, i) in news"
        :key="i"
        v-reveal="i * 100"
        class="lift group rounded-2xl border border-maroon-700/60 glass-card p-6 cursor-pointer"
      >
        <div class="flex items-center gap-3 mb-3">
          <span
            class="px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium border"
            :class="n.accent === 'gold'
              ? 'bg-gold-500/10 text-gold-300 border-gold-500/30'
              : 'bg-maroon-500/20 text-maroon-400 border-maroon-500/40'"
          >
            {{ n.category }}
          </span>
          <span class="text-bone-500 text-xs">{{ n.date }}</span>
        </div>
        <h3 class="text-lg font-serif text-bone-100 group-hover:text-gold-300 transition-colors leading-snug">{{ n.title }}</h3>
        <p class="mt-2 text-bone-500 text-sm leading-relaxed">{{ n.excerpt }}</p>
        <span class="mt-4 inline-flex items-center gap-1 text-gold-400/80 text-xs group-hover:text-gold-300 transition-colors">
          Continue reading
          <svg class="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" /></svg>
        </span>
      </article>
    </div>
  </div>
</template>
