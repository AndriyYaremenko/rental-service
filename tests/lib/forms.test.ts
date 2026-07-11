import { describe, expect, it } from 'vitest'
import { fieldErrors, errorMessage } from '@/lib/forms'
import { ClientApiError } from '@/lib/api'

describe('розбір помилок форми', () => {
  it('fieldErrors повертає поля з ClientApiError', () => {
    const e = new ClientApiError('VALIDATION_FAILED', 'Погано', { email: 'Некоректний email' })
    expect(fieldErrors(e)).toEqual({ email: 'Некоректний email' })
  })
  it('fieldErrors — порожній обʼєкт, коли полів немає або це не ClientApiError', () => {
    expect(fieldErrors(new ClientApiError('CONFLICT', 'Зайнято'))).toEqual({})
    expect(fieldErrors(new Error('boom'))).toEqual({})
  })
  it('errorMessage — message ClientApiError, або дефолт, або null', () => {
    expect(errorMessage(new ClientApiError('CONFLICT', 'Не можна видалити'))).toBe('Не можна видалити')
    expect(errorMessage(new Error('x'))).toBe('Сталася помилка')
    expect(errorMessage(null)).toBeNull()
  })
})
