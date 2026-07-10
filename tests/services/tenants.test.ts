import { afterEach, describe, expect, it } from 'vitest'
import { createTenant, deleteTenant, getTenant, listTenants, updateTenant } from '@/server/services/tenants'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'

const created: string[] = []
afterEach(async () => {
  await prisma.lease.deleteMany({ where: { tenantId: { in: created } } })
  await prisma.tenant.deleteMany({ where: { id: { in: created } } })
  created.length = 0
})
const track = <T extends { id: string }>(x: T) => { created.push(x.id); return x }

describe('tenants service', () => {
  it('створює орендаря з необовʼязковими полями', async () => {
    const t = track(await createTenant({ name: 'ТОВ Тест', phone: '+380671112233', taxCode: '12345678' }))
    expect(t.name).toBe('ТОВ Тест')
    expect(t.email).toBeNull()
  })

  it('список містить створеного орендаря', async () => {
    const t = track(await createTenant({ name: 'ФОП У списку' }))
    expect((await listTenants()).some((x) => x.id === t.id)).toBe(true)
  })

  it('оновлює телефон', async () => {
    const t = track(await createTenant({ name: 'ФОП Телефон' }))
    expect((await updateTenant(t.id, { phone: '+380509998877' })).phone).toBe('+380509998877')
  })

  it('видаляє орендаря без договорів', async () => {
    const t = await createTenant({ name: 'На видалення' })
    await deleteTenant(t.id)
    await expect(getTenant(t.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('не видаляє орендаря з договорами → CONFLICT', async () => {
    const t = track(await createTenant({ name: 'З договором' }))
    const loc = await prisma.location.create({ data: { name: 'Л', address: 'вул. Л, 1' } })
    const p = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: '1', type: 'офіс', areaM2: '10' } })
    await prisma.lease.create({ data: { premisesId: p.id, tenantId: t.id, startDate: new Date(Date.UTC(2026, 0, 1)), endDate: null, rentKop: 1, garbageKop: 0 } })
    try {
      await expect(deleteTenant(t.id)).rejects.toMatchObject({ code: 'CONFLICT' })
    } finally {
      await prisma.lease.deleteMany({ where: { tenantId: t.id } })
      await prisma.premises.deleteMany({ where: { id: p.id } })
      await prisma.location.deleteMany({ where: { id: loc.id } })
    }
  })

  // Mandatory tests from plan constraint
  it('getTenant неіснуючого id → NOT_FOUND', async () => {
    await expect(getTenant('немає')).rejects.toBeInstanceOf(ApiError)
  })

  it('updateTenant неіснуючого id → NOT_FOUND (не 500)', async () => {
    await expect(updateTenant('немає', { name: 'X' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('deleteTenant неіснуючого id → NOT_FOUND (не 500)', async () => {
    await expect(deleteTenant('немає')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('DTO не містить зайвих полів БД (createdAt/updatedAt не течуть)', async () => {
    const t = track(await createTenant({ name: 'Форма' }))
    expect(Object.keys(t).sort()).toEqual(['email', 'id', 'name', 'notes', 'phone', 'taxCode'])
  })

  it('список містить орендарів з правильною DTO формою', async () => {
    const t = track(await createTenant({ name: 'Тест у списку' }))
    const list = await listTenants()
    const found = list.find((x) => x.id === t.id)
    expect(found).toBeDefined()
    expect(Object.keys(found!).sort()).toEqual(['email', 'id', 'name', 'notes', 'phone', 'taxCode'])
  })

  it('явний null у phone очищує поле, а не лишає старе', async () => {
    const t = track(await createTenant({ name: 'З телефоном', phone: 'щось' }))
    expect(t.phone).toBe('щось')
    expect((await updateTenant(t.id, { phone: null })).phone).toBeNull()
  })
})
