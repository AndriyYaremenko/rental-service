import { requireUser } from '@/server/auth/guard'
import { json, route } from '@/server/http'
import { parseYearMonth } from '@/server/query'
import { reportMonthly } from '@/server/services/reports'

export const GET = route(async (req) => {
  await requireUser()
  const { year, month } = parseYearMonth(req.nextUrl.searchParams)
  return json(await reportMonthly(year, month))
})
