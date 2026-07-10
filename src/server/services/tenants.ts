import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import type { TenantCreate, TenantUpdate } from '@/lib/validation/tenant'

export interface TenantDTO {
  id: string
  name: string
  phone: string | null
  email: string | null
  taxCode: string | null
  notes: string | null
}

function toDTO(t: Prisma.TenantModel): TenantDTO {
  return { id: t.id, name: t.name, phone: t.phone, email: t.email, taxCode: t.taxCode, notes: t.notes }
}

const notFound = () => new ApiError('NOT_FOUND', 'Орендаря не знайдено')

export async function listTenants(): Promise<TenantDTO[]> {
  return (await prisma.tenant.findMany({ orderBy: { name: 'asc' } })).map(toDTO)
}

export async function getTenant(id: string): Promise<TenantDTO> {
  const t = await prisma.tenant.findUnique({ where: { id } })
  if (!t) throw notFound()
  return toDTO(t)
}

export async function createTenant(data: TenantCreate): Promise<TenantDTO> {
  return toDTO(await prisma.tenant.create({ data }))
}

export async function updateTenant(id: string, data: TenantUpdate): Promise<TenantDTO> {
  await getTenant(id)
  return toDTO(await prisma.tenant.update({ where: { id }, data }))
}

export async function deleteTenant(id: string): Promise<void> {
  await getTenant(id)
  try {
    await prisma.tenant.delete({ where: { id } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new ApiError('CONFLICT', 'Орендаря не можна видалити: є повʼязані договори')
    }
    throw e
  }
}
