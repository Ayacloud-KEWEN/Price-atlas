<template>
  <div>
    <div v-if="!hasData" class="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">暂无可绘制的数据点。</div>
    <template v-else>
      <svg :viewBox="`0 0 ${W} ${H}`" class="w-full" role="img" :aria-label="`价格曲线，${total} 个数据点`">
        <g>
          <template v-for="t in yTicks" :key="t.y">
            <line :x1="PL" :x2="W - PR" :y1="t.y" :y2="t.y" stroke="var(--color-line)" stroke-width="1" />
            <text :x="PL - 6" :y="t.y + 4" text-anchor="end" font-size="11" fill="var(--color-muted)">{{ t.label }}</text>
          </template>
          <template v-for="t in xTicks" :key="t.x">
            <line :x1="t.x" :x2="t.x" :y1="H - PB" :y2="H - PB + 4" stroke="var(--color-muted)" />
            <text :x="t.x" :y="H - PB + 18" text-anchor="middle" font-size="11" fill="var(--color-muted)">{{ t.label }}</text>
          </template>
        </g>
        <g v-for="s in drawn" :key="s.name">
          <polyline v-if="s.pts.length > 1" :points="s.pts.map((p) => `${p.x},${p.y}`).join(' ')" fill="none" :stroke="s.color" stroke-width="2" stroke-linejoin="round" />
          <circle v-for="p in s.pts" :key="p.key" :cx="p.x" :cy="p.y" r="4.5" :fill="s.color" stroke="#fff" stroke-width="1.5"><title>{{ s.name }}：{{ p.label }}</title></circle>
        </g>
      </svg>
      <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <li v-for="s in drawn" :key="s.name" class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ background: s.color }" />{{ s.name }}（{{ s.pts.length }} 个点）</li>
      </ul>
      <p v-if="total === 1" class="mt-1 text-xs text-muted">只有一个数据点：如实展示，尚无价格变化历史。</p>
    </template>
  </div>
</template>

<script setup lang="ts">
export interface Series { name: string; points: { t: number; v: number; label: string }[] }
const props = defineProps<{ series: Series[]; unitLabel?: string }>()

const W = 640; const H = 260; const PL = 52; const PR = 16; const PT = 12; const PB = 30
const COLORS = ['#1f4d3a', '#b5651d', '#2b5f8a', '#8a2b5f', '#6b6b1f', '#5a3a8a']
const all = computed(() => props.series.flatMap((s) => s.points))
const total = computed(() => all.value.length)
const hasData = computed(() => total.value > 0)

const range = computed(() => {
  const ts = all.value.map((p) => p.t); const vs = all.value.map((p) => p.v)
  let t0 = Math.min(...ts); let t1 = Math.max(...ts)
  if (t0 === t1) { t0 -= 86400000 * 3; t1 += 86400000 * 3 }
  let v0 = Math.min(...vs); let v1 = Math.max(...vs)
  if (v0 === v1) { const pad = Math.abs(v0) * 0.1 || 1; v0 -= pad; v1 += pad } else { const pad = (v1 - v0) * 0.1; v0 -= pad; v1 += pad }
  return { t0, t1, v0, v1 }
})
const sx = (t: number) => PL + ((t - range.value.t0) / (range.value.t1 - range.value.t0)) * (W - PL - PR)
const sy = (v: number) => PT + (1 - (v - range.value.v0) / (range.value.v1 - range.value.v0)) * (H - PT - PB)

const drawn = computed(() => props.series.filter((s) => s.points.length).map((s, i) => ({
  name: s.name, color: COLORS[i % COLORS.length]!,
  pts: [...s.points].sort((a, b) => a.t - b.t).map((p, j) => ({ x: sx(p.t), y: sy(p.v), label: p.label, key: `${i}-${j}` })),
})))
const yTicks = computed(() => Array.from({ length: 5 }, (_, i) => {
  const v = range.value.v0 + ((range.value.v1 - range.value.v0) * i) / 4
  return { y: sy(v), label: v.toFixed(Math.abs(v) < 10 ? 2 : 0) }
}))
const xTicks = computed(() => Array.from({ length: 4 }, (_, i) => {
  const t = range.value.t0 + ((range.value.t1 - range.value.t0) * i) / 3
  return { x: sx(t), label: fmtDate(new Date(t)) }
}))
</script>
