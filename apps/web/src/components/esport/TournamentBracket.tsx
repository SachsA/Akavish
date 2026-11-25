// A stage's matches as a bracket: a column per round, left to right, each
// match level with the two it comes from (lib/esport-tournaments.ts lays it
// out). A Swiss or group stage gets its rounds the same way. Scrolls sideways
// on small screens. Inside a SpoilerZone: it gives every result away.

import type { EsportTeam } from '@/lib/esport'
import { bracketLayout, roundName, type BracketSection, type StageMatch } from '@/lib/esport-tournaments'
import { getLocale, getMessages } from '@/lib/i18n/server'
import { DateText } from '../DateText'

function Side({ team, score, won, lost }: { team: EsportTeam | null; score: number | null; won: boolean; lost: boolean }) {
  const t = getMessages()
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 ${won ? 'font-bold text-white' : lost ? 'text-zinc-400' : 'text-zinc-200'}`}>
      {team?.logo ? (
        // A team logo from PandaScore's CDN: small, already sized.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo} alt="" width={18} height={18} loading="lazy" className="h-[18px] w-[18px] shrink-0 object-contain" />
      ) : (
        <span aria-hidden="true" className="h-[18px] w-[18px] shrink-0 rounded-sm bg-zinc-800" />
      )}
      <span className="min-w-0 flex-1 truncate" title={team?.name}>
        {team ? team.name : <span className="italic text-zinc-500">{t.esport.tbd}</span>}
      </span>
      <span className="w-5 shrink-0 text-right tabular-nums">{score ?? ''}</span>
    </div>
  )
}

function MatchCard({ m }: { m: StageMatch }) {
  const t = getMessages()
  const live = m.status === 'running'
  const done = m.status === 'finished'
  return (
    <div className={`w-56 overflow-hidden rounded-md border bg-zinc-900 text-sm ${live ? 'border-red-500/60' : 'border-zinc-800'}`}>
      <Side team={m.t1} score={done || live ? m.s1 : null} won={m.winner === 1} lost={m.winner === 2} />
      <div className="border-t border-zinc-800/70" />
      <Side team={m.t2} score={done || live ? m.s2 : null} won={m.winner === 2} lost={m.winner === 1} />
      <div className="flex items-center gap-2 border-t border-zinc-800/70 px-2.5 py-1 text-[11px] text-zinc-400">
        {live ? (
          <span className="font-bold uppercase text-red-400">{t.esport.live}</span>
        ) : m.at ? (
          <DateText iso={m.at} />
        ) : null}
        {m.bestOf ? <span className="ml-auto">{t.esport.bestOf(m.bestOf)}</span> : null}
      </div>
    </div>
  )
}

function Section({ section, title, tree }: { section: BracketSection; title: string | null; tree: boolean }) {
  const locale = getLocale()
  return (
    <section className="mb-8">
      {title && <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>}
      <div className="flex gap-6 overflow-x-auto pb-3">
        {section.columns.map((col, i) => (
          <div key={`${col.label}-${i}`} className="flex shrink-0 flex-col">
            <h4 className="mb-3 text-xs font-semibold text-zinc-400">{roundName(col.label, locale)}</h4>
            {/* A tree spreads each column so a match sits between the two it comes from; rounds just stack. */}
            <ul className={`flex flex-1 flex-col gap-3 ${tree ? 'justify-around' : 'justify-start'}`}>
              {col.matches.map((m) => (
                <li key={m.id}>
                  <MatchCard m={m} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

export function TournamentBracket({ matches }: { matches: StageMatch[] }) {
  const t = getMessages()
  const sections = bracketLayout(matches)
  const tree = matches.some((m) => m.prev.length > 0)
  const title = { main: null, upper: t.esport.upper, lower: t.esport.lower, final: t.esport.grandFinal }
  return (
    <div>
      {sections.map((s) => (
        <Section key={s.key} section={s} title={title[s.key]} tree={tree} />
      ))}
    </div>
  )
}
