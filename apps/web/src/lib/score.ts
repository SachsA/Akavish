// ─── Review score colours ────────────────────────────────────────────────────
// A review's score sits in a pill whose colour says how good it is:
//   10       gold
//   7 to 9   green, from a lime green at 7 to a very deep green at 9
//   5 to 6   orange-amber at 5, yellow at 6
//   0 to 4   red, from a dark maroon at 0 to a bright red at 4
// Each pill is a small gradient (lighter top-left, the shade bottom-right),
// always with white text.
// Half points (8.5) fall between their neighbours. Pure: unit-tested.

export interface ScoreColors {
  /** Gradient start (lighter) and end. */
  from: string
  to: string
  /** A middle stop (gold's metallic sheen). */
  via?: string
  /** A thin inner ring (gold only). */
  ring?: string
  /** Text colour: always white (with a light shadow in the pill), on every colour. */
  text: string
}

const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const WHITE = '#ffffff'

/**
 * Colours far apart on purpose, so a 7, an 8 and a 9 don't look alike: the
 * hue moves a lot inside each band and the shade darkens with it. Every
 * colour is dark enough for white text.
 */
export function scoreColors(score: number): ScoreColors {
  const s = Math.min(10, Math.max(0, score))
  if (s >= 10) {
    // Gold: a metallic sheen (light gold → gold → bronze) and a bright ring,
    // so it never reads as the yellow of a 6.
    return { from: hsl(48, 100, 70), via: hsl(43, 90, 46), to: hsl(32, 90, 26), ring: hsl(48, 100, 75), text: WHITE }
  }
  if (s >= 7) {
    // 7 lime, 8 plain green, 9 very deep emerald.
    const t = clamp01((s - 7) / 2)
    const h = lerp(78, 158, t)
    const l = lerp(38, 16, t)
    const sat = lerp(85, 90, t)
    return { from: hsl(h - 6, sat, l + 10), to: hsl(h, sat, l), text: WHITE }
  }
  if (s >= 5) {
    // 5 orange-amber, 6 yellow.
    const t = clamp01((s - 5) / 1.5)
    const h = lerp(30, 48, t)
    return { from: hsl(h + 4, 100, 46), to: hsl(h, 95, 37), text: WHITE }
  }
  // 0 a very dark maroon, 4 a bright red; hues around 0, wrapped.
  const t = clamp01(s / 4)
  const h = (lerp(-12, 6, t) + 360) % 360
  const l = lerp(20, 44, t)
  return { from: hsl((h + 6) % 360, 85, l + 10), to: hsl(h, 88, l), text: WHITE }
}

/** "8.5" stays "8.5", "8" stays "8". */
export const formatScore = (score: number) => String(Math.round(score * 10) / 10)
