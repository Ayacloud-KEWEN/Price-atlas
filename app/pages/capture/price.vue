<template>
  <div>
    <h1 class="mx-auto mb-4 max-w-3xl text-xl font-semibold">记录已有商品的新价格</h1>
    <CaptureForm mode="existing" :variant-id="(route.query.variantId as string) || undefined" :merchant-id="(route.query.merchantId as string) || undefined" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
</script>
