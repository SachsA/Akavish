import { describe, expect, it } from 'vitest'
import { pushText } from './web-push'

const data = {
  t1: { name: 'NIP' },
  t2: { name: 'Liquid' },
  s1: 2,
  s2: 0,
  event: 'PGL Major Singapore 2026',
  stage: 'Stage 1',
}

describe('push notification text', () => {
  it('says a match started, in the subscription language', () => {
    expect(pushText('match_start', data, 'fr', false)).toEqual({
      title: 'NIP contre Liquid a commencé',
      body: 'PGL Major Singapore 2026 · Stage 1',
    })
    expect(pushText('match_start', data, 'en', false).title).toBe('NIP vs Liquid has started')
  })

  it('gives the score of a result, unless the reader hides scores', () => {
    expect(pushText('match_end', data, 'en', false).body).toBe(
      'NIP 2 – 0 Liquid · PGL Major Singapore 2026 · Stage 1',
    )
    const hidden = pushText('match_end', data, 'fr', true)
    expect(hidden.body).toBe('Score masqué · PGL Major Singapore 2026 · Stage 1')
    expect(JSON.stringify(hidden)).not.toContain('2 – 0')
  })

  it('names the teams of a news', () => {
    expect(
      pushText('article', { teams: ['Vitality'], title: 'Vitality sign a coach' }, 'fr', false),
    ).toEqual({
      title: 'Actu sur Vitality',
      body: 'Vitality sign a coach',
    })
  })
})
