import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { advanceKop, debtKop } from '@/domain/debt'
import { listInvoices } from '@/server/services/invoices'
import { allocatePayments } from '@/domain/allocation'
import { leaseState } from '@/domain/status'
import type { InvoiceForAllocation, InvoiceStatus } from '@/domain/types'

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

export interface HistoryInvoice {
  id: string
  year: number
  month: number
  totalKop: number
  status: InvoiceStatus
}

export interface HistoryLease {
  leaseId: string
  tenantName: string
  startDate: string
  endDate: string | null
  status: 'ACTIVE' | 'ENDED'
  invoices: HistoryInvoice[]
}

export interface PremisesHistory {
  premisesId: string
  premisesLabel: string
  leases: HistoryLease[]
}

/** FIFO-статуси всіх рахунків одного договору (як у invoices-view, локально). */
function statusesForLease(invoices: { id: string; year: number; month: number; createdAt: Date; totalKop: number }[], totalPaidKop: number): Map<string, InvoiceStatus> {
  const forAlloc: InvoiceForAllocation[] = invoices.map((i) => ({ id: i.id, year: i.year, month: i.month, createdAt: i.createdAt, totalKop: i.totalKop }))
  const { byInvoiceId } = allocatePayments(forAlloc, totalPaidKop)
  const map = new Map<string, InvoiceStatus>()
  for (const [id, entry] of byInvoiceId) map.set(id, entry.status)
  return map
}

export async function reportPremisesHistory(premisesId: string): Promise<PremisesHistory> {
  const premises = await prisma.premises.findUnique({
    where: { id: premisesId },
    select: { id: true, unitNumber: true, location: { select: { name: true } } },
  })
  if (!premises) throw new ApiError('NOT_FOUND', 'Приміщення не знайдено')

  const leases = await prisma.lease.findMany({
    where: { premisesId },
    orderBy: { startDate: 'desc' },
    include: {
      tenant: { select: { name: true } },
      invoices: { select: { id: true, year: true, month: true, createdAt: true, totalKop: true }, orderBy: [{ year: 'asc' }, { month: 'asc' }] },
      payments: { select: { amountKop: true } },
    },
  })

  const historyLeases: HistoryLease[] = leases.map((l) => {
    const totalPaid = l.payments.reduce((s, p) => s + p.amountKop, 0)
    const status = statusesForLease(l.invoices, totalPaid)
    return {
      leaseId: l.id,
      tenantName: l.tenant.name,
      startDate: l.startDate.toISOString(),
      endDate: l.endDate ? l.endDate.toISOString() : null,
      status: leaseState({ startDate: l.startDate, endDate: l.endDate }, new Date()),
      invoices: l.invoices.map((i) => ({ id: i.id, year: i.year, month: i.month, totalKop: i.totalKop, status: status.get(i.id) ?? 'UNPAID' })),
    }
  })

  return { premisesId: premises.id, premisesLabel: `${premises.location.name} · ${premises.unitNumber}`, leases: historyLeases }
}
