import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { deletePremises, getPremises, updatePremises } from '@/server/services/premises'
import { premisesUpdateSchema } from '@/lib/validation/premises'

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await getPremises((await params).id))
})

export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await updatePremises((await params).id, await parseBody(req, premisesUpdateSchema)))
})

export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  await deletePremises((await params).id)
  return json({ ok: true })
})
