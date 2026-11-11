<script setup>
import { ref } from 'vue'

const form = ref({ name: '', email: '', subject: '', message: '' })
const sent = ref(false)

const submit = () => {
  sent.value = true
  setTimeout(() => {
    sent.value = false
    form.value = { name: '', email: '', subject: '', message: '' }
  }, 2600)
}

const channels = [
  {
    label: 'Visit Us',
    value: 'Jl. Kertanegara No. 28\nJakarta Selatan, Indonesia',
    icon: 'M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    label: 'Call Us',
    value: '+62 21 720 1918\n+62 858 1414 2277',
    icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  },
  {
    label: 'Email Us',
    value: 'admin@theresonanz.com',
    icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8 M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    label: 'Office Hours',
    value: 'Mon - Sat · 09:00 - 18:00',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
]

const inputBase =
  'w-full bg-maroon-850/70 border border-maroon-700/60 rounded-xl px-3.5 py-2.5 text-sm text-bone-200 placeholder:text-bone-500 outline-none transition-all focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20'
</script>

<template>
  <div class="space-y-5 sm:space-y-8">
    <!-- Header -->
    <div v-reveal>
      <p class="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-1.5 sm:mb-2">Get in touch</p>
      <h1 class="text-2xl sm:text-4xl font-serif text-bone-100">Contact <span class="text-gold-gradient">Resonanz</span></h1>
      <p class="mt-2 text-[13px] sm:text-base text-bone-500 max-w-xl">Questions about enrolment, lessons or events? We would love to hear from you.</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <!-- Channels -->
      <div class="space-y-3 lg:col-span-1">
        <div
          v-for="(c, i) in channels"
          :key="i"
          v-reveal="i * 90"
          class="lift flex items-start gap-3 sm:gap-4 rounded-xl sm:rounded-2xl border border-maroon-700/60 glass-card p-3.5 sm:p-5"
        >
          <span class="flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-maroon-700/50 border border-gold-500/20 flex items-center justify-center text-gold-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="c.icon" /></svg>
          </span>
          <div>
            <p class="text-[10px] sm:text-xs uppercase tracking-wider text-bone-500">{{ c.label }}</p>
            <p class="text-bone-200 mt-1 text-[13px] sm:text-sm whitespace-pre-line leading-relaxed">{{ c.value }}</p>
          </div>
        </div>
      </div>

      <!-- Form -->
      <div v-reveal="200" class="lg:col-span-2 rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-7 lg:p-8 relative overflow-hidden">
        <div class="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-gold-500/8 blur-3xl"></div>
        <form @submit.prevent="submit" class="relative space-y-4 sm:space-y-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
            <div>
              <label class="block text-xs uppercase tracking-wider text-bone-500 mb-1.5">Name</label>
              <input v-model="form.name" type="text" required placeholder="Your name" :class="inputBase" />
            </div>
            <div>
              <label class="block text-xs uppercase tracking-wider text-bone-500 mb-1.5">Email</label>
              <input v-model="form.email" type="email" required placeholder="you@email.com" :class="inputBase" />
            </div>
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wider text-bone-500 mb-1.5">Subject</label>
            <input v-model="form.subject" type="text" required placeholder="What is this about?" :class="inputBase" />
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wider text-bone-500 mb-1.5">Message</label>
            <textarea v-model="form.message" required rows="5" placeholder="Tell us more…" :class="inputBase + ' resize-none'"></textarea>
          </div>
          <div class="flex items-center justify-between flex-wrap gap-3">
            <button
              type="submit"
              class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-maroon-950 font-semibold text-sm hover:shadow-lg hover:shadow-gold-500/30 hover:-translate-y-0.5 transition-all"
            >
              Send Message
            </button>
            <Transition name="fade">
              <span v-if="sent" class="text-emerald-400 text-sm flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                Message sent — thank you!
              </span>
            </Transition>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
