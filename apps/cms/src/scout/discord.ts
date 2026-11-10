// ─── Discord (webhook) ───────────────────────────────────────────────────────
// Step 1 only posts: a webhook on the private #scout-news channel is enough.
// The bot with buttons (Publish / Edit / Reject) arrives with step 2.
// Message building is pure and unit-tested; `postToDiscord` does the I/O.

import type { FetchLike } from './anthropic'

export interface DigestStory {
  title: string
  score: number
  category?: string | null
  game?: string | null
  sourceNames: string[]
  url?: string
}

interface Embed {
  title: string
  url?: string
  description: string
  color: number
}

export interface DiscordMessage {
  content?: string
  embeds?: Embed[]
}

// Discord limits: 10 embeds per message, 256 characters per embed title.
const EMBEDS_PER_MESSAGE = 10
const MAX_STORIES = 30
const GREEN = 0x10b981
const GREY = 0x52525b

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/**
 * The 8 am / 8 pm digest: stories since the previous one, best score first.
 * Above the threshold = green (these will get a draft from step 2 on).
 */
export function digestMessages(
  slot: 'morning' | 'evening',
  stories: DigestStory[],
  threshold: number,
): DiscordMessage[] {
  const when = slot === 'morning' ? 'du matin (8 h)' : 'du soir (20 h)'
  if (stories.length === 0) {
    return [
      { content: `**Scout, résumé ${when}** : aucun nouveau sujet depuis le dernier résumé.` },
    ]
  }

  const sorted = [...stories].sort((a, b) => b.score - a.score)
  const shown = sorted.slice(0, MAX_STORIES)
  const above = sorted.filter((s) => s.score >= threshold).length
  const header =
    `**Scout, résumé ${when}** : ${stories.length} sujet${stories.length > 1 ? 's' : ''}, ` +
    `dont ${above} au-dessus du seuil (${threshold}).` +
    (sorted.length > shown.length
      ? ` Les ${shown.length} meilleurs ci-dessous, le reste dans /admin.`
      : '')

  const embeds: Embed[] = shown.map((s) => {
    const tags = [s.category, s.game].filter(Boolean).join(' · ')
    const sources = s.sourceNames.length
      ? `${s.sourceNames.length} source${s.sourceNames.length > 1 ? 's' : ''} : ${clip(s.sourceNames.join(', '), 300)}`
      : ''
    return {
      title: clip(`${s.score} · ${s.title}`, 256),
      ...(s.url ? { url: s.url } : {}),
      description: [tags, sources].filter(Boolean).join('\n') || '—',
      color: s.score >= threshold ? GREEN : GREY,
    }
  })

  const messages: DiscordMessage[] = []
  for (let i = 0; i < embeds.length; i += EMBEDS_PER_MESSAGE) {
    messages.push({
      ...(i === 0 ? { content: header } : {}),
      embeds: embeds.slice(i, i + EMBEDS_PER_MESSAGE),
    })
  }
  return messages
}

/** Post to the webhook. No mentions can ever ping anyone. */
export async function postToDiscord(
  webhook: string,
  message: DiscordMessage,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const res = await fetchImpl(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'Akavish Scout',
      allowed_mentions: { parse: [] },
      ...message,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    throw new Error(
      `Discord webhook ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`,
    )
  }
}
