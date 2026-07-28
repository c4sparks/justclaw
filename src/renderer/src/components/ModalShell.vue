<script setup lang="ts">
/**
 * Shared modal shell — draggable, resizable, slots for body and footer.
 */
import { ref, reactive, onBeforeUnmount, computed } from 'vue'

const props = withDefaults(defineProps<{
  show: boolean
  size?: 'sm' | 'md' | 'lg'
  closeOnBackdrop?: boolean
}>(), {
  size: 'md',
  closeOnBackdrop: true
})

const emit = defineEmits<{
  close: []
}>()

const maximized = ref(false)

const sizeClass = computed(() => {
  if (maximized.value) return '!w-auto !max-w-none'
  return props.size === 'sm' ? 'max-w-sm' : props.size === 'lg' ? 'max-w-2xl' : 'max-w-md'
})

// Drag
const modalRef = ref<HTMLElement | null>(null)
const dragging = ref(false)
const pos = reactive({ x: 0, y: 0 })
const offset = reactive({ x: 0, y: 0 })
let rafId = 0

function onHeaderMouseDown(e: MouseEvent): void {
  if (e.button !== 0 || !modalRef.value) return
  const target = e.target as HTMLElement
  if (target.closest('button')) return // don't drag when clicking buttons
  const rect = modalRef.value.getBoundingClientRect()
  offset.x = e.clientX - rect.left
  offset.y = e.clientY - rect.top
  pos.x = rect.left
  pos.y = rect.top
  dragging.value = true
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent): void {
  if (!dragging.value) return
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    pos.x = e.clientX - offset.x
    pos.y = e.clientY - offset.y
  })
}

function onMouseUp(): void {
  dragging.value = false
  cancelAnimationFrame(rafId)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 bg-black/30" @click.self="closeOnBackdrop && emit('close')">
    <div ref="modalRef"
      class="absolute w-full rounded-2xl bg-[#0a0d14]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
      :class="[sizeClass, { 'cursor-grabbing select-none': dragging }]"
      :style="maximized ? {
        left: '2.5vw', right: '2.5vw', top: '5vh', bottom: '5vh', width: 'auto',
        transform: 'none',
      } : {
        left: pos.x + 'px',
        top: pos.y + 'px',
        transform: pos.x === 0 && pos.y === 0 ? 'translate(calc(50vw - 50%), 10vh)' : 'none',
      }">
      <!-- Header (drag handle) -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/10 cursor-grab select-none shrink-0"
        @mousedown.prevent="onHeaderMouseDown">
        <h3 class="text-base font-bold text-white truncate">
          <slot name="header" />
        </h3>
        <div class="flex items-center gap-2 shrink-0">
          <button @click="maximized = !maximized" class="text-white/50 hover:text-white/80 w-7 h-7 flex items-center justify-center bg-transparent border-none p-0 cursor-pointer rounded-md hover:bg-white/5" :title="maximized ? $t('common.button.minimize') : $t('common.button.maximize')">
            <svg v-if="maximized" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5L9 9M9 9L6 9M9 9L9 6M19 5L15 9M15 9L18 9M15 9L15 6M5 19L9 15M9 15L6 15M9 15L9 18M19 19L15 15M15 15L18 15M15 15L15 18" /></svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9L5 5M5 5L8 5M5 5L5 8M15 9L19 5M19 5L16 5M19 5L19 8M9 15L5 19M5 19L8 19M5 19L5 16M15 15L19 19M19 19L16 19M19 19L19 16" /></svg>
          </button>
          <button @click="emit('close')" :title="$t('common.button.close')" class="text-white/50 hover:text-red-400 w-7 h-7 flex items-center justify-center bg-transparent border-none p-0 cursor-pointer rounded-md hover:bg-white/5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="p-5 space-y-4 overflow-y-auto bg-white/[0.02] flex-1">
        <slot name="body" />
      </div>

      <!-- Footer (optional) -->
      <div v-if="$slots.footer" class="flex justify-end px-5 py-3 border-t border-white/10 bg-white/[0.01] shrink-0">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
