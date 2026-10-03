<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <div v-for="f in visible" :key="f.key" :class="f.type === 'textarea' ? 'sm:col-span-2' : ''">
      <template v-if="f.type === 'bool'">
        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" class="h-5 w-5 accent-brand" :checked="!!model[f.key]" @change="set(f.key, ($event.target as HTMLInputElement).checked)" />
          {{ f.label }}
        </label>
      </template>
      <template v-else>
        <label class="label" :for="`f-${f.key}`">{{ f.label }}<span v-if="f.unit" class="font-normal text-muted"> ({{ f.unit }})</span></label>
        <select v-if="f.type === 'select'" :id="`f-${f.key}`" class="input" :value="model[f.key] ?? ''" @change="set(f.key, ($event.target as HTMLSelectElement).value)">
          <option value="">未填写 / 不适用</option>
          <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <textarea v-else-if="f.type === 'textarea'" :id="`f-${f.key}`" class="input" rows="2" :placeholder="f.placeholder" :value="(model[f.key] as string) ?? ''" @input="set(f.key, ($event.target as HTMLTextAreaElement).value)" />
        <input v-else :id="`f-${f.key}`" class="input" :type="f.type === 'number' || f.type === 'year' ? 'text' : 'text'" :inputmode="f.type === 'number' ? 'decimal' : f.type === 'year' ? 'numeric' : 'text'"
          :placeholder="f.placeholder" :value="(model[f.key] as string) ?? ''" :disabled="disabledKeys.includes(f.key)"
          @input="set(f.key, ($event.target as HTMLInputElement).value)" />
        <p v-if="f.help" class="hint">{{ f.help }}</p>
        <p v-if="errors?.[f.key]" class="err">{{ errors[f.key] }}</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FieldDef } from '../../shared/templates'

const props = defineProps<{
  fields: FieldDef[]
  model: Record<string, any>
  errors?: Record<string, string>
  advanced?: boolean // true：只显示高级字段；false：只显示基础字段
}>()
const emit = defineEmits<{ change: [key: string, value: unknown] }>()

const visible = computed(() => props.fields.filter((f) => (props.advanced === undefined ? true : !!f.advanced === props.advanced)))
const disabledKeys = computed(() => (props.model.nonVintage ? ['harvestYear'] : []))
function set(key: string, value: unknown) { emit('change', key, value) }
</script>
