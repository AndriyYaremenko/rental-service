import { afterEach, describe, expect, it } from 'vitest'
import { reportDebts, reportMonthly } from '@/server/services/reports'
import { prisma } from '@/server/db'

let ids: Record<string, string> = {}
// Прибирання за локацією 'Звіт' (тести на виключення й сортування створюють ДРУГИЙ
// договір під тією ж локацією). findFirst → null, якщо тест не створював фікстур —
// тоді нічого не видаляємо (жодного deleteMany з undefined-фільтром по seed-БД).
afterEach(async () => {
  const loc = await prisma.location.findFirst({ where: { name: 'Звіт' } })
  if (loc) {
    const prems = await prisma.premises.findMany({ where: { locationId: loc.id }, select: { id: true } })
    const premIds = prems.map((p) => p.id)
    const leases = await prisma.lease.findMany({ where: { premisesId: { in: premIds } }, select: { id: true, tenantId: true } })
    const leaseIds = leases.map((l) => l.id)
    await prisma.payment.deleteMany({ where: { leaseId: { in: leaseIds } } })
    await prisma.invoice.deleteMany({ where: { leaseId: { in: leaseIds } } })
    await prisma.lease.deleteMany({ where: { id: { in: leaseIds } } })
    await prisma.premises.deleteMany({ where: { id: { in: premIds } } })
    await prisma.tenant.deleteMany({ where: { id: { in: leases.map((l) => l.tenantId) } } })
    await prisma.location.deleteMany({ where: { id: loc.id } })
  }
  ids = {}
})

// Рахунок за місяць (year 2029 — ізоляція від seed) з довільним total.
async function leaseWith(totalKop: number) {
  const loc = await prisma.location.create({ data: { name: 'Звіт', address: 'вул. З, 1' } })
  const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'Z1', type: 'офіс', areaM2: '10' } })
  const ten = await prisma.tenant.create({ data: { name: 'Боржник Б' } })
  const l = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2029, 0, 1)), endDate: null, rentKop: totalKop, garbageKop: 0 } })
  await prisma.invoice.create({ data: {
    leaseId: l.id, year: 2029, month: 6, electricityRateKop: 0, waterRateKop: 0,
    prevElectricity: '0', currElectricity: '0', electricityUsed: '0', prevWater: '0', currWater: '0', waterUsed: '0',
    rentKop: totalKop, electricityKop: 0, waterKop: 0, garbageKop: 0, totalKop,
  } })
  ids = { loc: loc.id, prem: prem.id, ten: ten.id, lease: l.id }
  return l.id
}

