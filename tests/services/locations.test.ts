import { afterEach, describe, expect, it } from 'vitest'
import { createLocation, deleteLocation, getLocation, listLocations, updateLocation } from '@/server/services/locations'
import { ApiError } from '@/server/http'
import { prisma } from '@/server/db'

const created: string[] = []
afterEach(async () => {
  await prisma.premises.deleteMany({ where: { locationId: { in: created } } })
  await prisma.location.deleteMany({ where: { id: { in: created } } })
  created.length = 0
})
const track = <T extends { id: string }>(x: T) => { created.push(x.id); return x }

describe('locations service', () => {
  it('створює й читає локацію', async () => {
    const loc = track(await createLocation({ name: 'БЦ Тест', address: 'вул. Тестова, 1' }))
    expect(loc.name).toBe('БЦ Тест')
    expect((await getLocation(loc.id)).address).toBe('вул. Тестова, 1')
  })

  it('список містить створену локацію', async () => {
    const loc = track(await createLocation({ name: 'БЦ У списку', address: 'вул. Друга, 2' }))
    expect((await listLocations()).some((l) => l.id === loc.id)).toBe(true)
  })

  it('оновлює назву', async () => {
    const loc = track(await createLocation({ name: 'Стара', address: 'вул. Третя, 3' }))
    expect((await updateLocation(loc.id, { name: 'Нова' })).name).toBe('Нова')
  })

  it('видаляє порожню локацію', async () => {
    const loc = await createLocation({ name: 'На видалення', address: 'вул. Четверта, 4' })
    await deleteLocation(loc.id)
    await expect(getLocation(loc.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('getLocation неіснуючого → NOT_FOUND', async () => {
    await expect(getLocation('немає')).rejects.toBeInstanceOf(ApiError)
  })

  it('не видаляє локацію з приміщеннями → CONFLICT', async () => {
    const loc = track(await createLocation({ name: 'З приміщенням', address: 'вул. Пʼята, 5' }))
    await prisma.premises.create({ data: { locationId: loc.id, unitNumber: '1', type: 'офіс', areaM2: '10' } })
    await expect(deleteLocation(loc.id)).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
