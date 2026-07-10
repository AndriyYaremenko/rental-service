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
    await expect(authenticate(EMAIL, 'ne-toi')).rejects.toBeInstanceOf(ApiError)
  })

  it('неіснуючий email → UNAUTHORIZED (не розкриваємо, що саме не так)', async () => {
    await expect(authenticate('nikoho@example.com', 'bud-yaki')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('вимкнений користувач не входить', async () => {
    await ensureUser(false)
    await expect(authenticate(EMAIL, 'pravylnyi1')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
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
})
