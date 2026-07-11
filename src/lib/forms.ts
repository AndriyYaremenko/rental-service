import { ClientApiError } from '@/lib/api'

export function fieldErrors(e: unknown): Record<string, string> {
  return e instanceof ClientApiError && e.fields ? e.fields : {}
}
export function errorMessage(e: unknown): string | null {
  if (e == null) return null
  if (e instanceof ClientApiError) return e.message
  return 'Сталася помилка'
}
