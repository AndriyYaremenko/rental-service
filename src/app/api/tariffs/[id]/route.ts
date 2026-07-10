import { requireUser } from '@/server/auth/guard'
import { json, route } from '@/server/http'
import { deleteTariff } from '@/server/services/tariffs'

export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  await deleteTariff((await params).id)
  return json({ ok: true })
})
