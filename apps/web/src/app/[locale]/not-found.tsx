'use client'

// Client component: Next renders not-found without the page's params, so the
// language comes from the layout's I18nProvider.

import Link from '@/components/LocaleLink'
import { useI18n } from '@/components/I18nProvider'

export default function NotFound() {
  const { t } = useI18n()
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-6">
      <p aria-hidden="true" className="text-7xl font-black tracking-tight text-zinc-800">
        404
      </p>
      <h1 className="text-2xl font-bold text-white">{t.notFoundPage.title}</h1>
      <p className="text-zinc-400">{t.notFoundPage.body}</p>
      <div className="flex justify-center gap-3 pt-2">
        <Link
          href="/"
          className="px-4 py-2 rounded-md bg-emerald-700 text-on-accent text-sm font-semibold hover:bg-emerald-600 transition-colors"
        >
          {t.notFoundPage.home}
        </Link>
        <Link
          href="/news"
          className="px-4 py-2 rounded-md border border-zinc-800 text-zinc-300 text-sm font-semibold hover:border-zinc-700 transition-colors"
        >
          {t.notFoundPage.latest}
        </Link>
      </div>
    </div>
  )
}
