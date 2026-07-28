import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'
import { i18n } from '@/i18n'
import App from './App.vue'
import 'virtual:uno.css'
import '@/styles/main.css'

async function bootstrap(): Promise<void> {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)

  try {
    const savedLocale = await window.electronAPI.i18n.getLocale()
    i18n.global.locale.value = savedLocale as 'zh' | 'en'
  } catch {
    // use default locale
  }
  app.use(i18n)
  app.mount('#app')
}

bootstrap()
