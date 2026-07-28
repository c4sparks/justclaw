/**
 * Multi-gateway management store.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GatewayInstance } from '@shared/gateway-types'

const LOCAL_ID = 'local'

export const useGatewaysStore = defineStore('gateways', () => {
  const instances = ref<GatewayInstance[]>([])

  const activeId = ref<string>(LOCAL_ID)

  const activeInstance = computed(() =>
    instances.value.find(i => i.id === activeId.value)
  )

  function addInstance(inst: GatewayInstance): void {
    const existing = instances.value.findIndex(i => i.id === inst.id)
    if (existing >= 0) {
      instances.value[existing] = inst
    } else {
      instances.value.push(inst)
    }
  }

  function removeInstance(id: string): void {
    instances.value = instances.value.filter(i => i.id !== id)
    if (activeId.value === id) activeId.value = LOCAL_ID
  }

  function setActive(id: string): void {
    activeId.value = id
  }

  function updateStatus(id: string, status: GatewayInstance['status']): void {
    const inst = instances.value.find(i => i.id === id)
    if (inst) inst.status = status
  }

  return {
    instances, activeId, activeInstance,
    addInstance, removeInstance, setActive, updateStatus
  }
})
