// ─── Platforms (consoles) ────────────────────────────────────────────────────
// The consoles a game release can be on. One value per console, not per
// family, so the games library can answer "PS5 in 2028" or "Switch in 2019".
// The web has the same list with short labels (apps/web/src/lib/platforms.ts,
// a unit test there checks both stay in sync). Adding one needs a migration
// (it's a Postgres enum); removing one needs the games using it moved first.

export const PLATFORMS = [
  { value: 'pc', label: 'PC' },
  { value: 'mac', label: 'Mac' },
  { value: 'ps5', label: 'PlayStation 5' },
  { value: 'ps4', label: 'PlayStation 4' },
  { value: 'ps3', label: 'PlayStation 3' },
  { value: 'ps2', label: 'PlayStation 2' },
  { value: 'ps1', label: 'PlayStation' },
  { value: 'psp', label: 'PSP' },
  { value: 'vita', label: 'PS Vita' },
  { value: 'xbox-series', label: 'Xbox Series X|S' },
  { value: 'xbox-one', label: 'Xbox One' },
  { value: 'xbox-360', label: 'Xbox 360' },
  { value: 'xbox', label: 'Xbox (2001)' },
  { value: 'switch-2', label: 'Nintendo Switch 2' },
  { value: 'switch', label: 'Nintendo Switch' },
  { value: 'wii-u', label: 'Wii U' },
  { value: 'wii', label: 'Wii' },
  { value: 'gamecube', label: 'GameCube' },
  { value: 'n64', label: 'Nintendo 64' },
  { value: '3ds', label: 'Nintendo 3DS' },
  { value: 'ds', label: 'Nintendo DS' },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'quest', label: 'Meta Quest' },
] as const

export type Platform = (typeof PLATFORMS)[number]['value']
export const PLATFORM_VALUES = PLATFORMS.map((p) => p.value) as Platform[]

/** How precise a release date is: "Nov 19, 2026", "November 2026", "Q4 2026", "2026", "TBA". */
export const DATE_PRECISIONS = ['day', 'month', 'quarter', 'year', 'tba'] as const
export type DatePrecision = (typeof DATE_PRECISIONS)[number]
