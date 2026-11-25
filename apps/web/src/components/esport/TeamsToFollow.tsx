// The teams of a stage, each with a star to follow it: above the bracket of
// a stage without standings (a playoff), where the bracket's own boxes are
// too small for a button. Teams come from the stored bracket (with their
// PandaScore id since 2026-11-25). Not blurred: names give nothing away.
import type { EsportTeam } from '@/lib/esport'
import type { EsportStage } from '@/lib/esport-tournaments'
import { getMessages } from '@/lib/i18n/server'
import { EsportFollowButton } from './EsportFollowButton'

export function TeamsToFollow({ stage }: { stage: EsportStage }) {
  const t = getMessages()
  if (!stage.structure || stage.structure.standings.length > 0) return null
  const teams = new Map<number, EsportTeam>()
  for (const m of stage.structure.matches) {
    for (const team of [m.t1, m.t2]) if (team?.id) teams.set(team.id, team)
  }
  if (teams.size === 0) return null
  return (
    <section aria-labelledby="teams" className="mb-8">
      <h2 id="teams" className="mb-1 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        {t.esportFollow.teams}
      </h2>
      <p className="mb-3 text-xs text-zinc-400">{t.esportFollow.teamsHint}</p>
      <ul className="flex flex-wrap gap-2">
        {[...teams.values()]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((team) => (
            <li
              key={team.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 py-0.5 pl-2.5 pr-1 text-sm text-zinc-200"
            >
              {team.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={team.logo} alt="" width={16} height={16} loading="lazy" className="h-4 w-4 object-contain" />
              ) : null}
              {team.name}
              <EsportFollowButton
                look="star"
                follow={{
                  kind: 'team',
                  pandaId: team.id!,
                  game: stage.game,
                  label: team.name,
                  acronym: team.acronym,
                  logo: team.logo,
                  slug: null,
                  at: null,
                }}
              />
            </li>
          ))}
      </ul>
    </section>
  )
}
