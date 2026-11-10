<script setup>
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()

const memberSince = computed(() => {
  const c = authStore.user?.createdAt
  if (!c) return 'September 2019'
  try {
    return new Date(c).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  } catch {
    return 'September 2019'
  }
})

const providerLabel = computed(() => {
  const p = authStore.user?.provider
  if (p === 'google.com') return 'Google'
  if (p === 'password') return 'Email'
  return '—'
})

const info = computed(() => [
  { label: 'Full Name', value: authStore.user?.displayName || '—' },
  { label: 'Email', value: authStore.user?.email || '—' },
  { label: 'Phone', value: '+1 (555) 018-2733' },
  { label: 'Instrument', value: 'Piano · Composition' },
  { label: 'Level', value: 'Advanced · Faculty' },
  { label: 'Member Since', value: memberSince.value },
  { label: 'Sign-in Method', value: providerLabel.value },
])

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

const handleLogout = async () => {
  await authStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="space-y-8">
    <!-- ===== Not signed in: prompt to log in ===== -->
    <div
      v-if="!authStore.isAuthenticated"
      v-reveal
      class="flex flex-col items-center justify-center text-center rounded-2xl border border-maroon-700/60 glass-card p-10 sm:p-16"
    >
      <div class="relative mb-6">
        <div class="absolute inset-0 rounded-full bg-gradient-to-br from-gold-400 to-maroon-600 blur-md opacity-50 animate-glow"></div>
        <div class="relative w-20 h-20 rounded-full bg-gradient-to-br from-gold-400 to-maroon-600 flex items-center justify-center text-maroon-950">
          <svg class="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        </div>
      </div>
      <h2 class="text-2xl sm:text-3xl font-serif text-bone-100">Sign in to view your profile</h2>
      <p class="mt-2 text-bone-500 max-w-sm leading-relaxed">
        Log in or create an account to see your personal information, stats and recent activity.
      </p>
      <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
        <RouterLink
          :to="{ name: 'login', query: { redirect: '/profile' } }"
          class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-maroon-950 font-semibold text-sm hover:shadow-lg hover:shadow-gold-500/30 hover:-translate-y-0.5 transition-all flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
          Login
        </RouterLink>
        <RouterLink
          :to="{ name: 'register', query: { redirect: '/profile' } }"
          class="px-6 py-2.5 rounded-xl bg-maroon-850/70 border border-maroon-700/60 hover:border-gold-500/40 text-bone-200 font-medium text-sm transition-all"
        >
          Create account
        </RouterLink>
      </div>
    </div>

    <!-- ===== Signed in: full profile ===== -->
    <template v-else>
      <!-- Profile banner -->
      <section v-reveal class="relative overflow-hidden rounded-2xl border border-maroon-700/60 bg-gradient-to-br from-maroon-800 via-maroon-850 to-maroon-900 p-6 sm:p-8">
        <div class="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-gold-500/12 blur-3xl animate-float"></div>
        <div class="absolute inset-0 gold-ring opacity-20 blur-2xl rounded-2xl"></div>
        <div class="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div class="relative flex-shrink-0">
            <div class="absolute inset-0 rounded-full bg-gradient-to-br from-gold-400 to-maroon-600 blur-md opacity-60 animate-glow"></div>
            <div class="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-gold-400 to-maroon-600 flex items-center justify-center text-3xl sm:text-4xl font-serif font-bold text-maroon-950 ring-4 ring-gold-500/20">
              {{ authStore.initials }}
            </div>
          </div>
          <div class="text-center sm:text-left flex-1 min-w-0">
            <p class="text-xs uppercase tracking-[0.3em] text-gold-400/80">Faculty Member</p>
            <h1 class="mt-1 text-2xl sm:text-3xl font-serif text-bone-100 truncate">{{ authStore.displayName }}</h1>
            <p class="text-bone-400 mt-1 truncate">{{ authStore.user?.email || '—' }}</p>
            <div class="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
              <span class="px-3 py-1 rounded-full text-xs bg-gold-500/10 border border-gold-500/25 text-gold-300">Advanced</span>
              <span class="px-3 py-1 rounded-full text-xs bg-maroon-700/50 border border-maroon-600/40 text-bone-300">Senior Faculty</span>
            </div>
          </div>
          <button @click="handleLogout" class="px-5 py-2.5 rounded-xl bg-maroon-800/60 hover:bg-maroon-700/70 border border-maroon-700/60 hover:border-rose-600/40 text-bone-300 hover:text-rose-300 font-medium text-sm transition-all flex items-center gap-2 flex-shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign out
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
            <div v-for="(item, i) in info" :key="i" class="flex items-center justify-between gap-4 py-3 border-b border-maroon-800/60 last:border-0 group">
              <dt class="text-bone-500 text-sm flex-shrink-0">{{ item.label }}</dt>
              <dd class="text-bone-200 text-sm font-medium text-right group-hover:text-gold-300 transition-colors truncate">{{ item.value }}</dd>
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
    </template>
  </div>
</template>
