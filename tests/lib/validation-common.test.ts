import { describe, expect, it } from 'vitest'
import { optionalText, trimmed } from '@/lib/validation/common'

describe('optionalText', () => {
  it('порожній рядок → null (явне очищення поля)', () => {
    expect(optionalText.parse('')).toBeNull()
  })

  it('лише пробіли → null', () => {
    expect(optionalText.parse('   ')).toBeNull()
  })

  it('відсутнє значення → undefined (лишити без змін)', () => {
    expect(optionalText.parse(undefined)).toBeUndefined()
  })

  it('текст трімається', () => {
    expect(optionalText.parse('  ok  ')).toBe('ok')
  })
})

describe('trimmed', () => {
  it('відхиляє порожній рядок', () => {
    expect(trimmed.safeParse('   ').success).toBe(false)
  })

  it('трімає непорожній', () => {
    expect(trimmed.parse('  назва ')).toBe('назва')
  })
})
