import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { createPayment, listPayments } from '@/server/services/payments'
import { paymentCreateSchema } from '@/lib/validation/payment'

export const GET = route(async (req) => {
  await requireUser()
  const leaseId = req.nextUrl.searchParams.get('leaseId') ?? undefined
  return json(await listPayments(leaseId))
})

export const POST = route(async (req) => {
  await requireUser()
  return json(await createPayment(await parseBody(req, paymentCreateSchema)), 201)
})
