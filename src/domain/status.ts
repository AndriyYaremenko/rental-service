import type { Period } from './types'

export type LeaseState = 'ACTIVE' | 'ENDED'

/** Усі межи рахуються в UTC, щоб місцевий часовий пояс не зсував місяць. */
export function firstDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
}

export function lastDayOfMonth(year: number, month: number): Date {
  // Нульовий день наступного місяця — останній день поточного.
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
}

/** endDate включно: договір, що завершується сьогодні, ще активний. */
export function leaseState(period: Period, today: Date): LeaseState {
  if (period.endDate === null) return 'ACTIVE'
  return period.endDate.getTime() >= today.getTime() ? 'ACTIVE' : 'ENDED'
}

/**
 * Чи діяв договір у вказаному місяці.
 *
 * Визначається ВИКЛЮЧНО датами. Завершений договір лишається чинним для
 * тих місяців, у яких він діяв, — інакше нарахування заднім числом за
 * минулий місяць мовчки пропускало б такий договір.
 */
export function isLeaseActiveInMonth(period: Period, year: number, month: number): boolean {
  const monthStart = firstDayOfMonth(year, month)
  const monthEnd = lastDayOfMonth(year, month)

  const startsInTime = period.startDate.getTime() <= monthEnd.getTime()
  const endsInTime = period.endDate === null || period.endDate.getTime() >= monthStart.getTime()

  return startsInTime && endsInTime
}

/** Здане, якщо існує договір, що вже почався і ще не завершився. */
export function isPremisesOccupied(leases: Period[], today: Date): boolean {
  return leases.some(
    (lease) =>
      lease.startDate.getTime() <= today.getTime() && leaseState(lease, today) === 'ACTIVE',
  )
}
