import { describe, expect, it } from 'vitest'
import { pickTariffForMonth, type TariffRecord } from '@/domain/tariff'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

const jan: TariffRecord = {
  effectiveFrom: utc(2026, 1, 1), electricityRateKop: 432, waterRateKop: 1250,
}
const midMarch: TariffRecord = {
  effectiveFrom: utc(2026, 3, 15), electricityRateKop: 480, waterRateKop: 1375,
}

describe('pickTariffForMonth', () => {
  it('бере тариф, чинний на кінець місяця', () => {
    // Тариф набув чинності 15 березня — до березня він застосовується
    expect(pickTariffForMonth([jan, midMarch], 2026, 3)).toEqual(midMarch)
  })

  it('для попереднього місяця бере старий тариф', () => {
    expect(pickTariffForMonth([jan, midMarch], 2026, 2)).toEqual(jan)
  })

  it('тариф, чинний із першого числа, діє вже цього місяця', () => {
    // Реалістичний випадок: у seed тариф набуває чинності 1 червня.
    // Реалізація через firstDayOfMonth зі строгим `<` цей тариф пропустила б.
    const june: TariffRecord = {
      effectiveFrom: utc(2026, 6, 1), electricityRateKop: 500, waterRateKop: 1400,
    }
    expect(pickTariffForMonth([jan, june], 2026, 6)).toEqual(june)
  })

  it('для пізнішого місяця лишає новий тариф', () => {
    expect(pickTariffForMonth([jan, midMarch], 2026, 9)).toEqual(midMarch)
  })

  it('не залежить від порядку у вхідному масиві', () => {
    expect(pickTariffForMonth([midMarch, jan], 2026, 2)).toEqual(jan)
  })

  it('повертає null, якщо жоден тариф ще не діяв', () => {
    expect(pickTariffForMonth([jan], 2025, 12)).toBeNull()
  })

  it('повертає null на порожньому списку', () => {
    expect(pickTariffForMonth([], 2026, 6)).toBeNull()
  })
})
