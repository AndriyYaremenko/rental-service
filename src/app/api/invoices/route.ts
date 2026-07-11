import { requireUser } from '@/server/auth/guard'
import { json, route } from '@/server/http'
import { parseYearMonth } from '@/server/query' // тестований (Task 2), відхиляє відсутній/нечисловий param
import { listInvoices } from '@/server/services/invoices'

export const GET = route(async (req) => {
  await requireUser()
  const { year, month } = parseYearMonth(req.nextUrl.searchParams)
  return json(await listInvoices(year, month))
})
