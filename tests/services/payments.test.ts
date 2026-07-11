import { afterEach, describe, expect, it } from 'vitest'
import { createPayment, deletePayment, getPayment, listPayments, updatePayment } from '@/server/services/payments'
import { prisma } from '@/server/db'

let ids: Record<string, string> = {}
afterEach(async () => {
  if (ids.lease) {
    await prisma.payment.deleteMany({ where: { leaseId: ids.lease } })
    await prisma.lease.deleteMany({ where: { id: ids.lease } })
    await prisma.premises.deleteMany({ where: { id: ids.prem } })
    await prisma.tenant.deleteMany({ where: { id: ids.ten } })
    await prisma.location.deleteMany({ where: { name: 'Оплата' } })
  }
  ids = {}
})

async function lease() {
  const loc = await prisma.location.create({ data: { name: 'Оплата', address: 'вул. О, 1' } })
  const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'P1', type: 'офіс', areaM2: '10' } })
  const ten = await prisma.tenant.create({ data: { name: 'Орендар О' } })
  const l = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2029, 0, 1)), endDate: null, rentKop: 1, garbageKop: 0 } })
  ids = { loc: loc.id, prem: prem.id, ten: ten.id, lease: l.id }
  return l.id
}

describe('payments service', () => {
  it('створює оплату; грн → копійки, дата ISO, note зберігається', async () => {
    const leaseId = await lease()
    // Service-тести минають Zod, тож note подаємо ВЖЕ чистим (трім/''→null — робота
    // optionalText у схемі, на межі роуту, не сервісу; урок Плану 2a Task 4).
    const p = await createPayment({ leaseId, date: '2029-06-15', amountUah: '5000.50', method: 'CASH', note: 'за червень' })
    expect(p.amountKop).toBe(500_050)
    expect(p.date).toContain('2029-06-15')
    expect(p.method).toBe('CASH')
    expect(p.note).toBe('за червень')
  })

  it('явний null у note очищає його (персистенція явного null)', async () => {
    const leaseId = await lease()
    const created = await createPayment({ leaseId, date: '2029-06-15', amountUah: '100', method: 'CARD', note: 'x' })
    const upd = await updatePayment(created.id, { note: null })
    expect(upd.note).toBeNull()
  })

  it('некоректна сума → VALIDATION_FAILED (не 500)', async () => {
    const leaseId = await lease()
    await expect(createPayment({ leaseId, date: '2029-06-15', amountUah: 'abc', method: 'CASH' }))
      .rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('get/update/delete неіснуючого id → NOT_FOUND', async () => {
    await expect(getPayment('немає')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(updatePayment('немає', { note: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(deletePayment('немає')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('форма DTO і елемента списку — без полів БД (без createdAt)', async () => {
    const leaseId = await lease()
    const p = await createPayment({ leaseId, date: '2029-06-15', amountUah: '100', method: 'BANK', note: null })
    const keys = ['amountKop', 'date', 'id', 'leaseId', 'method', 'note']
    expect(Object.keys(p).sort()).toEqual(keys)
    const item = (await listPayments(leaseId)).find((x) => x.id === p.id)
    expect(Object.keys(item!).sort()).toEqual(keys)
  })

  it('listPayments(leaseId) повертає лише оплати цього договору, найновіші перші', async () => {
    const leaseId = await lease()
    await createPayment({ leaseId, date: '2029-05-01', amountUah: '100', method: 'CASH' })
    await createPayment({ leaseId, date: '2029-07-01', amountUah: '200', method: 'CASH' })
    const list = await listPayments(leaseId)
    expect(list).toHaveLength(2)
    expect(list[0]!.date).toContain('2029-07-01') // desc за датою
  })

  it('оновлення суми переписує копійки', async () => {
    const leaseId = await lease()
    const p = await createPayment({ leaseId, date: '2029-06-15', amountUah: '100', method: 'CASH' })
    const upd = await updatePayment(p.id, { amountUah: '250.25' })
    expect(upd.amountKop).toBe(25_025)
  })

  it('видаляє оплату', async () => {
    const leaseId = await lease()
    const p = await createPayment({ leaseId, date: '2029-06-15', amountUah: '100', method: 'CASH' })
    await deletePayment(p.id)
    await expect(getPayment(p.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
