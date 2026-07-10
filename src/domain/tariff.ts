import { lastDayOfMonth } from './status'
import type { TariffRates } from './types'

export interface TariffRecord extends TariffRates {
  effectiveFrom: Date
}

/**
 * Тариф, чинний на ОСТАННІЙ день розрахункового місяця.
 *
 * Показники знімають наприкінці місяця, тому діє та ставка, що вже
 * набула чинності. Пропорційний поділ місяця між тарифами не робимо.
 */
export function pickTariffForMonth(
  tariffs: TariffRecord[],
  year: number,
  month: number,
): TariffRecord | null {
  const monthEnd = lastDayOfMonth(year, month).getTime()
  // `<=`: тариф, чинний рівно на кінець місяця, застосовується цього місяця.
  // Рівність effectiveFrom === monthEnd на практиці недосяжна (effectiveFrom
  // завжди опівночі, monthEnd — 23:59:59.999), тому окремим тестом не покрита.
  // Якщо API колись зберігатиме не-опівнічний effectiveFrom, цю межу треба покрити.
  const eligible = tariffs.filter((t) => t.effectiveFrom.getTime() <= monthEnd)

  if (eligible.length === 0) return null

  return eligible.reduce((best, t) =>
    t.effectiveFrom.getTime() > best.effectiveFrom.getTime() ? t : best,
  )
}
