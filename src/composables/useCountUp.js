import { ref, onMounted, onUnmounted } from 'vue'

/**
 * useCountUp — animates a number from 0 up to `target` using an
 * easeOutQuart curve. Returns a reactive ref that updates via rAF.
 *
 * @param {number} target  final value
 * @param {{ duration?: number, delay?: number }} options
 */
export function useCountUp(target, { duration = 1600, delay = 0 } = {}) {
  const current = ref(0)
  let rafId = null

  onMounted(() => {
    const startTime = performance.now() + delay

    const tick = (now) => {
      const elapsed = now - startTime
      if (elapsed < 0) {
        rafId = requestAnimationFrame(tick)
        return
      }
      const progress = Math.min(elapsed / duration, 1)
      // easeOutQuart for a smooth, decelerating luxury feel
      const eased = 1 - Math.pow(1 - progress, 4)
      current.value = Math.round(eased * target)
      if (progress < 1) rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
  })

  onUnmounted(() => {
    if (rafId) cancelAnimationFrame(rafId)
  })

  return current
}
