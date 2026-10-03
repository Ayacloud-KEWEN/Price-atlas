<template>
  <NuxtLink :to="to" class="flex items-center justify-between rounded-lg px-3 py-2 text-ink hover:bg-brand-50"
    active-class="!bg-brand-50 !font-semibold !text-brand" :exact="to === '/'">
    <span>{{ label }}</span>
    <span v-if="badge" class="rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">{{ badge }}</span>
  </NuxtLink>
</template>

<script setup lang="ts">
defineProps<{ to: string; label: string; badge?: number }>()
</script>
