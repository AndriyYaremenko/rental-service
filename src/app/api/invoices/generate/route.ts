import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { generateInvoices } from '@/server/services/invoices'
import { z } from 'zod'

const genSchema = z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) })

export const POST = route(async (req) => {
  await requireUser()
  const { year, month } = await parseBody(req, genSchema)
  return json(await generateInvoices(year, month))
})
