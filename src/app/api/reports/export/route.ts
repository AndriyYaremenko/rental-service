import { NextResponse } from 'next/server'
import { requireUser } from '@/server/auth/guard'
import { ApiError, route } from '@/server/http'
import { parseYearMonth } from '@/server/query'
import { reportDebts, reportMonthly } from '@/server/services/reports'
import { fromKop } from '@/domain/money'

/** Суми у CSV — грн рядком (fromKop, крапка-роздільник) для парсингу таблицею. */
function csvResponse(csv: string, name: string): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}.csv"`,
    },
  })
}

export const GET = route(async (req) => {
  await requireUser()
  const type = req.nextUrl.searchParams.get('type')

  if (type === 'debts') {
    const rows = await reportDebts()
    const { toCsv } = await import('@/server/csv')
    const csv = toCsv(
      ['Орендар', 'Приміщення', 'Нараховано, грн', 'Оплачено, грн', 'Борг, грн', 'Аванс, грн'],
      rows.map((r) => [r.tenantName, r.premisesLabel, fromKop(r.invoicedKop), fromKop(r.paidKop), fromKop(r.debtKop), fromKop(r.advanceKop)]),
    )
    return csvResponse(csv, 'debts')
  }

  if (type === 'monthly') {
    const { year, month } = parseYearMonth(req.nextUrl.searchParams)
    const rep = await reportMonthly(year, month)
    const { toCsv } = await import('@/server/csv')
    const STATUS_UK: Record<string, string> = { UNPAID: 'Не оплачено', PARTIAL: 'Частково', PAID: 'Оплачено' }
    const csv = toCsv(
      ['Орендар', 'Приміщення', 'Сума, грн', 'Статус'],
      rep.rows.map((r) => [r.tenantName, r.premisesLabel, fromKop(r.totalKop), STATUS_UK[r.status] ?? r.status]),
    )
    return csvResponse(csv, `monthly-${year}-${String(month).padStart(2, '0')}`)
  }

  throw new ApiError('VALIDATION_FAILED', 'Потрібен type=debts або type=monthly')
})
