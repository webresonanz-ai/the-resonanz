import { onMounted, onUnmounted, ref } from 'vue'
import { subscribeToContent } from '@/firebase/content'

export function useContentCollection(collectionName, sortField, direction) {
  const items = ref([])
  const loading = ref(true)
  const error = ref('')
  let unsubscribe

  onMounted(() => {
    try {
      unsubscribe = subscribeToContent(
        collectionName,
        sortField,
        direction,
        (records) => {
          items.value = records
          loading.value = false
          error.value = ''
        },
        (err) => {
          error.value = err.message || 'Unable to load content from Firestore.'
          loading.value = false
        },
      )
    } catch (err) {
      error.value = err.message || 'Unable to load content from Firestore.'
      loading.value = false
    }
  })

  onUnmounted(() => unsubscribe?.())

  return { items, loading, error }
}
