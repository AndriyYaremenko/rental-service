export const CSRF_COOKIE = 'csrf'
export const CSRF_HEADER = 'x-csrf-token'
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Double-submit: автентифікована мутація вимагає непорожній заголовок,
 *  що дорівнює csrf-cookie. Безпечні методи й запити без сесії — дозволені. */
export function checkCsrf(
  method: string,
  sessionToken: string | undefined,
  csrfCookie: string | undefined,
  header: string | undefined,
): boolean {
  if (SAFE.has(method.toUpperCase())) return true
  if (!sessionToken) return true // немає сесії (логін) — CSRF не потрібен
  return Boolean(csrfCookie) && Boolean(header) && csrfCookie === header
}
