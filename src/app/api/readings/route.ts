import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { parseYearMonth } from '@/server/query'
import { getReadingsForMonth, saveReadings } from '@/server/services/readings'
import { saveReadingsSchema } from '@/lib/validation/reading'

export const GET = route(async (req) => {
  await requireUser()
  const { year, month } = parseYearMonth(req.nextUrl.searchParams)
  return json(await getReadingsForMonth(year, month))
})

export const POST = route(async (req) => {
  await requireUser()
  const body = await parseBody(req, saveReadingsSchema)
  return json(await saveReadings(body))
})
