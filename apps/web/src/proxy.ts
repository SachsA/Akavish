import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { CATEGORIES } from '@/lib/categories'
import {
  COOKIE_MAX_AGE,
  DEFAULT_LOCALE,
  LOCALES,
  fromAcceptLanguage,
  isLocale,
  isRegion,
  isSharedPath,
  LOCALE_COOKIE,
  localeOfPath,
  REGION_COOKIE,
} from '@/lib/i18n/config'

// Next 16 calls this file `proxy.ts` (it was `middleware.ts`); Clerk's
// `clerkMiddleware()` is unchanged.

// Routes that require a signed-in reader. The site is public by default
// (news, articles, sign-in/up); only the personal account area is protected.
const isProtectedRoute = createRouteMatcher(['/account(.*)', '/fr/account(.*)'])

/**
 * Languages (lib/i18n/config.ts). Pages live under app/[locale]: English at
 * the bare path, rewritten here to /en/…; French under /fr/…, served as is.
 *
 * - First visit, no choice yet: the browser's language decides. A French
 *   browser opening /news goes to /fr/news; crawlers send no language and
 *   stay on English.
 * - Once the reader picked a language in the menu (cookie), it wins: someone
 *   who chose English is never sent to /fr again. A /fr link always opens in
 *   French, whatever the cookie.
 * - /en/… isn't a public URL: it redirects to the bare path (one URL per page).
 *   The share images Next generates under /en are the exception.
 * - The English date style (🇬🇧 / 🇺🇸) is guessed once from the same header.
 */
const LIST_PATH = new RegExp(
  `^(?:/(?:${LOCALES.join('|')}))?/(?:${CATEGORIES.map((c) => c.slug).join('|')}|(?:tag|author|game)/[^/]+)$`,
)

/**
 * List pages keep `?page=N` as their public URL, but read the page from the
 * path (`/news/page/2`) so they can be cached: a page that reads
 * searchParams is rendered on every request. Any `page` value goes through
 * (the page 404s on junk, as before); several `page` params count as junk.
 */
function pageAsPath(req: NextRequest): URL | null {
  const values = req.nextUrl.searchParams.getAll('page')
  if (values.length === 0 || !LIST_PATH.test(req.nextUrl.pathname)) return null
  const url = req.nextUrl.clone()
  url.searchParams.delete('page')
  url.pathname = `${url.pathname}/page/${encodeURIComponent(values.length === 1 ? values[0] : 'x')}`
  return url
}

function localeRouting(req: NextRequest): NextResponse | null {
  const paged = pageAsPath(req)
  const pathname = paged?.pathname ?? req.nextUrl.pathname
  const search = paged?.search ?? req.nextUrl.search
  if (isSharedPath(pathname)) return null

  const asked = req.nextUrl.pathname
  if (asked === '/en' || asked.startsWith('/en/')) {
    if (asked.includes('opengraph-image')) return null
    const url = req.nextUrl.clone()
    url.pathname = asked.slice(3) || '/'
    return NextResponse.redirect(url, 308)
  }

  const fromHeader = fromAcceptLanguage(req.headers.get('accept-language'))
  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value
  const remember = (res: NextResponse) => {
    if (!isRegion(req.cookies.get(REGION_COOKIE)?.value) && fromHeader) {
      res.cookies.set(REGION_COOKIE, fromHeader.region, { path: '/', maxAge: COOKIE_MAX_AGE, sameSite: 'lax' })
    }
    return res
  }

  if (localeOfPath(pathname) !== DEFAULT_LOCALE) {
    return remember(paged ? NextResponse.rewrite(paged) : NextResponse.next())
  }

  const wanted = isLocale(cookieLocale) ? cookieLocale : fromHeader?.locale
  const isPage = req.method === 'GET' && (req.headers.get('accept') ?? '').includes('text/html')
  if (wanted && wanted !== DEFAULT_LOCALE && isPage) {
    const url = req.nextUrl.clone()
    // The public URL (with ?page=), not the internal /page/N.
    url.pathname = `/${wanted}${req.nextUrl.pathname === '/' ? '' : req.nextUrl.pathname}`
    return remember(NextResponse.redirect(url, 307))
  }

  const url = req.nextUrl.clone()
  url.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`
  url.search = search
  return remember(NextResponse.rewrite(url))
}

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
  return localeRouting(req) ?? undefined
})

export const config = {
  matcher: [
    // Run on everything except framework internals and telemetry:
    //   - `_next`    — build output and image optimiser
    //   - `_vercel`  — Web Analytics beacons (`/_vercel/insights/*`)
    //   - `monitoring` — Sentry's tunnel route (see next.config.ts). Putting an
    //     auth layer in front of error reporting is both pointless and a good
    //     way to lose the errors we most need to see.
    //
    // NOTE: Clerk's boilerplate matcher also skips anything ending in a static
    // file extension (.ico, .png, .css…). That exclusion is a **trap here** and
    // was removed deliberately.
    //
    // This app has no `public/` directory, so no such path is ever a real file.
    // Any request for one instead falls through to the top-level `[category]`
    // dynamic route, whose layout calls Clerk's `auth()` — which throws when the
    // middleware was skipped. The result was a 500 on every browser's automatic
    // `/favicon.ico` hit, one Sentry event per visitor, straight into the quota.
    //
    // Letting the middleware run on those paths costs almost nothing (there are
    // no static assets to slow down) and turns those 500s into clean 404s.
    '/((?!_next|_vercel|monitoring).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
  ],
}
