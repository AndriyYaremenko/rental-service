import type { Kop } from './types'

/** Додатнє — борг, відʼємне — аванс. */
export function balanceKop(totalInvoicedKop: Kop, totalPaidKop: Kop): number {
  return totalInvoicedKop - totalPaidKop
}

export function debtKop(totalInvoicedKop: Kop, totalPaidKop: Kop): Kop {
  return Math.max(0, balanceKop(totalInvoicedKop, totalPaidKop))
}

export function advanceKop(totalInvoicedKop: Kop, totalPaidKop: Kop): Kop {
  return Math.max(0, -balanceKop(totalInvoicedKop, totalPaidKop))
}
