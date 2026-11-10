import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
    { path: '/courses', name: 'courses', component: () => import('../views/CoursesView.vue') },
    { path: '/schedules', name: 'schedules', component: () => import('../views/SchedulesView.vue') },
    { path: '/teachers', name: 'teachers', component: () => import('../views/TeachersView.vue') },
    { path: '/news', name: 'news', component: () => import('../views/NewsView.vue') },
    { path: '/contact', name: 'contact', component: () => import('../views/ContactView.vue') },
  ]
})

export default router