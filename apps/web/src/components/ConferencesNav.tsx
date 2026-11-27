// The Conferences section's tabs: the recaps (articles) and the events
// calendar (/conferences/calendar).

import Link from './LocaleLink'
import { getMessages } from '@/lib/i18n/server'

export function ConferencesNav({ active }: { active: 'articles' | 'calendar' }) {
  const t = getMessages()
  const tabs = [
    { key: 'articles' as const, href: '/conferences', label: t.events.articles },
    { key: 'calendar' as const, href: '/conferences/calendar', label: t.events.calendar },
  ]
  return (
    <nav aria-label={t.events.tabs} className="mb-8 -mt-4 border-b border-zinc-800">
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
