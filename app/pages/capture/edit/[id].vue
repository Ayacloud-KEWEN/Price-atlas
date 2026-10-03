<template>
  <div>
    <h1 class="mx-auto mb-4 max-w-3xl text-xl font-semibold">编辑本机记录</h1>
    <p v-if="!mode" class="text-sm text-muted">加载中…</p>
    <CaptureForm v-else :mode="mode" :edit-id="id" />
  </div>
</template>

<script setup lang="ts">
const id = String(useRoute().params.id)
const mode = ref<'existing' | 'new' | 'quick' | null>(null)
onMounted(async () => {
  const rec = await localDb.getRecord(id)
  if (!rec) { useToast().error('找不到这条本机记录'); await navigateTo('/drafts'); return }
  mode.value = rec.mode
})
</script>
