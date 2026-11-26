import { describe, expect, it } from 'vitest'
import { igdbImageUrls, igdbMatch, normTitle, steamMatch } from './game-images'

describe('game image library: matching the game online', () => {
  it('compares titles loosely', () => {
    expect(normTitle('Grand Theft Auto VI™')).toBe('grand theft auto vi')
    expect(normTitle('Pokémon Legends: Z-A')).toBe('pokemon legends z a')
    expect(normTitle('Ratchet & Clank')).toBe(normTitle('Ratchet and Clank'))
  })

  it('takes the IGDB entry of exactly this game, by name or alternative name', () => {
    const results = [
      { name: 'Grand Theft Auto V', artworks: [{ image_id: 'five' }] },
      {
        name: 'Grand Theft Auto VI',
        artworks: [{ image_id: 'six1' }],
        screenshots: [{ image_id: 'six2' }],
      },
    ]
    expect(igdbMatch(results, 'Grand Theft Auto VI')?.name).toBe('Grand Theft Auto VI')
    expect(
      igdbMatch(
        [{ name: 'GTA 6', alternative_names: [{ name: 'Grand Theft Auto VI' }] }],
        'Grand Theft Auto VI',
      )?.name,
    ).toBe('GTA 6')
    // Never a neighbour: no image beats the wrong game's.
    expect(igdbMatch([results[0]], 'Grand Theft Auto VI')).toBeNull()
  })

  it('tells namesakes apart by year, else takes the most recent', () => {
    const at = (y: number) => Date.UTC(y, 5, 1) / 1000
    const fables = [
      { name: 'Fable', first_release_date: at(2004) },
      { name: 'Fable', first_release_date: at(2026) },
    ]
    expect(igdbMatch(fables, 'Fable', 2026)?.first_release_date).toBe(at(2026))
    expect(igdbMatch(fables, 'Fable', 2004)?.first_release_date).toBe(at(2004))
    expect(igdbMatch(fables, 'Fable')?.first_release_date).toBe(at(2026))
    // Only an old namesake for a new game: nothing rather than the wrong one.
    expect(igdbMatch([fables[0]], 'Fable', 2026)).toBeNull()
    // Not dated yet counts as upcoming.
    expect(igdbMatch([fables[0], { name: 'Fable' }], 'Fable')?.first_release_date).toBeUndefined()
  })

  it('builds 1080p IGDB URLs, artworks first, and drops odd ids', () => {
    expect(
      igdbImageUrls({
        name: 'x',
        screenshots: [{ image_id: 'sc1' }],
        artworks: [{ image_id: 'ar1' }, { image_id: '../evil' }, {}],
      }),
    ).toEqual([
      'https://images.igdb.com/igdb/image/upload/t_1080p/ar1.jpg',
      'https://images.igdb.com/igdb/image/upload/t_1080p/sc1.jpg',
    ])
  })

  it('takes the Steam app of exactly this game', () => {
    const items = [
      { id: 1, name: 'MECCHA CHAMELEON Soundtrack' },
      { id: 4704690, name: 'MECCHA CHAMELEON' },
    ]
    expect(steamMatch(items, 'Meccha Chameleon')).toBe(4704690)
    expect(steamMatch(items, 'Chameleon')).toBeNull()
  })
})
