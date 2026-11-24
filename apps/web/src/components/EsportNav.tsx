// The Esport section's tabs: News (the articles), Results, Transfers,
// Calendar. Above every Esport page.

import Link from './LocaleLink'
import { getMessages } from '@/lib/i18n/server'

export type EsportTab = 'news' | 'results' | 'transfers' | 'calendar'

const TABS: Array<{ key: EsportTab; href: string }> = [
  { key: 'news', href: '/esport' },
  { key: 'results', href: '/esport/results' },
  { key: 'transfers', href: '/esport/transfers' },
  { key: 'calendar', href: '/esport/calendar' },
]

export function EsportNav({ active }: { active: EsportTab }) {
  const t = getMessages()
  return (
    <nav aria-label={t.esport.sections} className="mb-8 -mt-4 border-b border-zinc-800">
      <ul className="flex gap-1 overflow-x-auto text-sm scrollbar-none [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
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
                {t.esport[tab.key]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
