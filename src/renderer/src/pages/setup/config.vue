<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useWizardStore } from '@/stores/wizard'
import { useFetchedModelsStore } from '@/stores/fetched-models'
import { useInstallLogs } from '@/composables/useIpc'
import { providerConfigs, providerMeta, domesticProviderOrder } from '@/config/providers'
import type { Provider, AuthMethod } from '@shared/types'

const props = withDefaults(defineProps<{ modal?: boolean }>(), { modal: false })
const emit = defineEmits<{ close: [] }>()

const { t, locale } = useI18n()
const router = useRouter()
const wizard = useWizardStore()
const fetchedStore = useFetchedModelsStore()
const { logs, clearLogs } = useInstallLogs()

const apiKey = ref('')
const submitting = ref(false)
const showPlain = ref(false)
const updating = ref(false)

const currentCfg = computed(() => providerConfigs.find(c => c.id === wizard.provider) ?? providerConfigs[0])
const meta = computed(() => providerMeta[wizard.provider])
const isOAuth = computed(() => wizard.authMethod === 'oauth')
const isOllama = computed(() => wizard.provider === 'ollama')

const fetchError = ref('')

async function fetchModels(): Promise<void> {
  updating.value = true
  fetchError.value = ''
  try {
    const list = await window.electronAPI.openclaw.fetchModels(wizard.provider)
    if (list.length === 0) { fetchError.value = t('steps.config.updateFail'); return }
    fetchedStore.clearFetchedModels(wizard.provider as Provider)
    fetchedStore.setFetchedModels(wizard.provider as Provider, list)
    setTimeout(() => fetchError.value = '', 4000)
  } catch { fetchError.value = t('steps.config.updateNetworkError') }
  finally { updating.value = false }
}

const isKeyValid = computed(() => {
  if (!apiKey.value || isOllama.value || isOAuth.value) return true
  return currentCfg.value?.pattern?.test(apiKey.value) ?? true
})

const providerSelected = computed(() => wizard.provider && domesticProviderOrder.includes(wizard.provider as any))

const displayModels = computed(() => {
  const provider = wizard.provider as Provider
  if (!provider) return []
  const defaults = (currentCfg.value?.models ?? []).map(m => ({ ...m, tag: '初始' as const }))
  const fetched = (fetchedStore.models[provider] ?? []).map(m => ({ ...m, tag: '★' as const }))
  const defaultIds = new Set(defaults.map(m => m.id))
  const newFetched = fetched.filter(m => !defaultIds.has(m.id))
  return [...defaults, ...newFetched]
})

const selectedModel = ref('')

function selectProvider(p: Provider): void {
  wizard.setProvider(p)
  const cfg = providerConfigs.find(c => c.id === p)
  if (cfg) selectedModel.value = cfg.models[0]?.id || ''
  apiKey.value = ''
}

function selectAuthMethod(m: AuthMethod): void {
  wizard.selectAuthMethod(m)
  const cfg = providerConfigs.find(c => c.id === wizard.provider)
  selectedModel.value = m === 'oauth'
    ? (cfg?.oauthModels?.[0]?.id ?? cfg?.models[0]?.id ?? '')
    : (cfg?.models[0]?.id ?? '')
}

function selectModel(id: string): void {
  selectedModel.value = id
  wizard.selectModel(id)
}

function maskKey(key: string): string {
  if (!key || key.length <= 8) return key
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}

const displayKey = computed(() => {
  if (!apiKey.value) return ''
  return showPlain.value ? apiKey.value : maskKey(apiKey.value)
})

const isEverythingInstalled = ref(false)

function goBack(): void {
  if (props.modal) {
    emit('close')
    return
  }
  // If env components are missing, go directly to setup
  if (!isEverythingInstalled.value) {
    wizard.goTo('setup')
    return
  }
  let prevStep = wizard.history.pop()
  while (prevStep === 'done') prevStep = wizard.history.pop()
  if (prevStep) {
    wizard.currentStep = prevStep
    router.push(`/${prevStep}`)
  }
}

function handleKeyInput(e: Event): void {
  if (showPlain.value) apiKey.value = (e.target as HTMLInputElement).value
}

function handleFocus(): void {
  if (!apiKey.value) showPlain.value = true
}
function handleBlur(): void {
  showPlain.value = false
}
function clearKey(): void {
  apiKey.value = ''
  showPlain.value = true
}

