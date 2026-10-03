<template>
  <div>
    <h1 class="mx-auto mb-4 max-w-3xl text-xl font-semibold">新商品</h1>
    <CaptureForm mode="new" :product-id="(route.query.productId as string) || undefined" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
</script>
