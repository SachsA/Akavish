// The game chips of the Esport News and Transfers pages: "All games", CS2,
// Valorant… Links, not a browser filter: each game has its own cached page
// (/esport/cs2, /esport/transfers/valorant) with its own pagination.

import Link from './LocaleLink'
import { getMessages } from '@/lib/i18n/server'
import { ESPORT_GAMES, ESPORT_GAME_LABEL, type EsportGame } from '@/lib/esport'

export function EsportGameFilter({
  base,
  active,
}: {
  /** The page without a game: `/esport` or `/esport/transfers`. */
  base: string
  active: EsportGame | null
}) {
  const t = getMessages()
  return (
    <nav aria-label={t.esport.byGame} className="mb-8 -mt-2">
      <ul className="flex flex-wrap gap-2">
        {([null, ...ESPORT_GAMES] as const).map((g) => {
          const on = g === active
          return (
            <li key={g ?? 'all'}>
              <Link
                href={g ? `${base}/${g}` : base}
                aria-current={on ? 'page' : undefined}
                className={`inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors ${
                  on
                    ? 'border-emerald-500 bg-emerald-500/10 text-white'
                    : 'border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {g ? ESPORT_GAME_LABEL[g] : t.esport.allGames}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
