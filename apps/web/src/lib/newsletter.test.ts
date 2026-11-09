import { describe, expect, it } from 'vitest'
import { isPlausibleEmail } from './newsletter'

describe('isPlausibleEmail', () => {
  it('accepts ordinary addresses, trimmed', () => {
    expect(isPlausibleEmail('alex@example.com')).toBe(true)
    expect(isPlausibleEmail('  first.last+tag@sub.example.co.uk ')).toBe(true)
  })

  it('rejects what the CMS would reject', () => {
    expect(isPlausibleEmail('')).toBe(false)
    expect(isPlausibleEmail('alex')).toBe(false)
    expect(isPlausibleEmail('alex@localhost')).toBe(false)
    expect(isPlausibleEmail('a b@example.com')).toBe(false)
    expect(isPlausibleEmail(`${'a'.repeat(250)}@example.com`)).toBe(false)
  })
})
