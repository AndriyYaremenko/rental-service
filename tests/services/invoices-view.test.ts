import { afterEach, describe, expect, it } from 'vitest'
import { getInvoice, listInvoices } from '@/server/services/invoices'
import { prisma } from '@/server/db'

let ids: Record<string, string> = {}
afterEach(async () => {
  // Захищений teardown: без ids.lease фільтри були б undefined, а Prisma тлумачить
  // undefined як «без фільтра» → знесло б УСІ рядки БД (див. invoices-generate.test.ts).
  if (ids.lease) {
    await prisma.payment.deleteMany({ where: { leaseId: ids.lease } })
    await prisma.invoice.deleteMany({ where: { leaseId: ids.lease } })
    await prisma.lease.deleteMany({ where: { id: ids.lease } })
    await prisma.premises.deleteMany({ where: { id: ids.prem } })
    await prisma.tenant.deleteMany({ where: { id: ids.ten } })
    await prisma.location.deleteMany({ where: { name: 'Статус' } })
  }
  ids = {}
})

async function withInvoice(totalKop: number) {
  const loc = await prisma.location.create({ data: { name: 'Статус', address: 'вул. С, 1' } })
  const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'I1', type: 'офіс', areaM2: '10' } })
  const ten = await prisma.tenant.create({ data: { name: 'Орендар І' } })
  const lease = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2026, 0, 1)), endDate: null, rentKop: totalKop, garbageKop: 0 } })
  const inv = await prisma.invoice.create({ data: {
    leaseId: lease.id, year: 2026, month: 6, electricityRateKop: 0, waterRateKop: 0,
    prevElectricity: '0', currElectricity: '0', electricityUsed: '0', prevWater: '0', currWater: '0', waterUsed: '0',
    rentKop: totalKop, electricityKop: 0, waterKop: 0, garbageKop: 0, totalKop,
  } })
  ids = { loc: loc.id, prem: prem.id, ten: ten.id, lease: lease.id, inv: inv.id }
  return { leaseId: lease.id, invId: inv.id }
}

/** Один договір із ДВОМА рахунками (червень і липень) по 100_000 коп. кожен. */
async function withTwoInvoices() {
  const loc = await prisma.location.create({ data: { name: 'Статус', address: 'вул. С, 1' } })
  const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'I2', type: 'офіс', areaM2: '10' } })
  const ten = await prisma.tenant.create({ data: { name: 'Орендар ІІ' } })
  const lease = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2026, 0, 1)), endDate: null, rentKop: 100_000, garbageKop: 0 } })
  const mk = (month: number) => prisma.invoice.create({ data: {
    leaseId: lease.id, year: 2026, month, electricityRateKop: 0, waterRateKop: 0,
    prevElectricity: '0', currElectricity: '0', electricityUsed: '0', prevWater: '0', currWater: '0', waterUsed: '0',
    rentKop: 100_000, electricityKop: 0, waterKop: 0, garbageKop: 0, totalKop: 100_000,
  } })
  const june = await mk(6)
  const july = await mk(7)
  ids = { loc: loc.id, prem: prem.id, ten: ten.id, lease: lease.id }
  return { leaseId: lease.id, juneId: june.id, julyId: july.id }
}

describe('invoices view — обчислений статус', () => {
  it('без оплат → UNPAID', async () => {
    const { invId } = await withInvoice(100_000)
    const dto = (await listInvoices(2026, 6)).find((i) => i.id === invId)!
    expect(dto.status).toBe('UNPAID')
  })

  it('часткова оплата → PARTIAL; повна → PAID', async () => {
    const { leaseId, invId } = await withInvoice(100_000)
    await prisma.payment.create({ data: { leaseId, date: new Date(), amountKop: 40_000, method: 'CASH' } })
    expect((await listInvoices(2026, 6)).find((i) => i.id === invId)!.status).toBe('PARTIAL')
    await prisma.payment.create({ data: { leaseId, date: new Date(), amountKop: 60_000, method: 'CASH' } })
    expect((await listInvoices(2026, 6)).find((i) => i.id === invId)!.status).toBe('PAID')
  })

  it('деталь містить розбивку показників як рядки', async () => {
    const { invId } = await withInvoice(100_000)
    const d = await getInvoice(invId)
    expect(typeof d.prevElectricity).toBe('string')
    expect(d.status).toBe('UNPAID')
  })

  it('getInvoice неіснуючого → NOT_FOUND', async () => {
    await expect(getInvoice('немає')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('форма елемента списку — без полів БД', async () => {
    const { invId } = await withInvoice(100_000)
    const dto = (await listInvoices(2026, 6)).find((i) => i.id === invId)!
    expect(Object.keys(dto).sort()).toEqual(['electricityKop', 'garbageKop', 'id', 'leaseId', 'month', 'rentKop', 'status', 'totalKop', 'waterKop', 'year'])
  })

  // ── Обовʼязкові додаткові тести (закривають реальні мутаційні діри) ──

  it('FIFO між ДВОМА рахунками одного договору: червень PAID, липень PARTIAL', async () => {
    // Одна оплата 150_000 на договір із двома рахунками по 100_000. FIFO (рік→місяць→
    // createdAt) гасить червень повністю, липень частково. Ловить мутанта, за якого
    // статус рахунку рахується ізольовано (allocatePayments лише над [цим рахунком]),
    // а не над УСІМА рахунками договору — саме тому leaseStatuses вантажить усі.
    const { leaseId, juneId, julyId } = await withTwoInvoices()
    await prisma.payment.create({ data: { leaseId, date: new Date(), amountKop: 150_000, method: 'CASH' } })

    expect((await getInvoice(juneId)).status).toBe('PAID')
    expect((await getInvoice(julyId)).status).toBe('PARTIAL')

    // Список погоджується з деталлю.
    expect((await listInvoices(2026, 6)).find((i) => i.id === juneId)!.status).toBe('PAID')
    expect((await listInvoices(2026, 7)).find((i) => i.id === julyId)!.status).toBe('PARTIAL')
  })

  it('InvoiceDetailDTO має рівно 18 полів (без витоку сирого рядка БД)', async () => {
    // Точний набір ключів: 10 полів InvoiceDTO + 8 деталізаційних. Ловить мутанта,
    // що повертає сирий рядок Prisma (spread `{ ...i, status }`) із createdAt тощо.
    const { invId } = await withInvoice(100_000)
    const invoiceDtoKeys = ['id', 'leaseId', 'year', 'month', 'rentKop', 'electricityKop', 'waterKop', 'garbageKop', 'totalKop', 'status']
    const detailExtraKeys = ['electricityRateKop', 'waterRateKop', 'prevElectricity', 'currElectricity', 'electricityUsed', 'prevWater', 'currWater', 'waterUsed']
    const expected = [...invoiceDtoKeys, ...detailExtraKeys].sort()
    expect(Object.keys(await getInvoice(invId)).sort()).toEqual(expected)
  })
})
