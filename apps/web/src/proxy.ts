import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import {
  COOKIE_MAX_AGE,
  DEFAULT_LOCALE,
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
function localeRouting(req: NextRequest): NextResponse | null {
  const { pathname, search } = req.nextUrl
  if (isSharedPath(pathname)) return null

  if (pathname === '/en' || pathname.startsWith('/en/')) {
    if (pathname.includes('opengraph-image')) return null
    const url = req.nextUrl.clone()
    url.pathname = pathname.slice(3) || '/'
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

  if (localeOfPath(pathname) !== DEFAULT_LOCALE) return remember(NextResponse.next())

  const wanted = isLocale(cookieLocale) ? cookieLocale : fromHeader?.locale
  const isPage = req.method === 'GET' && (req.headers.get('accept') ?? '').includes('text/html')
  if (wanted && wanted !== DEFAULT_LOCALE && isPage) {
    const url = req.nextUrl.clone()
    url.pathname = `/${wanted}${pathname === '/' ? '' : pathname}`
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
