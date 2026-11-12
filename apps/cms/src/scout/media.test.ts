import { describe, expect, it } from 'vitest'
import { leastUsed } from './media'

describe('leastUsed (rotating a game’s images)', () => {
  const imgs = [{ id: 1 }, { id: 2 }, { id: 3 }]

  it('keeps the main cover while nothing has used it', () => {
    expect(leastUsed(imgs, new Map())?.id).toBe(1)
  })

  it('moves on to the image used least recently', () => {
    expect(
      leastUsed(
        imgs,
        new Map([
          [1, 3],
          [2, 1],
        ]),
      )?.id,
    ).toBe(3)
    expect(
      leastUsed(
        imgs,
        new Map([
          [1, 2],
          [2, 1],
          [3, 1],
        ]),
      )?.id,
    ).toBe(2)
  })

  it('returns null without images', () => {
    expect(leastUsed([], new Map())).toBeNull()
  })
})
