import { runMigrations } from '../db/migrate'

// 服务启动时自动应用数据库迁移并写入预置分类（幂等）
export default defineNitroPlugin(async () => {
  const url = process.env.DATABASE_URL
  if (!url) { console.warn('[price-atlas] DATABASE_URL 未设置，跳过迁移'); return }
  for (let i = 0; i < 20; i++) {
    try {
      await runMigrations(url)
      console.log('[price-atlas] 数据库迁移完成')
      return
    } catch (e: any) {
      console.warn(`[price-atlas] 等待数据库… (${i + 1}/20) ${e?.cause?.message || e?.message}`)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  console.error('[price-atlas] 数据库迁移失败')
})
