import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import { SITE_URL, SITE_NAME, SITE_TWITTER, SITE_SOCIALS } from '@/lib/site'
import { Wordmark } from '@/components/Wordmark'
import { SearchBar } from '@/components/SearchBar'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Akavish — Gaming News, Leaks & Reviews',
    template: '%s | Akavish',
  },
  description:
    "Breaking gaming news, exclusive leaks, in-depth reviews and conference recaps. CS2, GTA, Baldur's Gate and everything in between.",
  keywords: ['gaming news', 'game leaks', 'game reviews', 'CS2', 'GTA', 'esport'],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Akavish — Gaming News, Leaks & Reviews',
    description: 'Breaking gaming news, exclusive leaks, in-depth reviews.',
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'en_US',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', site: SITE_TWITTER },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </body>
      </html>
    </ClerkProvider>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="Akavish — home">
          <Wordmark className="text-xl" />
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6 text-sm text-zinc-400">
          <Link href="/news" className="hidden sm:inline hover:text-white transition-colors">News</Link>
          <Link href="/leaks" className="hidden sm:inline hover:text-white transition-colors">Leaks</Link>
          <Link href="/reviews" className="hidden sm:inline hover:text-white transition-colors">Reviews</Link>
          <Link href="/esport" className="hidden sm:inline hover:text-white transition-colors">Esport</Link>
          <Suspense fallback={null}>
            <SearchBar />
          </Suspense>
          <div className="flex items-center gap-3 pl-3 border-l border-zinc-800">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="hover:text-white transition-colors">Log in</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors">
                  Sign up
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  const sections = [
    {
      title: 'Sections',
      links: [
        { label: 'News', href: '/news' },
        { label: 'Leaks', href: '/leaks' },
        { label: 'Reviews', href: '/reviews' },
        { label: 'Esport', href: '/esport' },
      ],
    },
    {
      title: 'Akavish',
      links: [
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' },
        { label: 'RSS feed', href: '/feed.xml' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
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
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2">
            <Wordmark className="text-xl" />
          </div>
          <p className="text-xs text-zinc-500 mt-3 max-w-[18ch]">
            Breaking gaming news, leaks &amp; reviews. No fluff.
          </p>
        </div>

        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs uppercase tracking-widest text-zinc-600 font-bold mb-3">
              {section.title}
            </h3>
            <ul className="space-y-2">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-400 hover:text-white transition-colors"
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
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} Akavish. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-500 hover:text-white transition-colors"
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
