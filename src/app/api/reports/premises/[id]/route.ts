import { requireUser } from '@/server/auth/guard'
import { json, route } from '@/server/http'
import { reportPremisesHistory } from '@/server/services/reports'

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await reportPremisesHistory((await params).id))
})
