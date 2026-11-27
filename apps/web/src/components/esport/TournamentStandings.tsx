// A Swiss or group stage's standings (PandaScore's ranking), with "qualified"
// / "eliminated" where the stage's rule is known (the CS2 Major stages).
import { swissVerdict, type EsportStage, type StageStanding } from '@/lib/esport-tournaments'
import { getMessages } from '@/lib/i18n/server'
import { spoilerData } from '@/lib/spoilers'
import { EsportFollowButton } from './EsportFollowButton'

export function TournamentStandings({ stage, rows }: { stage: EsportStage; rows: StageStanding[] }) {
  const t = getMessages()
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
          <tr>
            <th scope="col" className="w-14 px-3 py-2 text-left font-semibold">{t.esport.rank}</th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">{t.esport.team}</th>
            <th scope="col" className="w-20 px-3 py-2 text-right font-semibold">{t.esport.record}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {rows.map((r) => {
            const verdict = swissVerdict(stage, r)
            return (
              <tr
                key={`${r.rank}-${r.team.name}`}
                {...spoilerData({ game: stage.game, teams: [r.team.id] })}
                className={`akv-match ${verdict === 'eliminated' ? 'akv-lost text-zinc-500' : 'text-zinc-200'}`}
              >
                <td className="px-3 py-2 tabular-nums text-zinc-400">{r.rank}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    {r.team.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.team.logo} alt="" width={18} height={18} loading="lazy" className="h-[18px] w-[18px] shrink-0 object-contain" />
                    ) : (
                      <span aria-hidden="true" className="h-[18px] w-[18px] shrink-0 rounded-sm bg-zinc-800" />
                    )}
                    <span className="truncate font-medium">{r.team.name}</span>
                    {r.team.id ? (
                      <EsportFollowButton
                        look="star"
                        follow={{
                          kind: 'team',
                          pandaId: r.team.id,
                          game: stage.game,
                          label: r.team.name,
                          acronym: r.team.acronym,
                          logo: r.team.logo,
                          slug: null,
                          at: null,
                        }}
                      />
                    ) : null}
                    {verdict && (
                      <span
                        className={`akv-verdict ml-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          verdict === 'qualified' ? 'border-emerald-600/60 text-emerald-400' : 'border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {verdict === 'qualified' ? t.esport.qualified : t.esport.eliminated}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  <span className="akv-score">
                    {r.wins} – {r.losses}
                  </span>
                  <span aria-hidden="true" className="akv-mask text-zinc-500">
                    ? – ?
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
