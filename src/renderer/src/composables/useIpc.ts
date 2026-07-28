import { ref, onUnmounted } from 'vue'

/**
 * Subscribe to install progress events from main process.
 */
export function useInstallLogs() {
  const logs = ref<string[]>([])
  const error = ref<string | null>(null)

  const offP = window.electronAPI.install.onProgress((msg: string) => { logs.value.push(msg) })
  const offE = window.electronAPI.install.onError((msg: string) => { error.value = msg })

  onUnmounted(() => { offP(); offE() })

  const clearLogs = (): void => { logs.value = []; error.value = null }

  return { logs, error, clearLogs }
}

/**
 * Subscribe to gateway log events, auto-capped at 500 lines.
 */
export function useGatewayLogs(maxLines = 500) {
  const logs = ref<string[]>([])
  const off = window.electronAPI.gateway.onLog((msg: string) => {
    logs.value.push(msg)
    if (logs.value.length > maxLines) logs.value = logs.value.slice(-maxLines)
  })
  onUnmounted(off)
  return { logs }
}
