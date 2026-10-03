import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const input = z.object({ product: productInput, variant: variantInput }).parse(await readBody(event))
  return useDb().transaction((tx) => createProductWithVariant(tx, input))
})
