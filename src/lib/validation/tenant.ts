import { z } from 'zod'
import { optionalText, trimmed } from './common'

export const tenantCreateSchema = z.object({
  name: trimmed,
  phone: optionalText,
  email: optionalText,
  taxCode: optionalText,
  notes: optionalText,
})

export const tenantUpdateSchema = tenantCreateSchema.partial()

export type TenantCreate = z.infer<typeof tenantCreateSchema>
export type TenantUpdate = z.infer<typeof tenantUpdateSchema>
