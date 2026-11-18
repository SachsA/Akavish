// ─── Platforms (consoles) ────────────────────────────────────────────────────
// Consoles are documents (collection `platforms`, /platform/<slug> on the
// site): a game release links to the ones it came out on, and the scout
// creates a console the news names for the first time (a PS6 reveal). This
// list is what the collection started with (migration
// 20261118_154700_platforms_collection, the seed): slugs, names, the short label the
// site shows, the family the games library groups them by, and the order
// inside a family (newest first).

export const PLATFORM_FAMILIES = ['pc', 'playstation', 'xbox', 'nintendo', 'mobile', 'vr', 'other'] as const
export type PlatformFamily = (typeof PLATFORM_FAMILIES)[number]

export const INITIAL_PLATFORMS = [
  { slug: 'pc', name: 'PC', short: 'PC', family: 'pc' },
  { slug: 'mac', name: 'Mac', short: 'Mac', family: 'pc' },
  { slug: 'ps5', name: 'PlayStation 5', short: 'PS5', family: 'playstation' },
  { slug: 'ps4', name: 'PlayStation 4', short: 'PS4', family: 'playstation' },
  { slug: 'ps3', name: 'PlayStation 3', short: 'PS3', family: 'playstation' },
  { slug: 'ps2', name: 'PlayStation 2', short: 'PS2', family: 'playstation' },
  { slug: 'ps1', name: 'PlayStation', short: 'PS1', family: 'playstation' },
  { slug: 'psp', name: 'PSP', short: 'PSP', family: 'playstation' },
  { slug: 'vita', name: 'PS Vita', short: 'Vita', family: 'playstation' },
  { slug: 'xbox-series', name: 'Xbox Series X|S', short: 'Xbox Series', family: 'xbox' },
  { slug: 'xbox-one', name: 'Xbox One', short: 'Xbox One', family: 'xbox' },
  { slug: 'xbox-360', name: 'Xbox 360', short: 'Xbox 360', family: 'xbox' },
  { slug: 'xbox', name: 'Xbox (2001)', short: 'Xbox', family: 'xbox' },
  { slug: 'switch-2', name: 'Nintendo Switch 2', short: 'Switch 2', family: 'nintendo' },
  { slug: 'switch', name: 'Nintendo Switch', short: 'Switch', family: 'nintendo' },
  { slug: 'wii-u', name: 'Wii U', short: 'Wii U', family: 'nintendo' },
  { slug: 'wii', name: 'Wii', short: 'Wii', family: 'nintendo' },
  { slug: 'gamecube', name: 'GameCube', short: 'GameCube', family: 'nintendo' },
  { slug: 'n64', name: 'Nintendo 64', short: 'N64', family: 'nintendo' },
  { slug: '3ds', name: 'Nintendo 3DS', short: '3DS', family: 'nintendo' },
  { slug: 'ds', name: 'Nintendo DS', short: 'DS', family: 'nintendo' },
  { slug: 'ios', name: 'iOS', short: 'iOS', family: 'mobile' },
  { slug: 'android', name: 'Android', short: 'Android', family: 'mobile' },
  { slug: 'quest', name: 'Meta Quest', short: 'Quest', family: 'vr' },
] as const satisfies ReadonlyArray<{ slug: string; name: string; short: string; family: PlatformFamily }>

/**
 * The family a new console belongs to, from its name ("PlayStation 6" →
 * playstation). Pure.
 */
export function familyOf(name: string): PlatformFamily {
  const n = name.toLowerCase()
  if (/playstation|\bps\d|\bpsp\b|vita/.test(n)) return 'playstation'
  if (/xbox/.test(n)) return 'xbox'
  if (/nintendo|switch|\bwii\b|gamecube|\b[23]?ds\b/.test(n)) return 'nintendo'
  if (/\bios\b|android|iphone|mobile/.test(n)) return 'mobile'
  if (/quest|vision pro|\bvr\b|psvr/.test(n)) return 'vr'
  if (/^(pc|mac|windows|linux|steam ?os|steam deck)/.test(n)) return 'pc'
  return 'other'
}

/** How precise a release date is: "Nov 19, 2026", "November 2026", "Q4 2026", "2026", "TBA". */
export const DATE_PRECISIONS = ['day', 'month', 'quarter', 'year', 'tba'] as const
export type DatePrecision = (typeof DATE_PRECISIONS)[number]
