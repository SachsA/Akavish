'use client'

// /account → Esport: the teams, tournaments and matches the reader follows,
// each with "Unfollow", and a box to follow a team by name (the teams of this
// week's matches, from the page). Shares the follows store with every button.

import { useEffect, useMemo, useState } from 'react'
import Link from '../LocaleLink'
import { useI18n } from '../I18nProvider'
import { DateText } from '../DateText'
import { readerMessage } from '@/lib/reader-messages'
import { ESPORT_GAME_BADGE, ESPORT_GAME_LABEL, isEsportGame } from '@/lib/esport'
import type { EsportFollow, EsportFollowKind } from '@/lib/readers'
import { loadEsportFollows, toggleEsportFollow, useEsportFollows } from '@/lib/esport-follows-store'

export interface TeamChoice {
  id: number
  name: string
  acronym: string | null
  logo: string | null
  game: string
}

function Logo({ src }: { src: string | null }) {
  if (!src) return <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-sm bg-zinc-800" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={20} height={20} loading="lazy" className="h-5 w-5 shrink-0 object-contain" />
}

export function EsportFollowsManager({ teams }: { teams: TeamChoice[] }) {
  const { t, locale } = useI18n()
  const follows = useEsportFollows()
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => loadEsportFollows(), [])

  const byName = useMemo(() => new Map(teams.map((x) => [x.name.toLowerCase(), x])), [teams])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const q = query.trim().toLowerCase()
    const team = byName.get(q) ?? teams.find((x) => x.acronym?.toLowerCase() === q)
    if (!team) return setError(t.esportFollow.addTeamNone)
    const failed = await toggleEsportFollow(
      { kind: 'team', pandaId: team.id, game: team.game, label: team.name, acronym: team.acronym, logo: team.logo, slug: null, at: null },
      true
    )
    if (failed) setError(readerMessage(failed, locale))
    else setQuery('')
  }

  async function remove(f: EsportFollow) {
    const failed = await toggleEsportFollow(f, false)
    if (failed) setError(readerMessage(failed, locale))
  }

  const groups: Array<[EsportFollowKind, string]> = [
    ['team', t.esportFollow.followedTeams],
    ['event', t.esportFollow.followedEvents],
    ['match', t.esportFollow.followedMatches],
  ]

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold text-white">
          {t.esportFollow.addTeam}
          <input
            list="esport-teams"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.esportFollow.addTeamPlaceholder}
            className="h-10 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal text-zinc-100 focus:border-emerald-500 focus:outline-hidden"
          />
        </label>
        <datalist id="esport-teams">
          {teams.map((x) => (
            <option key={x.id} value={x.name} />
          ))}
        </datalist>
        <button type="submit" className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-on-accent hover:bg-emerald-600">
          {t.esportFollow.add}
        </button>
        {error && (
          <p role="status" className="w-full text-xs text-danger">
            {error}
          </p>
        )}
      </form>

      {follows !== null && follows.length === 0 && <p className="text-sm text-zinc-400">{t.esportFollow.noneYet}</p>}

      {follows !== null &&
        groups.map(([kind, title]) => {
          const list = follows.filter((f) => f.kind === kind)
          if (!list.length) return null
          return (
            <div key={kind}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                {title} ({list.length})
              </h3>
              <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
                {list.map((f) => (
                  <li key={`${f.kind}:${f.pandaId}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Logo src={f.logo} />
                    {f.game && isEsportGame(f.game) && (
                      <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase ${ESPORT_GAME_BADGE[f.game]}`}>
                        {ESPORT_GAME_LABEL[f.game]}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-zinc-100">
                      {f.slug ? (
                        <Link href={`/esport/tournaments/${f.slug}`} className="hover:text-emerald-400">
                          {f.label}
                        </Link>
                      ) : (
                        f.label
                      )}
                      {f.kind === 'match' && f.at && (
                        <span className="ml-2 text-xs text-zinc-400">
                          <DateText iso={f.at} />
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(f)}
                      className="shrink-0 text-xs font-semibold text-zinc-400 hover:text-white"
                    >
                      {t.esportFollow.remove}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
    </div>
  )
}
