import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { createTariff, listTariffs } from '@/server/services/tariffs'
import { tariffCreateSchema } from '@/lib/validation/tariff'

export const GET = route(async () => {
  await requireUser()
  return json(await listTariffs())
})

export const POST = route(async (req) => {
  await requireUser()
  return json(await createTariff(await parseBody(req, tariffCreateSchema)), 201)
})
