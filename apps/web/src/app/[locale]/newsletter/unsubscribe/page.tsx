import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import { getLocale, getMessages, setRequestLocale } from '@/lib/i18n/server'
import { localizePath } from '@/lib/i18n/config'
import { redirect } from 'next/navigation'
import { ContentPage } from '@/components/ContentPage'
import { unsubscribeFromNewsletter } from '@/lib/newsletter'

// Unsubscribe link target: /newsletter/unsubscribe?token=…  (the links go in
// the newsletter issues). Asks for a click rather than acting on load, because
// mail scanners open links on their own and unsubscribing deletes the
// subscriber for good. The result page carries no token.

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  setRequestLocale((await params).locale)
  return { title: getMessages().newsletter.unsubscribe.metaTitle, robots: { index: false, follow: false } }
}

async function unsubscribeAction(formData: FormData) {
  'use server'
  const token = String(formData.get('token') ?? '')
  const locale = formData.get('locale') === 'fr' ? 'fr' : 'en'
  const result = token ? await unsubscribeFromNewsletter(token) : 'invalid'
  redirect(`${localizePath(locale, '/newsletter/unsubscribe')}?result=${result}`)
}

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ token?: string | string[]; result?: string | string[] }>
}) {
  setRequestLocale((await params).locale)
  const t = getMessages().newsletter.unsubscribe
  const { token, result } = await searchParams

  if (result === 'unsubscribed') {
    return (
      <ContentPage title={t.doneTitle}>
        <p>{t.doneBody}</p>
        <p>
          <Link href="/">{t.back}</Link>
        </p>
      </ContentPage>
    )
  }

  if (result === 'invalid') {
    return (
      <ContentPage title={t.invalidTitle}>
        <p>{t.invalidBody}</p>
      </ContentPage>
    )
  }

  if (result === 'error') {
    return (
      <ContentPage title={t.errorTitle}>
        <p>{t.errorBody}</p>
      </ContentPage>
    )
  }

  if (typeof token !== 'string' || !token) {
    return (
      <ContentPage title={t.noTokenTitle}>
        <p>{t.noTokenBody}</p>
      </ContentPage>
    )
  }

  return (
    <ContentPage title={t.askTitle}>
      <p>{t.askBody}</p>
      <form action={unsubscribeAction}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="locale" value={getLocale()} />
        <button
          type="submit"
          className="mt-2 px-4 py-2 rounded-md bg-emerald-700 text-on-accent text-sm font-semibold hover:bg-emerald-600 transition-colors"
        >
          {t.button}
        </button>
      </form>
    </ContentPage>
  )
}
