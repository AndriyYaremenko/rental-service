import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { createLocation, listLocations } from '@/server/services/locations'
import { locationCreateSchema } from '@/lib/validation/location'

export const GET = route(async () => {
  await requireUser()
  return json(await listLocations())
})

export const POST = route(async (req) => {
  await requireUser()
  return json(await createLocation(await parseBody(req, locationCreateSchema)), 201)
})
