<template>
  <div class="min-h-dvh md:flex">
    <!-- 桌面侧栏 -->
    <aside v-show="!navCollapsed" class="hidden w-56 shrink-0 border-r border-line bg-surface md:block">
      <div class="sticky top-0 flex h-dvh flex-col overflow-y-auto p-4">
        <div class="mb-6 flex items-center justify-between gap-2">
          <NuxtLink to="/" class="flex items-center gap-2 text-lg font-semibold text-brand">
            <span class="inline-block h-6 w-6 rounded-md bg-brand"></span> Price Atlas
          </NuxtLink>
          <button type="button" class="btn btn-sm !min-h-9 !px-2" aria-label="收起侧边栏" title="收起侧边栏" @click="setCollapsed(true)">«</button>
        </div>
        <nav class="flex flex-1 flex-col gap-0.5 text-sm" aria-label="主导航">
          <p class="px-2 pb-1 text-xs font-semibold text-muted">采集</p>
          <NavLink to="/" label="采集" />
          <NavLink to="/drafts" label="草稿" :badge="sync.unsyncedCount.value" />
          <NavLink to="/records" label="记录" />
          <p class="px-2 pb-1 pt-4 text-xs font-semibold text-muted">整理与分析</p>
          <NavLink to="/inbox" label="待整理收件箱" />
          <NavLink to="/products" label="商品库" />
          <NavLink to="/quotes" label="报价列表" />
          <NavLink to="/analysis" label="价格分析" />
          <NavLink to="/base" label="基础资料" />
        </nav>
        <button class="btn btn-sm mt-4" @click="logout">退出登录</button>
      </div>
    </aside>

    <div class="min-w-0 flex-1">
      <button v-if="navCollapsed" type="button" class="btn btn-sm fixed left-2 top-2 z-30 hidden !min-h-10 shadow md:inline-flex" aria-label="展开侧边栏" title="展开侧边栏" @click="setCollapsed(false)">☰ 菜单</button>
      <!-- 手机顶栏 -->
      <header class="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-2 backdrop-blur md:hidden">
        <NuxtLink to="/" class="font-semibold text-brand">Price Atlas</NuxtLink>
        <div ref="moreRoot" class="relative">
          <button type="button" class="btn btn-sm" aria-haspopup="true" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen">更多 {{ moreOpen ? '▴' : '▾' }}</button>
          <div v-if="moreOpen" class="absolute right-0 mt-1 w-44 rounded-lg border border-line bg-surface p-1 shadow-lg">
            <NuxtLink v-for="l in moreLinks" :key="l.to" :to="l.to" class="block rounded px-3 py-2 text-sm hover:bg-brand-50" @click="moreOpen = false">{{ l.label }}</NuxtLink>
            <button class="block w-full rounded px-3 py-2 text-left text-sm hover:bg-brand-50" @click="logout">退出登录</button>
          </div>
        </div>
      </header>

      <SyncBanner />

      <main :class="navCollapsed ? 'md:!pt-14' : ''" class="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-6">
        <slot />
      </main>

      <!-- 手机底部导航 -->
      <nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="底部导航">
        <NuxtLink v-for="t in tabs" :key="t.to" :to="t.to" class="relative flex min-h-14 flex-col items-center justify-center text-sm text-muted"
          active-class="!text-brand font-semibold" :exact="t.to === '/'">
          <span>{{ t.label }}</span>
          <span v-if="t.badge" class="absolute right-[28%] top-2 rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white">{{ t.badge }}</span>
        </NuxtLink>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
const sync = useSyncEngine()
// 侧边栏折叠（横屏手机宽度也会进入桌面布局，可手动收起；记住选择，首次在矮屏上默认收起）
const navCollapsed = ref(false)
function setCollapsed(v: boolean) { navCollapsed.value = v; try { localStorage.setItem('pa_nav_collapsed', v ? '1' : '0') } catch {} }
const moreOpen = ref(false)
const moreRoot = ref<HTMLElement | null>(null)
const route = useRoute()
watch(() => route.fullPath, () => { moreOpen.value = false })
function onDocClick(e: Event) { if (moreOpen.value && moreRoot.value && !moreRoot.value.contains(e.target as Node)) moreOpen.value = false }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') moreOpen.value = false }
onMounted(() => {
  try {
    const saved = localStorage.getItem('pa_nav_collapsed')
    navCollapsed.value = saved === null ? window.innerHeight < 500 : saved === '1'
  } catch { navCollapsed.value = window.innerHeight < 500 }
  document.addEventListener('click', onDocClick); document.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKey) })
const tabs = computed(() => [
  { to: '/', label: '采集' },
  { to: '/drafts', label: '草稿', badge: sync.unsyncedCount.value || 0 },
  { to: '/records', label: '记录' },
])
const moreLinks = [
  { to: '/inbox', label: '待整理收件箱' }, { to: '/products', label: '商品库' }, { to: '/quotes', label: '报价列表' },
  { to: '/analysis', label: '价格分析' }, { to: '/base', label: '基础资料' },
]
async function logout() {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
  await navigateTo('/login', { external: true })
}
</script>
