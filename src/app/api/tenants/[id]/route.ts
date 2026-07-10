import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { deleteTenant, getTenant, updateTenant } from '@/server/services/tenants'
import { tenantUpdateSchema } from '@/lib/validation/tenant'

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await getTenant((await params).id))
})

export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await updateTenant((await params).id, await parseBody(req, tenantUpdateSchema)))
})

export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  await deleteTenant((await params).id)
  return json({ ok: true })
})
