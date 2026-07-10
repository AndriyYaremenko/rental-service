import { requireUser } from '@/server/auth/guard'
import { ApiError, json, route } from '@/server/http'
import { getReadingsForMonth } from '@/server/services/readings'

function period(req: import('next/server').NextRequest): { year: number; month: number } {
  const y = Number(req.nextUrl.searchParams.get('year'))
  const m = Number(req.nextUrl.searchParams.get('month'))
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    throw new ApiError('VALIDATION_FAILED', 'Потрібні коректні year і month')
  }
  return { year: y, month: m }
}

export const GET = route(async (req) => {
  await requireUser()
  const { year, month } = period(req)
  return json(await getReadingsForMonth(year, month))
})
