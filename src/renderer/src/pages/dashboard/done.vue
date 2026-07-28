<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWizardStore } from '@/stores/wizard'
import { useGatewayStore } from '@/stores/gateway'
import { useGatewayLogs } from '@/composables/useIpc'
import { useManagement } from '@/composables/useManagement'
import ManagementModal from '@/components/ManagementModal.vue'
import ModalShell from '@/components/ModalShell.vue'
import TroubleshootPage from '@/pages/dashboard/troubleshoot.vue'

const { t, locale } = useI18n()
const wizard = useWizardStore()
const gateway = useGatewayStore()
const { logs: gwLogs } = useGatewayLogs()
const mgmt = useManagement()

const autoLaunch = ref(false)
const showReport = ref(false)
const reportText = ref('')

const gwStatusText = computed(() => {
  const _ = locale.value
  if (gateway.status === 'running') return t('management.done.gatewayRunning')
  if (gateway.status === 'starting') return t('management.done.gatewayStarting')
  return t('management.done.gatewayStopped')
})

const errorLogCount = computed(() => gwLogs.value.filter(l => l.includes('[gw:err]')).length)
const restartCount = computed(() => gwLogs.value.filter(l => l.includes('starting') || l.includes('restart')).length)

onMounted(async () => {
  wizard.currentStep = 'done'
  for (let i = 0; i < 15; i++) {
    const s = await window.electronAPI.gateway.status()
    if (s === 'running') { gateway.status = 'running'; break }
    await new Promise(r => setTimeout(r, 2000))
  }
  try { const al = await window.electronAPI.autoLaunch.get(); autoLaunch.value = al.enabled } catch {}
})

async function toggleAuto(): Promise<void> {
  const next = !autoLaunch.value; await window.electronAPI.autoLaunch.set(next); autoLaunch.value = next
}

async function collectReport(): Promise<void> {
  const d = await window.electronAPI.report.collect(); reportText.value = d.text; showReport.value = true
}
function copyReport(): void { window.electronAPI.report.copy(reportText.value) }
const showTroubleshoot = ref(false)
const gwBusy = ref(false)

async function execGw(fn: () => Promise<unknown>): Promise<void> {
  if (gwBusy.value) return
  gwBusy.value = true
  try {
    await fn()
    // Refresh status immediately so buttons update without waiting for IPC event
    await gateway.refreshStatus()
  } catch { /* handled by store */ }
  finally { gwBusy.value = false }
}

async function goBack(): Promise<void> {
  const env = await window.electronAPI.env.check().catch(() => null)
  const needsInstall = env && (env.wslState !== undefined && env.wslState !== 'ready' || !env.nodeVersionOk || !env.openclawInstalled)
  if (needsInstall) {
    wizard.goTo('setup')
  } else {
    wizard.goTo('config')
  }
}

function goToOpenClawWeb(): void {
  window.electronAPI.openclaw.getDashboardUrl().then(url => {
    window.electronAPI.openExternal(url)
  })
}
function formatGwLog(l: string): string {
  return l.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})\.\d{3}[+-]\d{2}:\d{2}/g, '$1 $2')
    .replace(/\[gateway\]/g, '')
    .trim()
}
</script>

