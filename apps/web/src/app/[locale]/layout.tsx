import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { ClerkProvider } from '@clerk/nextjs'
import { frFR } from '@clerk/localizations'
import Link from '@/components/LocaleLink'
import { SITE_URL, SITE_NAME, SITE_TWITTER, SITE_SOCIALS } from '@/lib/site'
import { DeferredAnalytics } from '@/components/DeferredAnalytics'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { Wordmark } from '@/components/Wordmark'
import { SearchBar } from '@/components/SearchBar'
import { HeaderAuth } from '@/components/HeaderAuth'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageMenu } from '@/components/LanguageMenu'
import { I18nProvider } from '@/components/I18nProvider'
import { CATEGORIES } from '@/lib/categories'
import { LOCALES, ogLocale } from '@/lib/i18n/config'
import { alternates } from '@/lib/i18n/metadata'
import { getLocale, getMessages, setRequestLocale } from '@/lib/i18n/server'
import { feedPath } from '@/lib/feed'
import '../globals.css'

type Params = { params: Promise<{ locale: string }> }

// Both languages are built ahead. No `dynamicParams = false`: it would also
// apply to the article and list pages below, whose slugs aren't all built
// ahead. Other values never get here (the proxy only lets /fr through).
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = setRequestLocale((await params).locale)
  const t = getMessages()
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t.meta.siteTitle,
      template: '%s | Akavish',
    },
    description: t.meta.siteDescription,
    keywords: [...t.meta.keywords],
    alternates: { ...alternates(locale, '/'), types: { 'application/rss+xml': feedPath(locale) } },
    openGraph: {
      title: t.meta.siteTitle,
      description: t.meta.ogDescription,
      url: SITE_URL,
      siteName: SITE_NAME,
      locale: ogLocale(locale),
      type: 'website',
    },
    twitter: { card: 'summary_large_image', site: SITE_TWITTER },
    robots: { index: true, follow: true },
  }
}

// Browser UI colour (mobile address bar) matching each theme's background.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
}

// Runs before first paint: re-applies a theme the visitor picked earlier, so the
// page never flashes the OS theme first. Mirrors ThemeToggle's localStorage key.
const RESTORE_THEME = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const locale = setRequestLocale((await params).locale)
  const t = getMessages()
  return (
    <ClerkProvider localization={locale === 'fr' ? frFR : undefined}>
      <html lang={locale} suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: RESTORE_THEME }} />
        </head>
        <body>
          <I18nProvider locale={locale}>
          {/* Skip link: first thing a keyboard user reaches, invisible until
              focused. Saves tabbing through the whole header on every page. */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-md focus:bg-white focus:text-zinc-950 focus:font-semibold"
          >
            {t.header.skip}
          </a>
          <div className="min-h-screen flex flex-col">
            <Header />
            {/* tabIndex -1 so the skip link actually moves focus here (Safari). */}
            <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
              {children}
            </main>
            <Footer />
          </div>
          {/* Vercel Web Analytics — cookieless and no personal data, so it
              needs no consent banner. Only actually collects when deployed on
              Vercel; a no-op locally. 50k events/month on the Hobby plan. */}
          <DeferredAnalytics />
          </I18nProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}

function Header() {
  const t = getMessages()
  const label = (slug: string) => {
    const c = CATEGORIES.find((x) => x.slug === slug)
    return c ? t.categories[c.value].label : slug
  }
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label={t.header.home}>
          <Wordmark className="text-xl" />
        </Link>
        <nav aria-label={t.header.mainNav} className="flex items-center gap-1 sm:gap-6 text-sm text-zinc-400">
          <Link href="/news" className="hidden lg:inline py-1 hover:text-white transition-colors">{label('news')}</Link>
          <Link href="/leaks" className="hidden lg:inline py-1 hover:text-white transition-colors">{label('leaks')}</Link>
          <Link href="/reviews" className="hidden lg:inline py-1 hover:text-white transition-colors">{label('reviews')}</Link>
          <Link href="/esport" className="hidden lg:inline py-1 hover:text-white transition-colors">{label('esport')}</Link>
          <Link href="/conferences" className="hidden lg:inline py-1 hover:text-white transition-colors">{label('conferences')}</Link>
          <Suspense fallback={null}>
            <SearchBar />
          </Suspense>
          <ThemeToggle />
          <LanguageMenu />
          <div className="flex items-center gap-2 sm:gap-3 pl-1.5 sm:pl-3 border-l border-zinc-800">
            <HeaderAuth />
          </div>
        </nav>
      </div>
      {/* Phones and tablets: the section links above only fit from lg (1024 px),
          so below that every section gets a swipeable strip instead. Without
          it the only way to another section from an article was the footer. */}
      <nav aria-label={t.header.allSections} className="lg:hidden border-t border-zinc-900">
        <ul className="flex gap-1 overflow-x-auto px-2 py-1.5 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((c) => (
            <li key={c.slug} className="shrink-0">
              <Link
                href={`/${c.slug}`}
                className="block px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                {t.categories[c.value].label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}

function Footer() {
  const t = getMessages()
  const sections = [
    {
      title: t.footer.sections,
      links: ['news', 'leaks', 'reviews', 'esport', 'conferences'].map((slug) => {
        const c = CATEGORIES.find((x) => x.slug === slug)!
        return { label: t.categories[c.value].label, href: `/${slug}` }
      }),
    },
    {
      title: 'Akavish',
      links: [
        { label: t.footer.about, href: '/about' },
        { label: t.footer.contact, href: '/contact' },
        { label: t.footer.rss, href: feedPath(getLocale()) },
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { label: t.footer.privacy, href: '/privacy' },
        { label: t.footer.terms, href: '/terms' },
        // Required in France (LCEN) — identifies the publisher and the host.
        { label: t.footer.legalNotice, href: '/legal' },
      ],
    },
  ]

  const socials = [
    { label: 'X', href: SITE_SOCIALS.x },
    { label: 'Discord', href: SITE_SOCIALS.discord },
    { label: 'YouTube', href: SITE_SOCIALS.youtube },
  ]

  return (
    <footer className="border-t border-zinc-800 mt-16">
      <div className="max-w-7xl mx-auto px-4 pt-12">
        <div className="max-w-2xl">
          <NewsletterSignup source="footer" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2">
            <Wordmark className="text-xl" />
          </div>
          <p className="text-xs text-zinc-400 mt-3 max-w-[18ch]">
            {t.footer.tagline}
          </p>
        </div>

        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-3">
              {section.title}
            </h2>
            <ul className="space-y-1">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-block py-1 text-sm text-zinc-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-zinc-400">
            {t.footer.rights(new Date().getFullYear())}
          </p>
          <div className="flex items-center gap-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-2 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
