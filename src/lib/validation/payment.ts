import { z } from 'zod'
import { optionalText, trimmed } from './common'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата у форматі YYYY-MM-DD')

export const paymentCreateSchema = z.object({
  leaseId: trimmed,
  date: isoDate,
  amountUah: z.string().trim().min(1),
  method: z.enum(['CASH', 'CARD', 'BANK']),
  note: optionalText,
})

export const paymentUpdateSchema = paymentCreateSchema.partial()

export type PaymentCreate = z.infer<typeof paymentCreateSchema>
export type PaymentUpdate = z.infer<typeof paymentUpdateSchema>
