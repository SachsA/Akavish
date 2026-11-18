// ─── Consoles ────────────────────────────────────────────────────────────────
// Consoles are CMS documents (collection `platforms`): the scout creates a new
// one when the news names it (a PS6 reveal), and each has a page
// (/platform/<slug>). `fetchAllPlatforms` (lib/payload.ts) gives the list;
// everything here takes it as an argument. The games library groups them by
// family, newest first inside a family.

export const PLATFORM_FAMILIES = ['pc', 'playstation', 'xbox', 'nintendo', 'mobile', 'vr', 'other'] as const
export type PlatformFamily = (typeof PLATFORM_FAMILIES)[number]

export interface PlatformInfo {
  /** The slug, as in URLs and in a release's consoles. */
  value: string
  /** "PS5", "Xbox Series". */
  short: string
  /** "PlayStation 5". */
  label: string
  family: PlatformFamily
  /** Order inside the family (0 = first, the newest). */
  position: number
}

/** The site's order: family, then position, then name. */
export function orderPlatforms(list: readonly PlatformInfo[]): PlatformInfo[] {
  const fam = (p: PlatformInfo) => {
    const i = PLATFORM_FAMILIES.indexOf(p.family)
    return i < 0 ? PLATFORM_FAMILIES.length : i
  }
  return [...list].sort((a, b) => fam(a) - fam(b) || a.position - b.position || a.label.localeCompare(b.label))
}

export function platformInfo(value: string, list: readonly PlatformInfo[]): PlatformInfo | undefined {
  return list.find((p) => p.value === value)
}

/** "PS5", "Xbox Series"… (the value itself for one the list doesn't have). */
export const platformShort = (value: string, list: readonly PlatformInfo[]) =>
  platformInfo(value, list)?.short ?? value
export const platformLabel = (value: string, list: readonly PlatformInfo[]) =>
  platformInfo(value, list)?.label ?? value

/** These consoles in the site's order; ones the list doesn't have go last. */
export function sortPlatforms(values: readonly string[], list: readonly PlatformInfo[]): string[] {
  const known = orderPlatforms(list).map((p) => p.value).filter((p) => values.includes(p))
  return [...known, ...values.filter((v) => !known.includes(v))]
}
