import { z } from 'zod'
import { trimmed } from './common'

export const userCreateSchema = z.object({
  email: z.email('Некоректний email'), // Zod 4: top-level, не z.string().email()
  name: trimmed,
  role: z.enum(['ADMIN', 'USER']),
  password: z.string().min(8, 'Пароль щонайменше 8 символів'),
})

export const userUpdateSchema = z.object({
  name: trimmed.optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, 'Пароль щонайменше 8 символів').optional(),
})

export type UserCreate = z.infer<typeof userCreateSchema>
export type UserUpdate = z.infer<typeof userUpdateSchema>
