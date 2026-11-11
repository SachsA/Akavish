import { describe, expect, it } from 'vitest'
import { extractShareImage, extractYouTubeIds } from './extract'

describe('extractShareImage', () => {
  it('reads og:image, attributes in either order, relative URLs resolved', () => {
    expect(
      extractShareImage(
        '<head><meta property="og:image" content="https://cdn.example/a.jpg?w=1&amp;h=2"></head>',
        'https://site.example/news/x',
      ),
    ).toBe('https://cdn.example/a.jpg?w=1&h=2')
    expect(
      extractShareImage(
        '<meta content="/img/b.png" name="twitter:image">',
        'https://site.example/x',
      ),
    ).toBe('https://site.example/img/b.png')
  })

  it('prefers secure_url, skips http, and is null without a tag', () => {
    expect(
      extractShareImage(
        '<meta property="og:image" content="http://cdn.example/a.jpg"><meta property="og:image:secure_url" content="https://cdn.example/s.jpg">',
        'https://site.example',
      ),
    ).toBe('https://cdn.example/s.jpg')
    expect(
      extractShareImage(
        '<meta property="og:image" content="http://cdn.example/a.jpg">',
        'https://site.example',
      ),
    ).toBeNull()
    expect(extractShareImage('<p>nothing</p>', 'https://site.example')).toBeNull()
  })
})

describe('extractYouTubeIds', () => {
  it('finds embeds, watch, shorts and youtu.be links in the article only, once each', () => {
    const html = `<aside><a href="https://youtu.be/SIDEBAR0001">x</a></aside>
      <article>
        <iframe src="https://www.youtube-nocookie.com/embed/QdBZY2fkU-0?rel=0"></iframe>
        <a href="https://www.youtube.com/watch?feature=share&amp;v=_yl5ELcmugI">trailer</a>
        <a href="https://youtube.com/shorts/abcdefghijk">short</a>
        <a href="https://youtu.be/QdBZY2fkU-0">again</a>
      </article>`
    expect(extractYouTubeIds(html)).toEqual(['QdBZY2fkU-0', '_yl5ELcmugI', 'abcdefghijk'])
  })

  it('is empty without videos', () => {
    expect(extractYouTubeIds('<article><p>text</p></article>')).toEqual([])
  })
})
