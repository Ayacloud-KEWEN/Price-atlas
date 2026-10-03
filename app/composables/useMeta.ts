import { getTemplate, attributeDefToField, type FieldDef } from '../../shared/templates'

export interface Category {
  id: string; parentId: string | null; name: string; template: string | null; systemKey: string | null
  sortOrder: number; archived: boolean; path: string[]; effectiveTemplate: string
}
export interface Meta {
  categories: Category[]
  attributeDefs: any[]
  brands: any[]
  merchants: any[]
  tags: { id: string; name: string }[]
}

const empty = (): Meta => ({ categories: [], attributeDefs: [], brands: [], merchants: [], tags: [] })

export function useMeta() {
  const meta = useState<Meta>('meta', empty)
  const loaded = useState('meta-loaded', () => false)
  const fromCache = useState('meta-from-cache', () => false)

  async function load(force = false) {
    if (loaded.value && !force) return meta.value
    try {
      meta.value = await api<Meta>('/api/meta')
      loaded.value = true
      fromCache.value = false
      localDb.cacheSet('meta', meta.value)
    } catch (e: any) {
      if (e?.network) {
        const cached = await localDb.cacheGet<Meta>('meta')
        if (cached) { meta.value = cached; loaded.value = true; fromCache.value = true }
      } else throw e
    }
    return meta.value
  }

  const categoryById = (id?: string | null) => meta.value.categories.find((c) => c.id === id)
  const categoryLabel = (id?: string | null) => categoryById(id)?.path.join(' › ') ?? ''
  /** 缩进后的分类选项（含全部层级） */
  const categoryOptions = computed(() => {
    const cats = meta.value.categories.filter((c) => !c.archived)
    const out: { id: string; label: string; depth: number }[] = []
    const walk = (parent: string | null, depth: number) => {
      for (const c of cats.filter((x) => x.parentId === parent).sort((a, b) => a.sortOrder - b.sortOrder)) {
        out.push({ id: c.id, label: c.name, depth })
        walk(c.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  })
  const uncategorizedId = computed(() => meta.value.categories.find((c) => c.systemKey === 'uncategorized')?.id ?? null)

  /** 某分类的专属字段（内置模板 + 该分类及祖先上定义的自定义属性） */
  function fieldsFor(categoryId?: string | null): FieldDef[] {
    const cat = categoryById(categoryId)
    const tpl = getTemplate(cat?.effectiveTemplate)
    const ids = new Set<string>()
    let cur = cat
    while (cur) { ids.add(cur.id); cur = cur.parentId ? categoryById(cur.parentId) : undefined }
    const custom = meta.value.attributeDefs.filter((d) => ids.has(d.categoryId)).map(attributeDefToField)
    return [...tpl.fields, ...custom]
  }

  return { meta, loaded, fromCache, load, categoryById, categoryLabel, categoryOptions, uncategorizedId, fieldsFor }
}
