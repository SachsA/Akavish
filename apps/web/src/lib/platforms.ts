// ─── Consoles ────────────────────────────────────────────────────────────────
// The CMS's list (apps/cms/src/lib/platforms.ts, same values and order; a
// test checks) with the labels the site shows and the family each belongs to,
// for the games library's console filter.

export const PLATFORM_FAMILIES = ['pc', 'playstation', 'xbox', 'nintendo', 'mobile', 'vr'] as const
export type PlatformFamily = (typeof PLATFORM_FAMILIES)[number]

export const PLATFORMS = [
  { value: 'pc', short: 'PC', label: 'PC', family: 'pc' },
  { value: 'mac', short: 'Mac', label: 'Mac', family: 'pc' },
  { value: 'ps5', short: 'PS5', label: 'PlayStation 5', family: 'playstation' },
  { value: 'ps4', short: 'PS4', label: 'PlayStation 4', family: 'playstation' },
  { value: 'ps3', short: 'PS3', label: 'PlayStation 3', family: 'playstation' },
  { value: 'ps2', short: 'PS2', label: 'PlayStation 2', family: 'playstation' },
  { value: 'ps1', short: 'PS1', label: 'PlayStation', family: 'playstation' },
  { value: 'psp', short: 'PSP', label: 'PSP', family: 'playstation' },
  { value: 'vita', short: 'Vita', label: 'PS Vita', family: 'playstation' },
  { value: 'xbox-series', short: 'Xbox Series', label: 'Xbox Series X|S', family: 'xbox' },
  { value: 'xbox-one', short: 'Xbox One', label: 'Xbox One', family: 'xbox' },
  { value: 'xbox-360', short: 'Xbox 360', label: 'Xbox 360', family: 'xbox' },
  { value: 'xbox', short: 'Xbox', label: 'Xbox (2001)', family: 'xbox' },
  { value: 'switch-2', short: 'Switch 2', label: 'Nintendo Switch 2', family: 'nintendo' },
  { value: 'switch', short: 'Switch', label: 'Nintendo Switch', family: 'nintendo' },
  { value: 'wii-u', short: 'Wii U', label: 'Wii U', family: 'nintendo' },
  { value: 'wii', short: 'Wii', label: 'Wii', family: 'nintendo' },
  { value: 'gamecube', short: 'GameCube', label: 'GameCube', family: 'nintendo' },
  { value: 'n64', short: 'N64', label: 'Nintendo 64', family: 'nintendo' },
  { value: '3ds', short: '3DS', label: 'Nintendo 3DS', family: 'nintendo' },
  { value: 'ds', short: 'DS', label: 'Nintendo DS', family: 'nintendo' },
  { value: 'ios', short: 'iOS', label: 'iOS', family: 'mobile' },
  { value: 'android', short: 'Android', label: 'Android', family: 'mobile' },
  { value: 'quest', short: 'Quest', label: 'Meta Quest', family: 'vr' },
] as const satisfies ReadonlyArray<{ value: string; short: string; label: string; family: PlatformFamily }>

export type Platform = (typeof PLATFORMS)[number]['value']
export const PLATFORM_VALUES: readonly string[] = PLATFORMS.map((p) => p.value)

export function platformInfo(value: string) {
  return PLATFORMS.find((p) => p.value === value)
}

/** "PS5", "Xbox Series"… (the value itself for one the site doesn't know). */
export const platformShort = (value: string) => platformInfo(value)?.short ?? value
export const platformLabel = (value: string) => platformInfo(value)?.label ?? value

/** Known values only, in the list's order (newest consoles first per family). */
export function sortPlatforms(values: readonly string[]): string[] {
  return PLATFORM_VALUES.filter((p) => values.includes(p))
}
