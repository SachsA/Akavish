import { describe, expect, it } from 'vitest'
import { RESTORE_SPOILERS, resolveSpoilers } from './spoilers'

describe('anti-spoil mode', () => {
  it("this visit's choice, then the default, then shown", () => {
    expect(resolveSpoilers('hide', 'show')).toBe('hide')
    expect(resolveSpoilers(null, 'hide')).toBe('hide')
    expect(resolveSpoilers('junk', 'show')).toBe('show')
    expect(resolveSpoilers(null, null)).toBe('show')
  })

  it('the inline script follows the same rule', () => {
    const run = (visit: string | null, def: string | null) => {
      const html = { dataset: {} as Record<string, string> }
      const store = (v: string | null) => ({ getItem: () => v })
      new Function('sessionStorage', 'localStorage', 'document', RESTORE_SPOILERS)(
        store(visit),
        store(def),
        {
          documentElement: html,
        },
      )
      return html.dataset.spoilers
    }
    expect(run('show', 'hide')).toBe('show')
    expect(run(null, 'hide')).toBe('hide')
    expect(run(null, null)).toBe('show')
  })
})
