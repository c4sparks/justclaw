<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  title: string
  phase: string | null
  message?: string
  errorMsg?: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <div v-if="phase" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="w-full max-w-sm mx-4 p-6 space-y-4 rounded-2xl bg-surface/95 backdrop-blur-xl border border-white/[0.10] shadow-2xl">
      <h3 class="text-base font-bold text-white">{{ title }}</h3>

      <!-- Confirm phase: show child content via slot -->
      <div v-if="phase === 'confirm'">
        <slot />
      </div>

      <!-- Progress phase -->
      <div v-else-if="phase === 'progress'" class="flex items-center gap-3">
        <svg class="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
        <p class="text-sm text-white/60">{{ message || t('common.status.installing') }}</p>
      </div>

      <!-- Done phase -->
      <div v-else-if="phase === 'done'" class="space-y-3">
        <p class="text-sm text-green-400 font-medium">{{ message || t('common.status.completed') }}</p>
        <button @click="emit('close')" class="px-4 py-2 text-xs font-bold rounded-xl bg-white/[0.05] text-white/50 border border-white/[0.06] hover:bg-white/[0.08] transition-all">{{ t('common.button.back') }}</button>
      </div>

      <!-- Error phase -->
      <div v-else-if="phase === 'error'" class="space-y-3">
        <p class="text-sm text-red-400">{{ errorMsg || t('common.status.failed') }}</p>
        <button @click="emit('close')" class="px-4 py-2 text-xs font-bold rounded-xl bg-white/[0.05] text-white/50 border border-white/[0.06] hover:bg-white/[0.08] transition-all">{{ t('common.button.back') }}</button>
      </div>
    </div>
  </div>
</template>
