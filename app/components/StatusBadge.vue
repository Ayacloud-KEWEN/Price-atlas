<template>
  <span class="badge" :class="statusClass(status)">{{ BIZ_STATUS[status] ?? status }}</span>
</template>

<script setup lang="ts">
defineProps<{ status: string }>()
</script>
