import type { Metadata } from 'next'
import { ContentPage } from '@/components/ContentPage'
import { SITE_SOCIALS } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to reach the Akavish team.',
  alternates: { canonical: '/contact' },
}

export default function ContactPage() {
  return (
    <ContentPage title="Contact" subtitle="Tips, press, partnerships — reach out.">
      <h2>Editorial &amp; tips</h2>
      <p>
        Got a scoop or a correction? Email{' '}
        <a href="mailto:tips@akavish.gg">tips@akavish.gg</a>. Anonymity respected.
      </p>

      <h2>Press &amp; partnerships</h2>
      <p>
        For press inquiries, review codes or partnerships, email{' '}
        <a href="mailto:hello@akavish.gg">hello@akavish.gg</a>.
      </p>

      <h2>Social</h2>
      <p>
        Find us on{' '}
        <a href={SITE_SOCIALS.x} target="_blank" rel="noopener noreferrer">
          X
        </a>
        ,{' '}
        <a href={SITE_SOCIALS.discord} target="_blank" rel="noopener noreferrer">
          Discord
        </a>{' '}
        and{' '}
        <a href={SITE_SOCIALS.youtube} target="_blank" rel="noopener noreferrer">
          YouTube
        </a>
        .
      </p>
    </ContentPage>
  )
}
