import { z } from 'zod'

export const loginSchema = z.object({
  // Zod 4: email — top-level z.email(), НЕ застарілий z.string().email().
  email: z.email('Некоректний email'),
  password: z.string().min(1, 'Введіть пароль'),
})
