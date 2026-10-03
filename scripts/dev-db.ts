// 无需 Docker 的本地开发数据库：内嵌 PostgreSQL (PGlite) + 套接字服务，数据保存在 .data/pgdata
// 用法：npm run db:dev   然后 DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5455/postgres
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const dir = process.env.PGLITE_DIR || '.data/pgdata'
const port = Number(process.env.PGLITE_PORT || 5455)
import { mkdirSync } from 'node:fs'
mkdirSync(dir, { recursive: true })
const db = await PGlite.create(dir)
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' })
await server.start()
console.log(`PGlite 开发数据库已启动: postgres://postgres:postgres@127.0.0.1:${port}/postgres  (数据目录 ${dir})`)
process.on('SIGINT', async () => { await server.stop(); await db.close(); process.exit(0) })
