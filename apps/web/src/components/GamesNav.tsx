// The Games section's tabs: the library (/games) and the release calendar
// (/games/releases).

import Link from './LocaleLink'
import { getMessages } from '@/lib/i18n/server'

export function GamesNav({ active }: { active: 'library' | 'releases' }) {
  const t = getMessages()
  const tabs = [
    { key: 'library' as const, href: '/games', label: t.games.libraryTab },
    { key: 'releases' as const, href: '/games/releases', label: t.games.releasesTab },
  ]
  return (
    <nav aria-label={t.games.tabs} className="mb-8 border-b border-zinc-800">
      <ul className="flex gap-1 text-sm">
        {tabs.map((tab) => {
          const on = tab.key === active
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={on ? 'page' : undefined}
                className={`inline-block px-3 py-2 -mb-px border-b-2 whitespace-nowrap font-semibold transition-colors ${
                  on ? 'border-emerald-400 text-white' : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
