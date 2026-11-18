// ─── Review score colours ────────────────────────────────────────────────────
// A review's score sits in a pill whose colour says how good it is:
//   10       gold
//   7 to 9   green, from a yellowish green at 7 to a very deep green at 9
//   5 to 6   yellow
//   0 to 4   red, from a dark red at 0 to a brighter red at 4
// Each pill is a small gradient (lighter top-left, the shade bottom-right).
// Half points (8.5) fall between their neighbours. Pure: unit-tested.

export interface ScoreColors {
  /** Gradient start (lighter) and end. */
  from: string
  to: string
  /** Text colour readable on it. */
  text: string
}

const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const DARK_TEXT = 'hsl(30 40% 10%)'
const WHITE = '#ffffff'

export function scoreColors(score: number): ScoreColors {
  const s = Math.min(10, Math.max(0, score))
  if (s >= 10) {
    return { from: hsl(50, 98, 64), to: hsl(38, 92, 44), text: DARK_TEXT }
  }
  if (s >= 7) {
    // 7 → 9: hue from yellow-green to green, lightness down to a deep green.
    const t = clamp01((s - 7) / 2)
    const h = lerp(80, 145, t)
    const l = lerp(42, 20, t)
    const sat = lerp(75, 80, t)
    return { from: hsl(h, sat, l + 9), to: hsl(h, sat, l), text: l >= 36 ? DARK_TEXT : WHITE }
  }
  if (s >= 5) {
    // 5 → 6: an amber yellow to a bright yellow.
    const t = clamp01((s - 5) / 1.9)
    const h = lerp(42, 52, t)
    return { from: hsl(h, 96, 60), to: hsl(h, 92, 48), text: DARK_TEXT }
  }
  // 0 → 4: a dark red to a brighter red.
  const t = clamp01(s / 4)
  const l = lerp(28, 46, t)
  // Hues around 0: from 358 (a touch of crimson) to 6, wrapped.
  const h = (lerp(-2, 6, t) + 360) % 360
  return { from: hsl((h + 4) % 360, 78, l + 9), to: hsl(h, 80, l), text: WHITE }
}

/** "8.5" stays "8.5", "8" stays "8". */
export const formatScore = (score: number) => String(Math.round(score * 10) / 10)
