<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <AppToasts />
</template>

<script setup lang="ts">
// 同步引擎：应用打开且在线时尝试同步；不依赖关闭后的后台同步
const sync = useSyncEngine()
onMounted(() => { sync.start() })
</script>
