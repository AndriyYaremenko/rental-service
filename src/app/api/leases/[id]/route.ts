import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { deleteLease, getLease, updateLease } from '@/server/services/leases'
import { leaseUpdateSchema } from '@/lib/validation/lease'

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await getLease((await params).id))
})
export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await updateLease((await params).id, await parseBody(req, leaseUpdateSchema)))
})
export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  await deleteLease((await params).id)
  return json({ ok: true })
})
