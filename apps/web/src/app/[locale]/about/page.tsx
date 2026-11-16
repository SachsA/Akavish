import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import { ContentPage } from '@/components/ContentPage'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = setRequestLocale((await params).locale)
  const t = getMessages()
  return { title: t.about.metaTitle, description: t.about.description, alternates: alternates(locale, '/about') }
}

export default async function AboutPage({ params }: Params) {
  const locale = setRequestLocale((await params).locale)
  if (locale === 'fr') {
    return (
      <ContentPage title="À propos d'Akavish" subtitle="Rapide. Sérieux. Sans blabla.">
        <p>
          Akavish est un média jeu vidéo indépendant : l&apos;actu à chaud, des leaks exclusifs,
          des tests complets et les récaps des conférences, de CS2 et GTA à Baldur&apos;s Gate en
          passant par toute la scène esport.
        </p>
        <p>
          On va vite, mais on tient à avoir juste. Pas de putaclic, pas de remplissage : seulement
          les infos qui comptent pour ceux qui jouent vraiment.
        </p>

        <h2>Ce que nous couvrons</h2>
        <p>
          Actus, leaks, tests, aperçus, conférences et esport. Parcourez les{' '}
          <Link href="/news">Actus</Link>, les <Link href="/leaks">Leaks</Link>, les{' '}
          <Link href="/reviews">Tests</Link> ou l&apos;<Link href="/esport">Esport</Link>.
        </p>

        <h2>Nous contacter</h2>
        <p>
          Une info ou envie de travailler avec nous ? Passez par notre{' '}
          <Link href="/contact">page contact</Link>.
        </p>
      </ContentPage>
    )
  }
  return (
    <ContentPage title="About Akavish" subtitle="Fast. Serious. No fluff.">
      <p>
        Akavish is an independent gaming publication covering breaking news,
        exclusive leaks, in-depth reviews and conference recaps — from CS2 and
        GTA to Baldur&apos;s Gate and the wider esport scene.
      </p>
      <p>
        We move fast but care about getting it right. No clickbait, no filler —
        just the stories that matter to people who actually play.
      </p>

      <h2>What we cover</h2>
      <p>
        News, leaks, reviews, previews, conference coverage and esport. Browse by{' '}
        <Link href="/news">News</Link>, <Link href="/leaks">Leaks</Link>,{' '}
        <Link href="/reviews">Reviews</Link> or <Link href="/esport">Esport</Link>.
      </p>

      <h2>Get in touch</h2>
      <p>
        Got a tip or want to work with us? Head to our{' '}
        <Link href="/contact">contact page</Link>.
      </p>
    </ContentPage>
  )
}
