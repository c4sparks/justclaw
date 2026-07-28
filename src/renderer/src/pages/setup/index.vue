<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useWizardStore } from '@/stores/wizard'
import { useSettingsStore } from '@/stores/settings'
import { useInstallLogs } from '@/composables/useIpc'

const { t } = useI18n()
const router = useRouter()
const wizard = useWizardStore()
const settings = useSettingsStore()
const { logs, error, clearLogs } = useInstallLogs()

const phase = ref<'checking' | 'ready' | 'installing' | 'done' | 'failed'>('checking')
const steps = ref([
  { key: 'os', labelKey: 'steps.setup.os', status: 'done' as 'waiting' | 'doing' | 'done' | 'skip' | 'error', version: '' },
  { key: 'wsl', labelKey: 'steps.setup.wsl', status: 'waiting' as 'waiting' | 'doing' | 'done' | 'skip' | 'error', version: '' },
  { key: 'ubuntu', labelKey: 'steps.setup.ubuntu', status: 'waiting' as 'waiting' | 'doing' | 'done' | 'skip' | 'error', version: '' },
  { key: 'node', labelKey: 'steps.setup.nodejs', status: 'waiting' as 'waiting' | 'doing' | 'done' | 'skip' | 'error', version: '' },
  { key: 'openclaw', labelKey: 'steps.setup.openclaw', status: 'waiting' as 'waiting' | 'doing' | 'done' | 'skip' | 'error', version: '' },
])
const showRegistry = ref(false)
const customRegistry = ref('')
const needsWsl = ref(false)
const needsNode = ref(false)
const needsOc = ref(false)

function updateStep(key: string, status: 'waiting' | 'doing' | 'done' | 'skip' | 'error') {
  const s = steps.value.find(s => s.key === key)
  if (s) s.status = status
}

function setRegistry(url: string): void {
  settings.setNpmRegistry(url)
  customRegistry.value = ''
}

function setCustomRegistry(): void {
  if (customRegistry.value) settings.setNpmRegistry(customRegistry.value)
}

function stepLabel(s: { labelKey: string }): string {
  return t(s.labelKey)
}

function stepStatusLabel(status: string): string {
  const map: Record<string, string> = {
    waiting: t('steps.setup.missing'),
    doing: t('steps.setup.doing'),
    done: t('steps.setup.done'),
    error: t('steps.setup.error'),
    skip: t('steps.setup.skip'),
  }
  return map[status] || ''
}

const everythingReady = computed(() =>
  !needsWsl.value && !needsNode.value && !needsOc.value
)

onMounted(async () => {
  // First check if already configured
  const cfg = await window.electronAPI.config.read().catch(() => null)
  if (cfg?.config?.hasApiKey || cfg?.config?.provider) {
    if (cfg.config.provider) wizard.setProvider(cfg.config.provider as any)
    if (cfg.config.model) wizard.selectModel(cfg.config.model)
    wizard.currentStep = 'done'
    router.push('/done')
    return
  }

  const env = await window.electronAPI.env.check().catch(() => null)
  if (env) wizard.setEnvResult(env)

  needsWsl.value = env?.wslState !== undefined && env.wslState !== 'ready'
  needsNode.value = env ? !env.nodeVersionOk : false
  needsOc.value = env ? !env.openclawInstalled : false

  // Set versions for installed items
  steps.value[0].version = env?.osVersion ?? (env?.os === 'windows' ? 'Windows' : env?.os === 'macos' ? 'macOS' : 'Linux')
  const wslReady = env?.wslState === 'ready'
  if (!needsWsl.value) { updateStep('wsl', 'done') }
  steps.value[1].version = wslReady && env?.wslVersion ? `${env.wslVersion}` : ''
  if (wslReady) { updateStep('ubuntu', 'done'); steps.value[2].version = env?.distroVersion ? `Ubuntu ${env.distroVersion}` : 'Ubuntu' }
  else if (!needsWsl.value) { updateStep('ubuntu', 'done') }
  if (!needsNode.value) { updateStep('node', 'done'); steps.value[3].version = env?.nodeVersion ? `v${env.nodeVersion}` : '' }
  if (!needsOc.value) { updateStep('openclaw', 'done'); steps.value[4].version = env?.openclawVersion ? `v${env.openclawVersion}` : '' }

  if (everythingReady.value) {
    phase.value = 'ready'
    return
  }

  phase.value = 'ready'
})

