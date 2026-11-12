import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { vReveal } from './directives/reveal'
import './assets/main.css'

const app = createApp(App)

const blockInspect = () => {
  document.addEventListener(
    'contextmenu',
    (event) => {
      event.preventDefault()
    },
    { capture: true }
  )

  document.addEventListener(
    'keydown',
    (event) => {
      const key = event.key.toLowerCase()
      const isInspectShortcut =
        event.key === 'F12' ||
        (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (event.metaKey && event.altKey && key === 'i') ||
        (event.ctrlKey && key === 'u')

      if (isInspectShortcut) {
        event.preventDefault()
        event.stopPropagation()
        return false
      }
    },
    { capture: true }
  )
}

blockInspect()

app.use(createPinia())
app.use(router)
app.directive('reveal', vReveal)

app.mount('#app')
