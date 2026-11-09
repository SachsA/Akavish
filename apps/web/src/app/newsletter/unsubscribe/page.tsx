import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ContentPage } from '@/components/ContentPage'
import { unsubscribeFromNewsletter } from '@/lib/newsletter'

// Unsubscribe link target: /newsletter/unsubscribe?token=…  (the links go in
// the newsletter issues). Asks for a click rather than acting on load, because
// mail scanners open links on their own and unsubscribing deletes the
// subscriber for good. The result page carries no token.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
}

async function unsubscribeAction(formData: FormData) {
  'use server'
  const token = String(formData.get('token') ?? '')
  const result = token ? await unsubscribeFromNewsletter(token) : 'invalid'
  redirect(`/newsletter/unsubscribe?result=${result}`)
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; result?: string | string[] }>
}) {
  const { token, result } = await searchParams

  if (result === 'unsubscribed') {
    return (
      <ContentPage title="You’re unsubscribed">
        <p>
          Your address has been deleted from the newsletter list. You won’t get any more issues.
        </p>
        <p>
          <Link href="/">Back to Akavish</Link>
        </p>
      </ContentPage>
    )
  }

  if (result === 'invalid') {
    return (
      <ContentPage title="Already unsubscribed">
        <p>This link doesn’t match any subscription: you’re not on the list.</p>
      </ContentPage>
    )
  }

  if (result === 'error') {
    return (
      <ContentPage title="Something went wrong">
        <p>
          We couldn’t unsubscribe you right now. Open the link from the email again in a few
          minutes, or write to us and we’ll do it by hand.
        </p>
      </ContentPage>
    )
  }

  if (typeof token !== 'string' || !token) {
    return (
      <ContentPage title="Unsubscribe">
        <p>Use the unsubscribe link at the bottom of any newsletter email.</p>
      </ContentPage>
    )
  }

  return (
    <ContentPage title="Unsubscribe from the newsletter?">
      <p>You’ll stop receiving the Akavish newsletter and your address will be deleted.</p>
      <form action={unsubscribeAction}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="mt-2 px-4 py-2 rounded-md bg-emerald-700 text-on-accent text-sm font-semibold hover:bg-emerald-600 transition-colors"
        >
          Unsubscribe
        </button>
      </form>
    </ContentPage>
  )
}
