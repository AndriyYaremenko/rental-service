import { requireUser } from '@/server/auth/guard'
import { json, route } from '@/server/http'
import { reportDebts } from '@/server/services/reports'

export const GET = route(async () => {
  await requireUser()
  return json(await reportDebts())
})
