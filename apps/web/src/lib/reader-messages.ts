// What a reader reads when the CMS refuses something (codes from
// apps/cms/src/lib/readers.ts and comments.ts). Client-safe.

export const READER_MESSAGES: Record<string, string> = {
  unverified: 'Verify your email address first (Manage account, in your avatar menu).',
  banned: 'Your account can no longer take part.',
  'too-new': 'New accounts can comment 10 minutes after signing up.',
  'slow-down': 'Slow down: one comment every 30 seconds.',
  'daily-limit': 'That’s 30 comments today, the daily limit. See you tomorrow.',
  duplicate: 'You already posted that.',
  closed: 'Comments are closed on this article.',
  disabled: 'Comments are switched off for now.',
  empty: 'Write something first.',
  'too-long': 'Keep it under 2,000 characters.',
  own: 'That’s your own comment.',
  forbidden: 'You can’t do that.',
  'not-found': 'This comment or article is gone.',
  'reply-target': 'That comment can’t be answered any more.',
  'bad-reason': 'Pick a reason.',
  unavailable: 'This is unavailable right now. Please try again in a moment.',
  'signed-out': 'Sign in first.',
  'rate-limited': 'Too many requests, slow down.',
}

export function readerMessage(code: string | undefined): string {
  return (code && READER_MESSAGES[code]) || READER_MESSAGES.unavailable
}
