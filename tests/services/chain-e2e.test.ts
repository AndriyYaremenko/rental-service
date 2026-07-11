import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/db'
import { saveReadings } from '@/server/services/readings'
import { generateInvoices } from '@/server/services/invoices'
import { createPayment } from '@/server/services/payments'
import { reportDebts } from '@/server/services/reports'
import { toCsv } from '@/server/csv'

let ids: Record<string, string> = {}
afterEach(async () => {
  if (ids.lease) {
    await prisma.payment.deleteMany({ where: { leaseId: ids.lease } })
    await prisma.invoice.deleteMany({ where: { leaseId: ids.lease } })
    await prisma.meterReading.deleteMany({ where: { premisesId: ids.prem } })
    await prisma.lease.deleteMany({ where: { id: ids.lease } })
    await prisma.premises.deleteMany({ where: { id: ids.prem } })
    await prisma.tenant.deleteMany({ where: { id: ids.ten } })
    await prisma.tariff.deleteMany({ where: { id: ids.tariff } })
    await prisma.location.deleteMany({ where: { name: 'Ланцюг' } })
  }
  ids = {}
})

describe('наскрізний ланцюг: показники → нарахування → оплата → звіт → CSV', () => {
  it('проходить увесь конвеєр і дає узгоджений борг', async () => {
    const loc = await prisma.location.create({ data: { name: 'Ланцюг', address: 'вул. Л, 1' } })
    const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'C1', type: 'офіс', areaM2: '10' } })
    const ten = await prisma.tenant.create({ data: { name: 'Орендар Л' } })
    const lease = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2029, 0, 1)), endDate: null, rentKop: 1_000_000, garbageKop: 30_000 } })
    const tariff = await prisma.tariff.create({ data: { effectiveFrom: new Date(Date.UTC(2029, 0, 1)), electricityRateKop: 432, waterRateKop: 1250 } })
    ids = { loc: loc.id, prem: prem.id, ten: ten.id, lease: lease.id, tariff: tariff.id }

    // показники двох місяців
    await saveReadings({ year: 2029, month: 5, entries: [{ premisesId: prem.id, electricity: '100', water: '9' }] })
    await saveReadings({ year: 2029, month: 6, entries: [{ premisesId: prem.id, electricity: '150', water: '12.5' }] })

    // нарахування
    const gen = await generateInvoices(2029, 6)
    expect(gen.created).toBe(1)
    const inv = (await listInvoicesSafe(lease.id))
    const totalKop = 1_000_000 + 50 * 432 + Math.round(3.5 * 1250) + 30_000
    expect(inv.totalKop).toBe(totalKop)

    // часткова оплата
    await createPayment({ leaseId: lease.id, date: '2029-06-20', amountUah: '5000', method: 'CASH' })

    // звіт боргів
    const row = (await reportDebts()).find((r) => r.leaseId === lease.id)!
    expect(row.invoicedKop).toBe(totalKop)
    expect(row.paidKop).toBe(500_000)
    expect(row.debtKop).toBe(totalKop - 500_000)

    // CSV не порожній і містить орендаря
    const csv = toCsv(['Орендар'], [[row.tenantName]])
    expect(csv).toContain('Орендар Л')
  })
})

async function listInvoicesSafe(leaseId: string) {
  const inv = await prisma.invoice.findFirstOrThrow({ where: { leaseId, year: 2029, month: 6 } })
  return inv
}
