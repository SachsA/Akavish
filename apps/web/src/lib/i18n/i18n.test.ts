import { describe, expect, it } from 'vitest'
import { fromAcceptLanguage, isSharedPath, localeOfPath, localizePath, stripLocale } from './config'
import { formatDate } from './dates'
import { en } from './messages/en'
import { fr } from './messages/fr'

describe('paths', () => {
  it('adds /fr for French and nothing for English', () => {
    expect(localizePath('fr', '/news')).toBe('/fr/news')
    expect(localizePath('fr', '/')).toBe('/fr')
    expect(localizePath('fr', '/search?q=gta')).toBe('/fr/search?q=gta')
    expect(localizePath('en', '/news')).toBe('/news')
    expect(localizePath('en', '/fr/news')).toBe('/news')
    expect(localizePath('fr', '/fr/news')).toBe('/fr/news')
  })

  it('leaves external links, anchors and shared files alone', () => {
    expect(localizePath('fr', 'https://x.com/akavish33')).toBe('https://x.com/akavish33')
    expect(localizePath('fr', '#comments')).toBe('#comments')
    expect(localizePath('fr', '//cdn.example.com/a.png')).toBe('//cdn.example.com/a.png')
    expect(localizePath('fr', '/feed.xml')).toBe('/feed.xml')
    expect(localizePath('fr', '/api/search?q=x')).toBe('/api/search?q=x')
    expect(isSharedPath('/sitemap.xml')).toBe(true)
    expect(isSharedPath('/article/foo')).toBe(false)
  })

  it('strips and reads the language of a path', () => {
    expect(stripLocale('/fr/news?page=2')).toBe('/news?page=2')
    expect(stripLocale('/fr')).toBe('/')
    expect(stripLocale('/fr?x=1')).toBe('/?x=1')
    expect(stripLocale('/news')).toBe('/news')
    expect(stripLocale('/french-games')).toBe('/french-games')
    expect(localeOfPath('/fr/article/x')).toBe('fr')
    expect(localeOfPath('/article/x')).toBe('en')
    expect(localeOfPath('/fr')).toBe('fr')
  })
})

describe('fromAcceptLanguage', () => {
  it('picks the first supported language by weight', () => {
    expect(fromAcceptLanguage('fr-FR,fr;q=0.9,en;q=0.8')).toEqual({ locale: 'fr', region: 'US' })
    expect(fromAcceptLanguage('de-DE,de;q=0.9,en-GB;q=0.8,fr;q=0.7')).toEqual({ locale: 'en', region: 'GB' })
    expect(fromAcceptLanguage('en;q=0.5,fr;q=0.9')?.locale).toBe('fr')
  })

  it('guesses the English date style from the country', () => {
    expect(fromAcceptLanguage('en-US,en;q=0.9')?.region).toBe('US')
    expect(fromAcceptLanguage('en-AU')?.region).toBe('GB')
    expect(fromAcceptLanguage('en')?.region).toBe('US')
  })

  it('returns null when nothing is usable', () => {
    expect(fromAcceptLanguage(null)).toBeNull()
    expect(fromAcceptLanguage('')).toBeNull()
    expect(fromAcceptLanguage('de-DE,es;q=0.5')).toBeNull()
    expect(fromAcceptLanguage('fr;q=0')).toBeNull()
  })
})

describe('formatDate', () => {
  const iso = '2026-11-16T22:30:00Z'
  it('writes 🇺🇸, 🇬🇧 and 🇫🇷 dates', () => {
    expect(formatDate(iso, { locale: 'en', region: 'US' })).toBe('Nov 16, 2026')
    expect(formatDate(iso, { locale: 'en', region: 'GB' })).toBe('16 Nov 2026')
    expect(formatDate(iso, { locale: 'fr' })).toBe('16 nov. 2026')
    expect(formatDate(iso, { locale: 'en', region: 'US', style: 'long' })).toBe('November 16, 2026')
    expect(formatDate(iso, { locale: 'en', region: 'GB', style: 'long' })).toBe('16 November 2026')
    expect(formatDate(iso, { locale: 'fr', style: 'long' })).toBe('16 novembre 2026')
  })

  it('writes day headings, Today and Yesterday in each language', () => {
    const now = new Date('2026-11-18T10:00:00Z')
    expect(formatDate(iso, { locale: 'en', region: 'US', style: 'day', now })).toBe('Monday, November 16')
    expect(formatDate(iso, { locale: 'en', region: 'GB', style: 'day', now })).toBe('Monday 16 November')
    expect(formatDate(iso, { locale: 'fr', style: 'day', now })).toBe('Lundi 16 novembre')
    expect(formatDate('2026-11-17T01:00:00Z', { locale: 'fr', style: 'day', now })).toBe('Hier')
    expect(formatDate('2026-11-18T01:00:00Z', { locale: 'en', style: 'day', now })).toBe('Today')
  })

  it('returns nothing for a missing or broken date', () => {
    expect(formatDate(undefined, { locale: 'en' })).toBe('')
    expect(formatDate('nope', { locale: 'fr' })).toBe('')
  })
})

describe('messages', () => {
  it('French has every English key', () => {
    const keys = (o: object, prefix = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
      )
    expect(keys(fr).sort()).toEqual(keys(en).sort())
  })
})
