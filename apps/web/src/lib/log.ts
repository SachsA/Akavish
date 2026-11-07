// Structured server logs: one JSON object per line, so Vercel's log search can
// filter on fields (`level`, `msg`, `route`, `status`…) instead of grepping prose.
// Server-side only. Errors meant for alerting still go to Sentry; these are for
// the "what happened around 14:02?" questions.

type Level = 'info' | 'warn' | 'error'
type Fields = Record<string, unknown>

function write(level: Level, msg: string, fields: Fields = {}) {
  // `next build` renders pages while the CMS is usually unreachable (CI): that's
  // expected and already handled, don't flood the build output.
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  const entry: Fields = { level, msg, time: new Date().toISOString(), ...fields }
  if (entry.error instanceof Error) entry.error = entry.error.message
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const log = {
  info: (msg: string, fields?: Fields) => write('info', msg, fields),
  warn: (msg: string, fields?: Fields) => write('warn', msg, fields),
  error: (msg: string, fields?: Fields) => write('error', msg, fields),
}
