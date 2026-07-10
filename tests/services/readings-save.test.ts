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

  it('зменшення ЛИШЕ води (електрика зросла) → READING_DECREASED', async () => {
    const id = await prem()
    await prisma.meterReading.create({ data: { premisesId: id, year: 2026, month: 5, electricity: '100', water: '50' } })
    await expect(saveReadings({ year: 2026, month: 6, entries: [{ premisesId: id, electricity: '150', water: '40' }] }))
      .rejects.toMatchObject({ code: 'READING_DECREASED' })
  })

  it('часткова партія не застосовується: збій на 2-му записі не зберігає 1-й', async () => {
    const loc = await prisma.location.create({ data: { name: 'Атом', address: 'вул. А, 1' } })
    const p1 = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'A1', type: 'офіс', areaM2: '10' } })
    const p2 = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'A2', type: 'офіс', areaM2: '10' } })
    await prisma.meterReading.create({ data: { premisesId: p2.id, year: 2026, month: 5, electricity: '100', water: '10' } })
    try {
      await expect(saveReadings({ year: 2026, month: 6, entries: [
        { premisesId: p1.id, electricity: '150', water: '13' }, // валідний
        { premisesId: p2.id, electricity: '90', water: '11' },  // зменшується → кидає
      ] })).rejects.toMatchObject({ code: 'READING_DECREASED' })
      // Перший запис НЕ має бути збережений — уся партія відкотилася.
      expect(await prisma.meterReading.count({ where: { premisesId: p1.id, year: 2026, month: 6 } })).toBe(0)
    } finally {
      await prisma.meterReading.deleteMany({ where: { premisesId: { in: [p1.id, p2.id] } } })
      await prisma.premises.deleteMany({ where: { id: { in: [p1.id, p2.id] } } })
      await prisma.location.deleteMany({ where: { id: loc.id } })
    }
  })

  it('повторне збереження без прапорця очищає стан заміни (update-гілка)', async () => {
    const id = await prem()
    await prisma.meterReading.create({ data: { premisesId: id, year: 2026, month: 5, electricity: '100', water: '10' } })
    // Спершу зі заміною (30 < 100 → потрібен прапорець).
    await saveReadings({ year: 2026, month: 6, entries: [{ premisesId: id, electricity: '30', water: '11', electricityReplaced: true, electricityReplacedInitial: '0' }] })
    expect((await prisma.meterReading.findFirstOrThrow({ where: { premisesId: id, year: 2026, month: 6 } })).electricityReplaced).toBe(true)
    // Повторно без прапорця, показник ≥ попереднього (150 ≥ 100) → стан заміни скидається.
    await saveReadings({ year: 2026, month: 6, entries: [{ premisesId: id, electricity: '150', water: '12' }] })
    const row = await prisma.meterReading.findFirstOrThrow({ where: { premisesId: id, year: 2026, month: 6 } })
    expect(row.electricityReplaced).toBe(false)
    expect(row.electricityReplacedInitial).toBeNull()
  })
})
