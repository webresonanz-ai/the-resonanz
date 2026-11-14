<script setup>
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// Full-screen auth pages (login/register) skip the dashboard shell
const isAuthLayout = computed(() => route.meta.layout === 'auth')

/* ---- Responsive sidebar state ----
 * Desktop (lg+): `collapsed` toggles width (w-64 <-> w-20)
 * Mobile (< lg): `mobileOpen` slides an overlay sidebar in/out
 */
const collapsed = ref(false)
const mobileOpen = ref(false)
const isDesktop = ref(true)

const showText = computed(() =>
  isDesktop.value ? !collapsed.value : mobileOpen.value
)

// Hover/focus tooltip for the icon-only collapsed sidebar.
const navTooltip = ref(null)

const showNavTooltip = (item, event) => {
  if (showText.value) return
  const rect = event.currentTarget.getBoundingClientRect()
  navTooltip.value = {
    name: item.name,
    top: rect.top + rect.height / 2,
    left: rect.right + 10,
  }
}

const hideNavTooltip = () => {
  navTooltip.value = null
}

const toggleSidebar = () => {
  navTooltip.value = null
  if (isDesktop.value) collapsed.value = !collapsed.value
  else mobileOpen.value = !mobileOpen.value
}

const closeMobile = () => {
  navTooltip.value = null
  mobileOpen.value = false
}

const handleLogout = async () => {
  await authStore.logout()
  closeMobile()
  router.push({ name: 'login' })
}

let mql = null
const handleMQ = (e) => {
  isDesktop.value = e.matches
  if (e.matches) mobileOpen.value = false
}

onMounted(() => {
  isDesktop.value = window.matchMedia('(min-width: 1024px)').matches
  mql = window.matchMedia('(min-width: 1024px)')
  mql.addEventListener('change', handleMQ)
})
onUnmounted(() => {
  if (mql) mql.removeEventListener('change', handleMQ)
})

