import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Routes that require a signed-in reader. The site is public by default
// (news, articles, sign-in/up); only the personal account area is protected.
const isProtectedRoute = createRouteMatcher(['/account(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
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
