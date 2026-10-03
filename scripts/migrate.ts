import { runMigrations } from '../server/db/migrate'

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL 未设置'); process.exit(1) }
await runMigrations(url)
console.log('数据库迁移完成')
