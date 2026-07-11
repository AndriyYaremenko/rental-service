import { prisma } from '@/server/db'
import { advanceKop, debtKop } from '@/domain/debt'

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
