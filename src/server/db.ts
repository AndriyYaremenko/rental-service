// Відносний шлях, НЕ alias '@/': seed запускається через tsx,
// який не резолвить paths із tsconfig.
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL не задано')
  // Prisma 7 вимагає driver adapter — без нього конструктор кидає помилку
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
