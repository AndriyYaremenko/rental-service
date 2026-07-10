import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import type { LocationCreate, LocationUpdate } from '@/lib/validation/location'

export interface LocationDTO {
  id: string
  name: string
  address: string
  notes: string | null
}

function toDTO(l: { id: string; name: string; address: string; notes: string | null }): LocationDTO {
  return { id: l.id, name: l.name, address: l.address, notes: l.notes }
}

const notFound = () => new ApiError('NOT_FOUND', 'Локацію не знайдено')

export async function listLocations(): Promise<LocationDTO[]> {
  const rows = await prisma.location.findMany({ orderBy: { name: 'asc' } })
  return rows.map(toDTO)
}

export async function getLocation(id: string): Promise<LocationDTO> {
  const l = await prisma.location.findUnique({ where: { id } })
  if (!l) throw notFound()
  return toDTO(l)
}

export async function createLocation(data: LocationCreate): Promise<LocationDTO> {
  return toDTO(await prisma.location.create({ data: { name: data.name, address: data.address, notes: data.notes } }))
}

export async function updateLocation(id: string, data: LocationUpdate): Promise<LocationDTO> {
  await getLocation(id) // 404, якщо немає
  return toDTO(await prisma.location.update({ where: { id }, data }))
}

export async function deleteLocation(id: string): Promise<void> {
  await getLocation(id)
  try {
    await prisma.location.delete({ where: { id } })
  } catch (e) {
    // onDelete: Restrict → приміщення тримають локацію
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new ApiError('CONFLICT', 'Локацію не можна видалити: у ній є приміщення')
    }
    throw e
  }
}
