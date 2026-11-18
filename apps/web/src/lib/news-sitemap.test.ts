import { describe, expect, it } from 'vitest'
import { newsSitemapXml } from './news-sitemap'

const now = new Date('2026-11-18T12:00:00Z')

describe('Google News sitemap', () => {
  it('lists the last 48 hours, in English and translated French, escaped', () => {
    const xml = newsSitemapXml(
      [
        { slug: 'gta-out', title: 'GTA VI is out & it’s <big>', publishedAt: '2026-11-18T11:00:00Z', frTitle: 'GTA VI est sorti' },
        { slug: 'not-translated', title: 'Fresh', publishedAt: '2026-11-17T09:00:00Z' },
        { slug: 'too-old', title: 'Old', publishedAt: '2026-11-15T09:00:00Z', frTitle: 'Vieux' },
        { slug: 'future', title: 'Scheduled', publishedAt: '2026-11-19T09:00:00Z' },
      ],
      'https://akavish.gg',
      now,
    )
    expect(xml).toContain('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"')
    expect(xml).toContain('<loc>https://akavish.gg/article/gta-out</loc>')
    expect(xml).toContain('<loc>https://akavish.gg/fr/article/gta-out</loc>')
    expect(xml).toContain('<news:language>fr</news:language>')
    expect(xml).toContain('<news:title>GTA VI is out &amp; it’s &lt;big&gt;</news:title>')
    expect(xml).toContain('<news:publication_date>2026-11-18T11:00:00.000Z</news:publication_date>')
    expect(xml).toContain('/article/not-translated')
    expect(xml).not.toContain('/fr/article/not-translated')
    expect(xml).not.toContain('too-old')
    expect(xml).not.toContain('future')
    expect(xml.match(/<url>/g)).toHaveLength(3)
  })
})
