'use client'

// A date in the reader's language and, for English, their date style
// (🇬🇧 16 Nov 2026 / 🇺🇸 Nov 16, 2026). See lib/i18n/dates.ts for the formats.

import { formatDate, type DateStyle } from '@/lib/i18n/dates'
import { useI18n, useRegion } from './I18nProvider'

export function DateText({
  iso,
  style = 'short',
  now,
}: {
  iso: string | undefined | null
  style?: DateStyle
  /** The page's "now" for Today / Yesterday, so server and browser agree. */
  now?: string
}) {
  const { locale } = useI18n()
  const region = useRegion()
  if (!iso) return null
  const text = formatDate(iso, { locale, region, style, now: now ? new Date(now) : undefined })
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  )
}
