/** 创建（或幂等同步）一条价格观察：同一 clientId 重复提交只会返回已有记录。 */
export default defineEventHandler(async (event) => {
  const input = observationCreate.parse(await readBody(event))
  const { observation, duplicate } = await createObservation(input)
  const db = useDb()
  const counts = await photoCounts(db, [observation.id])
  return { id: observation.id, clientId: observation.clientId, status: observation.status, duplicate, photoCount: counts.get(observation.id) ?? 0 }
})
