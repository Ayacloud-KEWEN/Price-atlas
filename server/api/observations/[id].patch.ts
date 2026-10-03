/** 修正已有记录（保留修改前后值）。要记录“新的一次价格”请 POST 新记录，而不是修改旧记录。 */
export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const patch = parsePartial(observationPatch, await readBody(event)) as Record<string, any>
  const { changes } = await patchObservation(id, patch)
  return { ok: true, changes }
})
