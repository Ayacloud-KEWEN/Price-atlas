<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <span class="label !mb-0">{{ label }}</span>
      <span class="text-xs text-muted">{{ photos.length }} 张</span>
    </div>
    <div class="flex flex-wrap gap-2">
      <label class="btn cursor-pointer">
        📷 拍照
        <input class="sr-only" type="file" accept="image/*" capture="environment" @change="onPick" />
      </label>
      <label class="btn cursor-pointer">
        🖼 相册
        <input class="sr-only" type="file" accept="image/*" multiple @change="onPick" />
      </label>
    </div>
    <p v-if="busy" class="hint">处理照片中…</p>
    <p v-if="error" class="err">{{ error }}</p>
    <ul v-if="photos.length" class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <li v-for="(p, i) in photos" :key="p.clientId" class="card overflow-hidden p-0">
        <img :src="p.url" alt="已选照片预览" class="h-32 w-full object-cover" />
        <div class="flex items-center gap-1 p-2">
          <select :value="p.kind" class="input !min-h-9 !py-1 text-xs" :aria-label="`第 ${i + 1} 张照片类型`" @change="setKind(i, ($event.target as HTMLSelectElement).value)">
            <option v-for="(l, k) in ATTACHMENT_KINDS" :key="k" :value="k">{{ l }}</option>
          </select>
          <button type="button" class="btn btn-sm btn-danger" :aria-label="`移除第 ${i + 1} 张照片`" @click="remove(i)">删</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ATTACHMENT_KINDS } from '../../shared/templates'

export interface PickedPhoto { clientId: string; blob: Blob; name: string; kind: 'front' | 'back' | 'price_tag' | 'other'; url: string; size: number; mime: string }

const props = withDefaults(defineProps<{ modelValue: PickedPhoto[]; label?: string; max?: number }>(), { label: '照片', max: 12 })
const emit = defineEmits<{ 'update:modelValue': [PickedPhoto[]] }>()
const photos = computed(() => props.modelValue)
const busy = ref(false)
const error = ref('')

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (!files.length) return
  error.value = ''; busy.value = true
  const next = [...props.modelValue]
  for (const f of files) {
    if (next.length >= props.max) { error.value = `最多 ${props.max} 张照片`; break }
    if (f.type && !f.type.startsWith('image/')) { error.value = '只能选择图片文件'; continue }
    const { blob, name } = await compressImage(f)
    next.push({ clientId: uid(), blob, name, kind: next.length === 0 ? 'front' : 'other', url: URL.createObjectURL(blob), size: blob.size, mime: blob.type || f.type })
  }
  busy.value = false
  emit('update:modelValue', next)
}
function setKind(i: number, kind: string) {
  const next = [...props.modelValue]; next[i] = { ...next[i]!, kind: kind as any }
  emit('update:modelValue', next)
}
function remove(i: number) {
  const next = [...props.modelValue]
  const [gone] = next.splice(i, 1)
  if (gone) URL.revokeObjectURL(gone.url)
  emit('update:modelValue', next)
}
</script>
