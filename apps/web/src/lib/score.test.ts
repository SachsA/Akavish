import { describe, expect, it } from 'vitest'
import { formatScore, scoreColors } from './score'

const hue = (c: string) => Number(c.match(/^hsl\((\d+)/)![1])
const light = (c: string) => Number(c.match(/(\d+)%\)$/)![1])

describe('review score colours', () => {
  it('10 is gold', () => {
    expect(scoreColors(10)).toEqual({ from: 'hsl(50 98% 64%)', to: 'hsl(38 92% 44%)', text: 'hsl(30 40% 10%)' })
  })
  it('7 to 9: green, yellowish at 7, very deep at 9', () => {
    const seven = scoreColors(7)
    const nine = scoreColors(9)
    expect(hue(seven.to)).toBeLessThan(90)
    expect(hue(nine.to)).toBeGreaterThan(140)
    expect(light(nine.to)).toBeLessThanOrEqual(20)
    expect(light(scoreColors(8).to)).toBeLessThan(light(seven.to))
    expect(scoreColors(9.5)).toEqual(nine)
    expect(nine.text).toBe('#ffffff')
  })
  it('5 and 6 are yellow, 0 to 4 red', () => {
    expect(hue(scoreColors(5).to)).toBeGreaterThanOrEqual(40)
    expect(hue(scoreColors(6.5).to)).toBeLessThanOrEqual(55)
    for (const s of [0, 2, 4, 4.5]) {
      const h = hue(scoreColors(s).to)
      expect(h < 15 || h > 340).toBe(true)
    }
    expect(light(scoreColors(0).to)).toBeLessThan(light(scoreColors(4).to))
  })
  it('formats half points', () => {
    expect(formatScore(8.5)).toBe('8.5')
    expect(formatScore(8)).toBe('8')
  })
})
