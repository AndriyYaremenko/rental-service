import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { isPremisesOccupied } from '@/domain/status'
import type { PremisesCreate, PremisesUpdate } from '@/lib/validation/premises'

export interface PremisesDTO {
  id: string
  locationId: string
  unitNumber: string
  type: string
  floor: number | null
  areaM2: string
  notes: string | null
  occupied: boolean
}

const notFound = () => new ApiError('NOT_FOUND', 'Приміщення не знайдено')

type Row = Prisma.PremisesModel & { leases: { startDate: Date; endDate: Date | null }[] }

function toDTO(p: Row, today: Date): PremisesDTO {
  return {
    id: p.id,
    locationId: p.locationId,
    unitNumber: p.unitNumber,
    type: p.type,
    floor: p.floor,
    areaM2: p.areaM2.toString(),
    notes: p.notes,
    occupied: isPremisesOccupied(p.leases, today),
  }
}

export async function listPremises(): Promise<PremisesDTO[]> {
  const today = new Date()
  const rows = await prisma.premises.findMany({
    include: { leases: { select: { startDate: true, endDate: true } } },
    orderBy: [{ locationId: 'asc' }, { unitNumber: 'asc' }],
  })
  return rows.map((r) => toDTO(r, today))
}

export async function getPremises(id: string): Promise<PremisesDTO> {
  const p = await prisma.premises.findUnique({
    where: { id },
    include: { leases: { select: { startDate: true, endDate: true } } },
  })
  if (!p) throw notFound()
  return toDTO(p, new Date())
}

export async function createPremises(data: PremisesCreate): Promise<PremisesDTO> {
  try {
    const p = await prisma.premises.create({
      data: {
        locationId: data.locationId,
        unitNumber: data.unitNumber,
        type: data.type,
        floor: data.floor ?? null,
        areaM2: data.areaM2,
        notes: data.notes,
      },
      include: { leases: { select: { startDate: true, endDate: true } } },
    })
    return toDTO(p, new Date())
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ApiError('CONFLICT', 'Приміщення з таким номером у цій локації вже існує')
    }
    throw e
  }
}

export async function updatePremises(id: string, data: PremisesUpdate): Promise<PremisesDTO> {
  await getPremises(id)
  try {
    const p = await prisma.premises.update({
      where: { id },
      data,
      include: { leases: { select: { startDate: true, endDate: true } } },
    })
    return toDTO(p, new Date())
  } catch (e) {
    // PATCH unitNumber/locationId може зіткнутися з наявною парою
    // @@unique([locationId, unitNumber]) — це 409, не 500.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ApiError('CONFLICT', 'Приміщення з таким номером у цій локації вже існує')
    }
    throw e
  }
}

export async function deletePremises(id: string): Promise<void> {
  await getPremises(id)
  try {
    await prisma.premises.delete({ where: { id } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new ApiError('CONFLICT', 'Приміщення не можна видалити: є повʼязані договори')
    }
    throw e
  }
}
