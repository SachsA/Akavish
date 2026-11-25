import { describe, expect, it } from 'vitest'
import { keyBytes } from './push-client'

describe('push key', () => {
  it('turns a base64url VAPID key into bytes', () => {
    const bytes = keyBytes('AQID-_8')
    expect([...bytes]).toEqual([1, 2, 3, 251, 255])
  })
})
