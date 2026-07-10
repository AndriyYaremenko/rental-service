import { afterEach, describe, expect, it, vi } from 'vitest'
import { cookieOptions, signSession, verifySession } from '@/server/auth/session'

afterEach(() => {
  vi.unstubAllEnvs()
})

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

describe('cookieOptions', () => {
  it('httpOnly, sameSite lax, path /, строк 7 днів', () => {
    const opts = cookieOptions()
    expect(opts.httpOnly).toBe(true)
    expect(opts.sameSite).toBe('lax')
    expect(opts.path).toBe('/')
    expect(opts.maxAge).toBe(60 * 60 * 24 * 7)
  })

  it('secure лише в production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(cookieOptions().secure).toBe(true)
    vi.stubEnv('NODE_ENV', 'test')
    expect(cookieOptions().secure).toBe(false)
  })
})

describe('signSession без секрету', () => {
  it('кидає зрозумілу помилку, якщо SESSION_SECRET не задано', async () => {
    vi.stubEnv('SESSION_SECRET', '')
    await expect(signSession({ sub: 'u', role: 'USER' })).rejects.toThrow(/SESSION_SECRET/)
  })
})
