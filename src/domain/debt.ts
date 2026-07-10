import type { Kop } from './types'

/** Додатнє — борг, відʼємне — аванс. Єдине місце, де виконується віднімання. */
export function balanceKop(totalInvoicedKop: Kop, totalPaidKop: Kop): number {
  return totalInvoicedKop - totalPaidKop
}

/** Борг орендаря. Нуль, якщо він переплатив, — відʼємного боргу не буває. */
export function debtKop(totalInvoicedKop: Kop, totalPaidKop: Kop): Kop {
  return Math.max(0, balanceKop(totalInvoicedKop, totalPaidKop))
}

/**
 * Переплата орендаря. Нуль, якщо він у боргу.
 *
 * `Math.max(0, …)` тут не лише відсікає відʼємне: при нульовому балансі
 * вираз `-0` нормалізується до `+0`. Реалізація `-Math.min(0, balance)`
 * виглядає еквівалентною, але повертає `-0`.
 */
export function advanceKop(totalInvoicedKop: Kop, totalPaidKop: Kop): Kop {
  return Math.max(0, -balanceKop(totalInvoicedKop, totalPaidKop))
}
