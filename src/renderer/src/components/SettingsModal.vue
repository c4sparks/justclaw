<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { useWizardStore } from '@/stores/wizard'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import ModalShell from '@/components/ModalShell.vue'

const { t } = useI18n()
const settings = useSettingsStore()
const wizard = useWizardStore()

const emit = defineEmits<{ close: [] }>()

type RegistryMode = 'official' | 'ali' | 'custom'
const registryMode = ref<RegistryMode>(
  settings.npmRegistry === settings.OFFICIAL ? 'official'
    : settings.npmRegistry === settings.ALIBABA_MIRROR ? 'ali'
    : 'custom'
)
const customRegistryUrl = ref(
  registryMode.value === 'custom' ? settings.npmRegistry : ''
)

function selectPreset(url: string): void {
  settings.setNpmRegistry(url)
}

function applyCustom(): void {
  const url = customRegistryUrl.value.trim()
  if (url) settings.setNpmRegistry(url)
}

watch(registryMode, (mode) => {
  if (mode === 'official') settings.setNpmRegistry(settings.OFFICIAL)
  else if (mode === 'ali') settings.setNpmRegistry(settings.ALIBABA_MIRROR)
})
</script>

<template>
  <ModalShell :show="true" @close="emit('close')">
    <template #header>{{ $t('settings.title') }}</template>
    <template #body>
      <div class="space-y-5">
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
            <input v-model="customRegistryUrl" :placeholder="$t('steps.setup.registryPlaceholder')"
              class="flex-1 px-2 py-1.5 text-[11px] rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-blue-400/50 font-mono transition-all" />
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
      <button @click="emit('close')" class="px-5 py-2 text-xs font-bold rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80 transition-all">{{ $t('common.button.confirm') }}</button>
    </template>
  </ModalShell>
</template>
