import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { InvalidAmountError } from '@/domain/errors'
import { formatUah, fromKop, roundHalfUp, toKop } from '@/domain/money'

/**
 * Intl для uk-UA розділяє тисячі нерозривним пробілом (U+00A0).
 * Нормалізуємо будь-який пробільний символ, щоб тест не залежав від
 * версії ICU: різні збірки дають то U+00A0, то U+202F.
 */
const normalizeSpaces = (s: string) => s.replace(/\s/g, ' ')

describe('toKop', () => {
  it('переводить рядок у копійки', () => {
    expect(toKop('1234.56')).toBe(123456)
  })

  it('не втрачає копійку на float 1234.56', () => {
    // 1234.56 * 100 === 123455.99999999999 у чистому JS
    expect(toKop(1234.56)).toBe(123456)
  })

  it('обробляє один знак після коми', () => {
    expect(toKop('0.1')).toBe(10)
  })

  it('відхиляє три знаки після коми', () => {
    expect(() => toKop('1234.567')).toThrow(InvalidAmountError)
  })

  it('відхиляє відʼємну суму', () => {
    expect(() => toKop('-5')).toThrow(InvalidAmountError)
  })
})

describe('fromKop', () => {
  it('повертає рядок із двома знаками', () => {
    expect(fromKop(123456)).toBe('1234.56')
    expect(fromKop(5)).toBe('0.05')
  })
})

describe('roundHalfUp', () => {
  it('округлює 0.5 вгору', () => {
    expect(roundHalfUp(new Decimal('0.5'))).toBe(1)
  })

  it('округлює 1.4 вниз', () => {
    expect(roundHalfUp(new Decimal('1.4'))).toBe(1)
  })

  it('округлює 2.5 вгору, а не до парного', () => {
    // банківське округлення дало б 2 — нам потрібне 3
    expect(roundHalfUp(new Decimal('2.5'))).toBe(3)
  })
})

describe('formatUah', () => {
  it('форматує українською з групуванням', () => {
    expect(normalizeSpaces(formatUah(123456))).toBe('1 234,56 грн')
  })

  it('показує копійки навіть для круглої суми', () => {
    expect(normalizeSpaces(formatUah(100000))).toBe('1 000,00 грн')
  })
})
