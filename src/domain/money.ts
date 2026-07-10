import { Decimal } from 'decimal.js'
import { InvalidAmountError } from './errors'
import type { Kop } from './types'

/**
 * Гривні → копійки. Приймає рядок або число.
 * decimal.js будує значення з десяткового представлення числа,
 * тому float-похибки множення (1234.56 * 100) не виникає.
 */
export function toKop(uah: string | number): Kop {
  let value: Decimal
  try {
    value = new Decimal(uah)
  } catch {
    throw new InvalidAmountError(`Некоректна сума: ${uah}`)
  }

  if (value.isNegative()) {
    throw new InvalidAmountError(`Сума не може бути відʼємною: ${uah}`)
  }

  const kop = value.times(100)
  if (!kop.isInteger()) {
    throw new InvalidAmountError(`Сума ${uah} має більше двох знаків після коми`)
  }

  return kop.toNumber()
}

/** Копійки → рядок гривень із двома знаками, без розділювачів. */
export function fromKop(kop: Kop): string {
  return new Decimal(kop).dividedBy(100).toFixed(2)
}

/** Копійки → '1 234,56 грн' (нерозривний пробіл як розділювач тисяч). */
export function formatUah(kop: Kop): string {
  const uah = new Decimal(kop).dividedBy(100).toNumber()
  const formatted = new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(uah)
  return `${formatted} грн`
}

/** Єдина точка округлення в системі. Half-up, не банківське. */
export function roundHalfUp(value: Decimal): Kop {
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
}
