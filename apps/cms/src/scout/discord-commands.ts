// ─── Discord slash commands ──────────────────────────────────────────────────
// `/live …` for event mode (live.ts). Registered (overwritten) as global
// commands of the bot when the CMS starts with the scout and the bot set up;
// Discord sends them to the same interactions endpoint as the buttons.

import type { FetchLike } from './anthropic'
import type { DiscordBotConfig } from './config'

const STRING = 3
const SUB = 1

export const LIVE_COMMAND = {
  name: 'live',
  description: 'Mode événement du scout Akavish',
  type: 1,
  options: [
    {
      type: SUB,
      name: 'start',
      description: 'Lancer un live (une page mise à jour pendant le show)',
      options: [
        {
          type: STRING,
          name: 'nom',
          description: "Nom de l'événement",
          required: true,
          max_length: 100,
        },
        {
          type: STRING,
          name: 'image',
          description: 'URL d’une image officielle (facultatif)',
          required: false,
        },
      ],
    },
    {
      type: SUB,
      name: 'add',
      description: 'Ce qui vient d’être annoncé, avec les liens',
      options: [
        {
          type: STRING,
          name: 'texte',
          description: 'Annonce + liens, ou « #3 … » pour corriger ou compléter l’annonce 3',
          required: true,
          max_length: 1500,
        },
      ],
    },
    {
      type: SUB,
      name: 'image',
      description: 'Image officielle de la page live',
      options: [{ type: STRING, name: 'url', description: 'URL https de l’image', required: true }],
    },
    { type: SUB, name: 'stop', description: 'Terminer le live et lancer le résumé' },
    { type: SUB, name: 'status', description: 'Où en est le live' },
  ],
} as const

/** Overwrite the bot's global commands with ours. */
export async function registerCommands(bot: DiscordBotConfig, fetchImpl: FetchLike = fetch) {
  const res = await fetchImpl(
    `https://discord.com/api/v10/applications/${bot.applicationId}/commands`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bot ${bot.token}`,
        'content-type': 'application/json',
        'user-agent': 'DiscordBot (https://akavish.gg, 1.0)',
      },
      body: JSON.stringify([LIVE_COMMAND]),
      signal: AbortSignal.timeout(15_000),
    },
  )
  if (!res.ok)
    throw new Error(`Discord commands ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/** The subcommand and its options from an APPLICATION_COMMAND interaction. Pure. */
export function readCommand(data?: {
  name?: string
  options?: Array<{ name: string; options?: Array<{ name: string; value?: unknown }> }>
}): { command: string; sub: string; args: Record<string, string> } {
  const sub = data?.options?.[0]
  const args: Record<string, string> = {}
  for (const o of sub?.options ?? [])
    if (o.value !== undefined) args[o.name] = String(o.value).trim()
  return { command: data?.name ?? '', sub: sub?.name ?? '', args }
}
