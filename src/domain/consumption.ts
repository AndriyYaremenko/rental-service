import { Decimal } from 'decimal.js'
import { NegativeConsumptionError, NoPreviousReadingError } from './errors'
import type { MeterSideInput } from './types'

/**
 * База, від якої рахується споживання.
 *
 * Якщо лічильник міняли, це початковий показник нового лічильника
 * (зазвичай нуль), а не останній показник старого. Саме це значення
 * заморожується в рахунку як prevElectricity / prevWater.
 */
export function consumptionBase(side: MeterSideInput): Decimal {
  const base = side.replaced
    ? (side.replacedInitial ?? new Decimal(0))
    : side.prev

  if (base === null) {
    throw new NoPreviousReadingError()
  }

  return base
}

/**
 * Споживання за місяць = поточний показник − база.
 *
 * Відʼємний результат — помилка (лічильник не міг «відмотати» назад),
 * а не відʼємний рахунок.
 */
export function consumption(side: MeterSideInput): Decimal {
  const used = side.curr.minus(consumptionBase(side))
  if (used.isNegative()) {
    throw new NegativeConsumptionError(used.toString())
  }
  return used
}
