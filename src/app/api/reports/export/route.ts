import { NextResponse } from 'next/server'
import { requireUser } from '@/server/auth/guard'
import { ApiError, route } from '@/server/http'
import { parseYearMonth } from '@/server/query'
import { reportDebts, reportMonthly } from '@/server/services/reports'
import { debtsToCsv, monthlyToCsv } from '@/server/reports-csv'

function csvResponse(csv: string, name: string): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}.csv"`,
    },
  })
}

/** Тонкий роут: побудова CSV (колонки, fromKop, статуси) — у тестованих
 *  debtsToCsv/monthlyToCsv, тут лише вибір типу й формування Response. */
export const GET = route(async (req) => {
  await requireUser()
  const type = req.nextUrl.searchParams.get('type')

  if (type === 'debts') {
    return csvResponse(debtsToCsv(await reportDebts()), 'debts')
  }

  if (type === 'monthly') {
    const { year, month } = parseYearMonth(req.nextUrl.searchParams)
    return csvResponse(monthlyToCsv(await reportMonthly(year, month)), `monthly-${year}-${String(month).padStart(2, '0')}`)
  }

  throw new ApiError('VALIDATION_FAILED', 'Потрібен type=debts або type=monthly')
})
