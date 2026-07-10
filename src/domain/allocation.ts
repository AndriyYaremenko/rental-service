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

    // PAID перевіряється ПЕРШИМ: для рахунку на нульову суму умови
    // `coveredKop === 0` і `coveredKop === totalKop` істинні одночасно,
    // а рахунок на 0 грн нічого не вимагає, отже закритий.
    const status: InvoiceStatus =
      coveredKop === invoice.totalKop ? 'PAID'
      : coveredKop === 0 ? 'UNPAID'
      : 'PARTIAL'

    byInvoiceId.set(invoice.id, { coveredKop, status })
  }

  return { byInvoiceId, advanceKop: pool }
}
