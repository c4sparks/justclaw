<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useWizardStore } from '@/stores/wizard'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import ModalShell from '@/components/ModalShell.vue'

const settings = useSettingsStore()
const wizard = useWizardStore()

const emit = defineEmits<{ close: [] }>()

// ── npm registry ──
type RegistryMode = 'official' | 'ali' | 'custom'
const registryMode = ref<RegistryMode>(
  settings.npmRegistry === settings.OFFICIAL ? 'official'
    : settings.npmRegistry === settings.ALIBABA_MIRROR ? 'ali'
    : 'custom'
)
const customRegistryUrl = ref(
  registryMode.value === 'custom' ? settings.npmRegistry : ''
)
const registryError = ref(false)

function selectPreset(url: string): void {
  settings.setNpmRegistry(url)
  registryError.value = false
}

function applyCustom(): void {
  const url = customRegistryUrl.value.trim()
  if (url) { settings.setNpmRegistry(url); registryError.value = false }
}

watch(registryMode, (mode) => {
  registryError.value = false
  if (mode === 'official') settings.setNpmRegistry(settings.OFFICIAL)
  else if (mode === 'ali') settings.setNpmRegistry(settings.ALIBABA_MIRROR)
})

// ── Node.js mirror ──
type NodeMirrorMode = 'npmmirror' | 'official' | 'custom'
const nodeMirrorMode = ref<NodeMirrorMode>(
  settings.nodeMirror === settings.NODE_MIRROR_NPMMIRROR ? 'npmmirror'
    : settings.nodeMirror === settings.NODE_MIRROR_OFFICIAL ? 'official'
    : 'custom'
)
const customNodeMirrorUrl = ref(
  nodeMirrorMode.value === 'custom' ? settings.nodeMirror : ''
)
const nodeMirrorError = ref(false)

function selectNodeMirrorPreset(url: string): void {
  settings.setNodeMirror(url)
  nodeMirrorError.value = false
}

function applyCustomNodeMirror(): void {
  const url = customNodeMirrorUrl.value.trim()
  if (url) { settings.setNodeMirror(url); nodeMirrorError.value = false }
}

watch(nodeMirrorMode, (mode) => {
  nodeMirrorError.value = false
  if (mode === 'npmmirror') settings.setNodeMirror(settings.NODE_MIRROR_NPMMIRROR)
  else if (mode === 'official') settings.setNodeMirror(settings.NODE_MIRROR_OFFICIAL)
})

function handleConfirm(): void {
  let hasError = false
  if (registryMode.value === 'custom' && !customRegistryUrl.value.trim()) {
    registryError.value = true; hasError = true
  }
  if (nodeMirrorMode.value === 'custom' && !customNodeMirrorUrl.value.trim()) {
    nodeMirrorError.value = true; hasError = true
  }
  if (!hasError) emit('close')
}
</script>

