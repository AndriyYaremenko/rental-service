import { afterEach, describe, expect, it } from 'vitest'
import { getReadingsForMonth } from '@/server/services/readings'
import { prisma } from '@/server/db'

let ids: { loc?: string; prem?: string; ten?: string; lease?: string } = {}
afterEach(async () => {
  await prisma.meterReading.deleteMany({ where: { premisesId: ids.prem } })
  await prisma.lease.deleteMany({ where: { id: ids.lease } })
  await prisma.premises.deleteMany({ where: { id: ids.prem } })
  await prisma.tenant.deleteMany({ where: { id: ids.ten } })
  await prisma.location.deleteMany({ where: { id: ids.loc } })
  ids = {}
})

async function setup() {
  const loc = await prisma.location.create({ data: { name: 'Огляд', address: 'вул. О, 1' } })
  const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'R1', type: 'офіс', areaM2: '10' } })
  const ten = await prisma.tenant.create({ data: { name: 'Орендар О' } })
  const lease = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2026, 0, 1)), endDate: null, rentKop: 1, garbageKop: 0 } })
  ids = { loc: loc.id, prem: prem.id, ten: ten.id, lease: lease.id }
  return ids
}

describe('getReadingsForMonth', () => {
  it('повертає приміщення з активним договором; previous — з попереднього місяця', async () => {
    const { prem } = await setup()
    await prisma.meterReading.create({ data: { premisesId: prem!, year: 2026, month: 5, electricity: '100', water: '10' } })
    await prisma.meterReading.create({ data: { premisesId: prem!, year: 2026, month: 6, electricity: '150', water: '13' } })

    const rows = await getReadingsForMonth(2026, 6)
    const row = rows.find((r) => r.premisesId === prem)
    expect(row).toBeDefined()
    expect(row!.current).toEqual({ electricity: '150', water: '13' })
    expect(row!.previous).toEqual({ electricity: '100', water: '10' })
  })

  it('current = null, якщо показника за місяць ще нема', async () => {
    const { prem } = await setup()
    await prisma.meterReading.create({ data: { premisesId: prem!, year: 2026, month: 5, electricity: '100', water: '10' } })
    const row = (await getReadingsForMonth(2026, 6)).find((r) => r.premisesId === prem)
    expect(row!.current).toBeNull()
    expect(row!.previous).toEqual({ electricity: '100', water: '10' })
  })

  it('приміщення без активного договору в місяці не потрапляє в огляд', async () => {
    const { prem, lease } = await setup()
    await prisma.lease.update({ where: { id: lease! }, data: { endDate: new Date(Date.UTC(2026, 2, 31)) } }) // до березня
    const row = (await getReadingsForMonth(2026, 6)).find((r) => r.premisesId === prem)
    expect(row).toBeUndefined()
  })
})
