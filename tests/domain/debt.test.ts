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
