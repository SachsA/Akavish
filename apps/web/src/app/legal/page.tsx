import type { Metadata } from 'next'
import { ContentPage } from '@/components/ContentPage'
import { LegalLanguageSwitch, legalAlternates } from '@/components/LegalLanguageSwitch'
import { LEGAL_LAST_UPDATED, PUBLISHER } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Legal Notice',
  description: 'Publisher and hosting information for Akavish.',
  alternates: legalAlternates('legal', 'en'),
}

export default function LegalNoticePage() {
  return (
    <ContentPage title="Legal Notice" subtitle={`Last updated: ${LEGAL_LAST_UPDATED.en}`}>
      <LegalLanguageSwitch page="legal" current="en" />

      <p>
        Akavish is published from France. French law (LCEN, art. 6) requires the
        following information to be available to readers.
      </p>

      <h2>Publisher</h2>
      <p>
        <strong>{PUBLISHER.name}</strong>, publishing director.
        <br />
        Contact: <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a>
      </p>
      <p>
        Akavish is a personal, non-commercial publication. As a non-professional
        publisher, the postal address is not published here; it is held by the
        host named below and available to judicial authorities on request, as the
        law provides.
      </p>

      <h2>Hosting</h2>
      <p>
        <strong>Website</strong> — {PUBLISHER.host.name},{' '}
        {PUBLISHER.host.address} —{' '}
        <a href={PUBLISHER.host.url} target="_blank" rel="noopener noreferrer">
          {PUBLISHER.host.url}
        </a>
      </p>
      <p>
        <strong>Editorial back-office</strong> — {PUBLISHER.cmsHost.name} —{' '}
        <a href={PUBLISHER.cmsHost.url} target="_blank" rel="noopener noreferrer">
          {PUBLISHER.cmsHost.url}
        </a>
      </p>

      <h2>Intellectual property</h2>
      <p>
        Articles and original media are the property of the publisher. Game
        titles, logos and promotional material belong to their respective owners
        and are used for news reporting and commentary. Takedown requests:{' '}
        <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a>.
      </p>

      <h2>Personal data</h2>
      <p>
        How we handle data, and how to exercise your rights, is set out in the{' '}
        <a href="/privacy">privacy policy</a>. Data requests:{' '}
        <a href={`mailto:${PUBLISHER.privacyEmail}`}>{PUBLISHER.privacyEmail}</a>.
      </p>

      <h2>Reporting illegal content</h2>
      <p>
        If you believe content on this site is unlawful, write to{' '}
        <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a>{' '}
        describing the content, its location and the reason. We review such
        reports promptly.
      </p>
    </ContentPage>
  )
}
