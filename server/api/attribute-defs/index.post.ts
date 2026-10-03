import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const body = z.object({
    categoryId: uuid,
    label: reqText(40),
    key: z.string().trim().regex(/^[a-z0-9_]{1,40}$/, '标识只能含小写字母、数字、下划线').optional(),
    type: z.enum(['text', 'number', 'enum', 'measure']),
    unit: optText(20),
    options: z.array(z.string().trim().min(1).max(40)).max(50).nullish(),
  }).parse(await readBody(event))
  if (body.type === 'enum' && !body.options?.length) throw fieldError({ options: '枚举类型请至少提供一个选项' })
  if (body.type === 'measure' && !body.unit) throw fieldError({ unit: '带单位的数值请填写单位' })
  const key = body.key || `a${Date.now().toString(36)}`
  try {
    const [row] = await useDb().insert(schema.attributeDefs).values({ ...body, key, options: body.options ?? null }).returning()
    return row
  } catch (e: any) {
    if (e?.cause?.code === '23505' || /unique/i.test(String(e?.message))) throw fieldError({ key: '该分类下已存在相同标识的属性' })
    throw e
  }
})
