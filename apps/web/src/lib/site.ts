// Central site config. The canonical/public base URL is read from env so it can
// differ between dev (localhost) and production (akavish.gg).

function normalize(url: string): string {
  return url.replace(/\/+$/, '') // strip trailing slashes
}

export const SITE_URL = normalize(
  process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'
)

export const SITE_NAME = 'Akavish'
export const SITE_DESCRIPTION =
  'Breaking gaming news, exclusive leaks, in-depth reviews and conference recaps.'
export const SITE_TWITTER = '@akavish33'

/**
 * Official social profiles. Defined once here because they're rendered in
 * several places (footer, /contact) — duplicating the URLs is how one of them
 * ends up stale.
 *
 * ⚠️ The Discord URL is an **invite code**, not a stable profile URL. Discord
 * invites can be set to expire; make sure this one is created with "Never
 * expire" and unlimited uses, or the link silently dies.
 */
export const SITE_SOCIALS = {
  x: 'https://x.com/akavish33',
  discord: 'https://discord.gg/b9qUBbM9Ku',
  youtube: 'https://www.youtube.com/@akavish33',
} as const

// Build an absolute URL from a path.
export function absoluteUrl(path = ''): string {
  if (!path) return SITE_URL
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
