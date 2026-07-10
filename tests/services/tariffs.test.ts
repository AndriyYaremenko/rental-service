import { afterEach, describe, expect, it } from 'vitest'
import { createTariff, deleteTariff, listTariffs } from '@/server/services/tariffs'
import { prisma } from '@/server/db'

const created: string[] = []
afterEach(async () => {
  await prisma.tariff.deleteMany({ where: { id: { in: created } } })
  created.length = 0
})
const track = <T extends { id: string }>(x: T) => { created.push(x.id); return x }

describe('tariffs service', () => {
  it('створює тариф; ставки конвертуються в копійки', async () => {
    const t = track(await createTariff({ effectiveFrom: '2027-01-01', electricityUah: '4.32', waterUah: '12.50' }))
    expect(t.electricityRateKop).toBe(432)
    expect(t.waterRateKop).toBe(1250)
    expect(t.effectiveFrom).toContain('2027-01-01')
  })

  it('список відсортований за датою', async () => {
    track(await createTariff({ effectiveFrom: '2027-03-01', electricityUah: '5', waterUah: '13' }))
    track(await createTariff({ effectiveFrom: '2027-02-01', electricityUah: '4.8', waterUah: '13' }))
    const list = (await listTariffs()).filter((t) => t.effectiveFrom.startsWith('2027'))
    const dates = list.map((t) => t.effectiveFrom)
    expect([...dates]).toEqual([...dates].sort())
  })

  it('дублікат дати дії → CONFLICT', async () => {
    track(await createTariff({ effectiveFrom: '2027-06-01', electricityUah: '5', waterUah: '14' }))
    await expect(createTariff({ effectiveFrom: '2027-06-01', electricityUah: '6', waterUah: '15' }))
      .rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('некоректна сума ставки → VALIDATION_FAILED', async () => {
    await expect(createTariff({ effectiveFrom: '2027-07-01', electricityUah: '4.999', waterUah: '1' }))
      .rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('видаляє тариф', async () => {
    const t = await createTariff({ effectiveFrom: '2027-08-01', electricityUah: '5', waterUah: '14' })
    await deleteTariff(t.id)
    expect((await listTariffs()).some((x) => x.id === t.id)).toBe(false)
  })

  // Mandatory tests from context
  it('deleteTariff(неіснуючий-id) → NOT_FOUND', async () => {
    await expect(deleteTariff('nonexistent-id')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('DTO має правильну форму', async () => {
    const t = track(await createTariff({ effectiveFrom: '2027-09-01', electricityUah: '5', waterUah: '14' }))
    expect(Object.keys(t).sort()).toEqual(['effectiveFrom', 'electricityRateKop', 'id', 'waterRateKop'])
  })

  it('listTariffs item має правильну форму', async () => {
    const t = track(await createTariff({ effectiveFrom: '2027-10-01', electricityUah: '5', waterUah: '14' }))
    const list = await listTariffs()
    const item = list.find((x) => x.id === t.id)
    expect(item).toBeDefined()
    expect(Object.keys(item!).sort()).toEqual(['effectiveFrom', 'electricityRateKop', 'id', 'waterRateKop'])
  })
})
