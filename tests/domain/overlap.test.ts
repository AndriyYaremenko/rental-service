import { describe, expect, it } from 'vitest'
import { hasOverlap, periodsOverlap } from '@/domain/overlap'
import type { Period } from '@/domain/types'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))
const p = (from: Date, to: Date | null): Period => ({ startDate: from, endDate: to })

describe('periodsOverlap', () => {
  it('послідовні періоди не перетинаються', () => {
    const a = p(utc(2026, 1, 1), utc(2026, 3, 31))
    const b = p(utc(2026, 4, 1), utc(2026, 6, 30))
    expect(periodsOverlap(a, b)).toBe(false)
  })

  it('дотик у той самий день є перетином', () => {
    // endDate включно, тому 31 березня зайняте обома договорами
    const a = p(utc(2026, 1, 1), utc(2026, 3, 31))
    const b = p(utc(2026, 3, 31), utc(2026, 6, 30))
    expect(periodsOverlap(a, b)).toBe(true)
  })

  it('вкладений період перетинається', () => {
    const a = p(utc(2026, 1, 1), utc(2026, 12, 31))
    const b = p(utc(2026, 5, 1), utc(2026, 6, 1))
    expect(periodsOverlap(a, b)).toBe(true)
  })

  it('безстроковий період перетинає будь-який пізніший', () => {
    const a = p(utc(2026, 1, 1), null)
    const b = p(utc(2030, 1, 1), utc(2030, 6, 1))
    expect(periodsOverlap(a, b)).toBe(true)
  })

  it('два безстрокові періоди завжди перетинаються', () => {
    expect(periodsOverlap(p(utc(2026, 1, 1), null), p(utc(2027, 1, 1), null))).toBe(true)
  })

  it('симетрична: порядок аргументів не впливає', () => {
    const a = p(utc(2026, 1, 1), utc(2026, 3, 31))
    const b = p(utc(2026, 3, 1), utc(2026, 6, 30))
    expect(periodsOverlap(a, b)).toBe(periodsOverlap(b, a))
  })
})

describe('hasOverlap', () => {
  const existing = [
    p(utc(2026, 1, 1), utc(2026, 3, 31)),
    p(utc(2026, 7, 1), utc(2026, 9, 30)),
  ]

  it('дозволяє договір у вільному проміжку', () => {
    expect(hasOverlap(existing, p(utc(2026, 4, 1), utc(2026, 6, 30)))).toBe(false)
  })

  it('відхиляє договір, що накладається на наявний', () => {
    expect(hasOverlap(existing, p(utc(2026, 3, 1), utc(2026, 5, 1)))).toBe(true)
  })

  it('порожній список наявних договорів не дає перетину', () => {
    expect(hasOverlap([], p(utc(2026, 1, 1), null))).toBe(false)
  })
})