const navigation = [
  {
    name: 'Dashboard',
    path: '/',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    name: 'Profile',
    path: '/profile',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    name: 'Courses & Fee',
    path: '/courses',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  {
    name: 'Schedules',
    path: '/schedules',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    name: 'Teachers',
    path: '/teachers',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  },
  {
    name: 'News',
    path: '/news',
    icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
  },
  {
    name: 'Admin',
    path: '/admin',
    adminOnly: true,
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  },
  {
    name: 'Users',
    path: '/users',
    adminOnly: true,
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  },
  {
    name: 'Audiences',
    path: '/audiences',
    scannerOnly: true,
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    name: 'Contact',
    path: '/contact',
    icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
]
const navigationOrder = ['Dashboard', 'Courses & Fee', 'Schedules', 'Teachers', 'News', 'Contact', 'Admin', 'Users', 'Audiences']
const visibleNavigation = computed(() =>
  navigation
    .filter((item) => navigationOrder.includes(item.name) && (!item.adminOnly || authStore.isAdmin) && (!item.scannerOnly || authStore.isScanner))
    .sort((a, b) => navigationOrder.indexOf(a.name) - navigationOrder.indexOf(b.name))
)
</script>

<template>
  <div v-if="!authStore.initialized" class="relative flex min-h-screen items-center justify-center overflow-hidden bg-maroon-950 text-bone-200">
    <div class="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-maroon-500/15 blur-[120px]"></div>
    <div class="pointer-events-none absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full bg-gold-500/[0.07] blur-[140px]"></div>
    <div class="relative flex flex-col items-center px-6 text-center">
      <div class="relative flex h-28 w-28 items-center justify-center">
        <div class="absolute inset-0 rounded-full border border-gold-500/20"></div>
        <div class="absolute inset-1 rounded-full border border-transparent border-t-gold-300 animate-spin"></div>
        <div class="absolute inset-3 rounded-full border border-transparent border-b-gold-500/50 animate-spin" style="animation-direction: reverse; animation-duration: 2.6s"></div>
        <span class="font-serif text-5xl font-semibold text-gold-gradient">R</span>
      </div>
      <p class="mt-8 text-[10px] uppercase tracking-[0.5em] text-gold-400/80">The Resonanz Academy</p>
      <h1 class="mt-3 font-serif text-2xl sm:text-3xl text-bone-100">A moment before the music</h1>
      <p class="mt-3 text-sm text-bone-500">Preparing your space</p>
      <div class="mt-8 h-px w-32 overflow-hidden bg-maroon-700/70">
        <div class="h-full w-1/2 animate-pulse bg-gradient-to-r from-transparent via-gold-400 to-transparent"></div>
      </div>
    </div>
  </div>
  <!-- ===== Auth layout (full-screen, no shell) ===== -->
  <div v-else-if="isAuthLayout" class="min-h-screen bg-maroon-950">
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </div>

  <!-- ===== Dashboard layout ===== -->
  <div v-else class="flex h-screen overflow-hidden bg-maroon-950 text-bone-200 font-sans relative">
    <!-- Ambient background orbs -->
    <div class="pointer-events-none fixed inset-0 overflow-hidden z-0">
      <div class="absolute -top-40 -left-40 w-[30rem] h-[30rem] rounded-full bg-maroon-500/15 blur-[130px] animate-float"></div>
      <div class="absolute top-1/3 -right-32 w-[26rem] h-[26rem] rounded-full bg-gold-500/8 blur-[130px] animate-float" style="animation-delay: -3s"></div>
      <div class="absolute bottom-0 left-1/3 w-[24rem] h-[24rem] rounded-full bg-maroon-600/10 blur-[120px] animate-float" style="animation-delay: -5s"></div>
    </div>

    <!-- Mobile backdrop -->
    <Transition name="fade">
      <div
        v-if="mobileOpen"
        @click="closeMobile"
        class="fixed inset-0 bg-black/65 backdrop-blur-sm z-30 lg:hidden"
      ></div>
    </Transition>

    <!-- Sidebar -->
    <aside
      :class="[
        'bg-maroon-900/95 backdrop-blur-xl border-r border-maroon-700/50 flex flex-col transition-all duration-300 ease-out z-40',
        'fixed lg:static inset-y-0 left-0',
        mobileOpen ? 'translate-x-0 w-64 shadow-2xl shadow-black/60' : '-translate-x-full lg:translate-x-0',
        collapsed ? 'lg:w-20' : 'lg:w-64',
        'w-64',
      ]"
    >
      <!-- Logo -->
      <div class="h-16 lg:h-20 flex items-center justify-center border-b border-maroon-700/50 relative overflow-hidden flex-shrink-0">
        <div class="absolute inset-x-0 h-px top-1/2 bg-gradient-to-r from-transparent via-gold-500/40 to-transparent shimmer-line"></div>
        <Transition name="fade" mode="out-in">
          <h1
            v-if="showText"
            key="full"
            class="text-xl lg:text-2xl font-serif text-shimmer tracking-[0.22em] font-bold select-none"
          >
            RESONANZ
          </h1>
          <span
            v-else
            key="icon"
            class="text-2xl lg:text-3xl font-serif text-gold-gradient font-bold select-none"
          >
            R
          </span>
        </Transition>
      </div>

      <!-- Nav -->
      <nav class="flex-1 py-4 lg:py-6 space-y-1 px-2.5 lg:px-3 overflow-y-auto overflow-x-hidden" @scroll="hideNavTooltip">
        <RouterLink
          v-for="(item, index) in visibleNavigation"
          :key="item.name"
          :to="item.path"
          @click="closeMobile"
          @mouseenter="showNavTooltip(item, $event)"
          @mouseleave="hideNavTooltip"
          @focus="showNavTooltip(item, $event)"
          @blur="hideNavTooltip"
          class="nav-item group relative flex items-center px-3 py-2.5 rounded-xl text-bone-400 hover:text-gold-300 transition-all duration-300 animate-fade-in-up"
          exact-active-class="nav-active"
          :style="{ animationDelay: `${index * 70}ms` }"
        >
          <svg
            class="w-[1.1rem] h-[1.1rem] lg:w-5 lg:h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="item.icon" />
          </svg>
          <span
            v-if="showText"
            class="ml-3.5 font-medium tracking-wide text-[0.82rem] lg:text-sm whitespace-nowrap"
          >
            {{ item.name }}
          </span>
        </RouterLink>
      </nav>

      <!-- User card + login/logout -->
      <div v-if="showText" class="px-3 py-2.5 border-t border-maroon-700/50 flex-shrink-0">
        <div class="rounded-xl bg-gradient-to-br from-gold-500/10 to-transparent border border-gold-500/20 p-2.5">
          <template v-if="authStore.isAuthenticated">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-maroon-600 flex items-center justify-center text-maroon-950 text-xs font-bold flex-shrink-0">
                {{ authStore.initials }}
              </div>
              <p class="text-xs text-bone-300 truncate flex-1">{{ authStore.user?.email }}</p>
            </div>
            <button
              @click="handleLogout"
              class="mt-2.5 w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-maroon-800/60 hover:bg-maroon-700/70 border border-maroon-700/50 hover:border-rose-600/40 text-bone-400 hover:text-rose-300 text-xs font-medium transition-all"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Sign out
            </button>
          </template>

          <RouterLink
            v-else
            to="/login"
            class="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 text-maroon-950 text-sm font-semibold hover:shadow-lg hover:shadow-gold-500/20 transition-all"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
            Login
          </RouterLink>
        </div>
      </div>

      <!-- Toggle -->
      <button
        @click="toggleSidebar"
        class="p-3 lg:p-4 border-t border-maroon-700/50 text-bone-500 hover:text-gold-400 transition-colors group flex items-center justify-center flex-shrink-0"
        :aria-label="isDesktop ? 'Toggle sidebar width' : 'Toggle menu'"
      >
        <svg
          class="w-5 h-5 transition-transform duration-300 group-hover:scale-110"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            :d="(collapsed && isDesktop) ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7M19 19l-7-7 7-7'"
          />
        </svg>
      </button>
    </aside>

    <!-- Main content -->
    <main class="flex-1 flex flex-col overflow-hidden relative z-10 min-w-0">
      <!-- Header -->
      <header
        class="h-16 lg:h-20 glass border-b border-maroon-700/50 flex items-center justify-between px-3 sm:px-5 lg:px-8 z-20 sticky top-0 flex-shrink-0"
      >
        <div class="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <button
            @click="toggleSidebar"
            class="-ml-1 lg:hidden p-2 text-bone-400 hover:text-gold-400 transition-colors"
            aria-label="Open menu"
          >
            <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div class="min-w-0">
            <p class="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-bone-500 hidden sm:block">Music Academy</p>
            <h2 class="text-sm sm:text-lg lg:text-xl font-light text-bone-200 truncate">
              <template v-if="authStore.isAuthenticated">Welcome back, <span class="text-gold-gradient font-semibold">{{ authStore.displayName }}</span></template>
              <template v-else>Welcome to <span class="text-gold-gradient font-semibold">Resonanz</span></template>
            </h2>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-4 lg:gap-5 flex-shrink-0">
          <!-- Search (decorative, md+) -->
          <div class="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-maroon-850/70 border border-maroon-700/50 text-bone-500 w-44 lg:w-56">
            <svg class="w-4 h-4 text-bone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search…"
              class="bg-transparent outline-none text-sm text-bone-300 placeholder:text-bone-500 w-full"
            />
          </div>

          <template v-if="authStore.isAuthenticated">
            <!-- Notification -->
            <button class="relative p-2 text-bone-400 hover:text-gold-400 transition-colors" aria-label="Notifications">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-gold-500 rounded-full">
                <span class="ping-gold"></span>
              </span>
            </button>

            <!-- Avatar -->
            <div
              class="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-gold-400 to-maroon-600 flex items-center justify-center text-maroon-950 text-sm lg:text-base font-bold ring-2 ring-gold-500/30 hover:ring-gold-400/60 transition-all cursor-pointer select-none flex-shrink-0"
            >
              {{ authStore.initials }}
            </div>
          </template>

          <RouterLink
            v-else
            to="/login"
            class="px-4 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-maroon-950 font-semibold text-sm hover:shadow-lg hover:shadow-gold-500/30 hover:-translate-y-0.5 transition-all flex items-center gap-2 flex-shrink-0"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
            Login
          </RouterLink>
        </div>
      </header>

      <!-- Route content -->
      <div class="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8 relative">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </div>
    </main>

    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="navTooltip"
          role="tooltip"
          class="pointer-events-none fixed z-[70] -translate-y-1/2 whitespace-nowrap rounded-lg border border-maroon-700/60 bg-maroon-900/95 px-2.5 py-1.5 text-xs font-medium text-bone-200 shadow-lg shadow-black/50 backdrop-blur"
          :style="{ top: `${navTooltip.top}px`, left: `${navTooltip.left}px` }"
        >
          {{ navTooltip.name }}
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style>
/* Active nav link */
.nav-active {
  color: #f0d77b;
  background: linear-gradient(90deg, rgba(139, 26, 43, 0.4), rgba(139, 26, 43, 0.05));
}
.nav-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 58%;
  width: 3px;
  border-radius: 0 4px 4px 0;
  background: linear-gradient(180deg, #f0d77b, #d4af37);
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.7);
}
</style>
