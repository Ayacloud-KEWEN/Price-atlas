import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false, // 私人单用户应用：纯 SPA，HTML 外壳不含业务数据；离线草稿更简单
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'Price Atlas',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#1f4d3a' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'apple-touch-icon', href: '/icon.svg' },
      ],
    },
  },
  nitro: {
    
    errorHandler: '~~/server/error-handler',
  },
  runtimeConfig: {
    // 仅服务端，来自环境变量，不会暴露给前端
    sessionSecret: '',
  },
})
