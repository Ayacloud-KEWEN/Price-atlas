<template>
  <div>
    <h1 class="mb-1 text-xl font-semibold">基础资料</h1>
    <p class="mb-4 text-sm text-muted">分类、属性、品牌、商家与标签都可在这里调整，无需修改代码。</p>
    <div role="tablist" class="mb-4 flex flex-wrap gap-1 border-b border-line">
      <button v-for="t in tabs" :key="t.key" role="tab" :aria-selected="tab === t.key" class="-mb-px border-b-2 px-4 py-2 text-sm"
        :class="tab === t.key ? 'border-brand font-semibold text-brand' : 'border-transparent text-muted'" @click="tab = t.key">{{ t.label }}</button>
    </div>
    <p v-if="loadError" class="text-danger">{{ loadError }}</p>
    <BaseCategories v-if="tab === 'categories'" />
    <BaseBrands v-else-if="tab === 'brands'" />
    <BaseMerchants v-else-if="tab === 'merchants'" />
    <BaseTags v-else />
  </div>
</template>

<script setup lang="ts">
const tabs = [{ key: 'categories', label: '分类与属性' }, { key: 'brands', label: '品牌' }, { key: 'merchants', label: '商家与门店' }, { key: 'tags', label: '标签' }]
const tab = ref('categories')
const loadError = ref('')
const { load } = useMeta()
onMounted(() => load(true).catch((e) => { loadError.value = e.message }))
</script>
