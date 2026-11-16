import type { Metadata } from 'next'
import { ContentPage } from '@/components/ContentPage'
import { SITE_SOCIALS } from '@/lib/site'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = setRequestLocale((await params).locale)
  const t = getMessages()
  return { title: t.contact.metaTitle, description: t.contact.description, alternates: alternates(locale, '/contact') }
}

function Socials({ and }: { and: string }) {
  return (
    <>
      <a href={SITE_SOCIALS.x} target="_blank" rel="noopener noreferrer">
        X
      </a>
      ,{' '}
      <a href={SITE_SOCIALS.discord} target="_blank" rel="noopener noreferrer">
        Discord
      </a>{' '}
      {and}{' '}
      <a href={SITE_SOCIALS.youtube} target="_blank" rel="noopener noreferrer">
        YouTube
      </a>
    </>
  )
}

export default async function ContactPage({ params }: Params) {
  const locale = setRequestLocale((await params).locale)
  if (locale === 'fr') {
    return (
      <ContentPage title="Contact" subtitle="Infos, presse, partenariats : écrivez-nous.">
        <h2>Rédaction et infos</h2>
        <p>
          Un scoop ou une correction ? Écrivez à{' '}
          <a href="mailto:tips@akavish.gg">tips@akavish.gg</a>. Anonymat respecté.
        </p>

        <h2>Presse et partenariats</h2>
        <p>
          Pour la presse, les codes de test ou les partenariats, écrivez à{' '}
          <a href="mailto:hello@akavish.gg">hello@akavish.gg</a>.
        </p>

        <h2>Réseaux</h2>
        <p>
          Retrouvez-nous sur <Socials and="et" />.
        </p>
      </ContentPage>
    )
  }
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
        Find us on <Socials and="and" />.
      </p>
    </ContentPage>
  )
}
