import type { Metadata } from 'next'
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import { SITE_URL, SITE_NAME, SITE_TWITTER } from '@/lib/site'
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
        <a href="/" className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tight text-white">AKV</span>
          <span className="hidden sm:inline text-xs text-zinc-500 uppercase tracking-widest">Akavish</span>
        </a>
        <nav className="flex items-center gap-6 text-sm text-zinc-400">
          <a href="/news" className="hover:text-white transition-colors">News</a>
          <a href="/leaks" className="hover:text-white transition-colors">Leaks</a>
          <a href="/reviews" className="hover:text-white transition-colors">Reviews</a>
          <a href="/esport" className="hover:text-white transition-colors">Esport</a>
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
    { label: 'X', href: 'https://twitter.com/akavish' },
    { label: 'Discord', href: 'https://discord.gg/akavish' },
    { label: 'YouTube', href: 'https://youtube.com/@akavish' },
  ]

  return (
    <footer className="border-t border-zinc-800 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white">AKV</span>
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Akavish</span>
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
                  <a
                    href={link.href}
                    className="text-sm text-zinc-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
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