<template>
  <ModalShell :show="true" :close-on-backdrop="false" @close="handleConfirm">
    <template #header>{{ $t('settings.title') }}</template>
    <template #body>
      <div class="space-y-5">
        <!-- Node.js Mirror -->
        <div class="space-y-2">
          <label class="text-xs font-bold text-white/60">{{ $t('steps.setup.nodeMirror') || 'Node.js 镜像源' }}</label>
          <div class="flex gap-2">
            <button @click="nodeMirrorMode = 'official'; selectNodeMirrorPreset(settings.NODE_MIRROR_OFFICIAL)"
              :class="['flex-1 py-1.5 text-[11px] font-bold rounded-lg border transition-all', nodeMirrorMode === 'official' ? 'bg-blue-400/15 border-blue-400/40 text-blue-400' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10']">{{ $t('steps.setup.nodeMirrorOfficial') }}</button>
            <button @click="nodeMirrorMode = 'npmmirror'; selectNodeMirrorPreset(settings.NODE_MIRROR_NPMMIRROR)"
              :class="['flex-1 py-1.5 text-[11px] font-bold rounded-lg border transition-all', nodeMirrorMode === 'npmmirror' ? 'bg-blue-400/15 border-blue-400/40 text-blue-400' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10']">{{ $t('steps.setup.nodeMirrorAli') }}</button>
            <button @click="nodeMirrorMode = 'custom'"
              :class="['shrink-0 px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all', nodeMirrorMode === 'custom' ? 'bg-blue-400/15 border-blue-400/40 text-blue-400' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10']">{{ $t('steps.setup.registryCustom') }}</button>
          </div>
          <div v-if="nodeMirrorMode === 'custom'" class="flex gap-2 pt-1">
            <input v-model="customNodeMirrorUrl" placeholder="https://example.com/mirror/node" autocomplete="new-password"
              :class="['flex-1 px-2 py-1.5 text-[11px] rounded-lg bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-blue-400/50 font-mono transition-all', nodeMirrorError ? 'border-2 border-red-600' : 'border border-white/10']" />
            <button @click="applyCustomNodeMirror" :disabled="!customNodeMirrorUrl.trim()"
              class="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-white/10 text-white/80 border border-white/20 hover:bg-white/15 disabled:opacity-30 transition-all">应用</button>
          </div>
        </div>

        <!-- Registry -->
        <div class="space-y-2">
          <label class="text-xs font-bold text-white/60">{{ $t('settings.npmRegistry') }}</label>
          <div class="flex gap-2">
            <button @click="registryMode = 'official'; selectPreset(settings.OFFICIAL)"
              :class="['flex-1 py-1.5 text-[11px] font-bold rounded-lg border transition-all', registryMode === 'official' ? 'bg-blue-400/15 border-blue-400/40 text-blue-400' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10']">{{ $t('steps.setup.registryOfficial') }}</button>
            <button @click="registryMode = 'ali'; selectPreset(settings.ALIBABA_MIRROR)"
              :class="['flex-1 py-1.5 text-[11px] font-bold rounded-lg border transition-all', registryMode === 'ali' ? 'bg-blue-400/15 border-blue-400/40 text-blue-400' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10']">{{ $t('steps.setup.registryAli') }}</button>
            <button @click="registryMode = 'custom'"
              :class="['shrink-0 px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all', registryMode === 'custom' ? 'bg-blue-400/15 border-blue-400/40 text-blue-400' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10']">{{ $t('steps.setup.registryCustom') }}</button>
          </div>
          <div v-if="registryMode === 'custom'" class="flex gap-2 pt-1">
            <input v-model="customRegistryUrl" :placeholder="$t('steps.setup.registryPlaceholder')" autocomplete="new-password"
              :class="['flex-1 px-2 py-1.5 text-[11px] rounded-lg bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-blue-400/50 font-mono transition-all', registryError ? 'border-2 border-red-600' : 'border border-white/10']" />
            <button @click="applyCustom" :disabled="!customRegistryUrl.trim()"
              class="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-white/10 text-white/80 border border-white/20 hover:bg-white/15 disabled:opacity-30 transition-all">应用</button>
          </div>
        </div>

        <!-- Language -->
        <div class="space-y-2">
          <label class="text-xs font-bold text-white/60">{{ $t('settings.language') }}</label>
          <LanguageSwitcher />
        </div>

        <!-- Footer text -->
        <div class="space-y-1">
          <p class="text-[10px] text-white/40">{{ $t('settings.moreComing') }}</p>
          <p v-if="wizard.version" class="text-[10px] text-white/30 font-mono text-center">JustClaw v{{ wizard.version }}</p>
        </div>
      </div>
    </template>
    <template #footer>
      <button @click="handleConfirm"
        class="px-5 py-2 text-xs font-bold rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80 transition-all">{{ $t('common.button.confirm') }}</button>
    </template>
  </ModalShell>
</template>

<style scoped>
/* Fix Chromium autofill white flash in dark inputs */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
input:-webkit-autofill:active {
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: #fff !important;
  transition: background-color 9999s ease-in-out 0s !important;
  box-shadow: inset 0 0 0 1000px rgba(255,255,255,0.03) !important;
}
</style>
