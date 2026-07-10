import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { createPremises, listPremises } from '@/server/services/premises'
import { premisesCreateSchema } from '@/lib/validation/premises'

export const GET = route(async () => {
  await requireUser()
  return json(await listPremises())
})

export const POST = route(async (req) => {
  await requireUser()
  return json(await createPremises(await parseBody(req, premisesCreateSchema)), 201)
})
