import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { deletePayment, getPayment, updatePayment } from '@/server/services/payments'
import { paymentUpdateSchema } from '@/lib/validation/payment'

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await getPayment((await params).id))
})
export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await updatePayment((await params).id, await parseBody(req, paymentUpdateSchema)))
})
export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  await deletePayment((await params).id)
  return json({ ok: true })
})
