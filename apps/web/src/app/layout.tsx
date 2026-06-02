import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Akavish — Gaming News, Leaks & Reviews',
    template: '%s | Akavish',
  },
  description:
    "Breaking gaming news, exclusive leaks, in-depth reviews and conference recaps. CS2, GTA, Baldur's Gate and everything in between.",
  keywords: ['gaming news', 'game leaks', 'game reviews', 'CS2', 'GTA', 'esport'],
  openGraph: {
    title: 'Akavish — Gaming News, Leaks & Reviews',
    description: 'Breaking gaming news, exclusive leaks, in-depth reviews.',
    url: 'https://akavish.gg',
    siteName: 'Akavish',
    locale: 'en_US',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', site: '@akavish' },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
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
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-zinc-800 py-8 mt-16">
      <div className="max-w-7xl mx-auto px-4 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} Akavish. All rights reserved.
      </div>
    </footer>
  )
}
