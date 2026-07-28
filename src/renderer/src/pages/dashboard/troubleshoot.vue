<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWizardStore } from '@/stores/wizard'

const props = withDefaults(defineProps<{ modal?: boolean }>(), { modal: false })
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const wizard = useWizardStore()
const items = ref<{ label: string; status: string; detail: string }[]>([])
const logs = ref<string[]>([])

async function run(): Promise<void> {
  items.value = [
    { label: 'OpenClaw', status: '...', detail: '...' },
    { label: t('troubleshoot.gatewayStatus'), status: '...', detail: '...' },
    { label: t('troubleshoot.portCheck'), status: '...', detail: '...' }
  ]

  try {
    const env = await window.electronAPI.env.check()
    items.value[0] = { label: 'OpenClaw', status: env.openclawInstalled ? 'ok' : 'error', detail: env.openclawInstalled ? `v${env.openclawVersion}` : t('common.status.notInstalled') }
  } catch { items.value[0] = { label: 'OpenClaw', status: 'error', detail: t('common.status.failed') } }

  try {
    const s = await window.electronAPI.gateway.status()
    items.value[1] = { label: t('troubleshoot.gatewayStatus'), status: s === 'running' ? 'ok' : 'warn', detail: t(`troubleshoot.${s}`, s) }
  } catch { items.value[1] = { label: t('troubleshoot.gatewayStatus'), status: 'error', detail: t('common.status.failed') } }

  try {
    const p = await window.electronAPI.troubleshoot.checkPort()
    items.value[2] = { label: t('troubleshoot.portCheck'), status: p.inUse ? 'ok' : 'warn', detail: p.inUse ? `18789${p.pid ? ` (PID ${p.pid})` : ''}` : t('troubleshoot.ok') }
  } catch { items.value[2] = { label: t('troubleshoot.portCheck'), status: 'error', detail: t('common.status.failed') } }
}

async function doctor(): Promise<void> {
  logs.value.push(t('troubleshoot.reDiagnose') + '...')
  const r = await window.electronAPI.troubleshoot.doctorFix()
  logs.value.push(r.success ? t('troubleshoot.ok') : t('troubleshoot.error'))
}

onMounted(run)
</script>

<template>
  <div class="space-y-5 -mt-12">
    <div class="space-y-1">
      <h2 v-if="!modal" class="text-xl font-bold text-white">{{ $t('troubleshoot.title') }}</h2>
      <p class="text-sm text-white/40">{{ $t('troubleshoot.envCheck') }}</p>
    </div>

    <div class="space-y-2">
      <div v-for="item in items" :key="item.label"
        class="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <span class="text-sm text-white/80">{{ item.label }}</span>
        <div class="flex items-center gap-2">
          <span class="text-xs text-white/40">{{ item.detail }}</span>
          <div :class="['w-1.5 h-1.5 rounded-full', item.status === 'ok' ? 'bg-green-500' : item.status === 'error' ? 'bg-red-500' : 'bg-yellow-500']" />
        </div>
      </div>
    </div>

    <div v-if="logs.length > 0"
      class="p-3 rounded-xl bg-black/30 border border-white/[0.06] max-h-28 overflow-y-auto font-mono text-[11px] text-white/30 space-y-1">
      <p v-for="(l, i) in logs" :key="i">{{ l }}</p>
    </div>

    <div class="flex gap-2">
      <button @click="modal ? emit('close') : wizard.prev()" class="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/[0.08] transition-all">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        {{ $t('common.button.back') }}
      </button>
      <button @click="doctor" class="flex-1 py-2.5 text-xs font-bold rounded-xl bg-white/[0.05] text-white/50 border border-white/[0.06] hover:bg-white/[0.08] transition-all">openclaw doctor --fix</button>
      <button @click="run" class="flex-1 py-2.5 text-xs font-bold rounded-xl bg-white/[0.05] text-white/50 border border-white/[0.06] hover:bg-white/[0.08] transition-all">{{ $t('troubleshoot.reDiagnose') }}</button>
    </div>
  </div>
</template>
