import { afterEach, describe, expect, it } from 'vitest'
import { saveReadings } from '@/server/services/readings'
import { prisma } from '@/server/db'

let premId = ''
afterEach(async () => {
  await prisma.meterReading.deleteMany({ where: { premisesId: premId } })
  await prisma.premises.deleteMany({ where: { id: premId } })
  await prisma.location.deleteMany({ where: { name: 'Збереж' } })
  premId = ''
})
async function prem() {
  const loc = await prisma.location.create({ data: { name: 'Збереж', address: 'вул. З, 1' } })
  premId = (await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'S1', type: 'офіс', areaM2: '10' } })).id
  return premId
}

describe('saveReadings', () => {
  it('зберігає показники за місяць', async () => {
    const id = await prem()
    const r = await saveReadings({ year: 2026, month: 6, entries: [{ premisesId: id, electricity: '150', water: '13' }] })
    expect(r.saved).toBe(1)
    const row = await prisma.meterReading.findFirstOrThrow({ where: { premisesId: id, year: 2026, month: 6 } })
    expect(row.electricity.toString()).toBe('150')
  })

  it('повторний upsert оновлює той самий місяць, не дублює', async () => {
    const id = await prem()
    await saveReadings({ year: 2026, month: 6, entries: [{ premisesId: id, electricity: '150', water: '13' }] })
    await saveReadings({ year: 2026, month: 6, entries: [{ premisesId: id, electricity: '160', water: '14' }] })
    const count = await prisma.meterReading.count({ where: { premisesId: id, year: 2026, month: 6 } })
    expect(count).toBe(1)
    const row = await prisma.meterReading.findFirstOrThrow({ where: { premisesId: id, year: 2026, month: 6 } })
    expect(row.electricity.toString()).toBe('160')
  })

  it('показник менший за попередній без заміни → READING_DECREASED', async () => {
    const id = await prem()
    await prisma.meterReading.create({ data: { premisesId: id, year: 2026, month: 5, electricity: '100', water: '10' } })
    await expect(saveReadings({ year: 2026, month: 6, entries: [{ premisesId: id, electricity: '90', water: '11' }] }))
      .rejects.toMatchObject({ code: 'READING_DECREASED' })
  })

  it('менший показник ДОЗВОЛЕНО із прапорцем заміни лічильника', async () => {
    const id = await prem()
    await prisma.meterReading.create({ data: { premisesId: id, year: 2026, month: 5, electricity: '900', water: '10' } })
    const r = await saveReadings({ year: 2026, month: 6, entries: [
      { premisesId: id, electricity: '30', water: '11', electricityReplaced: true, electricityReplacedInitial: '0' },
    ] })
    expect(r.saved).toBe(1)
    const row = await prisma.meterReading.findFirstOrThrow({ where: { premisesId: id, year: 2026, month: 6 } })
    expect(row.electricityReplaced).toBe(true)
    expect(row.electricityReplacedInitial!.toString()).toBe('0')
  })

  it('перший показник (немає попереднього) зберігається без помилки', async () => {
    const id = await prem()
    const r = await saveReadings({ year: 2026, month: 6, entries: [{ premisesId: id, electricity: '150', water: '13' }] })
    expect(r.saved).toBe(1)
  })
})
