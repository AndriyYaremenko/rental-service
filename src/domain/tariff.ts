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
  const eligible = tariffs.filter((t) => t.effectiveFrom.getTime() <= monthEnd)

  if (eligible.length === 0) return null

  return eligible.reduce((best, t) =>
    t.effectiveFrom.getTime() > best.effectiveFrom.getTime() ? t : best,
  )
}
