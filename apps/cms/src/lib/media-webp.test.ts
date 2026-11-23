import { describe, expect, it } from 'vitest'
import { hasWebpSizes, sizesWeight } from './media-webp'

const size = (mimeType: string, filesize = 100) => ({ mimeType, filesize })

describe('hasWebpSizes', () => {
  it('needs every size in WebP', () => {
    const webp = size('image/webp')
    expect(
      hasWebpSizes({
        id: 1,
        mimeType: 'image/jpeg',
        sizes: { thumbnail: webp, card: webp, hero: webp, square: webp },
      }),
    ).toBe(true)
    expect(
      hasWebpSizes({
        id: 1,
        mimeType: 'image/jpeg',
        sizes: { thumbnail: webp, card: webp, hero: null, square: webp },
      }),
    ).toBe(false)
    expect(
      hasWebpSizes({
        id: 1,
        mimeType: 'image/png',
        sizes: { thumbnail: size('image/png'), card: webp, hero: webp, square: webp },
      }),
    ).toBe(false)
  })

  it('leaves alone what Sharp does not convert', () => {
    expect(hasWebpSizes({ id: 1, mimeType: 'image/svg+xml', sizes: {} })).toBe(true)
    expect(hasWebpSizes({ id: 1, mimeType: 'application/pdf', sizes: {} })).toBe(true)
  })
})

describe('sizesWeight', () => {
  it('adds up the sizes', () => {
    expect(
      sizesWeight({
        id: 1,
        sizes: { thumbnail: size('image/webp', 10), card: size('image/webp', 30), hero: null },
      }),
    ).toBe(40)
  })
})
