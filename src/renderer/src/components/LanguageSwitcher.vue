<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

const languages = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' }
]

async function setLanguage(code: string): Promise<void> {
  locale.value = code
  try {
    await window.electronAPI.i18n.setLanguage(code)
  } catch {
    /* persist silently */
  }
}
</script>

<template>
  <div class="flex gap-1 rounded-lg p-0.5">
    <button
      v-for="lang in languages"
      :key="lang.code"
      @click="setLanguage(lang.code)"
      :class="[
        'px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all',
        locale === lang.code
          ? 'bg-blue-400/15 border-blue-400/40 text-blue-400'
          : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
      ]"
    >
      {{ lang.label }}
    </button>
  </div>
</template>
