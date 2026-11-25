'use client'

// "From 24 Nov to 27 Nov" in the reader's language and date style.
import { formatDate } from '@/lib/i18n/dates'
import { useI18n, useRegion } from '../I18nProvider'

export function DateRange({ start, end }: { start: string | null; end: string | null }) {
  const { t, locale } = useI18n()
  const region = useRegion()
  if (!start) return null
  const f = (iso: string) => formatDate(iso, { locale, region, style: 'short' })
  return <span suppressHydrationWarning>{t.esport.from(f(start), end ? f(end) : null)}</span>
}
