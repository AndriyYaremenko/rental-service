import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { toKop } from '@/domain/money'
import { InvalidAmountError } from '@/domain/errors'
import type { TariffCreate } from '@/lib/validation/tariff'

export interface TariffDTO {
  id: string
  effectiveFrom: string
  electricityRateKop: number
  waterRateKop: number
}

function toDTO(t: Prisma.TariffModel): TariffDTO {
  return {
    id: t.id,
    effectiveFrom: t.effectiveFrom.toISOString(),
    electricityRateKop: t.electricityRateKop,
    waterRateKop: t.waterRateKop,
  }
}

export async function listTariffs(): Promise<TariffDTO[]> {
  return (await prisma.tariff.findMany({ orderBy: { effectiveFrom: 'asc' } })).map(toDTO)
}

export async function createTariff(data: TariffCreate): Promise<TariffDTO> {
  // Конвертація грн→копійки на межі сервісу; помилку toKop мапимо у VALIDATION_FAILED.
  let electricityRateKop: number
  let waterRateKop: number
  try {
    electricityRateKop = toKop(data.electricityUah)
    waterRateKop = toKop(data.waterUah)
  } catch (e) {
    if (e instanceof InvalidAmountError) {
      throw new ApiError('VALIDATION_FAILED', 'Некоректна ставка тарифу', { rate: e.message })
    }
    throw e
  }
  try {
    const t = await prisma.tariff.create({
      data: { effectiveFrom: new Date(`${data.effectiveFrom}T00:00:00.000Z`), electricityRateKop, waterRateKop },
    })
    return toDTO(t)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ApiError('CONFLICT', 'Тариф на цю дату вже існує')
    }
    throw e
  }
}

export async function deleteTariff(id: string): Promise<void> {
  const t = await prisma.tariff.findUnique({ where: { id } })
  if (!t) throw new ApiError('NOT_FOUND', 'Тариф не знайдено')
  await prisma.tariff.delete({ where: { id } })
}
