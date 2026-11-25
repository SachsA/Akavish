import { describe, expect, it } from 'vitest'
import {
  followFromBody,
  mentionsTeam,
  recipientsFor,
  transitionOf,
  type FollowRow,
  type MatchEvent,
} from './esport-follows'
import { matchEvent } from '../esport/sync'

const e: MatchEvent = {
  type: 'end',
  matchId: 900,
  game: 'cs2',
  serieId: 11176,
  event: 'PGL Major Singapore 2026',
  stage: 'Stage 1',
  slug: 'cs-go-pgl-major-singapore-2026-stage-1',
  t1: { id: 1, name: 'Ninjas in Pyjamas', acronym: 'NIP', logo: null },
  t2: { id: 2, name: 'Team Liquid', acronym: 'TL', logo: null },
  s1: 2,
  s2: 0,
  winner: 1,
}

describe('esport notifications', () => {
  it('turns a status change into a start or an end, nothing else', () => {
    expect(transitionOf('not_started', 'running')).toBe('start')
    expect(transitionOf('running', 'finished')).toBe('end')
    expect(transitionOf('not_started', 'finished')).toBe('end')
    expect(transitionOf('running', 'running')).toBeNull()
    expect(transitionOf('finished', 'running')).toBeNull()
    expect(transitionOf(undefined, 'running')).toBeNull() // new to us: no "it started"
    expect(transitionOf('postponed', 'running')).toBeNull()
  })

  it('finds the followers of a team, the event or the match, once each', () => {
    const f = (reader: number, kind: FollowRow['kind'], pandaId: number): FollowRow => ({
      reader,
      kind,
      pandaId,
      label: 'x',
    })
    const readers = recipientsFor(e, [
      f(10, 'team', 1),
      f(10, 'event', 11176), // same reader twice: one notification
      f(11, 'team', 2),
      f(12, 'match', 900),
      f(13, 'team', 3),
      f(14, 'event', 999),
    ])
    expect([...readers].sort()).toEqual(['10', '11', '12'])
  })

  it('spots a followed team in a title: full name, or a 3+ letter acronym in capitals', () => {
    const nip = { label: 'Ninjas in Pyjamas', acronym: 'NIP' }
    expect(mentionsTeam('NIP beat Liquid to reach Stage 2', nip)).toBe(true)
    expect(mentionsTeam('ninjas in pyjamas sign a new coach', nip)).toBe(true)
    expect(mentionsTeam('Snipers rule the map', nip)).toBe(false) // inside a word
    expect(mentionsTeam('nip and tuck', nip)).toBe(false) // acronym must be in capitals
    expect(mentionsTeam('G2 win the final', { label: 'G2 Esports', acronym: 'G2' })).toBe(false) // too short
    expect(mentionsTeam('Vitality are out', { label: 'Vitality', acronym: 'VIT' })).toBe(true)
  })

  it('accepts a follow from the site only with what it needs', () => {
    expect(
      followFromBody({
        kind: 'team',
        pandaId: '3216',
        label: ' Vitality ',
        logo: 'https://cdn-api.pandascore.co/images/team/image/3216/x.png',
        slug: 'Bad Slug!',
      }),
    ).toMatchObject({ kind: 'team', pandaId: 3216, label: 'Vitality', slug: null })
    expect(
      followFromBody({ kind: 'team', pandaId: 1, label: 'x', logo: 'https://evil.example/x.png' })
        ?.logo,
    ).toBeNull()
    expect(followFromBody({ kind: 'player', pandaId: 1, label: 'x' })).toBeNull()
    expect(followFromBody({ kind: 'team', pandaId: -1, label: 'x' })).toBeNull()
  })

  it('builds the event the bell shows from a synced match', () => {
    const ev = matchEvent(
      'start',
      {
        pandaId: 5,
        game: 'cs2',
        tournamentPandaId: 22378,
        name: 'NIP vs TL',
        status: 'running',
        scheduledAt: null,
        beginAt: null,
        endAt: null,
        bestOf: 3,
        team1: { pandaId: 1, name: 'NIP', acronym: 'NIP', logoUrl: null },
        team2: { pandaId: 2, name: 'Liquid', acronym: 'TL', logoUrl: null },
        score1: 0,
        score2: 0,
        winner: null,
        forfeit: false,
        draw: false,
        streamUrl: null,
        modifiedAt: null,
      },
      {
        pandaId: 22378,
        game: 'cs2',
        name: 'Stage 1',
        slug: 'cs-go-pgl-major-singapore-2026-stage-1',
        serieId: 11176,
        hasBracket: false,
        league: 'PGL Major',
        leagueLogoUrl: null,
        serie: 'Singapore 2026',
        tier: 's',
        beginAt: null,
        endAt: null,
      },
    )
    expect(ev).toMatchObject({
      type: 'start',
      matchId: 5,
      serieId: 11176,
      event: 'PGL Major Singapore 2026',
      stage: 'Stage 1',
    })
    expect(ev.t2).toEqual({ id: 2, name: 'Liquid', acronym: 'TL', logo: null })
  })
})
