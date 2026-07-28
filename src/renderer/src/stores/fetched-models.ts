import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Provider } from '@shared/types'

export interface FetchedModel {
  id: string
  name: string
  desc?: string
  price?: string
}

/**
 * Stores model data fetched via "更新模型" button.
 * Persists across page visits within the session.
 */
export const useFetchedModelsStore = defineStore('fetched-models', () => {
  const models = ref<Record<Provider, FetchedModel[]>>({} as Record<Provider, FetchedModel[]>)

  function setFetchedModels(provider: Provider, list: FetchedModel[]): void {
    models.value = { ...models.value, [provider]: list }
  }

  function clearFetchedModels(provider: Provider): void {
    const copy = { ...models.value }
    delete copy[provider]
    models.value = copy
  }

  function clearAll(): void {
    models.value = {} as Record<Provider, FetchedModel[]>
  }

  return { models, setFetchedModels, clearFetchedModels, clearAll }
})
