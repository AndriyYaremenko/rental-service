import { afterEach, describe, expect, it } from 'vitest'
import { generateInvoices } from '@/server/services/invoices'
import { prisma } from '@/server/db'

// Рік 2029 навмисно: generateInvoices глобальний (усі договори БД), а seed
// заповнює 2026. У 2029 seed-договори не мають показників → NO_CURRENT_READING,
// тож не створюють рахунків і не заважають підрахунку. Тариф на 2029 не
// колідує з seed-тарифами (2026-01-01 / 2026-06-01).
const LOC = 'Генер'
const TARIFF_FROM = new Date(Date.UTC(2029, 0, 1))

// Прибирання за локацією, а не за одиничним id: тест із кількома договорами
// створює кілька приміщень/орендарів. Так само уникаємо небезпеки
// deleteMany({ where: { leaseId: undefined } }) (Prisma тлумачить undefined як
// «без фільтра» → знесло б УСІ рахунки в БД).
afterEach(async () => {
  const loc = await prisma.location.findFirst({ where: { name: LOC } })
  if (loc) {
    const prems = await prisma.premises.findMany({ where: { locationId: loc.id }, select: { id: true } })
    const premIds = prems.map((p) => p.id)
    const leases = await prisma.lease.findMany({ where: { premisesId: { in: premIds } }, select: { id: true, tenantId: true } })
    const leaseIds = leases.map((l) => l.id)
    await prisma.invoice.deleteMany({ where: { leaseId: { in: leaseIds } } })
    await prisma.meterReading.deleteMany({ where: { premisesId: { in: premIds } } })
    await prisma.lease.deleteMany({ where: { id: { in: leaseIds } } })
    await prisma.premises.deleteMany({ where: { id: { in: premIds } } })
    await prisma.tenant.deleteMany({ where: { id: { in: leases.map((l) => l.tenantId) } } })
    await prisma.location.deleteMany({ where: { id: loc.id } })
  }
  await prisma.tariff.deleteMany({ where: { effectiveFrom: TARIFF_FROM } })
})

/** Один договір із показниками 2029-05/06 і тарифом на 2029. */
async function setup() {
  const loc = await prisma.location.create({ data: { name: LOC, address: 'вул. Г, 1' } })
  const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'G1', type: 'офіс', areaM2: '10' } })
  const ten = await prisma.tenant.create({ data: { name: 'Орендар Г' } })
  const lease = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2029, 0, 1)), endDate: null, rentKop: 1_000_000, garbageKop: 30_000 } })
  await prisma.tariff.create({ data: { effectiveFrom: TARIFF_FROM, electricityRateKop: 432, waterRateKop: 1250 } })
  await prisma.meterReading.create({ data: { premisesId: prem.id, year: 2029, month: 5, electricity: '100', water: '9' } })
  await prisma.meterReading.create({ data: { premisesId: prem.id, year: 2029, month: 6, electricity: '150', water: '12.5' } })
  return { lease: lease.id, prem: prem.id }
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

  it('формує рахунок КОЖНОМУ придатному договору в одному виклику (не лише першому)', async () => {
    // Два незалежні договори з показниками за місяць → план містить ДВА рахунки.
    // Ловить регресію, за якої персиститься/рахується лише перший (toCreate[0])
    // або created жорстко = 1. Одиничні тести вище такого мутанта не вбивають.
    const loc = await prisma.location.create({ data: { name: LOC, address: 'вул. Г, 2' } })
    const mk = async (unit: string, tenant: string) => {
      const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: unit, type: 'офіс', areaM2: '10' } })
      const ten = await prisma.tenant.create({ data: { name: tenant } })
      const lease = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2029, 0, 1)), endDate: null, rentKop: 1_000_000, garbageKop: 30_000 } })
      await prisma.meterReading.create({ data: { premisesId: prem.id, year: 2029, month: 6, electricity: '100', water: '9' } })
      await prisma.meterReading.create({ data: { premisesId: prem.id, year: 2029, month: 7, electricity: '150', water: '12.5' } })
      return lease.id
    }
    await prisma.tariff.create({ data: { effectiveFrom: TARIFF_FROM, electricityRateKop: 432, waterRateKop: 1250 } })
    const leaseA = await mk('M1', 'Орендар М1')
    const leaseB = await mk('M2', 'Орендар М2')

    const r = await generateInvoices(2029, 7)
    expect(r.created).toBe(2)
    expect(await prisma.invoice.count({ where: { leaseId: { in: [leaseA, leaseB] }, year: 2029, month: 7 } })).toBe(2)
    // саме по одному кожному, а не два одному й нуль іншому
    expect(await prisma.invoice.count({ where: { leaseId: leaseA, year: 2029, month: 7 } })).toBe(1)
    expect(await prisma.invoice.count({ where: { leaseId: leaseB, year: 2029, month: 7 } })).toBe(1)
  })
})
