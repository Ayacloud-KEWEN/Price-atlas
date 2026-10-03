import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { name } = z.object({ name: reqText(40) }).parse(await readBody(event))
  const [id] = await upsertTagNames(useDb(), [name])
  return { id, name }
})
