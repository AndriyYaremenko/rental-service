import { afterEach, describe, expect, it } from 'vitest'
import { createPremises, deletePremises, getPremises, listPremises, updatePremises } from '@/server/services/premises'
import { prisma } from '@/server/db'

let locationId = ''
const created: string[] = []

afterEach(async () => {
  await prisma.lease.deleteMany({ where: { premisesId: { in: created } } })
  await prisma.premises.deleteMany({ where: { id: { in: created } } })
  created.length = 0
  if (locationId) { await prisma.location.deleteMany({ where: { id: locationId } }); locationId = '' }
})

async function loc() {
  const l = await prisma.location.create({ data: { name: 'Локація П', address: 'вул. П, 1' } })
  locationId = l.id
  return l.id
}
const track = <T extends { id: string }>(x: T) => { created.push(x.id); return x }

describe('premises service', () => {
  it('створює приміщення; площа віддається рядком', async () => {
    const p = track(await createPremises({ locationId: await loc(), unitNumber: '204', type: 'офіс', floor: 2, areaM2: '54.30' }))
    expect(p.areaM2).toBe('54.3')
    expect(typeof p.areaM2).toBe('string')
    expect(p.occupied).toBe(false)
  })

  it('приміщення з активним договором позначається occupied', async () => {
    const locId = await loc()
    const p = track(await createPremises({ locationId: locId, unitNumber: '1', type: 'офіс', areaM2: '20' }))
    const t = await prisma.tenant.create({ data: { name: 'Орендар П' } })
    await prisma.lease.create({ data: { premisesId: p.id, tenantId: t.id, startDate: new Date(Date.UTC(2026, 0, 1)), endDate: null, rentKop: 100000, garbageKop: 0 } })
    try {
      expect((await getPremises(p.id)).occupied).toBe(true)
    } finally {
      // Lease.tenantId має onDelete: Restrict — спершу приберемо договір,
      // інакше видалення орендаря впаде на FK (не повʼязано із сервісом
      // під тестом: сам assert occupied===true пройшов).
      await prisma.lease.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.deleteMany({ where: { id: t.id } })
    }
  })

  it('оновлює тип', async () => {
    const p = track(await createPremises({ locationId: await loc(), unitNumber: '2', type: 'офіс', areaM2: '30' }))
    expect((await updatePremises(p.id, { type: 'склад' })).type).toBe('склад')
  })

  it('видаляє приміщення без договорів', async () => {
    const p = await createPremises({ locationId: await loc(), unitNumber: '3', type: 'офіс', areaM2: '40' })
    await deletePremises(p.id)
    await expect(getPremises(p.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('дублікат unitNumber у тій самій локації → CONFLICT', async () => {
    const locId = await loc()
    track(await createPremises({ locationId: locId, unitNumber: 'X', type: 'офіс', areaM2: '10' }))
    await expect(createPremises({ locationId: locId, unitNumber: 'X', type: 'склад', areaM2: '20' }))
      .rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('updatePremises неіснуючого id → NOT_FOUND (не 500)', async () => {
    await expect(updatePremises('неіснуючий-id', { type: 'склад' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('deletePremises неіснуючого id → NOT_FOUND (не 500)', async () => {
    await expect(deletePremises('неіснуючий-id')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('DTO не містить зайвих полів БД (createdAt/updatedAt не течуть)', async () => {
    const p = track(await createPremises({ locationId: await loc(), unitNumber: '5', type: 'офіс', areaM2: '15' }))
    expect(Object.keys(p).sort()).toEqual(['areaM2', 'floor', 'id', 'locationId', 'notes', 'occupied', 'type', 'unitNumber'])
  })

  it('явний null у notes очищає поле, а не лишає старе', async () => {
    const p = track(await createPremises({ locationId: await loc(), unitNumber: '6', type: 'офіс', areaM2: '25', notes: 'щось' }))
    expect(p.notes).toBe('щось')
    expect((await updatePremises(p.id, { notes: null })).notes).toBeNull()
  })

  it('listPremises повертає елементи у формі DTO (не сирі рядки Prisma)', async () => {
    // Список — єдине місце, де raw-row leak (Decimal-обʼєкт, createdAt, leases)
    // пройшов би непоміченим. Перевіряємо форму саме елемента списку.
    const p = track(await createPremises({ locationId: await loc(), unitNumber: '7', type: 'офіс', areaM2: '33.30' }))
    const item = (await listPremises()).find((x) => x.id === p.id)
    expect(item).toBeDefined()
    expect(typeof item!.areaM2).toBe('string')
    expect(item!.areaM2).toBe('33.3')
    expect(item!.occupied).toBe(false)
    expect(Object.keys(item!).sort()).toEqual(['areaM2', 'floor', 'id', 'locationId', 'notes', 'occupied', 'type', 'unitNumber'])
  })

  it('updatePremises на вже зайнятий unitNumber у локації → CONFLICT (не 500)', async () => {
    const locId = await loc()
    track(await createPremises({ locationId: locId, unitNumber: 'A', type: 'офіс', areaM2: '10' }))
    const b = track(await createPremises({ locationId: locId, unitNumber: 'B', type: 'офіс', areaM2: '20' }))
    await expect(updatePremises(b.id, { unitNumber: 'A' })).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
