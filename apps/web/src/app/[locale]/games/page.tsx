import Image from 'next/image'
import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import { JsonLd } from '@/components/JsonLd'
import { ContentUnavailable } from '@/components/StatusMessage'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { fetchAllGames, type GameListItem } from '@/lib/payload'
import { breadcrumbList } from '@/lib/structured-data'

// Every game on the site, A to Z, under a letter each (# for the rest), with
// a row of letters to jump. Each card opens the game's page (its articles).

export const revalidate = 30

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = setRequestLocale((await params).locale)
  const t = getMessages()
  return {
    title: t.games.title,
    description: t.games.description,
    alternates: alternates(locale, '/games'),
  }
}

/** First letter without accent, A-Z; anything else (digits, symbols) is "#". */
function letterOf(name: string): string {
  const c = name.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase()
  return /[A-Z]/.test(c) ? c : '#'
}

export default async function GamesPage({ params }: Params) {
  const locale = setRequestLocale((await params).locale)
  const t = getMessages()

  let games: GameListItem[] | null = null
  try {
    games = await fetchAllGames()
  } catch {
    games = null
  }

  const groups = new Map<string, GameListItem[]>()
  for (const g of [...(games ?? [])].sort((a, b) => a.name.localeCompare(b.name, locale))) {
    const letter = letterOf(g.name)
    groups.set(letter, [...(groups.get(letter) ?? []), g])
  }
  // "#" first, then A to Z.
  const letters = [...groups.keys()].sort((a, b) =>
    a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b),
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <JsonLd data={breadcrumbList([{ name: t.games.title, path: '/games' }], locale)} />
      <header className="mb-8">
        <h1 className="text-4xl font-black tracking-tight text-white">{t.games.title}</h1>
        {games && games.length > 0 && (
          <p className="text-zinc-400 mt-2">{t.games.count(games.length)}</p>
        )}
      </header>

      {!games ? (
        <ContentUnavailable />
      ) : games.length === 0 ? (
        <p className="text-zinc-400">{t.games.none}</p>
      ) : (
        <>
          <nav aria-label={t.games.letters} className="mb-10 flex flex-wrap gap-1">
            {letters.map((l) => (
              <a
                key={l}
                href={`#letter-${l === '#' ? 'other' : l}`}
                className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-zinc-800 text-sm text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
              >
                {l}
              </a>
            ))}
          </nav>

          <div className="space-y-10">
            {letters.map((l) => (
              <section
                key={l}
                id={`letter-${l === '#' ? 'other' : l}`}
                aria-labelledby={`h-${l === '#' ? 'other' : l}`}
                className="scroll-mt-24"
              >
                <h2
                  id={`h-${l === '#' ? 'other' : l}`}
                  className="mb-4 pb-2 border-b border-zinc-800 text-sm font-semibold uppercase tracking-wider text-zinc-400"
                >
                  {l}
                </h2>
                <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {groups.get(l)!.map((g) => (
                    <li key={g.slug}>
                      <Link
                        href={`/game/${g.slug}`}
                        className="group block h-full rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden hover:border-zinc-700 transition-colors"
                      >
                        <span className="relative block aspect-video bg-zinc-800">
                          {g.cover && (
                            <Image
                              src={g.cover}
                              // Decorative: the name is right under it, in the same link.
                              alt=""
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                              className="object-cover"
                            />
                          )}
                        </span>
                        <span className="block px-3 py-2">
                          <span className="block text-sm font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors line-clamp-2">
                            {g.name}
                          </span>
                          {g.releaseDate && (
                            <span className="block text-xs text-zinc-400 mt-0.5">
                              {new Date(g.releaseDate).getUTCFullYear()}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
