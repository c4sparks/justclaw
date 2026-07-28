import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * Global settings store — persists settings across wizard steps.
 * Add new settings here and expose them via the Settings UI.
 */
export const useSettingsStore = defineStore('settings', () => {
  // ── npm registry ──
  const ALIBABA_MIRROR = 'https://registry.npmmirror.com'
  const OFFICIAL = 'https://registry.npmjs.org'

  const npmRegistry = ref(ALIBABA_MIRROR)

  function setNpmRegistry(url: string): void {
    npmRegistry.value = url
  }

  /** Returns the effective npm --registry arg, or undefined to use npm default */
  const npmRegistryArg = computed<string | undefined>(() =>
    npmRegistry.value === OFFICIAL ? undefined : npmRegistry.value
  )

  // ── Node.js mirror ──
  const NODE_MIRROR_NPMMIRROR = 'https://npmmirror.com/mirrors/node'
  const NODE_MIRROR_OFFICIAL = 'https://nodejs.org/dist'

  const nodeMirror = ref(NODE_MIRROR_NPMMIRROR)

  function setNodeMirror(url: string): void {
    nodeMirror.value = url
  }

  return {
    // State
    npmRegistry,
    nodeMirror,
    // Getters
    npmRegistryArg,
    // Constants
    ALIBABA_MIRROR,
    OFFICIAL,
    NODE_MIRROR_NPMMIRROR,
    NODE_MIRROR_OFFICIAL,
    // Actions
    setNpmRegistry,
    setNodeMirror
  }
})
