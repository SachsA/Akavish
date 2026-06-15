import type { Metadata } from 'next'
import { ContentPage } from '@/components/ContentPage'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The rules for using Akavish.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <ContentPage title="Terms of Service" subtitle="Last updated: June 2026">
      <p className="text-sm text-zinc-500 border border-zinc-800 rounded-md p-3">
        ⚠️ This is a starting template, not legal advice. Have it reviewed by a
        qualified professional before launch.
      </p>

      <h2>Acceptance</h2>
      <p>
        By accessing Akavish you agree to these terms. If you do not agree,
        please don&apos;t use the site.
      </p>

      <h2>Use of the site</h2>
      <p>
        You agree to use Akavish lawfully and not to disrupt, scrape abusively,
        or attempt to compromise the service or other users.
      </p>

      <h2>Accounts</h2>
      <p>
        You are responsible for activity under your account and for keeping your
        credentials secure. We may suspend accounts that violate these terms.
      </p>

      <h2>Content &amp; intellectual property</h2>
      <p>
        Articles, branding and original media on Akavish are our property or used
        under license. Game names, images and trademarks belong to their
        respective owners.
      </p>

      <h2>Disclaimer</h2>
      <p>
        The site is provided &quot;as is&quot;, without warranties. We are not
        liable for damages arising from your use of the site to the extent
        permitted by law.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email{' '}
        <a href="mailto:hello@akavish.gg">hello@akavish.gg</a>.
      </p>
    </ContentPage>
  )
}
