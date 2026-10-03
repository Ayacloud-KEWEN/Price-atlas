import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let _db: PostgresJsDatabase<typeof schema> | null = null

export function useDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL 未设置')
    // pglite-socket（本地开发）只支持单连接
    const max = Number(process.env.DB_POOL_MAX || 10)
    _db = drizzle(postgres(url, { max, onnotice: () => {} }), { schema })
  }
  return _db
}
export type Db = PostgresJsDatabase<typeof schema>
export { schema }
