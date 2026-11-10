// ─── Discord bot (step 2) ────────────────────────────────────────────────────
// The bot posts drafts with buttons and receives the clicks on an HTTP
// endpoint (`/api/scout/discord`, "Interactions Endpoint URL" in the Discord
// developer portal): no always-on gateway connection. Message building and
// signature checking are pure and unit-tested; the REST calls are thin.

import { createPublicKey, verify } from 'node:crypto'
import type { FetchLike } from './anthropic'
import type { DiscordBotConfig } from './config'

const API = 'https://discord.com/api/v10'

// Discord constants (developer docs: interactions, message components).
export const InteractionType = { PING: 1, COMPONENT: 3, MODAL_SUBMIT: 5 } as const
export const ResponseType = { PONG: 1, MESSAGE: 4, UPDATE_MESSAGE: 7, MODAL: 9 } as const
const EPHEMERAL = 64
const Button = { PRIMARY: 1, SUCCESS: 3, DANGER: 4, LINK: 5 } as const

// ─── Signature ───────────────────────────────────────────────────────────────

// DER prefix of an Ed25519 SubjectPublicKeyInfo: Node wants the key in that
// envelope, Discord gives the raw 32 bytes in hex.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

/** Whether a request really comes from Discord (Ed25519 over timestamp + body). */
export function verifyDiscordSignature(
  publicKeyHex: string,
  signatureHex: string | null,
  timestamp: string | null,
  rawBody: string,
): boolean {
  if (!signatureHex || !timestamp || !/^[0-9a-f]{128}$/i.test(signatureHex)) return false
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, 'hex')]),
      format: 'der',
      type: 'spki',
    })
    return verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signatureHex, 'hex'))
  } catch {
    return false
  }
}

// ─── Messages ────────────────────────────────────────────────────────────────

export interface Embed {
  title?: string
  url?: string
  description?: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  footer?: { text: string }
}

export interface BotMessage {
  content?: string
  embeds?: Embed[]
  components?: unknown[]
}

export const COLORS = {
  draft: 0x3b82f6,
  published: 0x10b981,
  rejected: 0x52525b,
  working: 0xf59e0b,
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export interface DraftCard {
  storyId: number
  articleId: number | string
  version: number
  score: number
  title: string
  excerpt: string
  body: string
  category: string
  sources: Array<{ name: string; url: string }>
  adminUrl: string
  feedback?: string
}

/** A draft with its three buttons and a link to the admin. */
export function draftMessage(card: DraftCard): BotMessage {
  const sources = card.sources.map((s) => `[${s.name}](${s.url})`).join(' · ')
  return {
    ...(card.feedback
      ? { content: `**V${card.version}** après ton retour : « ${clip(card.feedback, 300)} »` }
      : {}),
    embeds: [
      {
        title: clip(card.title, 256),
        url: card.adminUrl,
        description: clip(`*${card.excerpt}*\n\n${card.body}`, 4000),
        color: COLORS.draft,
        fields: [
          { name: 'Score', value: String(card.score), inline: true },
          { name: 'Catégorie', value: card.category, inline: true },
          { name: 'Version', value: `V${card.version}`, inline: true },
          ...(sources ? [{ name: 'Sources', value: clip(sources, 1024) }] : []),
        ],
        footer: { text: 'Brouillon du scout · rien n’est publié sans ton clic' },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: Button.SUCCESS,
            label: 'Publier',
            custom_id: `scout:publish:${card.storyId}`,
          },
          {
            type: 2,
            style: Button.PRIMARY,
            label: 'Modifier',
            custom_id: `scout:edit:${card.storyId}`,
          },
          {
            type: 2,
            style: Button.DANGER,
            label: 'Rejeter',
            custom_id: `scout:reject:${card.storyId}`,
          },
          { type: 2, style: Button.LINK, label: 'Ouvrir dans /admin', url: card.adminUrl },
        ],
      },
    ],
  }
}

/** The same message after a decision: recoloured, a status line, no buttons. */
export function closedMessage(
  original: { embeds?: Embed[] },
  status: string,
  color: number,
): BotMessage {
  const embed = original.embeds?.[0] ?? {}
  return {
    embeds: [{ ...embed, color, footer: { text: clip(status, 2000) } }],
    components: [],
  }
}

/** Menu under a digest: pick a story below the threshold to get a draft anyway. */
export function pickMenu(stories: Array<{ id: number; score: number; title: string }>): unknown[] {
  if (stories.length === 0) return []
  return [
    {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: 'scout:pick',
          placeholder: 'Rédiger un de ces sujets…',
          options: stories.slice(0, 25).map((s) => ({
            label: clip(`${s.score} · ${s.title}`, 100),
            value: String(s.id),
          })),
        },
      ],
    },
  ]
}

/** A modal with one paragraph input. */
export function modal(
  customId: string,
  title: string,
  label: string,
  required: boolean,
  placeholder: string,
) {
  return {
    type: ResponseType.MODAL,
    data: {
      custom_id: customId,
      title: clip(title, 45),
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'text',
              style: 2,
              label: clip(label, 45),
              required,
              max_length: 1000,
              placeholder: clip(placeholder, 100),
            },
          ],
        },
      ],
    },
  }
}

export const ephemeral = (content: string) => ({
  type: ResponseType.MESSAGE,
  data: { content, flags: EPHEMERAL, allowed_mentions: { parse: [] } },
})

// ─── REST ────────────────────────────────────────────────────────────────────

async function call(
  bot: DiscordBotConfig,
  fetchImpl: FetchLike,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bot ${bot.token}`,
      'content-type': 'application/json',
      'user-agent': 'DiscordBot (https://akavish.gg, 1.0)',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok)
    throw new Error(
      `Discord ${method} ${path.split('/')[1]} ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`,
    )
  return res.status === 204 ? null : ((await res.json()) as Record<string, unknown>)
}

/** Post to the scout channel; returns the message id. */
export async function sendBotMessage(
  bot: DiscordBotConfig,
  message: BotMessage & { replyTo?: string },
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const { replyTo, ...rest } = message
  const res = await call(bot, fetchImpl, 'POST', `/channels/${bot.channelId}/messages`, {
    ...rest,
    allowed_mentions: { parse: [] },
    ...(replyTo ? { message_reference: { message_id: replyTo, fail_if_not_exists: false } } : {}),
  })
  return String(res?.id ?? '')
}

export async function editBotMessage(
  bot: DiscordBotConfig,
  messageId: string,
  message: BotMessage,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  await call(bot, fetchImpl, 'PATCH', `/channels/${bot.channelId}/messages/${messageId}`, message)
}
