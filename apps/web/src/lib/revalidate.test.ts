import { describe, expect, it } from 'vitest'
import { isValidSecret } from './revalidate'

describe('isValidSecret', () => {
  it('accepts the exact secret only', () => {
    expect(isValidSecret('s3cret-value', 's3cret-value')).toBe(true)
    expect(isValidSecret('s3cret-valuX', 's3cret-value')).toBe(false)
    expect(isValidSecret('short', 's3cret-value')).toBe(false)
  })

  it('refuses everything when no secret is configured or none is given', () => {
    expect(isValidSecret('anything', undefined)).toBe(false)
    expect(isValidSecret('anything', '')).toBe(false)
    expect(isValidSecret(null, 's3cret-value')).toBe(false)
  })
})
