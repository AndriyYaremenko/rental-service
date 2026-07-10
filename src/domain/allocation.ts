import type {
  AllocationEntry,
  AllocationResult,
  InvoiceForAllocation,
  InvoiceStatus,
  Kop,
} from './types'

/**
 * Розносить загальну суму оплат договору по його рахунках,
 * гасячи найстаріші першими.
 *
 * Статус рахунку ніде не зберігається — він завжди є результатом
 * цієї функції, тому не може розійтися з фактичними оплатами.
 */
export function allocatePayments(
  invoices: InvoiceForAllocation[],
  totalPaidKop: Kop,
): AllocationResult {
  const ordered = [...invoices].sort(
    (a, b) =>
      a.year - b.year ||
      a.month - b.month ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  )

  let pool = totalPaidKop
  const byInvoiceId = new Map<string, AllocationEntry>()

  for (const invoice of ordered) {
    const coveredKop = Math.min(pool, invoice.totalKop)
    pool -= coveredKop

    const status: InvoiceStatus =
      coveredKop === 0 ? 'UNPAID'
      : coveredKop < invoice.totalKop ? 'PARTIAL'
      : 'PAID'

    byInvoiceId.set(invoice.id, { coveredKop, status })
  }

  return { byInvoiceId, advanceKop: pool }
}
