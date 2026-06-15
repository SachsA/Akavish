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
export const SITE_TWITTER = '@akavish'

// Build an absolute URL from a path.
export function absoluteUrl(path = ''): string {
  if (!path) return SITE_URL
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
