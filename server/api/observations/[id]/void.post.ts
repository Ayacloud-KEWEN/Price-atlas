import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const { reason } = z.object({ reason: optText(300) }).parse(await readBody(event))
  const row = await voidObservation(id, reason)
  return { ok: true, status: row.status }
})
