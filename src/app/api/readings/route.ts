import { requireUser } from '@/server/auth/guard'
import { json, route } from '@/server/http'
import { parseYearMonth } from '@/server/query'
import { getReadingsForMonth } from '@/server/services/readings'

export const GET = route(async (req) => {
  await requireUser()
  const { year, month } = parseYearMonth(req.nextUrl.searchParams)
  return json(await getReadingsForMonth(year, month))
})
