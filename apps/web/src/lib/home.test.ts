import { describe, expect, it } from 'vitest'
import type { Article } from '@akavish/types'
import { pickLead } from './home'

const a = (id: string) => ({ id, title: id }) as Article

describe('pickLead', () => {
  it('uses the newest article when nothing is featured', () => {
    expect(pickLead([a('1'), a('2'), a('3')], null)).toEqual({ lead: a('1'), others: [a('2'), a('3')] })
  })

  it("puts the editor's pick first and doesn't repeat it below", () => {
    expect(pickLead([a('1'), a('2'), a('3')], a('2'))).toEqual({ lead: a('2'), others: [a('1'), a('3')] })
  })

  it('accepts a featured article older than the whole feed', () => {
    expect(pickLead([a('1'), a('2')], a('9'))).toEqual({ lead: a('9'), others: [a('1'), a('2')] })
  })

  it('handles an empty site', () => {
    expect(pickLead([], null)).toEqual({ lead: undefined, others: [] })
  })
})
