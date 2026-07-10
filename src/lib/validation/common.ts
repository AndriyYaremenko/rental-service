import { z } from 'zod'

/** Непорожній рядок після трімінгу. */
export const trimmed = z.string().trim().min(1, 'Поле обовʼязкове')

/**
 * Необовʼязковий текст.
 * - відсутнє поле → undefined (Prisma лишає значення без змін при update);
 * - порожній рядок → null (явне «очистити» — записує null у БД);
 * - інакше → трімнутий рядок.
 */
export const optionalText = z
  .string()
  .trim()
  .transform((s) => (s === '' ? null : s))
  .optional()
