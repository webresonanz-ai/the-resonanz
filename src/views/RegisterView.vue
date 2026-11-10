<script setup>
import { ref, reactive } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const form = reactive({ name: '', email: '', password: '', confirm: '' })
const showPassword = ref(false)
const errors = reactive({ name: '', email: '', password: '', confirm: '' })

const inputBase =
  'w-full bg-maroon-850/70 border rounded-xl px-3.5 py-2.5 text-sm text-bone-200 placeholder:text-bone-500 outline-none transition-all focus:ring-2 focus:ring-gold-500/20'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validate = () => {
  errors.name = ''
  errors.email = ''
  errors.password = ''
  errors.confirm = ''
  if (!form.name.trim()) errors.name = 'Name is required.'
  if (!form.email) errors.email = 'Email is required.'
  else if (!emailRegex.test(form.email)) errors.email = 'Please enter a valid email.'
  if (!form.password) errors.password = 'Password is required.'
  else if (form.password.length < 6) errors.password = 'Use at least 6 characters.'
  if (form.confirm !== form.password) errors.confirm = 'Passwords do not match.'
  return !errors.name && !errors.email && !errors.password && !errors.confirm
}

const handleSubmit = async () => {
  authStore.clearError()
  if (!validate()) return
  const ok = await authStore.register(form.name, form.email, form.password)
  if (ok) router.push(route.query.redirect || '/')
}

const googleSignUp = async () => {
  authStore.clearError()
  const ok = await authStore.loginWithGoogle()
  if (ok) router.push(route.query.redirect || '/')
}
</script>

