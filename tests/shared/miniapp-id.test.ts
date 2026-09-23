import { describe, expect, it } from 'vitest'
import { hasDealIdInput, parseDealIdInput } from '#shared/miniapp-id'

describe('parseDealIdInput', () => {
  it('reads a numeric id and ID: command', () => {
    expect(parseDealIdInput('14')).toBe('14')
    expect(parseDealIdInput('ID:14')).toBe('14')
    expect(parseDealIdInput('id: 14')).toBe('14')
  })

  it('treats empty id as new deal mode', () => {
    expect(hasDealIdInput('')).toBe(false)
    expect(hasDealIdInput('   ')).toBe(false)
    expect(hasDealIdInput('14')).toBe(true)
  })

  it('rejects empty and non-numeric values', () => {
    expect(parseDealIdInput('')).toBeNull()
    expect(parseDealIdInput('ID:')).toBeNull()
    expect(parseDealIdInput('ID: нет')).toBeNull()
    expect(parseDealIdInput('ID:14x')).toBeNull()
  })
})
