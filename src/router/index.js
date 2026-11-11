import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // ---- Public dashboard routes (no login required) ----
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
    },
    {
      path: '/courses',
      name: 'courses',
      component: () => import('../views/CoursesView.vue'),
    },
    {
      path: '/schedules',
      name: 'schedules',
      component: () => import('../views/SchedulesView.vue'),
    },
    {
      path: '/teachers',
      name: 'teachers',
      component: () => import('../views/TeachersView.vue'),
    },
    {
      path: '/news',
      name: 'news',
      component: () => import('../views/NewsView.vue'),
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { admin: true },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('../views/UsersView.vue'),
      meta: { admin: true },
    },
    {
      path: '/audiences',
      name: 'audiences',
      component: () => import('../views/AudiencesView.vue'),
      meta: { scanner: true },
    },
    {
      path: '/scan',
      name: 'scan',
      component: () => import('../views/ScanView.vue'),
      meta: { scanner: true },
    },
    {
      path: '/contact',
      name: 'contact',
      component: () => import('../views/ContactView.vue'),
    },
    // ---- Auth routes (full-screen, no dashboard shell) ----
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { layout: 'auth', guest: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { layout: 'auth', guest: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  // Wait for the first auth-state snapshot so the UI renders the right state.
  await authStore.init()

  // The dashboard is public. Only bounce already-signed-in users away from
  // the login/register pages so they don't see them twice.
  if (to.meta.guest && authStore.isAuthenticated) {
    return { name: 'home' }
  }

  if (to.meta.admin && !authStore.isAdmin) {
    if (!authStore.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    return { name: 'home' }
  }

  if (to.meta.scanner && !authStore.isScanner) {
    if (!authStore.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    return { name: 'home' }
  }
})

export default router
