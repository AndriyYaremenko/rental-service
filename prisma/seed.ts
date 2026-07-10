// Має стояти ПЕРШИМ: db.ts читає process.env.DATABASE_URL при завантаженні
// модуля, а tsx (на відміну від Next.js) сам .env не підвантажує.
import 'dotenv/config'
import { prisma } from '../src/server/db'
import { seed } from './seed-data'

seed()
  .then(() => console.log('Seed виконано: admin@rent.ksm.in.ua / admin12345'))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
