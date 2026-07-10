import { describe, expect, it } from 'vitest'
import { parseYearMonth } from '@/server/query'

const p = (q: string) => new URLSearchParams(q)

describe('parseYearMonth', () => {
  it('розбирає коректні year і month', () => {
    expect(parseYearMonth(p('year=2026&month=6'))).toEqual({ year: 2026, month: 6 })
  })

  it('відсутній year → VALIDATION_FAILED (не тихий 0)', () => {
    expect(() => parseYearMonth(p('month=6'))).toThrow(/year/)
  })

  it('відсутній month → VALIDATION_FAILED', () => {
    expect(() => parseYearMonth(p('year=2026'))).toThrow()
  })

  it('порожній рядок року → VALIDATION_FAILED', () => {
    expect(() => parseYearMonth(p('year=&month=6'))).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    )
  })

  it('нечисловий параметр → VALIDATION_FAILED', () => {
    expect(() => parseYearMonth(p('year=abc&month=6'))).toThrow()
  })

  it('місяць поза 1..12 → VALIDATION_FAILED', () => {
    expect(() => parseYearMonth(p('year=2026&month=0'))).toThrow()
    expect(() => parseYearMonth(p('year=2026&month=13'))).toThrow()
  })

  it('рік поза розумним діапазоном → VALIDATION_FAILED', () => {
    expect(() => parseYearMonth(p('year=1999&month=6'))).toThrow()
    expect(() => parseYearMonth(p('year=3001&month=6'))).toThrow()
  })
})
