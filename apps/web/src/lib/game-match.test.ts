import { describe, expect, it } from 'vitest'
import { gameScore, matchGames, tokens } from './game-match'

const games = [
  { name: 'Grand Theft Auto VI', releaseDate: '2026-11-19' },
  { name: 'Grand Theft Auto V', releaseDate: '2013-09-17' },
  { name: 'Grand Theft Auto IV', releaseDate: '2008-04-29' },
  { name: 'Counter-Strike 2', releaseDate: '2023-09-27' },
  { name: 'League of Legends', releaseDate: '2009-10-27' },
  { name: 'Red Dead Redemption 2', releaseDate: '2018-10-26' },
  { name: 'The Legend of Zelda: Breath of the Wild', releaseDate: '2017-03-03' },
  { name: 'Neon Drift' },
  { name: 'Ghost of Tsushima', releaseDate: '2020-07-17' },
  { name: 'Pokémon Legends: Z-A' },
]
const names = (q: string, limit?: number) => matchGames(games, q, limit).map((g) => g.name)

describe('tokens', () => {
  it('splits words and numbers, drops accents', () => {
    expect(tokens('GTA6')).toEqual(['gta', '6'])
    expect(tokens('Pokémon Legends: Z-A')).toEqual(['pokemon', 'legends', 'z', 'a'])
  })
})

describe('matchGames', () => {
  it('finds a series by its initials, newest first', () => {
    expect(names('GTA')).toEqual([
      'Grand Theft Auto VI',
      'Grand Theft Auto V',
      'Grand Theft Auto IV',
    ])
  })

  it('understands numbers, roman or not', () => {
    expect(names('gta 6')).toEqual(['Grand Theft Auto VI'])
    expect(names('GTA6')).toEqual(['Grand Theft Auto VI'])
    expect(names('gta vi')).toEqual(['Grand Theft Auto VI'])
    expect(names('cs2')).toEqual(['Counter-Strike 2'])
    expect(names('rdr2')).toEqual(['Red Dead Redemption 2'])
  })

  it('plain names, starts of words, accents', () => {
    expect(names('grand theft')[0]).toBe('Grand Theft Auto VI')
    expect(names('drift')).toEqual(['Neon Drift'])
    expect(names('pokemon')).toEqual(['Pokémon Legends: Z-A'])
    expect(names('lol')).toEqual(['League of Legends'])
    expect(names('botw')).toEqual(['The Legend of Zelda: Breath of the Wild'])
  })

  it('an exact name wins', () => {
    expect(gameScore('Neon Drift', 'neon drift')).toBe(100)
    expect(names('zelda')).toEqual(['The Legend of Zelda: Breath of the Wild'])
    expect(names('neon')).toEqual(['Neon Drift'])
  })

  it('nothing for nothing', () => {
    expect(names('')).toEqual([])
    expect(names('zzzz')).toEqual([])
  })

  it('respects the limit', () => {
    expect(names('gta', 2)).toHaveLength(2)
  })
})
