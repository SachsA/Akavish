'use client'

// next/link that stays in the page's language: `href="/news"` becomes
// `/fr/news` on a French page. Every internal link on the site goes through
// it (`import Link from '@/components/LocaleLink'`), so no page has to think
// about `/fr`. Absolute URLs, anchors and object hrefs pass through untouched.

import NextLink from 'next/link'
import type { ComponentProps } from 'react'
import { useI18n } from './I18nProvider'

export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const { href: localize } = useI18n()
  return <NextLink href={typeof href === 'string' ? localize(href) : href} {...props} />
}
