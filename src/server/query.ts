import { ApiError } from '@/server/http'

/**
 * Розбирає year/month із query-параметрів.
 *
 * `Number(null)` і `Number('')` обидва дають 0, тож перевіряємо саме рядок:
 * відсутній чи не суто цифровий параметр → VALIDATION_FAILED (не тихий year=0).
 */
export function parseYearMonth(params: URLSearchParams): { year: number; month: number } {
  const yRaw = params.get('year')
  const mRaw = params.get('month')
  const valid = (s: string | null): s is string => s !== null && /^\d+$/.test(s)
  if (!valid(yRaw) || !valid(mRaw)) {
    throw new ApiError('VALIDATION_FAILED', 'Потрібні коректні year і month')
  }
  const year = Number(yRaw)
  const month = Number(mRaw)
  if (year < 2000 || year > 3000 || month < 1 || month > 12) {
    throw new ApiError('VALIDATION_FAILED', 'Потрібні коректні year і month')
  }
  return { year, month }
}
