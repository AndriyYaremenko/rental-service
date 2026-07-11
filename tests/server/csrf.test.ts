import { describe, expect, it } from 'vitest'
import { checkCsrf } from '@/server/csrf'

describe('checkCsrf', () => {
  it('GET/HEAD завжди дозволені', () => {
    expect(checkCsrf('GET', 'sess', undefined, undefined)).toBe(true)
    expect(checkCsrf('HEAD', 'sess', 'a', 'b')).toBe(true)
  })
  it('мутація без сесії дозволена (напр. логін — CSRF не потрібен)', () => {
    expect(checkCsrf('POST', undefined, undefined, undefined)).toBe(true)
  })
  it('автентифікована мутація вимагає збіг cookie й заголовка', () => {
    expect(checkCsrf('POST', 'sess', 'tok', 'tok')).toBe(true)
    expect(checkCsrf('PATCH', 'sess', 'tok', 'tok')).toBe(true)
    expect(checkCsrf('DELETE', 'sess', 'tok', 'інше')).toBe(false)
    expect(checkCsrf('POST', 'sess', 'tok', undefined)).toBe(false)
    expect(checkCsrf('POST', 'sess', undefined, 'tok')).toBe(false)
  })
})
