import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { hashPassword } from '@/server/auth/password'
import type { UserCreate, UserUpdate } from '@/lib/validation/user'

export interface UserDTO {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'USER'
  isActive: boolean
}

// УВАГА: явний літерал полів — passwordHash НІКОЛИ не потрапляє в DTO,
// щоб хеш пароля не витік через жоден роут (create/update/list).
function toDTO(u: Prisma.UserModel): UserDTO {
  return { id: u.id, email: u.email, name: u.name, role: u.role === 'ADMIN' ? 'ADMIN' : 'USER', isActive: u.isActive }
}

const notFound = () => new ApiError('NOT_FOUND', 'Користувача не знайдено')

export async function listUsers(): Promise<UserDTO[]> {
  return (await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })).map(toDTO)
}

export async function createUser(data: UserCreate): Promise<UserDTO> {
  try {
    const u = await prisma.user.create({
      data: { email: data.email, name: data.name, role: data.role, passwordHash: await hashPassword(data.password) },
    })
    return toDTO(u)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ApiError('CONFLICT', 'Користувач із таким email уже існує')
    }
    throw e
  }
}

export async function updateUser(id: string, data: UserUpdate, currentUserId: string): Promise<UserDTO> {
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) throw notFound()

  // Захист від самоблокування (симетрично до deleteUser): адмін не може
  // деактивувати чи понизити САМ СЕБЕ, інакше єдиний адмін позбавив би
  // систему керування користувачами, і відновити можна лише через БД.
  if (id === currentUserId) {
    if (data.isActive === false) {
      throw new ApiError('CONFLICT', 'Не можна деактивувати власний обліковий запис')
    }
    if (data.role === 'USER') {
      throw new ApiError('CONFLICT', 'Не можна понизити роль власного облікового запису')
    }
  }

  const patch: Prisma.UserUpdateInput = {}
  if (data.name !== undefined) patch.name = data.name
  if (data.role !== undefined) patch.role = data.role
  if (data.isActive !== undefined) patch.isActive = data.isActive
  if (data.password !== undefined) patch.passwordHash = await hashPassword(data.password)

  return toDTO(await prisma.user.update({ where: { id }, data: patch }))
}

export async function deleteUser(id: string, currentUserId: string): Promise<void> {
  if (id === currentUserId) {
    throw new ApiError('CONFLICT', 'Не можна видалити власний обліковий запис')
  }
  const u = await prisma.user.findUnique({ where: { id } })
  if (!u) throw notFound()
  await prisma.user.delete({ where: { id } })
}
