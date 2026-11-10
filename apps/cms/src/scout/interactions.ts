// ─── Discord interactions (step 2) ───────────────────────────────────────────
// POST /api/scout/discord: Discord calls it when you click a button, pick in
// the menu or submit a form. Every request is signature-checked; only the
// owner's clicks are accepted. Discord wants an answer within 3 seconds, so
// anything that calls the model (a draft, a revision) is queued as a
// `scoutDraft` job and answered right away.

import type { Payload, PayloadHandler } from 'payload'
import type { SettingsDoc, StoryDoc } from './context'
import { draftStory, publishStory, rejectStory } from './draft'
import {
  closedMessage,
  COLORS,
  ephemeral,
  InteractionType,
  modal,
  ResponseType,
  verifyDiscordSignature,
  type Embed,
} from './discord-bot'
import { gatherReport, reportText } from './report'
import { makeContext } from './run'

interface Interaction {
  type: number
  data?: {
    custom_id?: string
    values?: string[]
    components?: Array<{ components?: Array<{ custom_id?: string; value?: string }> }>
  }
  member?: { user?: { id?: string } }
  user?: { id?: string }
  message?: { embeds?: Embed[] }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Queue a draft or a revision and start it now rather than at the next minute's tick. */
async function queueDraft(payload: Payload, storyId: number, feedback?: string) {
  const job = (await payload.jobs.queue({
    task: 'scoutDraft' as never,
    input: { storyId, ...(feedback ? { feedback } : {}) } as never,
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

  const [ns, action, idRaw] = (i.data?.custom_id ?? '').split(':')
  if (ns !== 'scout') return json(ephemeral('Action inconnue.'))
  const storyId = Number(idRaw)
  const original = i.message ?? {}

  try {
    // ── Buttons ──
    if (i.type === InteractionType.COMPONENT && action === 'publish') {
      const url = await publishStory(ctx, storyId)
      return json({
        type: ResponseType.UPDATE_MESSAGE,
        data: closedMessage(original, `Publié · ${url}`, COLORS.published),
      })
    }
    if (i.type === InteractionType.COMPONENT && action === 'edit') {
      return json(
        modal(
          `scout:editmodal:${storyId}`,
          'Modifier le brouillon',
          'Qu’est-ce qui ne va pas ?',
          true,
          'Trop long, le titre spoile, ajoute le prix…',
        ),
      )
    }
    if (i.type === InteractionType.COMPONENT && action === 'reject') {
      return json(
        modal(
          `scout:rejectmodal:${storyId}`,
          'Rejeter le sujet',
          'Pourquoi ? (facultatif)',
          false,
          'Doublon, pas intéressant, source pas fiable…',
        ),
      )
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
    const text = i.data?.components?.[0]?.components?.[0]?.value?.trim() ?? ''
    if (i.type === InteractionType.MODAL_SUBMIT && action === 'editmodal') {
      await queueDraft(payload, storyId, text)
      return json({
        type: ResponseType.UPDATE_MESSAGE,
        data: closedMessage(
          original,
          `Révision demandée : « ${text} ». La nouvelle version arrive en réponse.`,
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
export async function runDraftJob(payload: Payload, input: { storyId: number; feedback?: string }) {
  const ctx = makeContext(payload)
  const settings = (await payload.findGlobal({
    slug: 'scout-settings',
    overrideAccess: true,
  })) as unknown as SettingsDoc
  try {
    await draftStory(ctx, settings, Number(input.storyId), input.feedback)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    payload.logger.error({ msg: '[scout] draft job failed', story: input.storyId, error: message })
    await ctx.notify({
      content: `**Scout** : le brouillon du sujet ${input.storyId} a échoué (${message}).`,
    })
  }
}
