import { describe, expect, it } from 'vitest'
import {
  firstDayOfMonth,
  isLeaseActiveInMonth,
  isPremisesOccupied,
  lastDayOfMonth,
  leaseState,
} from '@/domain/status'
import type { Period } from '@/domain/types'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

describe('межи місяця', () => {
  it('перший день', () => {
    expect(firstDayOfMonth(2026, 2).toISOString()).toBe('2026-02-01T00:00:00.000Z')
  })

  it('останній день лютого невисокосного року', () => {
    expect(lastDayOfMonth(2026, 2).toISOString()).toBe('2026-02-28T23:59:59.999Z')
  })

  it('останній день лютого високосного року', () => {
    expect(lastDayOfMonth(2028, 2).toISOString()).toBe('2028-02-29T23:59:59.999Z')
  })

  it('останній день грудня лишається в тому самому році', () => {
    // Date.UTC(2026, 12, 0) переповнює місяць у січень 2027,
    // а день 0 відкочує назад на 31 грудня 2026.
    expect(lastDayOfMonth(2026, 12).toISOString()).toBe('2026-12-31T23:59:59.999Z')
  })
})

describe('leaseState', () => {
  it('безстроковий договір активний', () => {
    const p: Period = { startDate: utc(2026, 1, 1), endDate: null }
    expect(leaseState(p, utc(2026, 7, 10))).toBe('ACTIVE')
  })

  it('договір із майбутньою датою завершення активний', () => {
    const p: Period = { startDate: utc(2026, 1, 1), endDate: utc(2026, 12, 31) }
    expect(leaseState(p, utc(2026, 7, 10))).toBe('ACTIVE')
  })

  it('договір із минулою датою завершення завершений', () => {
    const p: Period = { startDate: utc(2026, 1, 1), endDate: utc(2026, 3, 31) }
    expect(leaseState(p, utc(2026, 7, 10))).toBe('ENDED')
  })

  it('договір, що завершується сьогодні, ще активний', () => {
    // endDate включно. Без цього тесту мутація `>=` на `>` у leaseState
    // не валить жодного тесту вище — усі вони порівнюють різні дати.
    const today = utc(2026, 7, 10)
    const p: Period = { startDate: utc(2026, 1, 1), endDate: today }
    expect(leaseState(p, today)).toBe('ACTIVE')
  })

  it('договір, що завершився вчора, вже завершений', () => {
    const today = utc(2026, 7, 10)
    const p: Period = { startDate: utc(2026, 1, 1), endDate: utc(2026, 7, 9) }
    expect(leaseState(p, today)).toBe('ENDED')
  })
})

describe('isLeaseActiveInMonth', () => {
  // Договір діяв січень-березень 2026 і вже завершився.
  const janToMar: Period = { startDate: utc(2026, 1, 1), endDate: utc(2026, 3, 31) }

  it('РЕГРЕСІЯ: завершений договір лишається чинним для лютого', () => {
    // Саме тут ховався баг: фільтр status = ACTIVE у квітні
    // мовчки викинув би цей договір із нарахування за лютий.
    expect(isLeaseActiveInMonth(janToMar, 2026, 2)).toBe(true)
  })

  it('не чинний для місяця після завершення', () => {
    expect(isLeaseActiveInMonth(janToMar, 2026, 4)).toBe(false)
  })

  it('не чинний для місяця до початку', () => {
    expect(isLeaseActiveInMonth(janToMar, 2025, 12)).toBe(false)
  })

  it('чинний у місяці початку, навіть якщо почався в останній день', () => {
    const p: Period = { startDate: utc(2026, 5, 31), endDate: null }
    expect(isLeaseActiveInMonth(p, 2026, 5)).toBe(true)
  })

  it('чинний у місяці завершення, навіть якщо завершився першого числа', () => {
    const p: Period = { startDate: utc(2026, 1, 1), endDate: utc(2026, 6, 1) }
    expect(isLeaseActiveInMonth(p, 2026, 6)).toBe(true)
  })

  it('безстроковий договір чинний у будь-якому місяці після початку', () => {
    const p: Period = { startDate: utc(2026, 1, 1), endDate: null }
    expect(isLeaseActiveInMonth(p, 2030, 11)).toBe(true)
  })
})

describe('isPremisesOccupied', () => {
  const today = utc(2026, 7, 10)

  it('приміщення без договорів вільне', () => {
    expect(isPremisesOccupied([], today)).toBe(false)
  })

  it('приміщення із чинним договором здане', () => {
    expect(isPremisesOccupied([{ startDate: utc(2026, 1, 1), endDate: null }], today)).toBe(true)
  })

  it('приміщення лише із завершеним договором вільне', () => {
    expect(isPremisesOccupied([{ startDate: utc(2026, 1, 1), endDate: utc(2026, 3, 31) }], today))
      .toBe(false)
  })

  it('приміщення з договором, що почнеться в майбутньому, поки вільне', () => {
    expect(isPremisesOccupied([{ startDate: utc(2026, 9, 1), endDate: null }], today)).toBe(false)
  })

  it('приміщення здане вже в перший день договору', () => {
    // startDate <= today включно. Мутація `<=` на `<` не валить тестів вище.
    expect(isPremisesOccupied([{ startDate: today, endDate: null }], today)).toBe(true)
  })

  it('приміщення ще здане в останній день договору', () => {
    expect(isPremisesOccupied([{ startDate: utc(2026, 1, 1), endDate: today }], today)).toBe(true)
  })
})
