import { describe, expect, it } from 'vitest'
import { advanceKop, balanceKop, debtKop } from '@/domain/debt'

describe('balanceKop', () => {
  it('додатнє значення означає борг', () => {
    expect(balanceKop(200_000, 50_000)).toBe(150_000)
  })

  it('відʼємне значення означає аванс', () => {
    expect(balanceKop(100_000, 150_000)).toBe(-50_000)
  })
})

describe('debtKop', () => {
  it('повертає борг', () => {
    expect(debtKop(200_000, 50_000)).toBe(150_000)
  })

  it('не буває відʼємним при переплаті', () => {
    expect(debtKop(100_000, 150_000)).toBe(0)
  })
})

describe('advanceKop', () => {
  it('повертає переплату', () => {
    expect(advanceKop(100_000, 150_000)).toBe(50_000)
  })

  it('дорівнює нулю за наявності боргу', () => {
    expect(advanceKop(200_000, 50_000)).toBe(0)
  })
})

describe('нульовий баланс', () => {
  it('борг і аванс одночасно нульові', () => {
    expect(balanceKop(100_000, 100_000)).toBe(0)
    expect(debtKop(100_000, 100_000)).toBe(0)
    expect(advanceKop(100_000, 100_000)).toBe(0)
  })

  it('аванс не повертає мінус-нуль', () => {
    // -balanceKop(x, x) обчислюється в -0; Math.max(0, -0) нормалізує до +0.
    // Реалізація на кшталт -Math.min(0, balance) повернула б -0,
    // і toBe(0) (він працює через Object.is) це спіймав би, а === ні.
    expect(Object.is(advanceKop(100_000, 100_000), -0)).toBe(false)
    expect(Object.is(debtKop(100_000, 100_000), -0)).toBe(false)
  })

  it('борг і аванс взаємно виключні', () => {
    const cases: ReadonlyArray<readonly [number, number]> = [
      [200_000, 50_000],   // борг
      [100_000, 150_000],  // аванс
      [100_000, 100_000],  // нуль
    ]
    for (const [invoiced, paid] of cases) {
      expect(Math.min(debtKop(invoiced, paid), advanceKop(invoiced, paid))).toBe(0)
    }
  })
})
