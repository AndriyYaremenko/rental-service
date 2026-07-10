import { z } from 'zod'

export const tariffCreateSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата у форматі YYYY-MM-DD'),
  electricityUah: z.string().trim().min(1),
  waterUah: z.string().trim().min(1),
})

export type TariffCreate = z.infer<typeof tariffCreateSchema>
