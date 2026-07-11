import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { InvalidAmountError } from '@/domain/errors'
import { toKop } from '@/domain/money'
import type { PaymentCreate, PaymentUpdate } from '@/lib/validation/payment'

export interface PaymentDTO {
  id: string
  leaseId: string
  date: string
  amountKop: number
  method: 'CASH' | 'CARD' | 'BANK'
  note: string | null
}

function toDTO(p: Prisma.PaymentModel): PaymentDTO {
  return { id: p.id, leaseId: p.leaseId, date: p.date.toISOString(), amountKop: p.amountKop, method: p.method, note: p.note }
}

const notFound = () => new ApiError('NOT_FOUND', 'Оплату не знайдено')
const day = (d: string) => new Date(`${d}T00:00:00.000Z`)

function amountKop(uah: string): number {
  try {
    return toKop(uah)
  } catch (e) {
    if (e instanceof InvalidAmountError) throw new ApiError('VALIDATION_FAILED', 'Некоректна сума', { amount: e.message })
    throw e
  }
}

export async function listPayments(leaseId?: string): Promise<PaymentDTO[]> {
  return (await prisma.payment.findMany({
    where: leaseId ? { leaseId } : undefined,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  })).map(toDTO)
}

export async function getPayment(id: string): Promise<PaymentDTO> {
  const p = await prisma.payment.findUnique({ where: { id } })
  if (!p) throw notFound()
  return toDTO(p)
}

export async function createPayment(data: PaymentCreate): Promise<PaymentDTO> {
  return toDTO(await prisma.payment.create({
    data: { leaseId: data.leaseId, date: day(data.date), amountKop: amountKop(data.amountUah), method: data.method, note: data.note ?? null },
  }))
}

export async function updatePayment(id: string, data: PaymentUpdate): Promise<PaymentDTO> {
  await getPayment(id)
  const patch: Prisma.PaymentUpdateInput = {}
  if (data.leaseId !== undefined) patch.lease = { connect: { id: data.leaseId } }
  if (data.date !== undefined) patch.date = day(data.date)
  if (data.amountUah !== undefined) patch.amountKop = amountKop(data.amountUah)
  if (data.method !== undefined) patch.method = data.method
  if (data.note !== undefined) patch.note = data.note // optionalText: '' → null
  return toDTO(await prisma.payment.update({ where: { id }, data: patch }))
}

export async function deletePayment(id: string): Promise<void> {
  await getPayment(id)
  await prisma.payment.delete({ where: { id } })
}
