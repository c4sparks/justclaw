<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useWizardStore } from '@/stores/wizard'
import { useGatewayStore } from '@/stores/gateway'
import StepIndicator from '@/components/StepIndicator.vue'
import SettingsModal from '@/components/SettingsModal.vue'

const router = useRouter()
const wizard = useWizardStore()
const gateway = useGatewayStore()
const showSettings = ref(false)

// ── Drag for settings button (vertical only, with settle transition) ──
const gearY = ref(0)
const gearActive = ref(false)
const gearDragging = ref(false)
const gearMoved = ref(false)

const BTN_H = 36
const PAD = 4

const gearStyle = computed(() => {
  if (!gearActive.value) return { right: '16px', top: '50%' }
  return {
    right: '16px',
    top: 0,
    transform: `translateY(${gearY.value}px)`,
    willChange: 'transform',
    transition: gearDragging.value ? 'none' : 'transform 0.15s ease-out'
  }
})

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

function onGearDown(e: MouseEvent): void {
  if (e.button !== 0) return
  gearMoved.value = false
  const btn = e.currentTarget as HTMLElement

  if (!gearActive.value) {
    const rect = btn.getBoundingClientRect()
    gearY.value = rect.top
    gearActive.value = true
  }

  gearDragging.value = true
  const startY = e.clientY
  const offsetY = e.clientY - gearY.value
  const maxY = window.innerHeight - BTN_H - PAD

  const onMove = (ev: MouseEvent) => {
    if (Math.abs(ev.clientY - startY) > 4) gearMoved.value = true
    gearY.value = clamp(ev.clientY - offsetY, PAD, maxY)
  }

  const onUp = () => {
    gearDragging.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove, { passive: true })
  document.addEventListener('mouseup', onUp)
}

function onGearClick(): void {
  if (!gearMoved.value) showSettings.value = true
}

const route = useRoute()
const showIndicator = computed(() => {
  const name = route.name as string
  return name === 'setup' || name === 'config' || name === 'done'
})

const showGear = computed(() => true)

watch(() => wizard.currentStep, (step) => {
  if (step === 'troubleshoot') router.push('/dashboard/troubleshoot')
  else router.push(`/${step}`)
})

onMounted(async () => {
  try { wizard.version = await window.electronAPI.version() } catch {}
  wizard.isWindows = navigator.userAgent.includes('Windows')
  try {
    const env = await window.electronAPI.env.check()
    wizard.setEnvResult(env)
  } catch {}
  try { gateway.subscribe() } catch {}
})
</script>

<template>
  <div class="h-full flex flex-col bg-surface overflow-hidden">
    <StepIndicator v-if="showIndicator" :current-step="wizard.currentStep" />

    <button v-if="showGear" @mousedown.prevent="onGearDown" @click="onGearClick"
      class="fixed z-40 w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.08] hover:border-primary/30 select-none transition-colors duration-150"
      :class="gearDragging ? 'cursor-grabbing' : 'cursor-pointer'"
      :style="gearStyle"
      :title="$t('settings.title')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>

    <SettingsModal v-if="showSettings" @close="showSettings = false" />

    <div class="flex-1 flex items-center justify-center p-6 bg-ambient">
      <div class="w-full max-w-lg">
        <router-view />
      </div>
    </div>

  </div>
</template>
