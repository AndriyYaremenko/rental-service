import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { InvalidAmountError } from '@/domain/errors'
import { toKop } from '@/domain/money'
import { hasOverlap } from '@/domain/overlap'
import { leaseState } from '@/domain/status'
import type { Period } from '@/domain/types'
import type { LeaseCreate, LeaseUpdate } from '@/lib/validation/lease'

export interface LeaseDTO {
  id: string
  premisesId: string
  tenantId: string
  startDate: string
  endDate: string | null
  rentKop: number
  garbageKop: number
  status: 'ACTIVE' | 'ENDED'
}

function toDTO(l: Prisma.LeaseModel): LeaseDTO {
  const period: Period = { startDate: l.startDate, endDate: l.endDate }
  return {
    id: l.id,
    premisesId: l.premisesId,
    tenantId: l.tenantId,
    startDate: l.startDate.toISOString(),
    endDate: l.endDate ? l.endDate.toISOString() : null,
    rentKop: l.rentKop,
    garbageKop: l.garbageKop,
    status: leaseState(period, new Date()),
  }
}

const notFound = () => new ApiError('NOT_FOUND', 'Договір не знайдено')
const day = (d: string) => new Date(`${d}T00:00:00.000Z`)

function amounts(rentUah: string, garbageUah: string): { rentKop: number; garbageKop: number } {
  try {
    return { rentKop: toKop(rentUah), garbageKop: toKop(garbageUah) }
  } catch (e) {
    if (e instanceof InvalidAmountError) throw new ApiError('VALIDATION_FAILED', 'Некоректна сума', { rent: e.message })
    throw e
  }
}

/** Перетин серед УСІХ договорів приміщення (крім self при оновленні). */
async function ensureNoOverlap(premisesId: string, candidate: Period, exceptId?: string): Promise<void> {
  const others = await prisma.lease.findMany({
    where: { premisesId, id: exceptId ? { not: exceptId } : undefined },
    select: { startDate: true, endDate: true },
  })
  const existing: Period[] = others.map((o) => ({ startDate: o.startDate, endDate: o.endDate }))
  if (hasOverlap(existing, candidate)) {
    throw new ApiError('LEASE_OVERLAP', 'Періоди договорів на приміщенні перетинаються', { startDate: 'зайнято' })
  }
}

export async function listLeases(): Promise<LeaseDTO[]> {
  return (await prisma.lease.findMany({ orderBy: { startDate: 'desc' } })).map(toDTO)
}

export async function getLease(id: string): Promise<LeaseDTO> {
  const l = await prisma.lease.findUnique({ where: { id } })
  if (!l) throw notFound()
  return toDTO(l)
}

export async function createLease(data: LeaseCreate): Promise<LeaseDTO> {
  const candidate: Period = { startDate: day(data.startDate), endDate: data.endDate ? day(data.endDate) : null }
  await ensureNoOverlap(data.premisesId, candidate)
  const { rentKop, garbageKop } = amounts(data.rentUah, data.garbageUah)
  return toDTO(await prisma.lease.create({
    data: {
      premisesId: data.premisesId, tenantId: data.tenantId,
      startDate: candidate.startDate, endDate: candidate.endDate,
      rentKop, garbageKop,
    },
  }))
}

export async function updateLease(id: string, data: LeaseUpdate): Promise<LeaseDTO> {
  const existing = await prisma.lease.findUnique({ where: { id } })
  if (!existing) throw notFound()

  const startDate = data.startDate ? day(data.startDate) : existing.startDate
  const endDate = data.endDate !== undefined ? (data.endDate ? day(data.endDate) : null) : existing.endDate
  const premisesId = data.premisesId ?? existing.premisesId
  await ensureNoOverlap(premisesId, { startDate, endDate }, id)

  const patch: Prisma.LeaseUpdateInput = {}
  if (data.premisesId !== undefined) patch.premises = { connect: { id: data.premisesId } }
  if (data.tenantId !== undefined) patch.tenant = { connect: { id: data.tenantId } }
  if (data.startDate !== undefined) patch.startDate = startDate
  if (data.endDate !== undefined) patch.endDate = endDate
  if (data.rentUah !== undefined) patch.rentKop = amounts(data.rentUah, data.garbageUah ?? '0').rentKop
  if (data.garbageUah !== undefined) patch.garbageKop = amounts(data.rentUah ?? '0', data.garbageUah).garbageKop

  return toDTO(await prisma.lease.update({ where: { id }, data: patch }))
}

export async function deleteLease(id: string): Promise<void> {
  const l = await prisma.lease.findUnique({ where: { id } })
  if (!l) throw notFound()
  try {
    await prisma.lease.delete({ where: { id } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new ApiError('CONFLICT', 'Договір не можна видалити: є повʼязані рахунки або оплати')
    }
    throw e
  }
}
