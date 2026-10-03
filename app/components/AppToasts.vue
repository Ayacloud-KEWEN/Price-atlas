<template>
  <div class="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-3" aria-live="polite">
    <div v-for="t in toast.toasts.value" :key="t.id"
      class="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg"
      :class="{ 'border-brand bg-brand text-white': t.kind === 'success', 'border-danger bg-danger-50 text-danger': t.kind === 'error', 'border-line bg-surface text-ink': t.kind === 'info' }">
      <span class="flex-1">{{ t.text }}</span>
      <button class="text-xs underline" @click="toast.dismiss(t.id)">关闭</button>
    </div>
  </div>
</template>

<script setup lang="ts">
const toast = useToast()
</script>
