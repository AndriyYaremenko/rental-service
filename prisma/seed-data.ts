import bcrypt from 'bcryptjs'
import { toKop } from '../src/domain/money'
import { prisma } from '../src/server/db'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

export async function seed() {
  // Порядок видалення поважає зовнішні ключі
  await prisma.payment.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.meterReading.deleteMany()
  await prisma.lease.deleteMany()
  await prisma.premises.deleteMany()
  await prisma.location.deleteMany()
  await prisma.tenant.deleteMany()
  await prisma.tariff.deleteMany()
  await prisma.user.deleteMany()

  await prisma.user.create({
    data: {
      email: 'admin@rent.ksm.in.ua',
      passwordHash: await bcrypt.hash('admin12345', 10),
      name: 'Адміністратор',
      role: 'ADMIN',
    },
  })

  const east = await prisma.location.create({
    data: { name: 'БЦ Схід', address: 'вул. Хрещатик, 12, Київ' },
  })
  const depot = await prisma.location.create({
    data: { name: 'Склад Лівобережний', address: 'вул. Промислова, 5, Київ' },
  })

  const office204 = await prisma.premises.create({
    data: { locationId: east.id, unitNumber: '204', type: 'офіс', floor: 2, areaM2: '54.30' },
  })
  const retail101 = await prisma.premises.create({
    data: { locationId: east.id, unitNumber: '101', type: 'ритейл', floor: 1, areaM2: '88.00' },
  })
  await prisma.premises.create({
    data: { locationId: depot.id, unitNumber: 'A-1', type: 'склад', floor: 1, areaM2: '240.00' },
  })

  const kavaMisto = await prisma.tenant.create({
    data: { name: 'ТОВ «Кава Місто»', phone: '+380671234567', taxCode: '12345678' },
  })
  const softLab = await prisma.tenant.create({
    data: { name: 'ФОП Іваненко І. І.', phone: '+380509876543', taxCode: '2345678901' },
  })

  await prisma.lease.create({
    data: {
      premisesId: office204.id,
      tenantId: softLab.id,
      startDate: utc(2026, 1, 1),
      endDate: null,
      rentKop: toKop('18000.00'),
      garbageKop: toKop('300.00'),
    },
  })
  await prisma.lease.create({
    data: {
      premisesId: retail101.id,
      tenantId: kavaMisto.id,
      startDate: utc(2026, 3, 1),
      endDate: utc(2027, 2, 28),
      rentKop: toKop('42000.00'),
      garbageKop: toKop('550.00'),
    },
  })

  // Історія тарифів: старий діє з січня, новий — із червня
  await prisma.tariff.create({
    data: {
      effectiveFrom: utc(2026, 1, 1),
      electricityRateKop: toKop('4.32'),
      waterRateKop: toKop('12.50'),
    },
  })
  await prisma.tariff.create({
    data: {
      effectiveFrom: utc(2026, 6, 1),
      electricityRateKop: toKop('4.80'),
      waterRateKop: toKop('13.75'),
    },
  })

  // Два місяці показників: травень дає базу, червень — розрахунковий місяць
  const readings = [
    { premisesId: office204.id, year: 2026, month: 5, electricity: '1250.0', water: '48.500' },
    { premisesId: office204.id, year: 2026, month: 6, electricity: '1418.0', water: '52.250' },
    { premisesId: retail101.id, year: 2026, month: 5, electricity: '3110.0', water: '133.000' },
    { premisesId: retail101.id, year: 2026, month: 6, electricity: '3475.0', water: '141.750' },
  ]
  for (const r of readings) {
    await prisma.meterReading.create({ data: { ...r, readAt: utc(r.year, r.month, 28) } })
  }
}
