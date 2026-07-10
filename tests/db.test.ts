import { describe, expect, it } from 'vitest'
import { prisma } from '@/server/db'

describe('підключення до БД', () => {
  it('робить повний цикл запис-читання-видалення', async () => {
    // Перевіряє одразу три речі, і кожна з них може зламатися:
    // міграція створила таблиці, клієнт згенерований, зʼєднання живе.
    const created = await prisma.location.create({
      data: { name: 'Тестова локація', address: 'вул. Тестова, 1' },
    })

    const found = await prisma.location.findUniqueOrThrow({ where: { id: created.id } })
    expect(found.name).toBe('Тестова локація')
    expect(found.address).toBe('вул. Тестова, 1')

    await prisma.location.delete({ where: { id: created.id } })
    expect(await prisma.location.findUnique({ where: { id: created.id } })).toBeNull()
  })

  it('зберігає площу приміщення як Decimal без втрати знаків', async () => {
    const location = await prisma.location.create({
      data: { name: 'Локація для площі', address: 'вул. Тестова, 2' },
    })
    const premises = await prisma.premises.create({
      data: { locationId: location.id, unitNumber: '1', type: 'офіс', areaM2: '54.30' },
    })

    const found = await prisma.premises.findUniqueOrThrow({ where: { id: premises.id } })
    expect(found.areaM2.toString()).toBe('54.3')

    await prisma.premises.delete({ where: { id: premises.id } })
    await prisma.location.delete({ where: { id: location.id } })
  })
})
