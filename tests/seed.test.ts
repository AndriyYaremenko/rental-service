import { beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../prisma/seed-data'
import { isLeaseActiveInMonth } from '@/domain/status'
import { prisma } from '@/server/db'

// Тест сам наповнює базу, тому не залежить від того, чи запускали
// `npm run db:seed` руками і в якому порядку йдуть файли тестів.
beforeAll(async () => {
  await seed()
})

describe('seed', () => {
  it('створює очікуваний набір сутностей', async () => {
    expect(await prisma.user.count()).toBe(1)
    expect(await prisma.location.count()).toBe(2)
    expect(await prisma.premises.count()).toBe(3)
    expect(await prisma.tenant.count()).toBe(2)
    expect(await prisma.lease.count()).toBe(2)
    expect(await prisma.tariff.count()).toBe(2)
    expect(await prisma.meterReading.count()).toBe(4)
  })

  it('зберігає гроші як цілі копійки', async () => {
    const lease = await prisma.lease.findFirstOrThrow({ orderBy: { rentKop: 'asc' } })
    expect(lease.rentKop).toBe(1_800_000)
    expect(Number.isInteger(lease.rentKop)).toBe(true)
  })

  it('дає кожному приміщенню з договором дві точки показників', async () => {
    const leases = await prisma.lease.findMany()
    for (const lease of leases) {
      const count = await prisma.meterReading.count({ where: { premisesId: lease.premisesId } })
      expect(count).toBe(2)
    }
  })

  it('обидва договори чинні в червні 2026 — місяці, за який рахуватимемо', async () => {
    const leases = await prisma.lease.findMany()
    for (const lease of leases) {
      expect(isLeaseActiveInMonth(lease, 2026, 6)).toBe(true)
    }
  })
})
