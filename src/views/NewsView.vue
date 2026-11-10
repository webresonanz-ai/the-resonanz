<script setup>
import { computed } from 'vue'
import { useContentCollection } from '@/composables/useContentCollection'

const { items: news, loading, error } = useContentCollection('news', 'date', 'desc')
const featured = computed(() => news.value.find((item) => item.featured))
const articles = computed(() => news.value.filter((item) => item.id !== featured.value?.id))

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : new Date(value)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
}
</script>

<template>
  <div class="space-y-5 sm:space-y-8">
    <div v-reveal>
      <p class="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-1.5 sm:mb-2">Latest</p>
      <h1 class="text-2xl sm:text-4xl font-serif text-bone-100">News &amp; <span class="text-gold-gradient">Stories</span></h1>
    </div>

    <div v-if="loading" class="rounded-2xl border border-maroon-700/60 glass-card p-5 sm:p-8 text-center text-bone-400">Loading news…</div>
    <div v-else-if="error" role="alert" class="rounded-2xl border border-rose-700/50 bg-rose-950/30 p-4 sm:p-5 text-rose-200">{{ error }}</div>
    <div v-else-if="!news.length" class="rounded-2xl border border-maroon-700/60 glass-card p-5 sm:p-8 text-center text-bone-400">
      No news articles have been published yet.
    </div>
    <template v-else>
      <article v-if="featured" v-reveal class="lift group relative overflow-hidden rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-7 lg:p-8">
        <div class="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-gold-500/12 blur-3xl group-hover:bg-gold-500/20 transition-colors duration-500"></div>
        <div class="relative">
          <div class="flex items-center gap-3 mb-4 flex-wrap">
            <span class="px-3 py-1 rounded-full text-xs uppercase tracking-wider bg-gold-500/15 text-gold-300 border border-gold-500/30">Featured · {{ featured.category }}</span>
            <span class="text-bone-500 text-xs">{{ formatDate(featured.date) }}<template v-if="featured.readTime"> · {{ featured.readTime }}</template></span>
          </div>
          <h2 class="text-xl sm:text-3xl font-serif text-bone-100 group-hover:text-gold-300 transition-colors leading-tight">{{ featured.title }}</h2>
          <p class="mt-3 text-[13px] sm:text-base text-bone-400 leading-relaxed max-w-2xl">{{ featured.excerpt }}</p>
        </div>
      </article>

      <div v-if="articles.length" class="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-6">
        <article
          v-for="(article, index) in articles"
          :key="article.id"
          v-reveal="index * 100"
          class="lift group rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-6"
        >
          <div class="flex items-center gap-3 mb-3">
            <span
              class="px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium border"
              :class="index % 2 === 0
                ? 'bg-gold-500/10 text-gold-300 border-gold-500/30'
                : 'bg-maroon-500/20 text-maroon-400 border-maroon-500/40'"
            >{{ article.category }}</span>
            <span class="text-bone-500 text-xs">{{ formatDate(article.date) }}</span>
          </div>
          <h3 class="text-base sm:text-lg font-serif text-bone-100 group-hover:text-gold-300 transition-colors leading-snug">{{ article.title }}</h3>
          <p class="mt-2 text-bone-500 text-[13px] sm:text-sm leading-relaxed">{{ article.excerpt }}</p>
        </article>
      </div>
    </template>
  </div>
</template>
