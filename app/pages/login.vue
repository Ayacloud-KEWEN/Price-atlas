<template>
  <div class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
    <h1 class="mb-1 text-2xl font-semibold text-brand">Price Atlas</h1>
    <p class="mb-6 text-sm text-muted">私人价格收集器 · 请登录</p>
    <form class="card space-y-4 p-5" @submit.prevent="submit" novalidate>
      <div>
        <label class="label" for="u">用户名</label>
        <input id="u" v-model="username" class="input" autocomplete="username" autocapitalize="none" required />
      </div>
      <div>
        <label class="label" for="p">密码</label>
        <input id="p" v-model="password" type="password" class="input" autocomplete="current-password" required />
      </div>
      <p v-if="error" class="err" role="alert">{{ error }}</p>
      <button class="btn btn-primary w-full" :disabled="busy">{{ busy ? '登录中…' : '登录' }}</button>
    </form>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'blank' })
const username = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)
const route = useRoute()

async function submit() {
  error.value = ''; busy.value = true
  try {
    await api('/api/auth/login', { method: 'POST', body: { username: username.value, password: password.value } })
    useSessionState().value = 'ok'
    const redirect = String(route.query.redirect || '/')
    await navigateTo(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/', { external: true })
  } catch (e: any) {
    error.value = e.message
  } finally { busy.value = false }
}
</script>
