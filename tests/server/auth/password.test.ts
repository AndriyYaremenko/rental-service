import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/server/auth/password'

describe('пароль', () => {
  it('хеш не дорівнює відкритому паролю', async () => {
    const hash = await hashPassword('taemnytsia123')
    expect(hash).not.toBe('taemnytsia123')
    expect(hash.length).toBeGreaterThan(20)
  })

  it('правильний пароль проходить перевірку', async () => {
    const hash = await hashPassword('taemnytsia123')
    expect(await verifyPassword('taemnytsia123', hash)).toBe(true)
  })

  it('неправильний пароль не проходить', async () => {
    const hash = await hashPassword('taemnytsia123')
    expect(await verifyPassword('inshyi', hash)).toBe(false)
  })
})
