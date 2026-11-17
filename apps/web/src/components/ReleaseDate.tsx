'use client'

// A release date as precise as it is known: "Nov 19, 2026" (in the reader's
// English date style), "November 2026", "Q4 2026" / "T4 2026", "2026", "TBA".

import { formatRelease, type Release } from '@/lib/game-library'
import { useI18n, useRegion } from './I18nProvider'

export function ReleaseDate({ release }: { release: Release }) {
  const { locale } = useI18n()
  const region = useRegion()
  const text = formatRelease(release, locale, region)
  if (!release.date) return <span>{text}</span>
  return (
    <time dateTime={release.precision === 'day' ? release.date : release.date.slice(0, release.precision === 'year' ? 4 : 7)} suppressHydrationWarning>
      {text}
    </time>
  )
}
