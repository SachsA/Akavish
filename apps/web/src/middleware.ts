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
    // Skip Next.js internals and static files, unless found in search params.
    //
    // Two telemetry paths are excluded too:
    //   - `monitoring` — Sentry's tunnel route (see next.config.ts). Putting an
    //     auth layer in front of error reporting is both pointless and a good
    //     way to lose the errors we most need to see.
    //   - `_vercel` — Vercel Web Analytics beacons (`/_vercel/insights/*`),
    //     created once Analytics is enabled in the dashboard.
    '/((?!_next|_vercel|monitoring|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
  ],
}
