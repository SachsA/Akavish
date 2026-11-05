import { describe, expect, it } from 'vitest'
import { countWords, readingTimeLabel, readingTimeMinutes } from './reading-time'

/** Build serialised Lexical content with one paragraph per string. */
function lexical(...paragraphs: string[]): string {
  return JSON.stringify({
    root: {
      type: 'root',
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        children: [{ type: 'text', text }],
      })),
    },
  })
}

const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ')

describe('countWords', () => {
  it('counts words across nested nodes', () => {
    expect(countWords(lexical('hello world', 'third'))).toBe(3)
  })

  it('does not glue words from adjacent nodes together', () => {
    // "end" and "start" sit in separate nodes; they must count as two words.
    expect(countWords(lexical('the end', 'start here'))).toBe(4)
  })

  it('returns 0 for invalid or empty content', () => {
    expect(countWords('not json')).toBe(0)
    expect(countWords('null')).toBe(0)
    expect(countWords(lexical())).toBe(0)
  })
})

describe('readingTimeMinutes', () => {
  it('is 0 when there is nothing to read', () => {
    expect(readingTimeMinutes(lexical())).toBe(0)
  })

  it('never says 0 minutes for a short piece', () => {
    expect(readingTimeMinutes(lexical('three short words'))).toBe(1)
  })

  it('uses ~220 words per minute', () => {
    expect(readingTimeMinutes(lexical(words(440)))).toBe(2)
    expect(readingTimeMinutes(lexical(words(1100)))).toBe(5)
  })
})

describe('readingTimeLabel', () => {
  it('formats the byline label', () => {
    expect(readingTimeLabel(lexical(words(660)))).toBe('3 min read')
  })

  it('is empty when there is no content, so the byline hides it', () => {
    expect(readingTimeLabel(lexical())).toBe('')
  })
})
