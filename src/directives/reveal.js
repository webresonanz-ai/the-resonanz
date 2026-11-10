/**
 * v-reveal — scroll-triggered entrance animation.
 * Adds the `.reveal` class on mount and `.is-visible` once the
 * element scrolls into view (IntersectionObserver).
 *
 * Usage:
 *   <div v-reveal>...</div>
 *   <div v-reveal="200">...</div>   // 200ms stagger delay
 */
export const vReveal = {
  mounted(el, binding) {
    el.classList.add('reveal')
    const delay = Number(binding.value) || 0
    if (delay) el.style.transitionDelay = `${delay}ms`

    // Fallback for very old browsers / no IO support
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible')
      return
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add('is-visible')
            obs.unobserve(el)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )

    observer.observe(el)
    el._revealObserver = observer
  },
  unmounted(el) {
    if (el._revealObserver) {
      el._revealObserver.disconnect()
      el._revealObserver = null
    }
  }
}
