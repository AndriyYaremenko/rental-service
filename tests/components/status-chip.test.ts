import { describe, expect, it } from 'vitest'
import { chipClass, STATUS_LABEL } from '@/components/ui/StatusChip'

describe('StatusChip мапінг', () => {
  it('кожен статус має свій клас і український підпис', () => {
    expect(STATUS_LABEL.PAID).toBe('Оплачено')
    expect(STATUS_LABEL.PARTIAL).toBe('Частково')
    expect(STATUS_LABEL.UNPAID).toBe('Не оплачено')
    expect(STATUS_LABEL.ACTIVE).toBe('Активний')
    expect(STATUS_LABEL.ENDED).toBe('Завершений')
    // різні статуси → різні класи (не всі однакові)
    expect(chipClass('PAID')).not.toBe(chipClass('UNPAID'))
  })
})
