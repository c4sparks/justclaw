<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useWizardStore } from '@/stores/wizard'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const wizard = useWizardStore()

function handleStart(): void {
  wizard.goTo('setup')
  router.push('/setup')
}
</script>

<template>
  <div class="text-center space-y-10 py-12">

    <!-- Logo mark -->
    <div class="flex justify-center animate-[fadeIn_0.6s_ease-out]">
      <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-2xl shadow-primary/30 rotate-12 hover:rotate-0 hover:scale-105 transition-all duration-500">
        <span class="text-4xl font-black text-white -rotate-12 hover:rotate-0 transition-all duration-500">J</span>
      </div>
    </div>

    <div class="space-y-3" style="animation: fadeIn 0.6s ease-out 0.15s both;">
      <h1 class="text-4xl font-black tracking-tight text-white">
        Just<span class="text-primary">Claw</span>
      </h1>
      <p class="text-white/40 text-sm font-medium leading-relaxed max-w-xs mx-auto whitespace-pre-line">{{ $t('steps.welcome.desc') }}</p>
    </div>

    <button @click="handleStart"
      class="px-8 py-2.5 text-sm font-bold rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.08] text-white/80 hover:text-white transition-all"
      style="animation: fadeIn 0.6s ease-out 0.3s both;">
      {{ $t('steps.welcome.start') }}
    </button>

  </div>
</template>
