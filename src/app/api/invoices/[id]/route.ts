import { requireUser } from '@/server/auth/guard'
import { json, route } from '@/server/http'
import { getInvoice } from '@/server/services/invoices'

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await getInvoice((await params).id))
})
