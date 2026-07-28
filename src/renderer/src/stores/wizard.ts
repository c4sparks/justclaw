import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Provider, AuthMethod, WslState, EnvCheckResult } from '@shared/types'

export type StepName =
  | 'welcome'
  | 'setup'
  | 'config'
  | 'done'
  | 'troubleshoot'

export const useWizardStore = defineStore('wizard', () => {
  const currentStep = ref<StepName>('welcome')
  const history = ref<StepName[]>([])

  const stepOrder: StepName[] = [
    'welcome', 'setup', 'config', 'done'
  ]

  const stepIndex = computed(() => stepOrder.indexOf(currentStep.value))
  const totalSteps = computed(() => stepOrder.length)
  const canGoBack = computed(() =>
    currentStep.value !== 'welcome' && currentStep.value !== 'done'
  )

  function goTo(step: StepName): void {
    history.value.push(currentStep.value)
    currentStep.value = step
  }

  function next(): void {
    const idx = stepOrder.indexOf(currentStep.value)
    if (idx < stepOrder.length - 1) {
      goTo(stepOrder[idx + 1])
    }
  }

  function prev(): void {
    // 从监控页返回 → apiKeyGuide 应显示已配置状态
    if (currentStep.value === 'done') entryHint.value = 'from-done'
    const target = history.value.pop()
    if (target) {
      currentStep.value = target
    }
  }

  const isWindows = ref(false)
  const wslState = ref<WslState>('ready')
  const version = ref('')

  const installNeeds = ref({
    needNode: false,
    needOpenclaw: false
  })
  const nodeVersion = ref<string | null>(null)
  const openclawVersion = ref<string | null>(null)

  const entryHint = ref<string | null>(null)
  const provider = ref<Provider>('' as any)
  const modelId = ref<string | undefined>(undefined)
  const authMethod = ref<AuthMethod>('api-key')
  const botUsername = ref<string | undefined>(undefined)

  function setBotUsername(name: string | undefined): void {
    botUsername.value = name
  }

  function setEnvResult(env: EnvCheckResult): void {
    isWindows.value = env.os === 'windows'
    if (env.wslState) wslState.value = env.wslState
    nodeVersion.value = env.nodeVersion
    openclawVersion.value = env.openclawVersion
    installNeeds.value = {
      needNode: !env.nodeVersionOk,
      needOpenclaw: !env.openclawInstalled
    }
  }

  function setProvider(p: Provider): void {
    provider.value = p
    modelId.value = undefined
    authMethod.value = 'api-key'
  }

  function selectAuthMethod(m: AuthMethod): void {
    authMethod.value = m
    modelId.value = undefined
  }

  function selectModel(id: string): void {
    modelId.value = id
  }

  function resetWizard(): void {
    currentStep.value = 'welcome'
    history.value = []
    provider.value = 'anthropic'
    modelId.value = undefined
    authMethod.value = 'api-key'
  }

  return {
    currentStep, history, stepIndex, totalSteps, canGoBack,
    isWindows, wslState, version, entryHint,
    installNeeds, nodeVersion, openclawVersion,
    provider, modelId, authMethod, botUsername,
    goTo, next, prev,
    setEnvResult, setProvider, selectAuthMethod, selectModel,
    setBotUsername, resetWizard
  }
})
