import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { createTenant, listTenants } from '@/server/services/tenants'
import { tenantCreateSchema } from '@/lib/validation/tenant'

export const GET = route(async () => {
  await requireUser()
  return json(await listTenants())
})

export const POST = route(async (req) => {
  await requireUser()
  return json(await createTenant(await parseBody(req, tenantCreateSchema)), 201)
})
