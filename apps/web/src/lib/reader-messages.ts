// What a reader reads when the CMS refuses something (codes from
// apps/cms/src/lib/readers.ts and comments.ts). Client-safe.

import { messagesFor } from './i18n/messages'
import type { Locale } from './i18n/config'

/** English, kept for the API's `message` field (the mobile app shows it). */
export const READER_MESSAGES: Record<string, string> = messagesFor('en').readerMessages

/** The sentence for a refusal code, in the page's language; unknown → "unavailable". */
export function readerMessage(code: string | undefined, locale: Locale = 'en'): string {
  const all = messagesFor(locale).readerMessages
  return (code && all[code]) || all.unavailable
}
