import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { deleteLocation, getLocation, updateLocation } from '@/server/services/locations'
import { locationUpdateSchema } from '@/lib/validation/location'

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await getLocation((await params).id))
})

export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await updateLocation((await params).id, await parseBody(req, locationUpdateSchema)))
})

export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  await deleteLocation((await params).id)
  return json({ ok: true })
})
