import { describe, expect, it } from 'vitest'
import { isGamingItem } from './default-sources'
import { normalizeUrl, parseFeed, stripHtml } from './feeds'

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>Outlet</title>
<item>
  <title><![CDATA[GTA 6 gets a <b>new</b> trailer &amp; date]]></title>
  <link>https://outlet.example/gta-6?utm_source=rss&amp;id=4#comments</link>
  <description><![CDATA[<p>Rockstar <em>finally</em> shows more.</p><script>x()</script>]]></description>
  <pubDate>Mon, 09 Nov 2026 15:37:00 +0000</pubDate>
</item>
<item>
  <title>No link, guid permalink</title>
  <guid isPermaLink="true">https://outlet.example/guid-only</guid>
</item>
<item><title>Broken link</title><link>javascript:alert(1)</link></item>
</channel></rss>`

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title>
<entry>
  <title type="html">Valve &lt;3 Half-Life</title>
  <link rel="alternate" href="https://atom.example/hl3"/>
  <link rel="replies" href="https://atom.example/hl3/comments"/>
  <summary>Rumour time.</summary>
  <updated>2026-11-10T08:00:00Z</updated>
</entry>
<entry><title>Single link</title><link href="https://atom.example/one"/></entry>
</feed>`

describe('parseFeed', () => {
  it('reads RSS 2.0: CDATA, entities, markup and tracking params removed', () => {
    const items = parseFeed(RSS)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      title: 'GTA 6 gets a new trailer & date',
      url: 'https://outlet.example/gta-6?id=4',
      summary: 'Rockstar finally shows more.',
    })
    expect(items[0].publishedAt?.toISOString()).toBe('2026-11-09T15:37:00.000Z')
    expect(items[1]).toMatchObject({
      title: 'No link, guid permalink',
      url: 'https://outlet.example/guid-only',
    })
  })

  it('reads Atom: the alternate link, not the comments one', () => {
    const items = parseFeed(ATOM)
    expect(items.map((i) => i.url)).toEqual([
      'https://atom.example/hl3',
      'https://atom.example/one',
    ])
    expect(items[0].title).toBe('Valve <3 Half-Life')
    expect(items[0].publishedAt?.toISOString()).toBe('2026-11-10T08:00:00.000Z')
  })

  it('returns nothing for something that is not a feed', () => {
    expect(parseFeed('<html><body>nope</body></html>')).toEqual([])
    expect(parseFeed('not xml at all <<<')).toEqual([])
  })
})

describe('normalizeUrl / stripHtml', () => {
  it('drops fragments and tracking parameters, keeps real ones', () => {
    expect(normalizeUrl('https://a.example/x?utm_medium=feed&page=2&fbclid=1#top')).toBe(
      'https://a.example/x?page=2',
    )
    expect(normalizeUrl('ftp://a.example/x')).toBeNull()
    expect(normalizeUrl('not a url')).toBeNull()
  })

  it('turns HTML into plain text', () => {
    expect(stripHtml('<p>Tom&#39;s &eacute;dition &#x263A;</p>  <br/>ok')).toBe(
      "Tom's édition ☺ ok",
    )
  })
})

describe('isGamingItem (general outlets)', () => {
  it('keeps games stories and drops the rest', () => {
    expect(isGamingItem('Embracer to split into three companies')).toBe(true)
    expect(isGamingItem('Ubisoft shares fall after delay')).toBe(true)
    expect(isGamingItem('Le marché du jeu vidéo recule en France')).toBe(true)
    expect(isGamingItem("Vietnam's cheap coffee may lose its edge")).toBe(false)
    expect(isGamingItem('Nvidia built itself around one man')).toBe(false)
  })
})
