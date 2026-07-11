import { afterEach, describe, expect, it } from 'vitest'
import { generateInvoices } from '@/server/services/invoices'
import { prisma } from '@/server/db'

// Рік 2029 навмисно: generateInvoices глобальний (усі договори БД), а seed
// заповнює 2026. У 2029 seed-договори не мають показників → NO_CURRENT_READING,
// тож не створюють рахунків і не заважають підрахунку. Тариф на 2029 не
// колідує з seed-тарифами (2026-01-01 / 2026-06-01).
let ids: Record<string, string> = {}
afterEach(async () => {
  await prisma.invoice.deleteMany({ where: { leaseId: ids.lease } })
  await prisma.meterReading.deleteMany({ where: { premisesId: ids.prem } })
  await prisma.lease.deleteMany({ where: { id: ids.lease } })
  await prisma.premises.deleteMany({ where: { id: ids.prem } })
  await prisma.tenant.deleteMany({ where: { id: ids.ten } })
  await prisma.tariff.deleteMany({ where: { id: ids.tariff } })
  await prisma.location.deleteMany({ where: { name: 'Генер' } })
  ids = {}
})

async function setup() {
  const loc = await prisma.location.create({ data: { name: 'Генер', address: 'вул. Г, 1' } })
  const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'G1', type: 'офіс', areaM2: '10' } })
  const ten = await prisma.tenant.create({ data: { name: 'Орендар Г' } })
  const lease = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2029, 0, 1)), endDate: null, rentKop: 1_000_000, garbageKop: 30_000 } })
  const tariff = await prisma.tariff.create({ data: { effectiveFrom: new Date(Date.UTC(2029, 0, 1)), electricityRateKop: 432, waterRateKop: 1250 } })
  await prisma.meterReading.create({ data: { premisesId: prem.id, year: 2029, month: 5, electricity: '100', water: '9' } })
  await prisma.meterReading.create({ data: { premisesId: prem.id, year: 2029, month: 6, electricity: '150', water: '12.5' } })
  ids = { loc: loc.id, prem: prem.id, ten: ten.id, lease: lease.id, tariff: tariff.id }
  return ids
}

describe('generateInvoices', () => {
  it('формує рахунок і зберігає заморожені суми', async () => {
    const { lease } = await setup()
    const r = await generateInvoices(2029, 6)
    expect(r.created).toBe(1)
    const inv = await prisma.invoice.findFirstOrThrow({ where: { leaseId: lease, year: 2029, month: 6 } })
    expect(inv.totalKop).toBe(1_000_000 + 50 * 432 + Math.round(3.5 * 1250) + 30_000)
    expect(inv.electricityRateKop).toBe(432)
    expect(inv.prevElectricity.toString()).toBe('100')
  })

  it('повторний виклик за той самий місяць нічого не створює (ALREADY_EXISTS)', async () => {
    const { lease } = await setup()
    await generateInvoices(2029, 6)
    const r = await generateInvoices(2029, 6)
    expect(r.created).toBe(0)
    expect(r.skipped).toContainEqual({ leaseId: lease, reason: 'ALREADY_EXISTS' })
    expect(await prisma.invoice.count({ where: { leaseId: lease, year: 2029, month: 6 } })).toBe(1)
  })
})
