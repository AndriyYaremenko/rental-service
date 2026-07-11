import { z } from 'zod'
import { trimmed } from './common'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата у форматі YYYY-MM-DD')

export const leaseCreateSchema = z.object({
  premisesId: trimmed,
  tenantId: trimmed,
  startDate: isoDate,
  endDate: isoDate.nullable(),
  rentUah: z.string().trim().min(1),
  garbageUah: z.string().trim().min(1),
})

export const leaseUpdateSchema = leaseCreateSchema.partial()

export type LeaseCreate = z.infer<typeof leaseCreateSchema>
export type LeaseUpdate = z.infer<typeof leaseUpdateSchema>
