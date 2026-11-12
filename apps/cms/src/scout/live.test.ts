import { describe, expect, it } from 'vitest'
import { readCommand } from './discord-commands'
import {
  applyLive,
  cleanLive,
  liveLexical,
  livePrompt,
  recapVideos,
  urlsIn,
  type LiveEntry,
} from './live-prompt'

const yt = 'https://www.youtube.com/watch?v=QdBZY2fkU-0'
const blog = 'https://blog.playstation.com/saga'
const entry: LiveEntry = {
  id: 'e1',
  at: '2026-12-10T01:12:00Z',
  headline: 'Saga: revealed',
  text: 'A new game was revealed.',
  links: [{ label: 'Trailer', url: yt }],
  from: 'editor',
  game: { id: 9, name: 'Saga', slug: 'saga' },
}

describe('live prompt', () => {
  it('finds the links pasted in a note', () => {
    expect(urlsIn(`Saga revealed ${yt} and (${blog})`)).toEqual([yt, blog])
  })

  it('lists entries with their number, notes with video titles, items and games', () => {
    const p = livePrompt({
      event: 'The Game Awards 2026',
      entries: [entry],
      notes: [{ id: 'n1', at: '', text: `#1 out in March ${yt}`, done: false }],
      items: [
        {
          index: 0,
          source: 'PlayStation Blog',
          official: true,
          title: 'Saga',
          url: blog,
          summary: '',
        },
      ],
      videoTitles: { [yt]: 'Saga - Reveal Trailer' },
      games: ['Saga'],
      first: false,
    })
    expect(p).toContain('e1 (#1): Saga: revealed | A new game was revealed. | game: Saga')
    expect(p).toContain(`(${yt} is the YouTube video "Saga - Reveal Trailer")`)
    expect(p).toContain('[0] (PlayStation Blog, official) Saga')
    expect(p).toContain('Existing games on Akavish: Saga')
  })
})

describe('cleanLive and applyLive', () => {
  it('keeps only given links, only existing entries, and new links only', () => {
    const a = cleanLive(
      {
        intro: 'So far: Saga.',
        new_entries: [
          {
            headline: 'Other: dated',
            text: 'Out in May.',
            links: [
              { label: 'Post', url: blog },
              { label: 'x', url: 'https://evil.example' },
            ],
          },
          { headline: '', text: 'no headline', links: [] },
        ],
        update_entries: [
          {
            entry: 'e1',
            headline: 'Saga: revealed for March 2027',
            text: 'Out in March 2027.',
            links: [
              { label: 'Trailer', url: yt },
              { label: 'Post', url: blog },
            ],
          },
          { entry: 'e9', text: 'unknown entry', links: [] },
        ],
      },
      [entry],
      new Set([yt, blog]),
    )
    expect(a.new_entries).toHaveLength(1)
    expect(a.new_entries[0].links).toEqual([{ label: 'Post', url: blog }])
    expect(a.update_entries).toHaveLength(1)
    expect(a.update_entries[0].links).toEqual([{ label: 'Post', url: blog }]) // the trailer was already there

    const r = applyLive([entry], a, '2026-12-10T01:20:00Z', true)
    expect(r.changed).toBe(true)
    expect(r.updated[0]).toMatchObject({
      headline: 'Saga: revealed for March 2027',
      updatedAt: '2026-12-10T01:20:00Z',
    })
    expect(r.updated[0].links.map((l) => l.url)).toEqual([yt, blog])
    expect(r.updated[0].game?.slug).toBe('saga') // kept
    expect(r.added[0]).toMatchObject({ id: 'e2', headline: 'Other: dated', from: 'editor' })
  })

  it('links a new entry to the game page it names', () => {
    const a = cleanLive(
      {
        intro: '',
        new_entries: [
          { headline: 'New: revealed', text: 't', links: [], game: 'New Game', game_is_new: true },
        ],
        update_entries: [],
      },
      [],
      new Set(),
    )
    const r = applyLive(
      [],
      a,
      'now',
      false,
      new Map([['new game', { id: 12, name: 'New Game', slug: 'new-game' }]]),
    )
    expect(r.added[0].game).toEqual({ id: 12, name: 'New Game', slug: 'new-game' })
  })

  it('reports nothing changed for an empty answer', () => {
    const r = applyLive([entry], cleanLive({ intro: 'x' }, [entry], new Set()), 'now', false)
    expect(r.changed).toBe(false)
  })
})

describe('live page', () => {
  it('shows newest first with time, links and the game page; then the end with the recap', () => {
    const later: LiveEntry = {
      ...entry,
      id: 'e2',
      at: '2026-12-10T01:30:00Z',
      headline: 'Later: shown',
      game: null,
    }
    const json = JSON.stringify(
      liveLexical({
        intro: 'Intro',
        entries: [entry, later],
        updatedAt: '2026-12-10T01:31:00Z',
        webUrl: 'https://akavish.gg',
      }),
    )
    expect(json.indexOf('02:30 · Later: shown')).toBeLessThan(
      json.indexOf('02:12 · Saga: revealed'),
    )
    expect(json).toContain('Last update 02:31 (Paris time)')
    expect(json).toContain('https://akavish.gg/game/saga')
    const ended = JSON.stringify(
      liveLexical({
        intro: '',
        entries: [],
        updatedAt: '',
        ended: true,
        recap: { title: 'Recap', url: 'https://akavish.gg/article/r' },
      }),
    )
    expect(ended).toContain('The show is over. Full recap: ')
  })

  it('collects the trailers for the recap', () => {
    expect(recapVideos([entry])).toEqual([{ title: 'Saga: Trailer', channel: '', url: yt }])
  })
})

describe('readCommand', () => {
  it('reads the subcommand and its options', () => {
    expect(
      readCommand({
        name: 'live',
        options: [{ name: 'add', options: [{ name: 'texte', value: ' Saga ' }] }],
      }),
    ).toEqual({ command: 'live', sub: 'add', args: { texte: 'Saga' } })
    expect(readCommand(undefined)).toEqual({ command: '', sub: '', args: {} })
  })
})