<template>
  <div class="min-h-screen flex bg-maroon-950 text-bone-200 font-sans relative">
    <!-- ===== Brand panel (desktop) ===== -->
    <div class="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-maroon-800 via-maroon-850 to-maroon-950 flex-col justify-between p-8 xl:p-12 z-0">
      <div class="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-gold-500/12 blur-[120px] animate-float"></div>
      <div class="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-maroon-500/20 blur-[120px] animate-float" style="animation-delay: -3s"></div>
      <div class="absolute inset-0 gold-ring opacity-20 blur-3xl pointer-events-none"></div>

      <div class="relative flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-gold-400 to-maroon-600 flex items-center justify-center text-maroon-950 font-serif font-bold text-xl shadow-lg shadow-gold-500/20">R</div>
        <span class="text-2xl font-serif text-shimmer tracking-[0.22em] font-bold">RESONANZ</span>
      </div>

      <div class="relative">
        <p class="text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-4">Where artistry meets discipline</p>
        <h1 class="text-4xl xl:text-5xl font-serif text-bone-100 leading-tight">
          Join a community of <span class="text-shimmer">artists</span>.
        </h1>
        <p class="mt-6 text-bone-400 max-w-md leading-relaxed">
          Create your account and step into a dashboard designed for music educators and students alike.
        </p>
      </div>

      <div class="relative grid grid-cols-3 gap-4 text-center">
        <div><p class="text-2xl font-serif text-gold-gradient">124</p><p class="text-xs text-bone-500 uppercase tracking-wider mt-1">Students</p></div>
        <div><p class="text-2xl font-serif text-gold-gradient">08</p><p class="text-xs text-bone-500 uppercase tracking-wider mt-1">Faculty</p></div>
        <div><p class="text-2xl font-serif text-gold-gradient">27</p><p class="text-xs text-bone-500 uppercase tracking-wider mt-1">Recitals</p></div>
      </div>
    </div>

    <!-- ===== Form panel ===== -->
    <div class="flex-1 flex items-start sm:items-center justify-center px-5 py-8 sm:p-10 relative">
      <div class="absolute top-0 right-0 w-72 h-72 rounded-full bg-gold-500/8 blur-[120px] animate-float lg:hidden pointer-events-none"></div>

      <div class="w-full max-w-md relative animate-scale-in">
        <!-- Mobile logo -->
        <div class="lg:hidden flex items-center gap-2 justify-center mb-6">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-maroon-600 flex items-center justify-center text-maroon-950 font-serif font-bold">R</div>
          <span class="text-lg sm:text-xl font-serif text-shimmer tracking-[0.22em] font-bold">RESONANZ</span>
        </div>

        <h2 class="text-2xl sm:text-3xl font-serif text-bone-100">Create account</h2>
        <p class="mt-1.5 text-[13px] sm:text-base text-bone-500">Start your journey with Resonanz.</p>

        <!-- Not-configured notice -->
        <div v-if="!authStore.isConfigured" class="mt-4 flex items-start gap-2 rounded-xl bg-gold-500/10 border border-gold-500/30 px-3 py-2.5 text-bone-300 text-[13px] sm:text-sm">
          <svg class="w-4 h-4 mt-0.5 flex-shrink-0 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>Add your Firebase credentials to <code class="text-gold-300">.env</code> to enable sign-up.</span>
        </div>

        <!-- Auth error -->
        <Transition name="fade">
          <div v-if="authStore.error" class="mt-4 flex items-start gap-2 rounded-xl bg-rose-900/30 border border-rose-700/40 px-3 py-2.5 text-rose-300 text-[13px] sm:text-sm">
            <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            {{ authStore.error }}
          </div>
        </Transition>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="mt-5 space-y-3.5">
          <div>
            <label class="block text-[11px] sm:text-xs uppercase tracking-wider text-bone-500 mb-1.5">Full Name</label>
            <input v-model="form.name" type="text" placeholder="Your name" :class="[inputBase, errors.name ? 'border-rose-700/60' : 'border-maroon-700/60 focus:border-gold-500/50']" />
            <p v-if="errors.name" class="mt-1.5 text-xs text-rose-400">{{ errors.name }}</p>
          </div>

          <div>
            <label class="block text-[11px] sm:text-xs uppercase tracking-wider text-bone-500 mb-1.5">Email</label>
            <input v-model="form.email" type="email" placeholder="you@email.com" :class="[inputBase, errors.email ? 'border-rose-700/60' : 'border-maroon-700/60 focus:border-gold-500/50']" />
            <p v-if="errors.email" class="mt-1.5 text-xs text-rose-400">{{ errors.email }}</p>
          </div>

          <div>
            <label class="block text-[11px] sm:text-xs uppercase tracking-wider text-bone-500 mb-1.5">Password</label>
            <div class="relative">
              <input v-model="form.password" :type="showPassword ? 'text' : 'password'" placeholder="At least 6 characters" :class="[inputBase, 'pr-11', errors.password ? 'border-rose-700/60' : 'border-maroon-700/60 focus:border-gold-500/50']" />
              <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-bone-500 hover:text-gold-400 transition-colors" :aria-label="showPassword ? 'Hide password' : 'Show password'">
                <svg v-if="showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </button>
            </div>
            <p v-if="errors.password" class="mt-1.5 text-xs text-rose-400">{{ errors.password }}</p>
          </div>

          <div>
            <label class="block text-[11px] sm:text-xs uppercase tracking-wider text-bone-500 mb-1.5">Confirm Password</label>
            <input v-model="form.confirm" :type="showPassword ? 'text' : 'password'" placeholder="Re-enter password" :class="[inputBase, errors.confirm ? 'border-rose-700/60' : 'border-maroon-700/60 focus:border-gold-500/50']" />
            <p v-if="errors.confirm" class="mt-1.5 text-xs text-rose-400">{{ errors.confirm }}</p>
          </div>

          <button type="submit" :disabled="authStore.loading" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-maroon-950 font-semibold hover:shadow-lg hover:shadow-gold-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0">
            <span v-if="authStore.loading" class="flex items-center justify-center gap-2">
              <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Creating account…
            </span>
            <span v-else>Create Account</span>
          </button>
        </form>

        <!-- Divider -->
        <div class="flex items-center gap-3 my-4">
          <div class="flex-1 h-px bg-maroon-700/50"></div>
          <span class="text-xs text-bone-500 uppercase tracking-wider">or</span>
          <div class="flex-1 h-px bg-maroon-700/50"></div>
        </div>

        <!-- Google -->
        <button @click="googleSignUp" :disabled="authStore.loading" class="w-full py-2.5 rounded-xl bg-maroon-850/70 border border-maroon-700/60 hover:border-gold-500/40 hover:bg-maroon-800/70 text-bone-200 font-medium transition-all flex items-center justify-center gap-3 disabled:opacity-60">
          <svg class="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <p class="mt-5 text-center text-[13px] sm:text-sm text-bone-500">
          Already have an account?
          <RouterLink to="/login" class="text-gold-400 hover:text-gold-300 font-medium transition-colors">Sign in</RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>
