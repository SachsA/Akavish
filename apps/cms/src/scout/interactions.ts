// ─── Discord interactions (step 2) ───────────────────────────────────────────
// POST /api/scout/discord: Discord calls it when you click a button, pick in
// the menu or submit a form. Every request is signature-checked; only the
// owner's clicks are accepted. Discord wants an answer within 3 seconds, so
// anything that calls the model (a draft, a revision) is queued as a
// `scoutDraft` job and answered right away.

import type { Payload, PayloadHandler } from 'payload'
import type { SettingsDoc, StoryDoc } from './context'
import { draftStory, NO_COVER, publishStory, rejectStory, setStoryImage } from './draft'
import {
  closedMessage,
  COLORS,
  ephemeral,
  InteractionType,
  modal,
  modalValues,
  ResponseType,
  verifyDiscordSignature,
  type Embed,
} from './discord-bot'
import { readCommand } from './discord-commands'
import {
  addNote,
  liveStatus,
  publishLive,
  publishRecap,
  rejectRecap,
  setLiveImage,
  startLive,
  stopLive,
  undoLive,
} from './live'
import { gatherReport, reportText } from './report'
import { makeContext } from './run'

interface Interaction {
  type: number
  data?: {
    custom_id?: string
    values?: string[]
    components?: Array<{ components?: Array<{ custom_id?: string; value?: string }> }>
    // Slash commands
    name?: string
    options?: Array<{ name: string; options?: Array<{ name: string; value?: unknown }> }>
  }
  member?: { user?: { id?: string } }
  user?: { id?: string }
  message?: { embeds?: Embed[] }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Queue a draft or a revision and start it now rather than at the next minute's tick. */
async function queueDraft(payload: Payload, storyId: number, feedback?: string, imageUrl?: string) {
  const job = (await payload.jobs.queue({
    task: 'scoutDraft' as never,
    input: {
      storyId,
      ...(feedback ? { feedback } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    } as never,
    queue: 'scout',
  })) as { id: number | string }
  void payload.jobs.runByID({ id: job.id }).catch(() => {
    // Left in the queue: the per-minute autoRun picks it up.
  })
}

export async function handleInteraction(
  payload: Payload,
  raw: string,
  headers: Headers,
): Promise<Response> {
  const ctx = makeContext(payload)
  const bot = ctx.config.bot
  if (!bot) return json({ error: 'bot not configured' }, 404)
  if (
    !verifyDiscordSignature(
      bot.publicKey,
      headers.get('x-signature-ed25519'),
      headers.get('x-signature-timestamp'),
      raw,
    )
  ) {
    return json({ error: 'invalid request signature' }, 401)
  }

  let i: Interaction
  try {
    i = JSON.parse(raw) as Interaction
  } catch {
    return json({ error: 'bad json' }, 400)
  }
  // Discord checks the endpoint with a PING when you save its URL.
  if (i.type === InteractionType.PING) return json({ type: ResponseType.PONG })

  const userId = i.member?.user?.id ?? i.user?.id
  if (userId !== bot.ownerId)
    return json(ephemeral('Seul l’éditeur d’Akavish peut valider les brouillons.'))

  // ── /live slash commands (event mode, live.ts) ──
  if (i.type === InteractionType.COMMAND) {
    const { command, sub, args } = readCommand(i.data)
    if (command !== 'live') return json(ephemeral('Commande inconnue.'))
    try {
      const answer =
        sub === 'start'
          ? await startLive(ctx, args.nom ?? 'Live', args.image || undefined)
          : sub === 'add'
            ? await addNote(ctx, args.texte ?? '')
            : sub === 'image'
              ? /^https:\/\/\S+$/i.test(args.url ?? '')
                ? await setLiveImage(ctx, args.url)
                : 'L’image doit être une URL en https://…'
              : sub === 'stop'
                ? await stopLive(ctx)
                : await liveStatus(ctx)
      return json(ephemeral(answer))
    } catch (err) {
      return json(
        ephemeral(`Ça n’a pas marché : ${err instanceof Error ? err.message : String(err)}`),
      )
    }
  }

  const [ns, action, idRaw, extra] = (i.data?.custom_id ?? '').split(':')
  if (ns !== 'scout') return json(ephemeral('Action inconnue.'))
  const storyId = Number(idRaw)
  const original = i.message ?? {}

  try {
    // ── Buttons ──
    if (i.type === InteractionType.COMPONENT && action === 'publish') {
      let url: string
      try {
        url = await publishStory(ctx, storyId)
      } catch (err) {
        if (err instanceof Error && err.message === NO_COVER) {
          return json(
            ephemeral(
              'Pas d’image sur cet article, je ne publie pas. **Modifier** → colle l’URL d’une image officielle (ou ajoute-la dans /admin), puis Publier.',
            ),
          )
        }
        throw err
      }
      return json({
        type: ResponseType.UPDATE_MESSAGE,
        data: closedMessage(original, `Publié · ${url}`, COLORS.published),
      })
    }
    if (i.type === InteractionType.COMPONENT && action === 'edit') {
      return json(
        modal(`scout:editmodal:${storyId}`, 'Modifier le brouillon', [
          {
            id: 'text',
            label: 'Qu’est-ce qui ne va pas ?',
            required: false,
            placeholder: 'Trop long, le titre spoile, ajoute le prix… (vide = image seule)',
          },
          {
            id: 'image',
            label: 'Image (URL officielle, facultatif)',
            required: false,
            placeholder: 'https://… visuel officiel (éditeur, studio, organisateur)',
            short: true,
          },
        ]),
      )
    }
    if (i.type === InteractionType.COMPONENT && action === 'reject') {
      return json(
        modal(`scout:rejectmodal:${storyId}`, 'Rejeter le sujet', [
          {
            id: 'text',
            label: 'Pourquoi ? (facultatif)',
            required: false,
            placeholder: 'Doublon, pas intéressant, source pas fiable…',
          },
        ]),
      )
    }
    // ── Event mode buttons ──
    if (i.type === InteractionType.COMPONENT && action === 'evpub') {
      try {
        const url = await publishLive(ctx, storyId)
        return json({
          type: ResponseType.UPDATE_MESSAGE,
          data: closedMessage(
            original,
            `Live publié · ${url} · les mises à jour partent seules`,
            COLORS.published,
          ),
        })
      } catch (err) {
        if (err instanceof Error && err.message === NO_COVER) {
          return json(
            ephemeral('Pas d’image sur le live : /live image <url officielle>, puis Publier.'),
          )
        }
        throw err
      }
    }
    if (i.type === InteractionType.COMPONENT && action === 'evstop') {
      return json(ephemeral(await stopLive(ctx)))
    }
    if (i.type === InteractionType.COMPONENT && action === 'evundo') {
      await undoLive(ctx, storyId, Number(extra))
      return json({
        type: ResponseType.UPDATE_MESSAGE,
        data: { content: '↩️ Mise à jour annulée.', components: [] },
      })
    }
    if (i.type === InteractionType.COMPONENT && action === 'evrecap') {
      try {
        const url = await publishRecap(ctx, storyId)
        return json({
          type: ResponseType.UPDATE_MESSAGE,
          data: closedMessage(original, `Résumé publié · ${url}`, COLORS.published),
        })
      } catch (err) {
        if (err instanceof Error && err.message === NO_COVER) {
          return json(ephemeral('Pas d’image sur le résumé : ajoute-la dans /admin, puis Publier.'))
        }
        throw err
      }
    }
    if (i.type === InteractionType.COMPONENT && action === 'evrecapno') {
      await rejectRecap(ctx, storyId)
      return json({
        type: ResponseType.UPDATE_MESSAGE,
        data: closedMessage(original, 'Résumé rejeté, brouillon supprimé.', COLORS.rejected),
      })
    }
    // ── "Write one of these" menu under a digest ──
    if (i.type === InteractionType.COMPONENT && action === 'pick') {
      const picked = Number(i.data?.values?.[0])
      const story = (await payload.findByID({
        collection: 'scout-stories',
        id: picked,
        depth: 0,
        overrideAccess: true,
      })) as unknown as StoryDoc
      await queueDraft(payload, picked)
      return json(
        ephemeral(
          `Brouillon en cours pour « ${story.title} ». Il arrive ici d’ici une minute ou deux.`,
        ),
      )
    }

    // ── Forms ──
    const values = modalValues(i.data)
    const text = values.text ?? ''
    if (i.type === InteractionType.MODAL_SUBMIT && action === 'editmodal') {
      const image = values.image ?? ''
      if (!text && !image) {
        return json(ephemeral('Rien à changer : écris un retour ou colle une URL d’image.'))
      }
      if (image && !/^https:\/\/\S+$/i.test(image)) {
        return json(ephemeral('L’image doit être une URL en https://…'))
      }
      await queueDraft(payload, storyId, text || undefined, image || undefined)
      const asked = [text ? `révision « ${text} »` : '', image ? 'nouvelle image' : '']
        .filter(Boolean)
        .join(' + ')
      return json({
        type: ResponseType.UPDATE_MESSAGE,
        data: closedMessage(
          original,
          `Demandé : ${asked}. La nouvelle version arrive en réponse.`,
          COLORS.working,
        ),
      })
    }
    if (i.type === InteractionType.MODAL_SUBMIT && action === 'rejectmodal') {
      await rejectStory(ctx, storyId, text)
      return json({
        type: ResponseType.UPDATE_MESSAGE,
        data: closedMessage(
          original,
          `Rejeté${text ? ` : ${text}` : ''}. Le brouillon est supprimé.`,
          COLORS.rejected,
        ),
      })
    }
  } catch (err) {
    payload.logger.error({
      msg: '[scout] interaction failed',
      action,
      storyId,
      error: err instanceof Error ? err.message : String(err),
    })
    return json(
      ephemeral(`Ça n’a pas marché : ${err instanceof Error ? err.message : String(err)}`),
    )
  }
  return json(ephemeral('Action inconnue.'))
}

export const discordInteractionsHandler: PayloadHandler = async (req) => {
  const raw = req.text ? await req.text() : ''
  return handleInteraction(req.payload, raw, req.headers)
}

/**
 * GET /api/scout/report?days=7: the weekly numbers as plain text (or JSON with
 * &format=json). Editors only: open it in the browser while logged into /admin.
 */
export const scoutReportHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return new Response('Connecte-toi à /admin d’abord, puis recharge cette page.', {
      status: 401,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
  const raw = Number(req.searchParams?.get('days'))
  const days = Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), 30) : 7
  const settings = (await req.payload.findGlobal({
    slug: 'scout-settings',
    overrideAccess: true,
  })) as unknown as SettingsDoc
  const report = await gatherReport(makeContext(req.payload), settings.threshold ?? 60, days)
  if (req.searchParams?.get('format') === 'json') return json(report)
  return new Response(reportText(report), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** The `scoutDraft` job: one draft or revision, reported on Discord if it fails. */
export async function runDraftJob(
  payload: Payload,
  input: { storyId: number; feedback?: string | null; imageUrl?: string | null },
) {
  const ctx = makeContext(payload)
  const settings = (await payload.findGlobal({
    slug: 'scout-settings',
    overrideAccess: true,
  })) as unknown as SettingsDoc
  try {
    if (input.imageUrl && !input.feedback) {
      // Image only: no model call, the text stays as it is.
      await setStoryImage(ctx, settings, Number(input.storyId), input.imageUrl)
    } else {
      await draftStory(ctx, settings, Number(input.storyId), input.feedback ?? undefined, {
        imageUrl: input.imageUrl ?? undefined,
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    payload.logger.error({ msg: '[scout] draft job failed', story: input.storyId, error: message })
    await ctx.notify({
      content: `**Scout** : le brouillon du sujet ${input.storyId} a échoué (${message}).`,
    })
  }
}
