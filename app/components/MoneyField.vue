<template>
  <div>
    <label v-if="label" class="label" :for="id">{{ label }}<span v-if="required" class="text-danger"> *</span></label>
    <input :id="id" v-model="raw" inputmode="decimal" autocomplete="off" class="input text-right tabular-nums"
      :class="{ 'input-error': !!shownError }" :placeholder="placeholder || '0.00'" :aria-invalid="!!shownError"
      @input="onInput" @blur="commit" />
    <div v-if="state === 'ambiguous' && ambiguous" class="mt-2 rounded-lg border border-warn bg-warn-50 p-3 text-sm text-warn" role="alert">
      “{{ raw }}” 含义不明确，请确认：
      <div class="mt-2 flex flex-wrap gap-2">
        <button type="button" class="btn btn-sm" @click="choose(ambiguous.asDecimal)">按小数：{{ ambiguous.asDecimal }}</button>
        <button type="button" class="btn btn-sm" @click="choose(ambiguous.asThousand)">按千分位：{{ ambiguous.asThousand }}</button>
      </div>
    </div>
    <p v-if="shownError" class="err">{{ shownError }}</p>
    <p v-else-if="hint" class="hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { parseAmountInput } from '../../shared/pricing'

const props = defineProps<{ modelValue: string | null | undefined; label?: string; error?: string; hint?: string; required?: boolean; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string]; state: [string] }>()
const id = `money-${Math.random().toString(36).slice(2, 8)}`

const raw = ref(props.modelValue ?? '')
const state = ref<'ok' | 'ambiguous' | 'error' | 'empty'>(props.modelValue ? 'ok' : 'empty')
const ambiguous = ref<{ asDecimal: string; asThousand: string } | null>(null)
const parseError = ref('')
const shownError = computed(() => props.error || parseError.value)

watch(() => props.modelValue, (v) => {
  // 外部重置（如“保存并继续下一件”清空）
  if ((v ?? '') !== normalized.value) { raw.value = v ?? ''; evaluate(false) }
})
const normalized = ref(props.modelValue ?? '')

function evaluate(emitValue = true) {
  parseError.value = ''; ambiguous.value = null
  if (!raw.value.trim()) { state.value = 'empty'; normalized.value = ''; if (emitValue) emit('update:modelValue', ''); emit('state', 'empty'); return }
  const r = parseAmountInput(raw.value)
  if (r.ok) { state.value = 'ok'; normalized.value = r.value; if (emitValue) emit('update:modelValue', r.value) }
  else if (r.ambiguous) {
    state.value = 'ambiguous'; ambiguous.value = r.ambiguous; normalized.value = ''
    if (emitValue) emit('update:modelValue', '')
  } else { state.value = 'error'; parseError.value = r.error || '金额格式不正确'; normalized.value = ''; if (emitValue) emit('update:modelValue', '') }
  emit('state', state.value)
}
function onInput() { if (state.value !== 'ambiguous') evaluate() }
function commit() { evaluate() }
function choose(v: string) { raw.value = v; evaluate() }
</script>
