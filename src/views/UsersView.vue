<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  ROLE_DESCRIPTIONS,
  USER_ROLES,
  subscribeToUsers,
  updateUserRole,
} from '@/firebase/users'

const authStore = useAuthStore()

const users = ref([])
const loading = ref(true)
const error = ref('')
const notice = ref('')
const search = ref('')
const roleFilter = ref('')
const savingUid = ref('')
let unsubscribe

const roleCounts = computed(() =>
  users.value.reduce(
    (counts, user) => {
      const role = USER_ROLES.includes(user.role) ? user.role : 'guest'
      counts[role] += 1
      return counts
    },
    { guest: 0, scanner: 0, admin: 0 },
  ),
)

const adminCount = computed(() => roleCounts.value.admin)

const filteredUsers = computed(() => {
  const term = search.value.trim().toLowerCase()
  return users.value.filter((user) => {
    const role = USER_ROLES.includes(user.role) ? user.role : 'guest'
    if (roleFilter.value && role !== roleFilter.value) return false
    if (!term) return true
    return [user.displayName, user.email, user.uid].some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(term),
    )
  })
})

function isSelf(user) {
  const uid = user.id || user.uid
  return uid && uid === authStore.user?.uid
}

function initials(user) {
  const base = user.displayName || user.email || '?'
  const parts = base.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

function roleOf(user) {
  return USER_ROLES.includes(user.role) ? user.role : 'guest'
}

function formatDate(value) {
  if (!value) return '—'
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function roleLockReason(user) {
  if (isSelf(user)) return 'You cannot change your own role.'
  if (roleOf(user) === 'admin' && adminCount.value <= 1) {
    return 'At least one admin must remain.'
  }
  return ''
}

async function onRoleChange(user, event) {
  const select = event.target
  const nextRole = select.value
  const uid = user.id || user.uid
  const previousRole = roleOf(user)

  if (nextRole === previousRole) return

  const reason = roleLockReason(user)
  if (reason) {
    select.value = previousRole
    error.value = reason
    return
  }

  savingUid.value = uid
  error.value = ''
  notice.value = ''
  try {
    await updateUserRole(uid, nextRole)
    notice.value = `${user.displayName || user.email || 'User'} is now ${nextRole}.`
  } catch (err) {
    select.value = previousRole
    error.value = err.message || 'Unable to update this user role.'
  } finally {
    savingUid.value = ''
  }
}

onMounted(() => {
  try {
    unsubscribe = subscribeToUsers(
      (records) => {
        users.value = records
        loading.value = false
      },
      (err) => {
        error.value = err.message || 'Unable to load users from Firestore.'
        loading.value = false
      },
    )
  } catch (err) {
    error.value = err.message || 'Unable to load users from Firestore.'
    loading.value = false
  }
})

onUnmounted(() => unsubscribe?.())
</script>

<template>
  <div class="space-y-5 sm:space-y-8">
    <header>
      <p class="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-1.5 sm:mb-2">
        Administration
      </p>
      <h1 class="text-2xl sm:text-4xl font-serif text-bone-100">
        User <span class="text-gold-gradient">Management</span>
      </h1>
      <p class="mt-2 text-[13px] sm:text-base text-bone-500 max-w-2xl">
        Review every account and adjust what each user is allowed to access.
      </p>
    </header>

    <div v-if="error" role="alert" class="rounded-xl border border-rose-700/50 bg-rose-950/30 p-3 sm:p-4 text-sm text-rose-200">
      {{ error }}
    </div>
    <div v-if="notice" role="status" class="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-3 sm:p-4 text-sm text-emerald-200">
      {{ notice }}
    </div>

    <div class="grid grid-cols-3 gap-2.5 sm:gap-4">
      <div
        v-for="role in USER_ROLES"
        :key="role"
        class="rounded-2xl border border-maroon-700/60 glass-card p-3.5 sm:p-5"
      >
        <p class="text-[10px] uppercase tracking-[0.2em] text-bone-500">{{ role }}</p>
        <p class="mt-1 text-xl sm:text-3xl font-serif text-gold-gradient">{{ roleCounts[role] }}</p>
      </div>
    </div>

    <section class="rounded-2xl border border-maroon-700/60 glass-card overflow-hidden">
      <div class="flex flex-col gap-3 sm:gap-4 p-4 sm:p-5 border-b border-maroon-700/50 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="text-base sm:text-lg font-serif text-bone-100">Accounts</h2>
          <p class="text-xs text-bone-500 mt-1">
            <template v-if="search || roleFilter">
              {{ filteredUsers.length }} of {{ users.length }} user{{ users.length === 1 ? '' : 's' }}
            </template>
            <template v-else>{{ users.length }} registered user{{ users.length === 1 ? '' : 's' }}</template>
          </p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label class="sr-only" for="user-role-filter">Filter by role</label>
          <select
            id="user-role-filter"
            v-model="roleFilter"
            class="w-full sm:w-44 rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold-500/60"
          >
            <option value="">All roles</option>
            <option v-for="role in USER_ROLES" :key="role" :value="role">{{ role }}</option>
          </select>
          <div class="relative w-full sm:w-64">
            <input
              v-model="search"
              type="search"
              placeholder="Search name or email…"
              class="w-full rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 placeholder:text-bone-500 outline-none focus:border-gold-500/60"
            />
          </div>
        </div>
      </div>

      <div v-if="loading" class="p-4 sm:p-6 text-bone-400">Loading users…</div>
      <div v-else-if="!users.length" class="p-4 sm:p-6 text-bone-400">
        No user accounts found yet. Users appear here after their first sign-in.
      </div>
      <div v-else-if="!filteredUsers.length" class="p-4 sm:p-6 text-bone-400">
        No users match your filters.
      </div>
      <ul v-else class="divide-y divide-maroon-800/70 max-h-[34rem] overflow-y-auto">
        <li
          v-for="user in filteredUsers"
          :key="user.id || user.uid"
          class="flex flex-col gap-3 p-3 sm:p-4 hover:bg-maroon-800/30 sm:flex-row sm:items-center"
        >
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <div class="flex w-10 h-10 flex-shrink-0 items-center justify-center rounded-full border border-gold-500/25 bg-gold-500/10 text-sm font-semibold text-gold-300">
              {{ initials(user) }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="text-sm font-medium text-bone-200 truncate">
                  {{ user.displayName || user.email || 'Unnamed user' }}
                </span>
                <span
                  v-if="isSelf(user)"
                  class="px-2 py-0.5 rounded-full border border-gold-500/25 bg-gold-500/5 text-[10px] uppercase tracking-wider text-gold-300"
                >You</span>
                <span
                  class="px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider"
                  :class="{
                    'border-gold-500/30 bg-gold-500/10 text-gold-300': roleOf(user) === 'admin',
                    'border-sky-500/30 bg-sky-500/10 text-sky-300': roleOf(user) === 'scanner',
                    'border-maroon-600/50 bg-maroon-800/40 text-bone-400': roleOf(user) === 'guest',
                  }"
                >{{ roleOf(user) }}</span>
              </div>
              <p class="text-xs text-bone-500 break-all mt-0.5">{{ user.email || '—' }}</p>
              <p class="text-[11px] text-bone-600 mt-1">
                Joined {{ formatDate(user.createdAt) }}
                <span class="text-bone-700">·</span>
                Last login {{ formatDate(user.lastLoginAt) }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 sm:flex-shrink-0">
            <label class="sr-only" :for="`role-${user.id || user.uid}`">Role</label>
            <select
              :id="`role-${user.id || user.uid}`"
              :value="roleOf(user)"
              :disabled="savingUid === (user.id || user.uid) || Boolean(roleLockReason(user))"
              :title="roleLockReason(user) || ROLE_DESCRIPTIONS[roleOf(user)]"
              class="w-full sm:w-36 rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-1.5 text-sm text-bone-200 outline-none focus:border-gold-500/60 disabled:cursor-not-allowed disabled:opacity-50"
              @change="onRoleChange(user, $event)"
            >
              <option v-for="role in USER_ROLES" :key="role" :value="role">{{ role }}</option>
            </select>
            <span v-if="savingUid === (user.id || user.uid)" class="text-xs text-bone-500">Saving…</span>
          </div>
        </li>
      </ul>
    </section>

    <p class="text-xs text-bone-500">
      Roles: <span class="text-bone-300">guest</span> — {{ ROLE_DESCRIPTIONS.guest }}
      <span class="text-bone-300">scanner</span> — {{ ROLE_DESCRIPTIONS.scanner }}
      <span class="text-bone-300">admin</span> — {{ ROLE_DESCRIPTIONS.admin }}
    </p>
  </div>
</template>
