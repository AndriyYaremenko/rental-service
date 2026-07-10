import { z } from 'zod'
import { optionalText, trimmed } from './common'

export const locationCreateSchema = z.object({
  name: trimmed,
  address: trimmed,
  notes: optionalText,
})

export const locationUpdateSchema = locationCreateSchema.partial()

export type LocationCreate = z.infer<typeof locationCreateSchema>
export type LocationUpdate = z.infer<typeof locationUpdateSchema>
