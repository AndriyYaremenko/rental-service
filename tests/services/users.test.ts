import { afterEach, describe, expect, it } from 'vitest'
import { createUser, deleteUser, listUsers, updateUser } from '@/server/services/users'
import { verifyPassword } from '@/server/auth/password'
import { prisma } from '@/server/db'

const created: string[] = []
afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: created } } })
  created.length = 0
})
const track = <T extends { id: string }>(x: T) => { created.push(x.id); return x }

describe('users service', () => {
  it('створює користувача; DTO не містить passwordHash', async () => {
    const u = track(await createUser({ email: 'new-user@example.com', name: 'Новий', role: 'USER', password: 'parol12345' }))
    expect(u).not.toHaveProperty('passwordHash')
    expect(u.role).toBe('USER')
    expect(u.isActive).toBe(true)
  })

  it('дублікат email → CONFLICT', async () => {
    track(await createUser({ email: 'dup@example.com', name: 'А', role: 'USER', password: 'parol12345' }))
    await expect(createUser({ email: 'dup@example.com', name: 'Б', role: 'ADMIN', password: 'parol12345' }))
      .rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('деактивує користувача', async () => {
    const u = track(await createUser({ email: 'deact@example.com', name: 'Деакт', role: 'USER', password: 'parol12345' }))
    expect((await updateUser(u.id, { isActive: false })).isActive).toBe(false)
  })

  it('createUser хешує пароль, а не зберігає відкритим текстом', async () => {
    // Читаємо рядок ОДРАЗУ після створення (до будь-якого update, який
    // інакше замаскував би зламаний create, перехешувавши поверх).
    const u = track(await createUser({ email: 'hash-create@example.com', name: 'Хеш', role: 'USER', password: 'parol12345' }))
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(row.passwordHash).not.toBe('parol12345')
    expect(await verifyPassword('parol12345', row.passwordHash)).toBe(true)
  })

  it('оновлення пароля справді змінює хеш і працює для входу', async () => {
    const u = track(await createUser({ email: 'pw@example.com', name: 'Пароль', role: 'USER', password: 'staryi12345' }))
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash

    await updateUser(u.id, { password: 'novyi123456' })
    const after = (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash

    // Не літерал, і саме ЗМІНИВСЯ (мовчазний no-op лишив би старий хеш),
    // і новий пароль реально проходить перевірку.
    expect(after).not.toBe('novyi123456')
    expect(after).not.toBe(before)
    expect(await verifyPassword('novyi123456', after)).toBe(true)
    expect(await verifyPassword('staryi12345', after)).toBe(false)
  })

  it('адмін не може видалити сам себе → CONFLICT', async () => {
    const u = track(await createUser({ email: 'self@example.com', name: 'Я', role: 'ADMIN', password: 'parol12345' }))
    await expect(deleteUser(u.id, u.id)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('видаляє іншого користувача', async () => {
    const u = await createUser({ email: 'other@example.com', name: 'Інший', role: 'USER', password: 'parol12345' })
    await deleteUser(u.id, 'admin-хтось-інший')
    expect((await listUsers()).some((x) => x.id === u.id)).toBe(false)
  })

  // Mandatory tests from plan constraint
  it('updateUser неіснуючого id → NOT_FOUND', async () => {
    await expect(updateUser('неіснуючий-id', { name: 'X' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('deleteUser неіснуючого id (не поточний) → NOT_FOUND', async () => {
    await expect(deleteUser('неіснуючий-id', 'admin-хтось-інший')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('DTO не містить зайвих полів БД (passwordHash не тече)', async () => {
    const u = track(await createUser({ email: 'shape@example.com', name: 'Форма', role: 'USER', password: 'parol12345' }))
    expect(Object.keys(u).sort()).toEqual(['email', 'id', 'isActive', 'name', 'role'])
  })

  it('список містить користувачів з правильною DTO формою (passwordHash не тече через список)', async () => {
    const u = track(await createUser({ email: 'list-shape@example.com', name: 'У списку', role: 'USER', password: 'parol12345' }))
    const list = await listUsers()
    const found = list.find((x) => x.id === u.id)
    expect(found).toBeDefined()
    expect(Object.keys(found!).sort()).toEqual(['email', 'id', 'isActive', 'name', 'role'])
  })
})