async function runInstall(): Promise<void> {
  phase.value = 'installing'
  clearLogs()

  try {
    if (needsWsl.value && wizard.wslState) {
      updateStep('wsl', 'doing')
      updateStep('ubuntu', 'doing')
      const r = await window.electronAPI.wsl.install(wizard.wslState).catch(() => ({ success: false, error: 'WSL install failed' }))
      if (!r.success) { updateStep('wsl', 'error'); updateStep('ubuntu', 'error'); phase.value = 'failed'; return }
      if ((r as any).needsReboot) {
        await window.electronAPI.wizard.saveState({ step: 'setup', wslInstalled: true, timestamp: Date.now() })
        window.electronAPI.reboot()
        return
      }
      updateStep('wsl', 'done')
      updateStep('ubuntu', 'done')
      const envAfter = await window.electronAPI.env.check()
      wizard.setEnvResult(envAfter)
      steps.value[1].version = envAfter?.wslVersion ? `${envAfter.wslVersion}` : ''
      steps.value[2].version = envAfter?.distroVersion ? `Ubuntu ${envAfter.distroVersion}` : 'Ubuntu'
    }

    if (needsNode.value) {
      updateStep('node', 'doing')
      const r = await window.electronAPI.install.node()
      if (!r.success) { updateStep('node', 'error'); phase.value = 'failed'; return }
      updateStep('node', 'done')
      const envAfter = await window.electronAPI.env.check()
      wizard.setEnvResult(envAfter)
      steps.value[3].version = envAfter?.nodeVersion ? `v${envAfter.nodeVersion}` : ''
    }

    if (needsOc.value) {
      updateStep('openclaw', 'doing')
      const r = await window.electronAPI.install.openclaw(settings.npmRegistryArg)
      if (!r.success) { updateStep('openclaw', 'error'); phase.value = 'failed'; return }
      updateStep('openclaw', 'done')
      const envAfter = await window.electronAPI.env.check()
      wizard.setEnvResult(envAfter)
      steps.value[4].version = envAfter?.openclawVersion ? `v${envAfter.openclawVersion}` : ''
    }

    phase.value = 'done'
    setTimeout(() => wizard.goTo('config'), 800)
  } catch {
    phase.value = 'failed'
  }
}
</script>

