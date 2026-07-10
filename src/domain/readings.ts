export interface MonthPoint {
  year: number
  month: number
}

/** Порядковий номер місяця — щоб порівнювати без роботи з датами. */
const ordinal = (p: MonthPoint): number => p.year * 12 + p.month

/**
 * Останній показник, знятий РАНІШЕ розрахункового місяця.
 *
 * Це не «місяць мінус один»: якщо в даних дірка, беремо найсвіжіший
 * наявний запис. Інакше пропущений місяць ламав би нарахування.
 */
export function findPreviousReading<T extends MonthPoint>(
  readings: T[],
  year: number,
  month: number,
): T | null {
  const target = ordinal({ year, month })
  const earlier = readings.filter((r) => ordinal(r) < target)

  if (earlier.length === 0) return null

  return earlier.reduce((best, r) => (ordinal(r) > ordinal(best) ? r : best))
}
