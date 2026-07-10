import { requireUser } from '@/server/auth/guard'
import { json, route } from '@/server/http'

export const GET = route(async () => {
  return json(await requireUser())
})