describe('reportDebts', () => {
  it('без оплат: борг = сума рахунків, аванс = 0', async () => {
    const leaseId = await leaseWith(100_000)
    const row = (await reportDebts()).find((r) => r.leaseId === leaseId)!
    expect(row.invoicedKop).toBe(100_000)
    expect(row.paidKop).toBe(0)
    expect(row.debtKop).toBe(100_000)
    expect(row.advanceKop).toBe(0)
    expect(row.tenantName).toBe('Боржник Б')
    expect(row.premisesLabel).toContain('Z1')
  })

  it('переплата: борг = 0, аванс = переплата', async () => {
    const leaseId = await leaseWith(100_000)
    await prisma.payment.create({ data: { leaseId, date: new Date(), amountKop: 130_000, method: 'CASH' } })
    const row = (await reportDebts()).find((r) => r.leaseId === leaseId)!
    expect(row.debtKop).toBe(0)
    expect(row.advanceKop).toBe(30_000)
  })

  it('форма елемента звіту — фіксований набір ключів', async () => {
    const leaseId = await leaseWith(100_000)
    const row = (await reportDebts()).find((r) => r.leaseId === leaseId)!
    expect(Object.keys(row).sort()).toEqual(['advanceKop', 'debtKop', 'invoicedKop', 'leaseId', 'paidKop', 'premisesLabel', 'tenantName'])
  })

  it('договір без активності (0 рахунків, 0 оплат) — ВИКЛЮЧЕНО зі звіту', async () => {
    // Без guard `continue` мутант проходить: договір без активності зʼявляється з боргом 0.
    await leaseWith(100_000) // активний договір → локація 'Звіт' існує
    // другий договір під тією ж локацією: власні приміщення/орендар, БЕЗ рахунку й оплати
    const prem2 = await prisma.premises.create({ data: { locationId: ids.loc, unitNumber: 'Z2', type: 'офіс', areaM2: '10' } })
    const ten2 = await prisma.tenant.create({ data: { name: 'Без активності' } })
    const bareLeaseId = (await prisma.lease.create({ data: { premisesId: prem2.id, tenantId: ten2.id, startDate: new Date(Date.UTC(2029, 0, 1)), endDate: null, rentKop: 1, garbageKop: 0 } })).id
    expect((await reportDebts()).find((r) => r.leaseId === bareLeaseId)).toBeUndefined()
  })

  it('сортування за боргом спаданням: більший борг йде раніше', async () => {
    // менший борг СТВОРЮЄМО ПЕРШИМ, щоб порядок вставки відрізнявся від сортованого;
    // без `rows.sort` результат — порядок вставки (менший перший) → тест падає.
    const smallLeaseId = await leaseWith(50_000)
    // другий договір із рахунком 200_000 під тією ж локацією
    const prem2 = await prisma.premises.create({ data: { locationId: ids.loc, unitNumber: 'Z2', type: 'офіс', areaM2: '10' } })
    const ten2 = await prisma.tenant.create({ data: { name: 'Боржник В' } })
    const bigLease = await prisma.lease.create({ data: { premisesId: prem2.id, tenantId: ten2.id, startDate: new Date(Date.UTC(2029, 0, 1)), endDate: null, rentKop: 200_000, garbageKop: 0 } })
    await prisma.invoice.create({ data: {
      leaseId: bigLease.id, year: 2029, month: 6, electricityRateKop: 0, waterRateKop: 0,
      prevElectricity: '0', currElectricity: '0', electricityUsed: '0', prevWater: '0', currWater: '0', waterUsed: '0',
      rentKop: 200_000, electricityKop: 0, waterKop: 0, garbageKop: 0, totalKop: 200_000,
    } })
    const report = await reportDebts()
    const smallIdx = report.findIndex((r) => r.leaseId === smallLeaseId)
    const bigIdx = report.findIndex((r) => r.leaseId === bigLease.id)
    expect(smallIdx).toBeGreaterThanOrEqual(0)
    expect(bigIdx).toBeGreaterThanOrEqual(0)
    expect(bigIdx).toBeLessThan(smallIdx) // борг 200_000 передує боргу 50_000
  })
})

describe('reportMonthly', () => {
  it('рядки за місяць зі статусом і підсумком; повна оплата → PAID', async () => {
    const leaseId = await leaseWith(100_000) // рахунок 2029-06
    await prisma.payment.create({ data: { leaseId, date: new Date(), amountKop: 100_000, method: 'CASH' } })
    const rep = await reportMonthly(2029, 6)
    const row = rep.rows.find((r) => r.leaseId === leaseId)!
    expect(row.totalKop).toBe(100_000)
    expect(row.status).toBe('PAID')
    expect(row.tenantName).toBe('Боржник Б')
    expect(row.premisesLabel).toContain('Z1')
    // ізоляція року 2029: у 2029-06 існує лише власний рахунок цього тесту, тож
    // підсумок і кількість — ТОЧНІ (не >=); слабке >= пережив би мутант суми/лічильника
    expect(rep.totalInvoicedKop).toBe(100_000)
    expect(rep.count).toBe(1)
  })

  it('інший місяць не містить рахунку', async () => {
    const leaseId = await leaseWith(100_000) // рахунок лише 2029-06
    const rep = await reportMonthly(2029, 7)
    expect(rep.rows.find((r) => r.leaseId === leaseId)).toBeUndefined()
  })

  it('форма елемента — фіксований набір ключів', async () => {
    const leaseId = await leaseWith(100_000)
    const row = (await reportMonthly(2029, 6)).rows.find((r) => r.leaseId === leaseId)!
    expect(Object.keys(row).sort()).toEqual(['leaseId', 'premisesLabel', 'status', 'tenantName', 'totalKop'])
  })
})
