import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { ContentPage } from '@/components/ContentPage'
import { confirmSubscription } from '@/lib/newsletter'

// Landing page of the link in the confirmation email. Confirms on load: the
// reader asked for this by signing up, so a mail scanner opening the link
// first does no harm (it can only confirm what the reader requested).
// Unsubscribing, which can't be undone, asks for a click instead.

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  setRequestLocale((await params).locale)
  return { title: getMessages().newsletter.confirm.metaTitle, robots: { index: false, follow: false } }
}

export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ token?: string | string[] }>
}) {
  setRequestLocale((await params).locale)
  const t = getMessages().newsletter.confirm
  const { token } = await searchParams
  const outcome =
    typeof token === 'string' && token
      ? await confirmSubscription(token)
      : ({ result: 'invalid' } as const)

  if (outcome.result === 'confirmed') {
    return (
      <ContentPage title={t.subscribed}>
        <p>{t.thanks}</p>
        <p>
          <Link href="/">{t.backToNews}</Link>
        </p>
        {outcome.unsubscribeToken && (
          <p className="text-sm text-zinc-400">
            {t.changedMind}{' '}
            <Link
              href={`/newsletter/unsubscribe?token=${encodeURIComponent(outcome.unsubscribeToken)}`}
            >
              {t.unsubscribe}
            </Link>
            .
          </p>
        )}
      </ContentPage>
    )
  }

  if (outcome.result === 'error') {
    return (
      <ContentPage title={t.errorTitle}>
        <p>{t.errorBody}</p>
      </ContentPage>
    )
  }

  return (
    <ContentPage title={t.invalidTitle}>
      <p>{t.invalidBody}</p>
      <p>
        <Link href="/">{t.backToNews}</Link>
      </p>
    </ContentPage>
  )
}
