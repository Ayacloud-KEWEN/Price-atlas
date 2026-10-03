import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { resolve } from 'node:path'
import * as schema from './schema'

/** 预置分类树（可在界面中修改，不依赖代码）。仅在分类表为空时写入。 */
const DEFAULT_TREE: { name: string; template?: string; systemKey?: string; children?: { name: string; template?: string }[] }[] = [
  { name: '食品', children: [{ name: '鱼子酱', template: 'caviar' }] },
  {
    name: '酒类', template: 'alcohol_other',
    children: [
      { name: '葡萄酒', template: 'wine' },
      { name: '起泡酒', template: 'sparkling' },
      { name: '烈酒', template: 'spirits' },
      { name: '啤酒', template: 'beer' },
      { name: '其他酒类', template: 'alcohol_other' },
    ],
  },
  { name: '美妆', children: [{ name: '香水', template: 'perfume' }] },
  { name: '其他商品' },
  { name: '待分类', systemKey: 'uncategorized' },
]

export async function runMigrations(url: string, folder = process.env.MIGRATIONS_DIR || resolve(process.cwd(), 'drizzle')) {
  const client = postgres(url, { max: 1, onnotice: () => {} })
  const db = drizzle(client, { schema })
  try {
    await migrate(db, { migrationsFolder: folder })
    const existing = await db.select({ id: schema.categories.id }).from(schema.categories).limit(1)
    if (!existing.length) {
      let order = 0
      for (const top of DEFAULT_TREE) {
        const [row] = await db.insert(schema.categories).values({
          name: top.name, template: top.template ?? null, systemKey: top.systemKey ?? null, sortOrder: order++,
        }).returning()
        let childOrder = 0
        for (const c of top.children ?? []) {
          await db.insert(schema.categories).values({
            parentId: row!.id, name: c.name, template: c.template ?? null, sortOrder: childOrder++,
          })
        }
      }
    }
  } finally {
    await client.end()
  }
}
