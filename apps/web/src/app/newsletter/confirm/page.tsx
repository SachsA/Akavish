import type { Metadata } from 'next'
import Link from 'next/link'
import { ContentPage } from '@/components/ContentPage'
import { confirmSubscription } from '@/lib/newsletter'

// Landing page of the link in the confirmation email. Confirms on load: the
// reader asked for this by signing up, so a mail scanner opening the link
// first does no harm (it can only confirm what the reader requested).
// Unsubscribing, which can't be undone, asks for a click instead.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Newsletter subscription',
  robots: { index: false, follow: false },
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>
}) {
  const { token } = await searchParams
  const outcome =
    typeof token === 'string' && token
      ? await confirmSubscription(token)
      : ({ result: 'invalid' } as const)

  if (outcome.result === 'confirmed') {
    return (
      <ContentPage title="You’re subscribed">
        <p>
          Thanks for confirming. The Akavish newsletter will land in your inbox; every issue has a
          one-click unsubscribe link.
        </p>
        <p>
          <Link href="/">Back to the latest news</Link>
        </p>
        {outcome.unsubscribeToken && (
          <p className="text-sm text-zinc-400">
            Changed your mind?{' '}
            <Link
              href={`/newsletter/unsubscribe?token=${encodeURIComponent(outcome.unsubscribeToken)}`}
            >
              Unsubscribe
            </Link>
            .
          </p>
        )}
      </ContentPage>
    )
  }

  if (outcome.result === 'error') {
    return (
      <ContentPage title="Something went wrong">
        <p>
          We couldn’t confirm your subscription right now. Open the link from the email again in a
          few minutes.
        </p>
      </ContentPage>
    )
  }

  return (
    <ContentPage title="This link no longer works">
      <p>
        It may have expired (unconfirmed sign-ups are deleted after 30 days) or been replaced by a
        newer one. Sign up again from the form at the bottom of any page and use the latest email.
      </p>
      <p>
        <Link href="/">Back to the latest news</Link>
      </p>
    </ContentPage>
  )
}
