import type { Metadata } from 'next'
import Link from 'next/link'
import { ContentPage } from '@/components/ContentPage'
import { LegalLanguageSwitch, legalAlternates } from '@/components/LegalLanguageSwitch'
import { LEGAL_LAST_UPDATED, PUBLISHER } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'The rules for using Akavish.',
  alternates: legalAlternates('terms', 'en'),
}

export default function TermsPage() {
  return (
    <ContentPage title="Terms of Use" subtitle={`Last updated: ${LEGAL_LAST_UPDATED.en}`}>
      <LegalLanguageSwitch page="terms" current="en" />

      <h2>Agreement</h2>
      <p>
        These terms govern your use of akavish.gg. By browsing the site you accept
        them. If you do not, please stop reading here. Akavish is published by{' '}
        {PUBLISHER.name} — see the <Link href="/legal">legal notice</Link>.
      </p>

      <h2>Using the site</h2>
      <p>
        Read, share and quote us freely. Do not attempt to break, overload or gain
        unauthorised access to the service, scrape it in a way that degrades it
        for others, or use it to publish anything unlawful.
      </p>

      <h2>Accounts</h2>
      <p>
        You are responsible for what happens under your account and for keeping
        your credentials to yourself. Accounts used to abuse the site may be
        suspended without notice.
      </p>

      <h2>Editorial standards, leaks and rumours</h2>
      <p>
        Akavish covers leaks, rumours and unconfirmed reports, and labels them as
        such. Anything in the <em>Leaks</em> category is by definition
        unconfirmed: it reflects what sources claimed at the time of writing, not
        established fact. Release dates change, projects get cancelled, sources
        turn out to be wrong. Do not make purchases or decisions on that basis.
      </p>
      <p>
        We correct mistakes rather than quietly deleting them. Spotted an error?{' '}
        <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a>.
      </p>

      <h2>Our content, and other people’s</h2>
      <p>
        Articles, the Akavish name and our original artwork belong to the
        publisher. You may quote short extracts with a visible credit and a link;
        please do not republish whole articles.
      </p>
      <p>
        Game titles, logos, screenshots and trailers belong to their respective
        publishers and developers. They appear here for news reporting, review and
        commentary. If you hold rights to material used on the site and want it
        removed, write to{' '}
        <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a>{' '}
        and we will act promptly.
      </p>

      <h2>Money, and how we disclose it</h2>
      <p>
        Akavish is independent. Should we ever run advertising, affiliate links,
        sponsored articles or accept review copies and press codes, we commit to
        the following, in line with French consumer law on{' '}
        <em>publicité déguisée</em>:
      </p>
      <ul className="list-disc ml-6 space-y-1">
        <li>Sponsored or paid content is labelled as such, at the top of the article.</li>
        <li>Affiliate links are disclosed on the page that contains them.</li>
        <li>Games received free of charge are disclosed in the review.</li>
        <li>No advertiser gets to review or approve editorial coverage before it is published.</li>
      </ul>
      <p>
        At the time of writing, none of the above is in place — the site carries no
        advertising and no affiliate links.
      </p>

      <h2>Links to other sites</h2>
      <p>
        We link to sources, stores and social platforms. What happens on those
        sites is governed by their terms and their privacy policies, not ours.
      </p>

      <h2>Availability and liability</h2>
      <p>
        The site is provided as is. We do not promise it will be available without
        interruption or free of errors, and we may change or withdraw any part of
        it. To the extent permitted by law, we are not liable for indirect loss
        arising from your use of the site.
      </p>
      <p>
        Nothing here removes the rights French and European consumer law gives
        you, which apply regardless of what this page says.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by French law. If a dispute cannot be settled
        amicably, it will be brought before the competent French courts — without
        prejudice to your right, as a consumer, to bring proceedings where you
        live.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms; the date above tracks the current version.
        Questions:{' '}
        <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a>.
      </p>
    </ContentPage>
  )
}
