import { z } from 'zod'
import { trimmed } from './common'

const meter = z.string().trim().regex(/^\d+(\.\d{1,3})?$/, 'Показник — число до трьох знаків')

const entry = z.object({
  premisesId: trimmed,
  electricity: meter,
  water: meter,
  electricityReplaced: z.boolean().optional(),
  electricityReplacedInitial: meter.nullable().optional(),
  waterReplaced: z.boolean().optional(),
  waterReplacedInitial: meter.nullable().optional(),
})

export const saveReadingsSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  entries: z.array(entry).min(1),
})

export type SaveReadingsBody = z.infer<typeof saveReadingsSchema>
