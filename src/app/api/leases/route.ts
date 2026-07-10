import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { createLease, listLeases } from '@/server/services/leases'
import { leaseCreateSchema } from '@/lib/validation/lease'

export const GET = route(async () => {
  await requireUser()
  return json(await listLeases())
})
export const POST = route(async (req) => {
  await requireUser()
  return json(await createLease(await parseBody(req, leaseCreateSchema)), 201)
})
