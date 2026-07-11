import { toCsv } from '@/server/csv'
import { fromKop } from '@/domain/money'
import type { DebtRow, MonthlyReport } from '@/server/services/reports'
import type { InvoiceStatus } from '@/domain/types'

const STATUS_UK: Record<InvoiceStatus, string> = {
  UNPAID: 'Не оплачено',
  PARTIAL: 'Частково',
  PAID: 'Оплачено',
}

/** CSV звіту боргів: суми — грн рядком (fromKop) у фіксованому порядку колонок. */
export function debtsToCsv(rows: DebtRow[]): string {
  return toCsv(
    ['Орендар', 'Приміщення', 'Нараховано, грн', 'Оплачено, грн', 'Борг, грн', 'Аванс, грн'],
    rows.map((r) => [r.tenantName, r.premisesLabel, fromKop(r.invoicedKop), fromKop(r.paidKop), fromKop(r.debtKop), fromKop(r.advanceKop)]),
  )
}

/** CSV місячного звіту: сума — грн рядком, статус — українською. */
export function monthlyToCsv(rep: MonthlyReport): string {
  return toCsv(
    ['Орендар', 'Приміщення', 'Сума, грн', 'Статус'],
    rep.rows.map((r) => [r.tenantName, r.premisesLabel, fromKop(r.totalKop), STATUS_UK[r.status] ?? r.status]),
  )
}
