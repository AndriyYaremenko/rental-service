import { describe, expect, it } from 'vitest'
import { findPreviousReading } from '@/domain/readings'

const r = (year: number, month: number) => ({ year, month })

describe('findPreviousReading', () => {
  it('повертає показник попереднього місяця', () => {
    const found = findPreviousReading([r(2026, 4), r(2026, 5)], 2026, 6)
    expect(found).toEqual(r(2026, 5))
  })

  it('перестрибує дірку в даних', () => {
    // Квітня і травня немає — беремо березень, а не падаємо
    const found = findPreviousReading([r(2026, 3), r(2026, 6)], 2026, 6)
    expect(found).toEqual(r(2026, 3))
  })

  it('перетинає межу року', () => {
    const found = findPreviousReading([r(2025, 12)], 2026, 1)
    expect(found).toEqual(r(2025, 12))
  })

  it('ігнорує показник самого розрахункового місяця', () => {
    expect(findPreviousReading([r(2026, 6)], 2026, 6)).toBeNull()
  })

  it('ігнорує пізніші показники', () => {
    expect(findPreviousReading([r(2026, 7), r(2026, 8)], 2026, 6)).toBeNull()
  })

  it('повертає null, якщо ранішого показника немає', () => {
    expect(findPreviousReading([], 2026, 6)).toBeNull()
  })
})
