import { requireAdmin } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { createUser, listUsers } from '@/server/services/users'
import { userCreateSchema } from '@/lib/validation/user'

export const GET = route(async () => {
  await requireAdmin()
  return json(await listUsers())
})

export const POST = route(async (req) => {
  await requireAdmin()
  return json(await createUser(await parseBody(req, userCreateSchema)), 201)
})
