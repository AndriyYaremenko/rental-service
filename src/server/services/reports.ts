import { prisma } from '@/server/db'
import { advanceKop, debtKop } from '@/domain/debt'
import { listInvoices } from '@/server/services/invoices'

export interface DebtRow {
  leaseId: string
  tenantName: string
  premisesLabel: string
  invoicedKop: number
  paidKop: number
  debtKop: number
  advanceKop: number
}

/** Борг/аванс по кожному договору з активністю (є рахунок або оплата). */
export async function reportDebts(): Promise<DebtRow[]> {
  const leases = await prisma.lease.findMany({
    include: {
      tenant: { select: { name: true } },
      premises: { select: { unitNumber: true, location: { select: { name: true } } } },
      invoices: { select: { totalKop: true } },
      payments: { select: { amountKop: true } },
    },
  })

  const rows: DebtRow[] = []
  for (const l of leases) {
    if (l.invoices.length === 0 && l.payments.length === 0) continue
    const invoicedKop = l.invoices.reduce((s, i) => s + i.totalKop, 0)
    const paidKop = l.payments.reduce((s, p) => s + p.amountKop, 0)
    rows.push({
      leaseId: l.id,
      tenantName: l.tenant.name,
      premisesLabel: `${l.premises.location.name} · ${l.premises.unitNumber}`,
      invoicedKop,
      paidKop,
      debtKop: debtKop(invoicedKop, paidKop),
      advanceKop: advanceKop(invoicedKop, paidKop),
    })
  }
  rows.sort((a, b) => b.debtKop - a.debtKop || a.tenantName.localeCompare(b.tenantName, 'uk'))
  return rows
}

export interface MonthlyRow {
  leaseId: string
  tenantName: string
  premisesLabel: string
  totalKop: number
  status: 'UNPAID' | 'PARTIAL' | 'PAID'
}

export interface MonthlyReport {
  year: number
  month: number
  rows: MonthlyRow[]
  totalInvoicedKop: number
  count: number
}

/** Місячний звіт: рахунки за (year, month) зі статусом FIFO + підсумок.
 *  Статус бере вже тестований listInvoices — DRY, без дублювання алокації. */
export async function reportMonthly(year: number, month: number): Promise<MonthlyReport> {
  const invoices = await listInvoices(year, month)
  const leaseIds = [...new Set(invoices.map((i) => i.leaseId))]
  const leases = await prisma.lease.findMany({
    where: { id: { in: leaseIds } },
    select: { id: true, tenant: { select: { name: true } }, premises: { select: { unitNumber: true, location: { select: { name: true } } } } },
  })
  const label = new Map(leases.map((l) => [l.id, { tenantName: l.tenant.name, premisesLabel: `${l.premises.location.name} · ${l.premises.unitNumber}` }]))

  const rows: MonthlyRow[] = invoices.map((i) => ({
    leaseId: i.leaseId,
    tenantName: label.get(i.leaseId)?.tenantName ?? '',
    premisesLabel: label.get(i.leaseId)?.premisesLabel ?? '',
    totalKop: i.totalKop,
    status: i.status,
  }))
  return { year, month, rows, totalInvoicedKop: rows.reduce((s, r) => s + r.totalKop, 0), count: rows.length }
}
