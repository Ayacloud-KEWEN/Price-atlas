export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  return findDuplicates(useDb(), id)
})
