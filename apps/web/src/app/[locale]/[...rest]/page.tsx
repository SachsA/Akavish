import { notFound } from 'next/navigation'

// Any path under a language that matches no page: the localized 404
// (not-found.tsx next door, inside the site's layout) instead of Next's bare one.
export default function CatchAll() {
  notFound()
}
