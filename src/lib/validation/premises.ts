import { z } from 'zod'
import { optionalText, trimmed } from './common'

export const premisesCreateSchema = z.object({
  locationId: trimmed,
  unitNumber: trimmed,
  type: trimmed,
  floor: z.number().int().nullable().optional(),
  areaM2: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Площа — число з до двох знаків'),
  notes: optionalText,
})

export const premisesUpdateSchema = premisesCreateSchema.partial()

export type PremisesCreate = z.infer<typeof premisesCreateSchema>
export type PremisesUpdate = z.infer<typeof premisesUpdateSchema>
