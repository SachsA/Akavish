// The Esport section's tabs: News (the articles), Results, Transfers,
// Calendar. Above every Esport page. With a game picked (/esport/cs2), the
// tabs keep it: Mercato → /esport/transfers/cs2, Results → ?game=cs2.

import Link from './LocaleLink'
import { getMessages } from '@/lib/i18n/server'
import type { EsportGame } from '@/lib/esport'
import { SpoilerToggle } from './SpoilerToggle'

export type EsportTab = 'news' | 'results' | 'transfers' | 'calendar'

const TABS: Array<{ key: EsportTab; href: string }> = [
  { key: 'news', href: '/esport' },
  { key: 'results', href: '/esport/results' },
  { key: 'transfers', href: '/esport/transfers' },
  { key: 'calendar', href: '/esport/calendar' },
]

const withGame = (tab: EsportTab, href: string, game: EsportGame | null) =>
  !game ? href : tab === 'news' || tab === 'transfers' ? `${href}/${game}` : `${href}?game=${game}`

export function EsportNav({
  active,
  game = null,
}: {
  active: EsportTab
  game?: EsportGame | null
}) {
  const t = getMessages()
  return (
    <>
      <nav aria-label={t.esport.sections} className="mb-4 -mt-4 border-b border-zinc-800">
        <ul className="flex gap-1 overflow-x-auto text-sm scrollbar-none [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => {
            const on = tab.key === active
            return (
              <li key={tab.key}>
                <Link
                  href={withGame(tab.key, tab.href, game)}
                  aria-current={on ? 'page' : undefined}
                  className={`inline-block px-3 py-2 -mb-px border-b-2 whitespace-nowrap font-semibold transition-colors ${
                    on
                      ? 'border-emerald-400 text-white'
                      : 'border-transparent text-zinc-400 hover:text-white'
                  }`}
                >
                  {t.esport[tab.key]}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      {/* Anti-spoil switch: on every esport page, right under the tabs. */}
      <SpoilerToggle />
    </>
  )
}
