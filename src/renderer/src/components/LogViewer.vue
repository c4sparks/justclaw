<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  lines: string[]
}>()

const container = ref<HTMLElement | null>(null)

watch(() => props.lines.length, async () => {
  await nextTick()
  if (container.value) {
    container.value.scrollTop = container.value.scrollHeight
  }
})
</script>

<template>
  <div
    ref="container"
    class="bg-black/40 rounded-xl p-3 max-h-40 overflow-y-auto font-mono text-[11px] leading-relaxed border border-glass"
  >
    <p
      v-for="(line, i) in lines"
      :key="i"
      class="text-muted/70"
    >
      {{ line }}
    </p>
    <p v-if="lines.length === 0" class="text-muted/30 italic">
      Waiting for output...
    </p>
  </div>
</template>