onMounted(async () => {
  // Check if env is fully installed (for back button state)
  const env = await window.electronAPI.env.check().catch(() => null)
  if (env) {
    const wslOk = env.wslState === undefined || env.wslState === 'ready'
    isEverythingInstalled.value = wslOk && env.nodeVersionOk && env.openclawInstalled
  }

  if (wizard.entryHint === 'from-done') {
    wizard.entryHint = null
    const r = await window.electronAPI.config.read().catch(() => null)
    if (r?.config?.apiKey) apiKey.value = r.config.apiKey
    if (r?.config?.provider) wizard.setProvider(r.config.provider as Provider)
    if (r?.config?.model) { selectedModel.value = r.config.model; wizard.selectModel(r.config.model) }
  }

  if (wizard.modelId) {
    selectedModel.value = wizard.modelId
  } else if (displayModels.value.length > 0) {
    selectedModel.value = displayModels.value[0].id
    wizard.selectModel(displayModels.value[0].id)
  }

  try {
    const list = await window.electronAPI.openclaw.fetchModels(wizard.provider)
    if (list.length > 0) {
      fetchedStore.clearFetchedModels(wizard.provider as Provider)
      fetchedStore.setFetchedModels(wizard.provider as Provider, list)
    }
  } catch { /* silent */ }
})