<template>
  <div class="flex flex-col gap-5 -mt-12">

    <div class="space-y-1">
      <h2 class="text-xl font-bold text-white">{{ $t('steps.setup.title') }}</h2>
      <p class="text-sm text-white/40">{{ $t('steps.setup.desc') }}</p>
    </div>

    <!-- Checking... -->
    <div v-if="phase === 'checking'" class="glass-2 rounded-xl py-16 flex items-center justify-center">
      <span class="text-sm text-white/40">{{ $t('steps.welcome.checking') }}</span>
    </div>

    <!-- Install steps (shown when ready or installing) -->
    <div v-else class="glass-2 rounded-xl p-1 space-y-px">
      <div v-for="s in steps" :key="s.key"
        class="flex items-center gap-3 px-4 py-1.5 rounded-lg">
        <!-- OS row: info-only, no status dot -->
        <template v-if="s.key === 'os'">
          <div class="w-6 h-6 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-white/30">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <span class="text-sm text-white/80">{{ stepLabel(s) }}</span>
            <span v-if="s.version" class="ml-2 text-[11px] text-white/40 font-mono">{{ s.version }}</span>
          </div>
        </template>
        <!-- Installable rows -->
        <template v-else>
          <div :class="[
            'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-all',
            s.status === 'done' ? 'bg-green-500/20 text-green-400' :
            s.status === 'doing' ? 'bg-yellow-500/20 text-yellow-400 animate-pulse' :
            s.status === 'error' ? 'bg-red-500/20 text-red-400' :
            s.status === 'skip' ? 'bg-white/[0.03] text-white/20' :
            'bg-white/[0.03] text-white/30'
          ]">
            <span v-if="s.status === 'doing'" class="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" />
            <span v-else-if="s.status === 'done'">✓</span>
            <span v-else-if="s.status === 'error'">!</span>
            <span v-else-if="s.status === 'skip'">—</span>
            <span v-else>{{ steps.indexOf(s) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <span :class="['text-sm', s.status === 'skip' ? 'text-white/30' : 'text-white/80']">{{ stepLabel(s) }}</span>
            <span v-if="s.version" class="ml-2 text-[11px] text-white/40 font-mono">{{ s.version }}</span>
          </div>
          <span class="text-xs shrink-0"
            :class="s.status === 'doing' ? 'text-white/30 animate-pulse' : s.status === 'done' ? 'text-green-400' : s.status === 'error' ? 'text-red-400' : s.status === 'skip' ? 'text-white/20' : 'text-white/30'">{{ stepStatusLabel(s.status) }}</span>
        </template>
      </div>
    </div>

    <!-- Registry selector (shown when install fails) -->
    <div v-if="phase === 'failed' && !wizard.isWindows" class="glass-2 rounded-xl p-3 space-y-2">
      <button @click="showRegistry = !showRegistry" class="flex items-center gap-2 text-xs text-white/50 hover:text-white/70 transition-colors">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6" /></svg>
        {{ $t('steps.setup.registryTitle') }}
      </button>
      <div v-if="showRegistry" class="space-y-2 pt-1">
        <div class="flex gap-2">
          <button @click="setRegistry(settings.ALIBABA_MIRROR)" :class="['px-3 py-1.5 text-xs rounded-lg border transition-all', settings.npmRegistry === settings.ALIBABA_MIRROR ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:text-white/80']">{{ $t('steps.setup.registryAli') }}</button>
          <button @click="setRegistry(settings.OFFICIAL)" :class="['px-3 py-1.5 text-xs rounded-lg border transition-all', settings.npmRegistry === settings.OFFICIAL ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:text-white/80']">{{ $t('steps.setup.registryOfficial') }}</button>
        </div>
        <div class="flex gap-2">
          <input v-model="customRegistry" :placeholder="$t('steps.setup.registryPlaceholder')" class="flex-1 px-2 py-1.5 text-xs rounded-lg bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 focus:outline-none focus:border-primary/50" />
          <button @click="setCustomRegistry" :disabled="!customRegistry" class="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-white/80 border border-white/[0.08] disabled:opacity-40">{{ $t('steps.setup.registryCustom') }}</button>
        </div>
      </div>
    </div>

    <!-- Logs -->
    <div v-if="phase === 'installing' || phase === 'failed' || logs.length > 0"
      class="glass-1 rounded-xl p-3 max-h-36 overflow-y-auto font-mono text-[11px] text-white/70 leading-relaxed space-y-1 select-text toast-in">
      <p v-if="error" class="text-red-400">{{ error }}</p>
      <p v-for="(l, i) in logs" :key="i" class="text-white/50">{{ l }}</p>
      <p v-if="logs.length === 0 && phase === 'installing'" class="italic text-white/30">{{ $t('steps.setup.installing') }}</p>
    </div>

    <!-- Bottom bar -->
    <div class="flex items-center justify-between pt-3 border-t border-white/[0.06]">
      <button @click="wizard.goTo('welcome')"
        class="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/[0.08] transition-all duration-200">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        {{ $t('common.button.back') }}
      </button>

      <!-- Ready: show install or next button -->
      <button v-if="phase === 'ready' && !everythingReady" @click="runInstall"
        class="px-5 py-2 text-sm font-bold rounded-xl bg-white/5 border border-white/[0.08] text-white/80 hover:text-white hover:bg-white/10 transition-all inline-flex items-center gap-1.5">
        安装
      </button>
      <button v-else-if="phase === 'ready' && everythingReady" @click="wizard.goTo('config')"
        class="px-5 py-2 text-sm font-bold rounded-xl bg-white/5 text-white/80 hover:bg-white/10 border border-white/[0.08] transition-all inline-flex items-center gap-1.5">
        {{ $t('common.button.next') }}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>

      <!-- Failed: retry -->
      <button v-else-if="phase === 'failed'" @click="runInstall"
        class="px-5 py-2 text-sm font-bold rounded-xl bg-white/5 text-white/80 hover:bg-white/10 border border-white/[0.08] transition-all inline-flex items-center gap-1.5">
        {{ $t('steps.setup.retry') }}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>

      <!-- Installing: waiting text -->
      <div v-else-if="phase === 'installing'" class="text-xs text-white/30">{{ $t('steps.setup.installing') }}</div>
    </div>

  </div>
</template>
