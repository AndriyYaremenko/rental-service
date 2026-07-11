import { describe, expect, it } from 'vitest'
import { chipClass, STATUS_LABEL } from '@/components/ui/StatusChip'

describe('StatusChip мапінг', () => {
  it('кожен статус має свій клас і український підпис', () => {
    expect(STATUS_LABEL.PAID).toBe('Оплачено')
    expect(STATUS_LABEL.PARTIAL).toBe('Частково')
    expect(STATUS_LABEL.UNPAID).toBe('Не оплачено')
    expect(STATUS_LABEL.ACTIVE).toBe('Активний')
    expect(STATUS_LABEL.ENDED).toBe('Завершений')
  })

  it('тонові групи різні: оплачено/частково/несплачено/завершено не збігаються', () => {
    // 4 різні тони; PAID і ACTIVE навмисно спільні (зелений, різні домени).
    const groups = [chipClass('PAID'), chipClass('PARTIAL'), chipClass('UNPAID'), chipClass('ENDED')]
    expect(new Set(groups).size).toBe(4) // жодна пара не колізує
    expect(chipClass('ACTIVE')).toBe(chipClass('PAID')) // свідомо спільний зелений
  })
})
