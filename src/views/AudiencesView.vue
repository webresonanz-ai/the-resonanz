<script setup>
import AdminAudiences from '@/components/AdminAudiences.vue'
</script>

<template>
  <div class="space-y-5 sm:space-y-8">
    <header>
      <p class="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-1.5 sm:mb-2">
        Check-in
      </p>
      <h1 class="text-2xl sm:text-4xl font-serif text-bone-100">
        Workshop <span class="text-gold-gradient">Audiences</span>
      </h1>
      <p class="mt-2 text-[13px] sm:text-base text-bone-500 max-w-2xl">
        Browse registered guests, filter by workshop, and track who has already been checked in.
      </p>
    </header>

    <AdminAudiences />
  </div>
</template>