<template>
  <div class="space-y-4 -mt-20">

    <!-- Title -->
    <h2 class="text-xl font-bold text-white">
      {{ $t('management.done.title') }}
    </h2>

    <!-- Dashboard row: status + quick actions -->
    <div class="grid grid-cols-2 gap-4">
      <!-- Left: Gateway Status -->
      <div :class="['glass-2 rounded-xl p-4 transition-all duration-300',
        gateway.health === 'failed' ? '!border-red-500/30 !bg-red-500/5' :
        gateway.health === 'restarting' ? '!border-yellow-500/30 !bg-yellow-500/5' :
        gateway.status === 'running' ? '!border-primary/20 glow-primary' : '']">
        <div class="flex items-start gap-3">
          <div :class="[
            'w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-all',
            gateway.status === 'running' ? 'bg-green-500/20 text-green-400' :
            gateway.status === 'starting' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-white/30'
          ]">{{ gateway.status === 'running' ? '✓' : gateway.status === 'starting' ? '⏳' : '⏹' }}</div>
          <div class="flex-1 min-w-0 space-y-1">
            <div class="flex items-center gap-2">
              <div :class="['w-2 h-2 rounded-full', gateway.status === 'running' ? 'bg-green-500 glow-green' : gateway.status === 'starting' ? 'bg-yellow-500' : 'bg-white/20']" />
              <span class="text-sm font-bold text-white/90 truncate">{{ gwStatusText }}</span>
              <span v-if="gateway.health === 'restarting'" class="text-[10px] text-yellow-500 font-medium shrink-0 ml-auto">{{ $t('management.done.gatewayRestarting') }}</span>
            </div>
            <p class="text-[10px] text-white/40 whitespace-nowrap">Gateway · Port 18789</p>
          </div>
        </div>
        <!-- Metrics -->
        <div class="flex items-center gap-3 mt-2 pt-2 border-t border-white/[0.06]">
          <div class="flex items-center gap-1.5">
            <div class="w-1.5 h-1.5 rounded-full bg-red-400/60" />
            <span class="text-[10px] text-white/40">Errors <span class="text-white/60 font-semibold">{{ errorLogCount }}</span></span>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="w-1.5 h-1.5 rounded-full bg-yellow-400/60" />
            <span class="text-[10px] text-white/40">Restarts <span class="text-white/60 font-semibold">{{ restartCount }}</span></span>
          </div>
        </div>
        <!-- Gateway error detail (below metrics) -->
        <div v-if="gateway.health === 'failed' && gateway.error" class="mt-1.5 pt-1.5 border-t border-white/[0.04]">
          <p class="text-[10px] text-red-400/70 leading-relaxed">{{ gateway.error }}</p>
        </div>
      </div>

      <!-- Right: Quick Actions -->
      <div class="glass-2 rounded-xl p-4 flex flex-col gap-2">
        <a href="http://127.0.0.1:18789" @click.prevent="goToOpenClawWeb"
          class="flex items-center justify-center gap-2.5 w-full py-3 rounded-lg bg-white/5 border border-white/[0.08] text-white/80 hover:bg-white/10 hover:text-white transition-all text-sm font-bold no-underline">
          <span class="text-lg">🌐</span>
          OpenClaw Web
        </a>
        <div class="flex gap-2">
          <template v-if="gateway.status === 'running'">
            <button @click="execGw(() => gateway.restart())"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg glass-1 text-white/80 hover:text-white hover:bg-white/[0.08] transition-all text-base font-bold"
              :class="gwBusy ? 'opacity-50 pointer-events-none' : ''">
              {{ $t('management.done.restartBtn') }}
              <span v-if="gwBusy" class="w-3 h-3 rounded-full border-2 border-white/30 border-t-white/80 animate-spin shrink-0" />
            </button>
            <button @click="execGw(() => gateway.stop())"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg glass-1 text-white/80 hover:text-red-400 hover:bg-red-500/10 transition-all text-base font-bold"
              :class="gwBusy ? 'opacity-50 pointer-events-none' : ''">
              {{ $t('management.done.stopBtn') }}
              <span v-if="gwBusy" class="w-3 h-3 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin shrink-0" />
            </button>
          </template>
          <button v-else @click="execGw(() => gateway.start())"
            class="flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-lg transition-all text-base font-bold"
            :class="gwBusy ? 'opacity-50 pointer-events-none bg-white/5 border border-white/[0.08] text-white/80' : 'bg-white/5 border border-white/[0.08] text-white/80 hover:bg-green-400/10 hover:text-green-400 hover:border-green-400/30'">
            <span class="text-lg">▶</span>
            {{ $t('management.done.startBtn') }}
            <span v-if="gwBusy" class="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
          </button>
        </div>
      </div>
    </div>

    <!-- Tools grid -->
    <div class="grid grid-cols-4 gap-2">
      <button @click="toggleAuto"
        class="glass-1 rounded-xl py-1.5 px-2 flex items-center hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200">
        <span class="text-sm font-semibold text-white/80 hover:text-white transition-colors truncate">{{ $t('management.done.autoLaunch') }}</span>
        <div :class="['w-9 h-5 rounded-full p-0.5 ml-auto shrink-0 transition-colors', autoLaunch ? 'bg-green-500' : 'bg-white/10']">
          <div :class="['w-4 h-4 rounded-full bg-white shadow-sm transition-transform', autoLaunch ? 'translate-x-4' : 'translate-x-0']" />
        </div>
      </button>
      <button @click="showTroubleshoot = true"
        class="glass-1 rounded-xl py-1.5 px-2 text-center hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200">
        <span class="text-sm font-semibold text-white/80 hover:text-white transition-colors">{{ $t('management.done.troubleshoot') }}</span>
      </button>
      <button @click="collectReport"
        class="glass-1 rounded-xl py-1.5 px-2 text-center hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200">
        <span class="text-sm font-semibold text-white/80 hover:text-white transition-colors">{{ $t('management.done.reportLabel') }}</span>
      </button>
      <button @click="mgmt.executeBackup()"
        class="glass-1 rounded-xl py-1.5 px-2 text-center hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200">
        <span class="text-sm font-semibold text-white/80 hover:text-white transition-colors">{{ $t('management.done.settingsBackup') }}</span>
      </button>
      <button @click="mgmt.openRestore()"
        class="glass-1 rounded-xl py-1.5 px-2 text-center hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200">
        <span class="text-sm font-semibold text-white/80 hover:text-white transition-colors">{{ $t('management.done.restore') }}</span>
      </button>
      <button @click="mgmt.openReset()"
        class="glass-1 rounded-xl py-1.5 px-2 text-center hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200">
        <span class="text-sm font-semibold text-white/80 hover:text-white transition-colors">{{ $t('management.done.reset') }}</span>
      </button>
      <button @click="mgmt.openUninstall()"
        class="glass-1 rounded-xl py-1.5 px-2 text-center hover:bg-white/[0.08] hover:border-red-500/20 transition-all duration-200">
        <span class="text-sm font-semibold text-red-400/50 hover:text-red-400 transition-colors">{{ $t('management.done.delete') }}</span>
      </button>
      <button @click="goBack()" :disabled="gateway.status === 'running' || gateway.status === 'starting'"
        class="glass-1 rounded-xl py-1.5 px-2 text-center hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed">
        <span class="text-sm font-semibold text-white/80 hover:text-white transition-colors">{{ $t('common.button.back') }}</span>
      </button>
    </div>

    <!-- Gateway Logs -->
    <div v-if="gwLogs.length > 0">
      <div class="glass-1 rounded-xl p-3 max-h-40 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5 select-text">
        <p v-for="(l, i) in gwLogs" :key="i" :class="l.startsWith('[gw:err]') ? 'text-red-400' : 'text-white/70'">{{ formatGwLog(l) }}</p>
      </div>
    </div>

    <!-- Modals -->
        <ManagementModal :title="$t('management.uninstall.title')" :phase="mgmt.uninstallModal.value" :message="mgmt.uninstallMsg.value" :error-msg="mgmt.uninstallError.value" @close="mgmt.closeUninstall()">
      <div class="-mx-2 space-y-0.5">

        <label class="flex items-center gap-2.5 px-3 py-1.5 rounded-lg cursor-pointer bg-white/[0.03] hover:bg-white/[0.06] transition-all group">
          <input type="checkbox" v-model="mgmt.uninstallOc.value"
            class="w-3.5 h-3.5 accent-red-500 shrink-0" />
          <div class="flex-1 flex items-center justify-between min-w-0">
            <span class="text-sm font-medium text-white/85">OpenClaw</span>
            <span class="text-[10px] text-white/30 shrink-0 ml-2">{{ $t('management.uninstall.uninstallAll') }}</span>
          </div>
        </label>
      </div>

      <div class="flex gap-2 pt-3">
        <button @click="mgmt.closeUninstall()" class="flex-1 py-2 text-xs font-bold rounded-xl bg-white/[0.05] text-white/50 border border-white/[0.06] hover:bg-white/[0.08] transition-all">{{ $t('common.button.cancel') }}</button>
        <button @click="mgmt.executeUninstall()" :disabled="!mgmt.uninstallOc.value"
          class="flex-1 py-2 text-xs font-bold rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all">{{ $t('common.button.delete') }}</button>
      </div>
    </ManagementModal>>

    <ManagementModal :title="$t('management.reset.title')" :phase="mgmt.resetModal.value" :message="mgmt.resetMsg.value" :error-msg="mgmt.resetError.value" @close="mgmt.closeReset()">
      <div class="space-y-3">
        <p class="text-sm text-white/60">{{ $t('management.reset.desc') }}</p>
        <div class="flex gap-2 pt-1">
          <button @click="mgmt.closeReset()" class="flex-1 py-2 text-xs font-bold rounded-xl bg-white/[0.05] text-white/50 border border-white/[0.06] hover:bg-white/[0.08] transition-all">{{ $t('common.button.cancel') }}</button>
          <button @click="mgmt.executeReset()" class="flex-1 py-2 text-xs font-bold rounded-xl bg-white/5 text-white/80 hover:bg-white/10 border border-white/[0.08] transition-all">{{ $t('management.reset.confirm') }}</button>
        </div>
      </div>
    </ManagementModal>

    <ManagementModal :title="$t('management.backupRestore.settingsBackup')" :phase="mgmt.backupModal.value" :message="mgmt.backupMsg.value" @close="mgmt.closeBackup()" />
    <ManagementModal :title="$t('management.backupRestore.restoreTitle')" :phase="mgmt.restoreModal.value" :message="mgmt.restoreMsg.value" @close="mgmt.closeRestore()">
      <div class="space-y-3">
        <p class="text-sm text-white/60">{{ $t('management.backupRestore.restoreDesc') }}</p>
        <div class="flex gap-2 pt-1">
          <button @click="mgmt.closeRestore()" class="flex-1 py-2 text-xs font-bold rounded-xl bg-white/[0.05] text-white/50 border border-white/[0.06] hover:bg-white/[0.08] transition-all">{{ $t('common.button.cancel') }}</button>
          <button @click="mgmt.executeRestore()" class="flex-1 py-2 text-xs font-bold rounded-xl bg-white/5 text-white/80 hover:bg-white/10 border border-white/[0.08] transition-all">{{ $t('management.backupRestore.selectFile') }}</button>
        </div>
      </div>
    </ManagementModal>

    <!-- Report modal -->
    <ModalShell :show="showReport" @close="showReport = false">
      <template #header>{{ $t('management.done.copyReport') }}</template>
      <template #body>
        <pre class="overflow-auto p-3 text-[11px] font-mono text-white/90 leading-relaxed whitespace-pre-wrap select-text bg-black/30 rounded-lg">{{ reportText }}</pre>
      </template>
      <template #footer>
        <button @click="showReport = false" class="px-4 py-2 text-xs font-bold rounded-xl bg-white/[0.05] text-white/50 border border-white/[0.06] hover:bg-white/[0.08] transition-all">{{ $t('common.button.back') }}</button>
      </template>
    </ModalShell>

    <!-- Troubleshoot modal -->
    <ModalShell :show="showTroubleshoot" @close="showTroubleshoot = false">
      <template #header>{{ $t('troubleshoot.title') }}</template>
      <template #body>
        <TroubleshootPage :modal="true" @close="showTroubleshoot = false" />
      </template>
    </ModalShell>
  </div>
</template>
