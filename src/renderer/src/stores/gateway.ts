import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { GatewayStatus } from '@shared/types'

/**
 * Gateway store — manages the OpenClaw gateway process state.
 * Subscribes to IPC events for real-time status updates.
 */
export const useGatewayStore = defineStore('gateway', () => {
  const status = ref<GatewayStatus>('stopped')
  const logs = ref<string[]>([])
  const health = ref<'healthy' | 'restarting' | 'failed'>('healthy')
  const error = ref<string | null>(null)

  let unsubFns: (() => void)[] = []

  function subscribe(): void {
    unsubFns.push(
      window.electronAPI.gateway.onLog((msg: string) => {
        logs.value.push(msg)
        if (logs.value.length > 500) {
          logs.value = logs.value.slice(-500)
        }
      })
    )
    unsubFns.push(
      window.electronAPI.gateway.onStatusChanged((p: { status: string }) => {
        status.value = p.status as GatewayStatus
        if (p.status === 'running') health.value = 'healthy'
        else if (p.status === 'restarting') health.value = 'restarting'
        else if (p.status === 'failed' || p.status === 'gave_up') health.value = 'failed'
      })
    )
    unsubFns.push(
      window.electronAPI.gateway.onRestarting(() => {
        health.value = 'restarting'
      })
    )
    unsubFns.push(
      window.electronAPI.gateway.onRestarted(() => {
        health.value = 'healthy'
      })
    )
    unsubFns.push(
      window.electronAPI.gateway.onGaveUp(() => {
        health.value = 'failed'
      })
    )
  }

  function unsubscribe(): void {
    unsubFns.forEach((fn) => fn())
    unsubFns = []
  }

  async function start(): Promise<boolean> {
    error.value = null
    const r = await window.electronAPI.gateway.start()
    if (!r.success) {
      if (r.error) error.value = r.error
      return false
    }
    return true
  }

  async function stop(): Promise<void> {
    await window.electronAPI.gateway.stop()
    status.value = 'stopped'
  }

  async function restart(): Promise<boolean> {
    error.value = null
    const r = await window.electronAPI.gateway.restart()
    if (!r.success) {
      if (r.error) error.value = r.error
      return false
    }
    return true
  }

  async function refreshStatus(): Promise<GatewayStatus> {
    const s = await window.electronAPI.gateway.status()
    status.value = s
    return s
  }

  return {
    status, logs, health, error,
    subscribe, unsubscribe,
    start, stop, restart, refreshStatus
  }
})
