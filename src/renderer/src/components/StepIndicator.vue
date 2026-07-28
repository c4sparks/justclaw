<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

const props = defineProps<{
  currentStep: string
  isWindows?: boolean
}>()

const allSteps = computed<{ key: string; label: string }[]>(() => {
  const _ = locale.value
  const prefix = 'steps.indicator.'
  const keys: { key: string }[] = [
    { key: 'setup' },
    { key: 'config' },
    { key: 'done' },
  ]
  return keys.map((k) => ({ key: k.key, label: t(prefix + k.key) }))
})

const currentIdx = computed(() => {
  const idx = allSteps.value.findIndex(s => s.key === props.currentStep)
  return idx >= 0 ? idx : 0
})

const total = computed(() => allSteps.value.length)
</script>

<template>
  <div class="shrink-0 px-6 pt-5 pb-3">
    <div class="flex items-center gap-0 relative">
      <template v-for="(s, i) in allSteps" :key="s.key">
        <!-- Step dot + label -->
        <div class="flex items-center gap-2 min-w-0">
          <div :class="[
            'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300',
            i < currentIdx || (i === currentIdx && s.key === 'done')
              ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
              : i === currentIdx
                ? 'bg-primary/15 text-white border border-primary/40 step-active-glow'
                : 'glass-1 text-white'
          ]">
            <span v-if="i < currentIdx || (i === currentIdx && s.key === 'done')"
              class="text-sm">✓</span>
            <span v-else class="text-xs">{{ i + 1 }}</span>
          </div>
          <span :class="[
            'text-[11px] font-semibold truncate transition-all duration-300 max-w-[80px]',
            i <= currentIdx ? 'text-white/80' : 'text-white/25'
          ]">{{ s.label }}</span>
        </div>
        <!-- Connector line -->
        <div v-if="i < total - 1" class="flex-1 mx-2.5 relative h-0.5">
          <div class="absolute inset-0 rounded-full bg-white/8" />
          <div v-if="i < currentIdx" class="connector-fill absolute inset-y-0 left-0 rounded-full bg-green-500/60"
            :style="{ width: '100%' }" />
        </div>
      </template>
    </div>
  </div>
</template>
