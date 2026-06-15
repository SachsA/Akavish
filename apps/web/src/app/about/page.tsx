import type { Metadata } from 'next'
import { ContentPage } from '@/components/ContentPage'

export const metadata: Metadata = {
  title: 'About',
  description: 'What Akavish is and what we cover.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
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
        <a href="/news">News</a>, <a href="/leaks">Leaks</a>,{' '}
        <a href="/reviews">Reviews</a> or <a href="/esport">Esport</a>.
      </p>

      <h2>Get in touch</h2>
      <p>
        Got a tip or want to work with us? Head to our{' '}
        <a href="/contact">contact page</a>.
      </p>
    </ContentPage>
  )
}
