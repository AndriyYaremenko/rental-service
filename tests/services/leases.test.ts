import { afterEach, describe, expect, it } from 'vitest'
import { createLease, deleteLease, getLease, listLeases, updateLease } from '@/server/services/leases'
import { prisma } from '@/server/db'

const created: string[] = []
let premisesId = ''
let premisesId2 = ''
let tenantId = ''

afterEach(async () => {
  await prisma.lease.deleteMany({ where: { id: { in: created } } })
  created.length = 0
  await prisma.premises.deleteMany({ where: { id: { in: [premisesId, premisesId2].filter(Boolean) } } })
  await prisma.tenant.deleteMany({ where: { id: tenantId } })
  await prisma.location.deleteMany({ where: { name: 'Локація Д' } })
  premisesId = ''; premisesId2 = ''; tenantId = ''
})

async function fixtures() {
  const loc = await prisma.location.create({ data: { name: 'Локація Д', address: 'вул. Д, 1' } })
  premisesId = (await prisma.premises.create({ data: { locationId: loc.id, unitNumber: '1', type: 'офіс', areaM2: '20' } })).id
  premisesId2 = (await prisma.premises.create({ data: { locationId: loc.id, unitNumber: '2', type: 'офіс', areaM2: '30' } })).id
  tenantId = (await prisma.tenant.create({ data: { name: 'Орендар Д' } })).id
}
const track = <T extends { id: string }>(x: T) => { created.push(x.id); return x }

describe('leases service', () => {
  it('створює договір; грн → копійки, дати ISO, статус похідний', async () => {
    await fixtures()
    const l = track(await createLease({
      premisesId, tenantId, startDate: '2026-01-01', endDate: null,
      rentUah: '18000.00', garbageUah: '300.00',
    }))
    expect(l.rentKop).toBe(1_800_000)
    expect(l.garbageKop).toBe(30_000)
    expect(l.startDate).toContain('2026-01-01')
    expect(l.endDate).toBeNull()
    expect(l.status).toBe('ACTIVE')
  })

  it('завершений договір (минула endDate) має статус ENDED', async () => {
    await fixtures()
    const l = track(await createLease({
      premisesId, tenantId, startDate: '2020-01-01', endDate: '2020-12-31',
      rentUah: '1000', garbageUah: '0',
    }))
    expect(l.status).toBe('ENDED')
  })

  it('перекриття періодів на тому самому приміщенні → LEASE_OVERLAP', async () => {
    await fixtures()
    track(await createLease({ premisesId, tenantId, startDate: '2026-01-01', endDate: '2026-06-30', rentUah: '1', garbageUah: '0' }))
    await expect(createLease({ premisesId, tenantId, startDate: '2026-03-01', endDate: '2026-09-30', rentUah: '1', garbageUah: '0' }))
      .rejects.toMatchObject({ code: 'LEASE_OVERLAP' })
  })

  it('сусідній період на тому самому приміщенні дозволено', async () => {
    await fixtures()
    track(await createLease({ premisesId, tenantId, startDate: '2026-01-01', endDate: '2026-03-31', rentUah: '1', garbageUah: '0' }))
    const ok = track(await createLease({ premisesId, tenantId, startDate: '2026-04-01', endDate: null, rentUah: '1', garbageUah: '0' }))
    expect(ok.id).toBeDefined()
  })

  it('перекриття НЕ спрацьовує між різними приміщеннями', async () => {
    await fixtures()
    track(await createLease({ premisesId, tenantId, startDate: '2026-01-01', endDate: null, rentUah: '1', garbageUah: '0' }))
    const ok = track(await createLease({ premisesId: premisesId2, tenantId, startDate: '2026-01-01', endDate: null, rentUah: '1', garbageUah: '0' }))
    expect(ok.id).toBeDefined()
  })

  it('оновлення договору не конфліктує сам із собою', async () => {
    await fixtures()
    const l = track(await createLease({ premisesId, tenantId, startDate: '2026-01-01', endDate: null, rentUah: '1', garbageUah: '0' }))
    const upd = await updateLease(l.id, { endDate: '2026-12-31' })
    expect(upd.endDate).toContain('2026-12-31')
  })

  it('update/delete неіснуючого id → NOT_FOUND', async () => {
    await expect(updateLease('немає', { endDate: null })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(deleteLease('немає')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('форма DTO і елемента списку — без полів БД', async () => {
    await fixtures()
    const l = track(await createLease({ premisesId, tenantId, startDate: '2026-01-01', endDate: null, rentUah: '1', garbageUah: '0' }))
    const keys = ['endDate', 'garbageKop', 'id', 'premisesId', 'rentKop', 'startDate', 'status', 'tenantId']
    expect(Object.keys(l).sort()).toEqual(keys)
    const item = (await listLeases()).find((x) => x.id === l.id)
    expect(Object.keys(item!).sort()).toEqual(keys)
  })
})
