import { asc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const db = useDb()
  const cats = await loadCategoryMap(db)
  const [attributeDefs, brands, merchants, tags] = await Promise.all([
    db.select().from(schema.attributeDefs).orderBy(asc(schema.attributeDefs.sortOrder), asc(schema.attributeDefs.label)),
    db.select().from(schema.brands).orderBy(asc(schema.brands.name)),
    db.select().from(schema.merchants).orderBy(asc(schema.merchants.name)),
    db.select().from(schema.tags).orderBy(asc(schema.tags.name)),
  ])
  const categories = cats.rows
    .map((c) => ({ ...c, path: cats.pathOf(c.id), effectiveTemplate: cats.templateOf(c.id) }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
  return { categories, attributeDefs, brands, merchants, tags }
})
