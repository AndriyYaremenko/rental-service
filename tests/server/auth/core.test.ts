import { afterAll, describe, expect, it } from 'vitest'
import { authenticate, userFromToken } from '@/server/auth/core'
import { hashPassword } from '@/server/auth/password'
import { ApiError } from '@/server/http'
import { prisma } from '@/server/db'

const EMAIL = 'core-test@example.com'
let userId = ''

async function ensureUser(active = true) {
  const u = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { isActive: active },
    create: { email: EMAIL, name: 'Тест', role: 'USER', isActive: active, passwordHash: await hashPassword('pravylnyi1') },
  })
  userId = u.id
  return u
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } })
})

describe('authenticate', () => {
  it('правильні креденшели → user і токен', async () => {
    await ensureUser()
    const { user, token } = await authenticate(EMAIL, 'pravylnyi1')
    expect(user.email).toBe(EMAIL)
    expect(token.length).toBeGreaterThan(10)
  })

  it('неправильний пароль → UNAUTHORIZED', async () => {
    await ensureUser()
    await expect(authenticate(EMAIL, 'ne-toi')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('неіснуючий email → UNAUTHORIZED (не розкриваємо, що саме не так)', async () => {
    await expect(authenticate('nikoho@example.com', 'bud-yaki')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('вимкнений користувач не входить', async () => {
    await ensureUser(false)
    await expect(authenticate(EMAIL, 'pravylnyi1')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('усі три причини невдачі дають ІДЕНТИЧНІ код і повідомлення (без enumeration)', async () => {
    const caught: ApiError[] = []
    await ensureUser(true)
    try { await authenticate(EMAIL, 'ne-toi') } catch (e) { caught.push(e as ApiError) } // неправильний пароль
    try { await authenticate('nema@example.com', 'x') } catch (e) { caught.push(e as ApiError) } // немає email
    await ensureUser(false)
    try { await authenticate(EMAIL, 'pravylnyi1') } catch (e) { caught.push(e as ApiError) } // деактивований

    expect(caught).toHaveLength(3)
    // Різне повідомлення чи код на різних гілках виказав би, які email існують.
    expect(new Set(caught.map((e) => e.message)).size).toBe(1)
    expect(new Set(caught.map((e) => e.code))).toEqual(new Set(['UNAUTHORIZED']))
  })

  it('повернений SessionUser не містить passwordHash', async () => {
    await ensureUser()
    const { user } = await authenticate(EMAIL, 'pravylnyi1')
    // login-роут віддає цей обʼєкт прямо в HTTP-відповідь — хеш не має протекти.
    expect(user).not.toHaveProperty('passwordHash')
    expect(Object.keys(user).sort()).toEqual(['email', 'id', 'name', 'role'])
  })
})

describe('userFromToken', () => {
  it('валідний токен активного користувача → SessionUser', async () => {
    await ensureUser()
    const { token } = await authenticate(EMAIL, 'pravylnyi1')
    expect((await userFromToken(token)).email).toBe(EMAIL)
  })

  it('відсутній cookie → UNAUTHORIZED', async () => {
    await expect(userFromToken(undefined)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('користувача деактивували після видачі токена → UNAUTHORIZED', async () => {
    await ensureUser()
    const { token } = await authenticate(EMAIL, 'pravylnyi1')
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } })
    await expect(userFromToken(token)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('userFromToken повертає SessionUser без passwordHash', async () => {
    await ensureUser()
    const { token } = await authenticate(EMAIL, 'pravylnyi1')
    const u = await userFromToken(token)
    expect(u).not.toHaveProperty('passwordHash')
  })
})
