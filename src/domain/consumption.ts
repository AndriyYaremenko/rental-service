import { Decimal } from 'decimal.js'
import { NegativeConsumptionError, NoPreviousReadingError } from './errors'
import type { MeterSideInput } from './types'

/**
 * Споживання за місяць.
 *
 * Якщо лічильник міняли, базою є початковий показник нового лічильника
 * (зазвичай нуль), а не останній показник старого — інакше споживання
 * вийшло б відʼємним.
 */
export function consumption(side: MeterSideInput): Decimal {
  const base = side.replaced
    ? (side.replacedInitial ?? new Decimal(0))
    : side.prev

  if (base === null) {
    throw new NoPreviousReadingError()
  }

  const used = side.curr.minus(base)
  if (used.isNegative()) {
    throw new NegativeConsumptionError(used.toString())
  }

  return used
}
