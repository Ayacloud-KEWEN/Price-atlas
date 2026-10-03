export default defineEventHandler(async (event) => {
  const body = merchantInput.parse(await readBody(event))
  const [row] = await useDb().insert(schema.merchants).values(body).returning()
  return row
})
