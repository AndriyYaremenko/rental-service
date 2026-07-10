import type { Period } from './types'

const endOf = (period: Period): number =>
  period.endDate === null ? Number.POSITIVE_INFINITY : period.endDate.getTime()

/**
 * Періоди перетинаються, якщо кожен починається не пізніше,
 * ніж закінчується інший. endDate вважається включним.
 */
export function periodsOverlap(a: Period, b: Period): boolean {
  return a.startDate.getTime() <= endOf(b) && b.startDate.getTime() <= endOf(a)
}

/** Перевіряється проти УСІХ договорів приміщення — статусу в них немає. */
export function hasOverlap(existing: Period[], candidate: Period): boolean {
  return existing.some((period) => periodsOverlap(period, candidate))
}
