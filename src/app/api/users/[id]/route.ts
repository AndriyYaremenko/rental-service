import { requireAdmin } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { deleteUser, updateUser } from '@/server/services/users'
import { userUpdateSchema } from '@/lib/validation/user'

export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  return json(await updateUser((await params).id, await parseBody(req, userUpdateSchema), admin.id))
})

export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  await deleteUser((await params).id, admin.id)
  return json({ ok: true })
})
