'use client'

import Link from '@/components/LocaleLink'
import { useI18n } from '@/components/I18nProvider'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-6">
      <p className="text-7xl font-black tracking-tight text-zinc-800">{t.errorPage.oops}</p>
      <h1 className="text-2xl font-bold text-white">{t.errorPage.title}</h1>
      <p className="text-zinc-400">{t.errorPage.body}</p>
      <div className="flex justify-center gap-3 pt-2">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-md bg-emerald-700 text-on-accent text-sm font-semibold hover:bg-emerald-600 transition-colors"
        >
          {t.errorPage.retry}
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-md border border-zinc-800 text-zinc-300 text-sm font-semibold hover:border-zinc-700 transition-colors"
        >
          {t.errorPage.home}
        </Link>
      </div>
    </div>
  )
}
