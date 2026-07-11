/** RFC 4180: поля з комою/лапками/переносом — у лапках, лапки подвоюються. */
function escapeField(value: string | number): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Серіалізує таблицю в CSV. Попереду — BOM (`U+FEFF`), щоб Excel розпізнав
 * UTF-8 і не поламав кирилицю; рядки розділяє CRLF за RFC 4180.
 */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(escapeField).join(','), ...rows.map((r) => r.map(escapeField).join(','))]
  return '\uFEFF' + lines.join('\r\n') // U+FEFF BOM — пиши ЕСКЕЙПОМ, не невидимим літералом
}
