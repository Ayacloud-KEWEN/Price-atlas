<template>
  <div v-if="session === 'expired' || !sync.online.value || sync.failedCount.value" class="space-y-px" role="status">
    <div v-if="session === 'expired'" class="bg-danger-50 px-4 py-2 text-sm text-danger">
      登录已过期。本机未同步的草稿不会丢失，请
      <a href="/login" class="font-semibold underline">重新登录</a>后点击“重试”。
    </div>
    <div v-if="!sync.online.value" class="bg-warn-50 px-4 py-2 text-sm text-warn">
      当前离线：新记录会先保存在本机，恢复网络后自动同步。离线时无法加载新页面或搜索服务器上的商品。
    </div>
    <div v-if="sync.failedCount.value" class="bg-danger-50 px-4 py-2 text-sm text-danger">
      有 {{ sync.failedCount.value }} 条记录同步失败，
      <NuxtLink to="/drafts" class="font-semibold underline">去处理</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const sync = useSyncEngine()
const session = useSessionState()
</script>
