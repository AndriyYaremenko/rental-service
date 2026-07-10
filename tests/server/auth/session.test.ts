import { describe, expect, it } from 'vitest'
import { signSession, verifySession } from '@/server/auth/session'

describe('сесія', () => {
  it('підписаний токен верифікується назад у ті самі claims', async () => {
    const token = await signSession({ sub: 'user_1', role: 'ADMIN' })
    expect(await verifySession(token)).toMatchObject({ sub: 'user_1', role: 'ADMIN' })
  })

  it('підроблений токен → null', async () => {
    const token = await signSession({ sub: 'user_1', role: 'USER' })
    expect(await verifySession(token + 'x')).toBeNull()
  })

  it('сміття замість токена → null, а не викид', async () => {
    expect(await verifySession('не-токен')).toBeNull()
  })
})
