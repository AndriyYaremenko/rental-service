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

  it('тариф, чинний із першого числа місяця, застосовується вже цього місяця', () => {
    // Базовий випадок: effectiveFrom рівно 1-го числа входить у свій місяць.
    // Він НЕ розрізняє firstDayOfMonth від lastDayOfMonth — firstDayOfMonth(2026,6)
    // збігається з effectiveFrom до мілісекунди, тож обидві реалізації з `<=`
    // проходять однаково. Кінець-місяця-правило доводить лише тест із тарифом
    // від 15 березня вище.
    const june: TariffRecord = {
      effectiveFrom: utc(2026, 6, 1), electricityRateKop: 500, waterRateKop: 1400,
    }
    expect(pickTariffForMonth([jan, june], 2026, 6)).toEqual(june)
  })

  it('для пізнішого місяця лишає новий тариф', () => {
    expect(pickTariffForMonth([jan, midMarch], 2026, 9)).toEqual(midMarch)
  })

  it('не залежить від порядку у вхідному масиві', () => {
    // Обидва тарифи чинні в березні, тож reduce справді має вибрати найновіший
    // незалежно від порядку — на відміну від місяця, де придатний лише один.
    expect(pickTariffForMonth([midMarch, jan], 2026, 3)).toEqual(midMarch)
    expect(pickTariffForMonth([jan, midMarch], 2026, 3)).toEqual(midMarch)
  })

  it('повертає null, якщо жоден тариф ще не діяв', () => {
    expect(pickTariffForMonth([jan], 2025, 12)).toBeNull()
  })

  it('повертає null на порожньому списку', () => {
    expect(pickTariffForMonth([], 2026, 6)).toBeNull()
  })
})
