import { describe, expect, it } from 'vitest'
import { breadcrumbList, serializeJsonLd } from './structured-data'
import { SITE_URL } from './site'

describe('breadcrumbList', () => {
  it('starts at Home and numbers the items from 1 with absolute URLs', () => {
    const list = breadcrumbList([
      { name: 'Reviews', path: '/reviews' },
      { name: 'Neon Drift review', path: '/article/neon-drift-review' },
    ])
    expect(list['@type']).toBe('BreadcrumbList')
    expect(list.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Akavish', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Reviews', item: `${SITE_URL}/reviews` },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Neon Drift review',
        item: `${SITE_URL}/article/neon-drift-review`,
      },
    ])
  })
})

describe('serializeJsonLd', () => {
  it('cannot be used to close the script tag', () => {
    const out = serializeJsonLd({ headline: 'Bad </script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(JSON.parse(out)).toEqual({ headline: 'Bad </script><script>alert(1)</script>' })
  })
})
