<script setup>
const info = [
  { label: 'Full Name', value: 'Maestro Viotti' },
  { label: 'Email', value: 'maestro@resonanz.art' },
  { label: 'Phone', value: '+1 (555) 018-2733' },
  { label: 'Instrument', value: 'Piano · Composition' },
  { label: 'Level', value: 'Advanced · Faculty' },
  { label: 'Member Since', value: 'September 2019' },
]

const stats = [
  { label: 'Courses Teaching', value: '5' },
  { label: 'Recitals Hosted', value: '27' },
  { label: 'Awards', value: '9' },
]

const activity = [
  { title: 'Hosted Spring Student Recital', when: '2 days ago', icon: 'M9 19V6l12-3v13' },
  { title: 'Published new course: Harmony III', when: '1 week ago', icon: 'M12 6.253v13M5 6.253v13' },
  { title: 'Awarded "Educator of the Term"', when: '3 weeks ago', icon: 'M11.049 2.927c.3-1.04 1.808-1.04 2.107 0l1.79 6.2' },
  { title: 'Joined faculty review panel', when: '1 month ago', icon: 'M17 20h5v-2a4 4 0 00-3-3.87' },
]
</script>

<template>
  <div class="space-y-8">
    <!-- Profile banner -->
    <section v-reveal class="relative overflow-hidden rounded-2xl border border-maroon-700/60 bg-gradient-to-br from-maroon-800 via-maroon-850 to-maroon-900 p-6 sm:p-8">
      <div class="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-gold-500/12 blur-3xl animate-float"></div>
      <div class="absolute inset-0 gold-ring opacity-20 blur-2xl rounded-2xl"></div>
      <div class="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div class="relative flex-shrink-0">
          <div class="absolute inset-0 rounded-full bg-gradient-to-br from-gold-400 to-maroon-600 blur-md opacity-60 animate-glow"></div>
          <div class="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-gold-400 to-maroon-600 flex items-center justify-center text-3xl sm:text-4xl font-serif font-bold text-maroon-950 ring-4 ring-gold-500/20">M</div>
        </div>
        <div class="text-center sm:text-left flex-1">
          <p class="text-xs uppercase tracking-[0.3em] text-gold-400/80">Faculty Member</p>
          <h1 class="mt-1 text-2xl sm:text-3xl font-serif text-bone-100">Maestro Viotti</h1>
          <p class="text-bone-400 mt-1">Pianist · Composer · Educator</p>
          <div class="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
            <span class="px-3 py-1 rounded-full text-xs bg-gold-500/10 border border-gold-500/25 text-gold-300">Advanced</span>
            <span class="px-3 py-1 rounded-full text-xs bg-maroon-700/50 border border-maroon-600/40 text-bone-300">Senior Faculty</span>
          </div>
        </div>
        <button class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-maroon-950 font-semibold text-sm hover:shadow-lg hover:shadow-gold-500/30 transition-all flex-shrink-0">
          Edit Profile
        </button>
      </div>
    </section>

    <!-- Stats -->
    <div class="grid grid-cols-3 gap-4 sm:gap-6">
      <div v-for="(s, i) in stats" :key="s.label" v-reveal="i * 100" class="rounded-2xl border border-maroon-700/60 glass-card p-5 sm:p-6 text-center">
        <p class="text-2xl sm:text-3xl font-serif text-gold-gradient">{{ s.value }}</p>
        <p class="text-xs uppercase tracking-wider text-bone-500 mt-1">{{ s.label }}</p>
      </div>
    </div>

    <!-- Info + Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Info -->
      <div v-reveal class="rounded-2xl border border-maroon-700/60 glass-card p-6 sm:p-8">
        <h3 class="text-xl font-serif text-gold-gradient mb-5">Personal Information</h3>
        <dl class="space-y-1">
          <div v-for="(item, i) in info" :key="i" class="flex items-center justify-between py-3 border-b border-maroon-800/60 last:border-0 group">
            <dt class="text-bone-500 text-sm">{{ item.label }}</dt>
            <dd class="text-bone-200 text-sm font-medium group-hover:text-gold-300 transition-colors">{{ item.value }}</dd>
          </div>
        </dl>
      </div>

      <!-- Activity -->
      <div v-reveal="150" class="rounded-2xl border border-maroon-700/60 glass-card p-6 sm:p-8">
        <h3 class="text-xl font-serif text-gold-gradient mb-5">Recent Activity</h3>
        <ul class="space-y-1">
          <li v-for="(a, i) in activity" :key="i" class="flex items-start gap-4 p-3 rounded-xl hover:bg-maroon-800/50 transition-colors group">
            <span class="mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg bg-gold-500/10 border border-gold-500/25 flex items-center justify-center text-gold-400 group-hover:scale-110 transition-transform">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="a.icon" /></svg>
            </span>
            <div>
              <p class="text-bone-200 text-sm font-medium">{{ a.title }}</p>
              <p class="text-bone-500 text-xs mt-0.5">{{ a.when }}</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