async function handleSubmit(): Promise<void> {
  submitting.value = true
  clearLogs()
  try {
    if (isOAuth.value) {
      const r = await window.electronAPI.oauth.loginCodex()
      if (!r.success) throw new Error(r.error || 'OAuth failed')
    }
    const r = await window.electronAPI.onboard.run({
      provider: wizard.provider,
      apiKey: isOAuth.value || isOllama.value ? undefined : apiKey.value,
      authMethod: wizard.authMethod,
      modelId: wizard.modelId
    })
    if (r.success) {
      wizard.setBotUsername(r.botUsername)
      if (props.modal) {
        emit('close')
      } else {
        wizard.goTo('done')
      }
    } else {
      throw new Error(r.error || 'Save failed')
    }
  } catch (err) {
    logs.value.push(`Error: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-0 -mt-12">
    <div class="space-y-0">
      <h2 v-if="!modal" class="text-base font-bold text-white">{{ $t('steps.config.title') }}</h2>
      <p v-if="!modal" class="text-xs text-white/40">{{ $t('steps.config.desc') }}</p>
    </div>

    <!-- Provider list + right panel split -->
    <div class="flex gap-0 h-[260px]">
      <!-- Left: Provider list sidebar -->
      <div class="w-[172px] shrink-0 space-y-1 overflow-y-auto py-3 px-2 border border-white/[0.08] bg-transparent rounded-none">
        <button v-for="p in domesticProviderOrder" :key="p" @click="selectProvider(p)"
          :class="[
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-150',
            wizard.provider === p
              ? 'bg-primary/10 border border-primary/30'
              : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.04]'
          ]">
          <div :class="['w-3 h-3 rounded-full shrink-0 border-2 transition-all', wizard.provider === p ? 'border-green-500 bg-green-500' : 'border-white/20']" />
          <span class="text-sm font-bold" :class="wizard.provider === p ? 'text-white/90' : 'text-white/50'">{{ providerMeta[p].name }}</span>
        </button>
      </div>

      <!-- Right: Content panel -->
      <div class="flex-1 min-w-0 p-4 overflow-y-auto border border-white/[0.08] bg-transparent rounded-none -ml-px">
        <!-- No provider selected -->
        <div v-if="!providerSelected" class="pt-6 text-center">
          <p class="text-sm text-white/40">{{ $t('steps.config.selectProviderHint') }}</p>
        </div>

        <div v-else class="space-y-4">
          <!-- Auth method -->
          <div v-if="currentCfg.authMethods && currentCfg.authMethods.length > 1" class="flex gap-2">
            <button v-for="m in currentCfg.authMethods" :key="m" @click="selectAuthMethod(m)"
              :class="[
                'px-3 py-1.5 text-xs font-bold rounded-lg border transition-all',
                wizard.authMethod === m
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-white/[0.03] border-white/20 text-white/40 hover:text-white/60'
              ]">
              {{ $t('steps.config.authMethod.' + m) }}
            </button>
          </div>

          <!-- Model selection -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-white/50">{{ $t('steps.config.modelSelect') }}</label>
              <button @click="fetchModels" :disabled="updating"
                class="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-white/5 text-white/80 hover:bg-white/10 border border-white/[0.08] disabled:opacity-40 transition-all w-16 inline-flex items-center justify-center">
                {{ $t('steps.config.updateModels') }}
              </button>
            </div>
            <p v-if="fetchError" class="text-[10px] text-red-400">{{ fetchError }}</p>
            <div class="space-y-1 max-h-[116px] overflow-y-auto">
              <button v-for="m in displayModels" :key="m.id" @click="selectModel(m.id)"
                :class="[
                  'w-full flex items-center gap-2 px-3 py-1 rounded-lg text-left transition-all duration-150',
                  selectedModel === m.id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.04]'
                ]">
                <div :class="['w-3 h-3 rounded-full shrink-0 border-2 transition-all', selectedModel === m.id ? 'border-green-500 bg-green-500' : 'border-white/20']" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm font-bold" :class="selectedModel === m.id ? 'text-white/90' : 'text-white/50'">{{ m.name }}</span>
                    <span v-if="m.tag" :class="['text-[9px] font-bold px-1 py-0.5 rounded', m.tag === '初始' ? 'bg-white/10 text-white/40' : 'text-yellow-400']">{{ m.tag }}</span>
                  </div>
                  <span class="text-[11px] text-white/40 block truncate">{{ m.desc }}</span>
                </div>
                <span v-if="m.price" class="text-[10px] text-white/30 font-mono shrink-0">{{ m.price }}</span>
              </button>
            </div>
          </div>

          <!-- API Key input -->
          <div v-if="!isOAuth && !isOllama" class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-white/50">{{ $t('steps.config.apiKey') }}</label>
              <a v-if="wizard.provider !== 'ollama' && !(wizard.provider === 'openai' && wizard.authMethod === 'oauth')"
                :href="meta?.consoleUrl" target="_blank" rel="noreferrer"
                class="text-[10px] font-semibold text-primary/60 hover:text-primary transition-colors no-underline">
                {{ $t('steps.config.getKey') }}
              </a>
              <a v-else-if="wizard.provider === 'ollama'"
                :href="providerMeta.ollama.consoleUrl" target="_blank" rel="noreferrer"
                class="text-[10px] font-semibold text-primary/60 hover:text-primary transition-colors no-underline">
                {{ $t('steps.config.downloadOllama') }}
              </a>
            </div>
            <div class="relative group">
              <input :value="displayKey" @input="handleKeyInput"
                @focus="handleFocus" @blur="handleBlur"
                type="text" :placeholder="$t('steps.config.apiKeyPlaceholder')"
                class="w-full px-3 py-[9px] pr-8 text-sm rounded-lg bg-white/[0.03] border text-white placeholder-white/20 focus:outline-none focus:border-primary/50 transition-colors font-mono"
                :class="apiKey && !isKeyValid ? 'border-red-500/50' : 'border-white/20'" />
              <button v-if="apiKey" @click="clearKey"
                class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 leading-none text-gray-400 text-lg">×</button>
            </div>
            <p v-if="apiKey && !isKeyValid" class="text-[10px] text-red-400">{{ $t('steps.config.keyFormatHint') }}</p>
          </div>

          <!-- OAuth button -->
          <button v-else-if="isOAuth" @click="handleSubmit" :disabled="submitting"
            class="w-full py-2.5 text-sm font-bold rounded-xl bg-white/5 text-white/80 hover:bg-white/10 border border-white/[0.08] disabled:opacity-40 transition-all">
            {{ submitting ? $t('steps.config.loggingIn') : $t('steps.config.oauthLogin') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Logs -->
    <div v-if="submitting || logs.length > 0"
      class="p-3 rounded-xl bg-black/30 border border-white/20 max-h-32 overflow-y-auto font-mono text-[12px] text-white/70 space-y-0.5 select-text">
      <p v-for="(l, i) in logs" :key="i" class="text-white/70">{{ l }}</p>
      <p v-if="logs.length === 0 && submitting" class="italic text-white/40">{{ $t('steps.config.configuring') }}</p>
    </div>

    <!-- Bottom bar -->
    <div class="flex items-center justify-between pt-3 border-t border-white/20">
      <button @click="goBack()" :disabled="isEverythingInstalled"
        class="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        {{ $t('common.button.back') }}
      </button>
      <button @click="handleSubmit" :disabled="submitting || (!apiKey && !isOllama && !isOAuth)"
        class="px-5 py-2 text-sm font-bold rounded-xl bg-white/5 border border-white/[0.08] text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-40 transition-all inline-flex items-center gap-1.5">
        {{ submitting ? $t('steps.config.saving') : $t('steps.config.save') }}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
    </div>
  </div>
</template>
