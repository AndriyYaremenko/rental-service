import { z } from 'zod'

/** Непорожній рядок після трімінгу. */
export const trimmed = z.string().trim().min(1, 'Поле обовʼязкове')

/** Необовʼязковий текст: порожній рядок і пробіли стають undefined. */
export const optionalText = z
  .string()
  .trim()
  .transform((s) => (s === '' ? undefined : s))
  .optional()
