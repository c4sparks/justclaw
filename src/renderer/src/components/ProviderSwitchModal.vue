<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInstallLogs } from '@/composables/useIpc'
import { providerConfigs, providerMeta, domesticProviderOrder } from '@/config/providers'
import type { Provider, AuthMethod } from '@shared/types'
import LogViewer from './LogViewer.vue'

type Phase = 'form' | 'progress' | 'done' | 'error'

const props = defineProps<{
  currentProvider?: string
  currentModel?: string
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const { t } = useI18n()
const { logs, error, clearLogs } = useInstallLogs()

const phase = ref<Phase>('form')
const apiKey = ref('')
const provider = ref<Provider>(
  (domesticProviderOrder.includes(props.currentProvider as Provider) ? props.currentProvider : 'deepseek') as Provider
)
const authMethod = ref<AuthMethod>('api-key')
const modelId = ref(props.currentModel || providerConfigs.find(c => c.id === provider.value)!.models[0].id)
const progressMsg = ref('')
const errMsg = ref('')

const currentCfg = computed(() => providerConfigs.find((c) => c.id === provider.value)!)

async function handleSwitch(): Promise<void> {
  phase.value = 'progress'
  clearLogs()
  try {
    const r = await window.electronAPI.config.switchProvider({
      provider: provider.value,
      apiKey: authMethod.value === 'oauth' || provider.value === 'ollama' ? undefined : apiKey.value,
      authMethod: authMethod.value,
      modelId: modelId.value
    })
    if (r.success) {
      phase.value = 'done'
      setTimeout(() => emit('success'), 1500)
    } else {
      phase.value = 'error'
      errMsg.value = r.error || 'Switch failed'
    }
  } catch {
    phase.value = 'error'
    errMsg.value = 'Switch failed'
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="glass-card w-full max-w-sm mx-4 p-5 space-y-4 max-h-[80vh] overflow-y-auto">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <h3 class="text-base font-black text-white">{{ t('steps.apiKeyGuide.title') }}</h3>
        <button @click="emit('close')" class="text-muted hover:text-content text-lg leading-none">&times;</button>
      </div>

      <!-- Form -->
      <div v-if="phase === 'form'" class="space-y-3">
        <!-- Provider tabs -->
        <div class="flex rounded-lg border border-glass overflow-hidden bg-white/5">
          <button v-for="p in domesticProviderOrder" :key="p" @click="() => { provider = p; modelId = providerConfigs.find(c => c.id === p)!.models[0].id }"
            :class="['flex-1 py-1.5 text-[10px] font-bold transition-colors cursor-pointer',
              provider === p ? 'bg-primary/15 text-primary' : 'hover:bg-white/5 text-muted']">
            {{ providerMeta[p].name }}
          </button>
        </div>

        <!-- Auth method -->
        <div v-if="currentCfg.authMethods" class="flex rounded-lg border border-glass overflow-hidden">
          <button v-for="m in currentCfg.authMethods" :key="m" @click="authMethod = m"
            :class="['flex-1 py-1.5 text-[10px] font-bold transition-colors cursor-pointer',
              authMethod === m ? 'bg-primary/15 text-primary' : 'hover:bg-white/5 text-muted']">
            {{ m === 'api-key' ? 'API Key' : 'OAuth' }}
          </button>
        </div>

        <!-- API Key input -->
        <div v-if="authMethod === 'api-key' && provider !== 'ollama'" class="space-y-1">
          <label class="text-[11px] font-bold text-muted">API Key</label>
          <input v-model="apiKey" placeholder="sk-..." class="w-full px-3 py-2 text-xs rounded-lg bg-white/5 border border-glass text-content placeholder-muted/30 focus:outline-none focus:border-primary/50" />
        </div>

        <!-- Model selection -->
        <div class="space-y-1">
          <label class="text-[11px] font-bold text-muted">Model</label>
          <div class="space-y-1 max-h-32 overflow-y-auto">
            <button v-for="m in currentCfg.models" :key="m.id" @click="modelId = m.id"
              :class="['w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer',
                modelId === m.id ? 'bg-primary/15 border border-primary/40' : 'bg-white/5 border border-transparent hover:bg-white/8']">
              <div :class="['w-2.5 h-2.5 rounded-full border-2 shrink-0', modelId === m.id ? 'border-green-500 bg-green-500' : 'border-muted/30']" />
              <span class="text-xs font-bold">{{ m.name }}</span>
            </button>
          </div>
        </div>

        <button @click="handleSwitch" :disabled="!apiKey && authMethod === 'api-key' && provider !== 'ollama'"
          class="w-full py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white disabled:opacity-50 transition-all">
          Switch Provider
        </button>
      </div>

      <!-- Progress -->
      <div v-else-if="phase === 'progress'" class="space-y-3">
        <div class="flex items-center gap-3">
          <svg class="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
          <p class="text-sm text-muted">Switching provider...</p>
        </div>
        <LogViewer v-if="logs.length > 0" :lines="logs" />
      </div>

      <!-- Done -->
      <div v-else-if="phase === 'done'" class="text-center space-y-3">
        <p class="text-success font-bold text-lg">✓</p>
        <p class="text-sm text-muted">Provider switched successfully</p>
      </div>

      <!-- Error -->
      <div v-else-if="phase === 'error'" class="space-y-3">
        <p class="text-sm text-error">{{ errMsg }}</p>
        <button @click="phase = 'form'" class="btn-secondary text-xs">Try Again</button>
      </div>
    </div>
  </div>
</template>
