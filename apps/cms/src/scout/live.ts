// ─── Event mode (step 5) ─────────────────────────────────────────────────────
// One live article during a showcase. The editor drives it from Discord:
//
//   /live start <name> [image]   starts it (one live at a time)
//   /live add <text>             what they just saw, links pasted as is
//   /live image <url>            the article's cover (an official visual)
//   /live stop                   ends it; the next run writes the recap
//   /live status                 where it stands
//
// Every scout run (5 minutes) while it's live: the editor's new notes and the
// feed items that arrived since the last update go to Sonnet with the
// entries so far; it adds one short entry per new announcement and merges
// repeats (a note and an official post about the same reveal = one entry
// with both links). Nothing new, nothing happens. Until the editor clicks
// "Publier le live" the article stays a draft and one Discord card is kept
// up to date; after that click every update goes live by itself and is
// announced with "Annuler cette MAJ". On stop, a final update, the page says
// the show is over, and a recap article is drafted for the usual validation.

import { callTool } from './anthropic'
import { checkBudget, recordUsage } from './budget'
import type { ScoutContext, SettingsDoc, SourceDoc } from './context'
import { COLORS, editBotMessage, sendBotMessage, type BotMessage } from './discord-bot'
import { authorId, createGame, existingGames, NO_COVER } from './draft'
import { cleanDraft, DRAFT_TOOL, matchGame, toLexical, type DraftAnswer } from './draft-prompt'
import { extractYouTubeIds, fetchPage, USER_AGENT } from './extract'
import {
  applyLive,
  cleanLive,
  LIVE_SYSTEM,
  LIVE_TOOL,
  liveLexical,
  livePrompt,
  RECAP_SYSTEM,
  recapPrompt,
  recapVideos,
  urlsIn,
  type LiveAnswer,
  type LiveEntry,
  type LiveItem,
  type LiveNote,
} from './live-prompt'
import { uploadImage } from './media'

const MAX_ITEMS = 40
const MAX_HOURS = 8

export interface EventDoc {
  id: number
  name: string
  status: 'live' | 'ending' | 'ended'
  startedAt: string
  endedAt?: string | null
  article?: number | { id: number } | null
  recapArticle?: number | { id: number } | null
  cover?: number | { id: number; url?: string | null } | null
  published?: boolean | null
  intro?: string | null
  entries?: LiveEntry[] | null
  notes?: LiveNote[] | null
  previous?: { intro: string; entries: LiveEntry[] } | null
  rev?: number | null
  itemsSince?: string | null
  lastUpdateAt?: string | null
  discordMessageId?: string | null
}

const relId = (v: unknown): number | null =>
  v == null ? null : typeof v === 'object' ? Number((v as { id: number }).id) : Number(v)

async function current(ctx: ScoutContext): Promise<EventDoc | null> {
  const { docs } = await ctx.payload.find({
    collection: 'scout-events' as never,
    where: { status: { in: ['live', 'ending'] } } as never,
    sort: '-startedAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (docs[0] as unknown as EventDoc) ?? null
}

async function getEvent(ctx: ScoutContext, id: number): Promise<EventDoc> {
  return (await ctx.payload.findByID({
    collection: 'scout-events' as never,
    id,
    depth: 0,
    overrideAccess: true,
  })) as unknown as EventDoc
}

async function saveEvent(ctx: ScoutContext, id: number, data: Record<string, unknown>) {
  await ctx.payload.update({
    collection: 'scout-events' as never,
    id,
    data: data as never,
    overrideAccess: true,
  })
}

// ─── Commands (answered within Discord's 3 seconds: no model call) ───────────

export async function startLive(
  ctx: ScoutContext,
  name: string,
  imageUrl?: string,
): Promise<string> {
  const running = await current(ctx)
  if (running) return `Un live tourne déjà : « ${running.name} ». /live stop d'abord.`
  let cover: number | undefined
  let imageNote = ''
  if (imageUrl) {
    try {
      cover = (await uploadImage(ctx, imageUrl, `${name}: official image`)).id
    } catch (err) {
      imageNote = ` (l'image n'a pas marché : ${err instanceof Error ? err.message : String(err)} ; /live image <url> pour réessayer)`
    }
  }
  await ctx.payload.create({
    collection: 'scout-events' as never,
    data: {
      name: name.slice(0, 120),
      status: 'live',
      startedAt: ctx.now.toISOString(),
      // Official posts often go up a few minutes before the show starts.
      itemsSince: new Date(ctx.now.getTime() - 30 * 60_000).toISOString(),
      entries: [],
      notes: [],
      rev: 0,
      ...(cover ? { cover } : {}),
    } as never,
    overrideAccess: true,
  })
  return `🔴 Live « ${name} » lancé${imageNote}. Envoie ce que tu vois avec /live add (texte + liens). Mise à jour toutes les 5 min ; la page reste en brouillon jusqu'à ton clic sur « Publier le live ».`
}

export async function addNote(ctx: ScoutContext, textIn: string): Promise<string> {
  const ev = await current(ctx)
  if (!ev || ev.status !== 'live')
    return 'Aucun live en cours. /live start <nom> pour en lancer un.'
  const notes = [...(ev.notes ?? [])]
  notes.push({
    id: `n${notes.length + 1}`,
    at: ctx.now.toISOString(),
    text: textIn.slice(0, 1500),
    done: false,
  })
  await saveEvent(ctx, ev.id, { notes })
  return `Noté (${notes.filter((n) => !n.done).length} en attente). Intégré à la prochaine mise à jour, d'ici 5 min.`
}

export async function setLiveImage(ctx: ScoutContext, url: string): Promise<string> {
  const ev = await current(ctx)
  if (!ev) return 'Aucun live en cours.'
  try {
    const up = await uploadImage(ctx, url, `${ev.name}: official image`)
    await saveEvent(ctx, ev.id, { cover: up.id })
    const articleId = relId(ev.article)
    if (articleId) {
      await ctx.payload.update({
        collection: 'articles',
        id: articleId,
        data: { coverImage: up.id } as never,
        draft: !ev.published,
        overrideAccess: true,
      })
    }
    return 'Image enregistrée pour le live.'
  } catch (err) {
    return `L'image n'a pas marché : ${err instanceof Error ? err.message : String(err)}`
  }
}

export async function stopLive(ctx: ScoutContext): Promise<string> {
  const ev = await current(ctx)
  if (!ev) return 'Aucun live en cours.'
  if (ev.status === 'ending') return "Déjà en cours d'arrêt : le résumé arrive au prochain passage."
  await saveEvent(ctx, ev.id, { status: 'ending' })
  return `⏹️ Live « ${ev.name} » arrêté. Dernière mise à jour et brouillon du résumé d'ici 5 min.`
}

export async function liveStatus(ctx: ScoutContext): Promise<string> {
  const ev = await current(ctx)
  if (!ev) return 'Aucun live en cours.'
  const entries = ev.entries ?? []
  const pending = (ev.notes ?? []).filter((n) => !n.done).length
  return `« ${ev.name} » : ${ev.status === 'live' ? 'en cours' : 'arrêt en cours'}, ${entries.length} annonce(s), ${pending} note(s) en attente, ${ev.published ? 'publié (MAJ automatiques)' : 'en brouillon (attend « Publier le live »)'}${ev.cover ? '' : ", ⚠️ pas encore d'image"}.`
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

async function articleUrl(
  ctx: ScoutContext,
  articleId: number,
): Promise<{ title: string; url: string }> {
  const art = (await ctx.payload.findByID({
    collection: 'articles',
    id: articleId,
    depth: 0,
    draft: true,
    overrideAccess: true,
  })) as unknown as { title: string; slug: string }
  return { title: art.title, url: `${ctx.config.webUrl}/article/${art.slug}` }
}

async function hasCover(ctx: ScoutContext, articleId: number): Promise<boolean> {
  const art = (await ctx.payload.findByID({
    collection: 'articles',
    id: articleId,
    depth: 0,
    draft: true,
    overrideAccess: true,
  })) as unknown as { coverImage?: unknown }
  return !!art.coverImage
}

/** "Publier le live": the article goes live, and every later update too. */
export async function publishLive(ctx: ScoutContext, eventId: number): Promise<string> {
  const ev = await getEvent(ctx, eventId)
  const articleId = relId(ev.article)
  if (!articleId) throw new Error("pas encore d'article pour ce live")
  if (!(await hasCover(ctx, articleId))) throw new Error(NO_COVER)
  await ctx.payload.update({
    collection: 'articles',
    id: articleId,
    data: { _status: 'published', status: 'published' } as never,
    overrideAccess: true,
  })
  await saveEvent(ctx, eventId, { published: true })
  return (await articleUrl(ctx, articleId)).url
}

/** "Annuler cette MAJ": back to the page as it was before update `rev`. */
export async function undoLive(ctx: ScoutContext, eventId: number, rev: number): Promise<void> {
  const ev = await getEvent(ctx, eventId)
  if ((ev.rev ?? 0) !== rev || !ev.previous)
    throw new Error('trop tard : une autre mise à jour est passée depuis')
  const articleId = relId(ev.article)
  if (!articleId) throw new Error("pas d'article")
  await writeArticle(
    ctx,
    ev,
    articleId,
    ev.previous.intro,
    ev.previous.entries,
    ev.status !== 'live',
  )
  await saveEvent(ctx, eventId, {
    intro: ev.previous.intro,
    entries: ev.previous.entries,
    previous: null,
    rev: rev + 1,
  })
}

/** "Publier le résumé". */
export async function publishRecap(ctx: ScoutContext, eventId: number): Promise<string> {
  const ev = await getEvent(ctx, eventId)
  const recapId = relId(ev.recapArticle)
  if (!recapId) throw new Error('pas de résumé')
  if (!(await hasCover(ctx, recapId))) throw new Error(NO_COVER)
  await ctx.payload.update({
    collection: 'articles',
    id: recapId,
    data: { _status: 'published', status: 'published' } as never,
    overrideAccess: true,
  })
  const recap = await articleUrl(ctx, recapId)
  // The live page points to it.
  const liveId = relId(ev.article)
  if (liveId) {
    await writeArticle(ctx, ev, liveId, ev.intro ?? '', ev.entries ?? [], true, recap)
  }
  return recap.url
}

/** "Rejeter le résumé": the draft goes, the live page stays as it is. */
export async function rejectRecap(ctx: ScoutContext, eventId: number): Promise<void> {
  const ev = await getEvent(ctx, eventId)
  const recapId = relId(ev.recapArticle)
  if (recapId)
    await ctx.payload.delete({ collection: 'articles', id: recapId, overrideAccess: true })
  await saveEvent(ctx, eventId, { recapArticle: null })
}

// ─── The update, every run ───────────────────────────────────────────────────

async function eventTag(ctx: ScoutContext, name: string): Promise<number> {
  const { docs } = await ctx.payload.find({
    collection: 'tags',
    where: { name: { equals: name } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (docs[0]) return Number(docs[0].id)
  const created = await ctx.payload.create({
    collection: 'tags',
    data: { name: name.slice(0, 60) } as never,
    overrideAccess: true,
  })
  return Number(created.id)
}

/** Write the live article's content; published stays published. */
async function writeArticle(
  ctx: ScoutContext,
  ev: EventDoc,
  articleId: number,
  intro: string,
  entries: LiveEntry[],
  ended: boolean,
  recap?: { title: string; url: string } | null,
): Promise<void> {
  await ctx.payload.update({
    collection: 'articles',
    id: articleId,
    data: {
      content: liveLexical({
        intro,
        entries,
        updatedAt: ctx.now.toISOString(),
        ended,
        recap,
        webUrl: ctx.config.webUrl,
      }),
      ...(intro ? { excerpt: intro.slice(0, 300) } : {}),
      ...(ev.published ? { _status: 'published', status: 'published' } : {}),
    } as never,
    draft: !ev.published,
    overrideAccess: true,
  })
}

/** YouTube titles of the videos pasted in the notes (oEmbed, no key). */
async function videoTitles(ctx: ScoutContext, notes: LiveNote[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const url of notes.flatMap((n) => urlsIn(n.text))) {
    if (!extractYouTubeIds(url).length) continue
    try {
      const res = await ctx.fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
        { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(8_000) },
      )
      if (res.ok) {
        const o = (await res.json()) as { title?: string }
        if (o.title) out[url] = o.title
      }
    } catch {
      // left without a title
    }
  }
  return out
}

/**
 * The game pages of the games the update names: an existing one (matched on
 * letters and digits), or a new one created with what the inputs say, like a
 * draft does. Keyed by the lower-cased name the model gave.
 */
async function resolveGames(
  ctx: ScoutContext,
  answer: LiveAnswer,
  list: Array<{ id: number; name: string }>,
): Promise<Map<string, NonNullable<LiveEntry['game']>>> {
  const out = new Map<string, NonNullable<LiveEntry['game']>>()
  for (const g of [...answer.new_entries, ...answer.update_entries]) {
    if (!g.game || out.has(g.game.toLowerCase())) continue
    let id = matchGame(g.game, null, list)
    if (!id && g.game_is_new) {
      id = await createGame(ctx, g.game, g.new_game)
      list.push({ id, name: g.game })
    }
    if (!id) continue
    const doc = (await ctx.payload.findByID({
      collection: 'games',
      id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as { name: string; slug?: string | null }
    out.set(g.game.toLowerCase(), { id, name: doc.name, slug: doc.slug })
  }
  return out
}

/** A cover from the official posts among the new items, if the live has none. */
async function coverFromItems(
  ctx: ScoutContext,
  ev: EventDoc,
  items: LiveItem[],
): Promise<number | null> {
  for (const item of items.filter((i) => i.official).slice(0, 3)) {
    const page = await fetchPage(item.url, ctx.fetch)
    if (!page.image) continue
    try {
      const up = await uploadImage(
        ctx,
        page.image,
        page.imageAlt || `${ev.name}: official image from ${item.source}`,
      )
      return up.id
    } catch {
      // next one
    }
  }
  return null
}

function card(
  ev: EventDoc,
  args: { title: string; intro: string; entries: LiveEntry[]; adminUrl: string; hasCover: boolean },
): BotMessage {
  const list = [...args.entries]
    .reverse()
    .slice(0, 15)
    .map((e) => `#${e.id.slice(1)} ${e.headline}`)
    .join('\n')
  return {
    content: `🔴 **Live « ${ev.name} »** : brouillon, ${args.entries.length} annonce(s). Mis à jour toutes les 5 min tant que tu n'as pas publié. Pour corriger ou compléter une annonce : /live add #numéro + ce qu'il faut changer.`,
    embeds: [
      {
        title: args.title.slice(0, 256),
        url: args.adminUrl,
        description: `${args.intro}\n\n${list}`.slice(0, 4000),
        color: COLORS.working,
        fields: [
          {
            name: 'Image',
            value: args.hasCover
              ? 'ok'
              : "⚠️ pas d'image : /live image <url officielle>. Publier est bloqué d'ici là.",
          },
        ],
      },
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 3, label: 'Publier le live', custom_id: `scout:evpub:${ev.id}` },
          { type: 2, style: 4, label: 'Stop live', custom_id: `scout:evstop:${ev.id}` },
          { type: 2, style: 5, label: 'Ouvrir dans /admin', url: args.adminUrl },
        ],
      },
    ],
  }
}

/** One live update. Returns true when the page changed. */
async function updateEvent(
  ctx: ScoutContext,
  settings: SettingsDoc,
  ev: EventDoc,
): Promise<boolean> {
  const notes = (ev.notes ?? []).filter((n) => !n.done)
  const { docs } = await ctx.payload.find({
    collection: 'scout-items',
    where: { createdAt: { greater_than: ev.itemsSince ?? ev.startedAt } },
    sort: 'createdAt',
    limit: MAX_ITEMS,
    depth: 1,
    overrideAccess: true,
  })
  const raw = docs as unknown as Array<{
    title: string
    url: string
    summary?: string | null
    createdAt: string
    source: SourceDoc | number
  }>
  const items: LiveItem[] = raw
    .filter((i) => typeof i.source === 'object' && i.source.reliability !== 'variable')
    .map((i, index) => ({
      index,
      source: (i.source as SourceDoc).name,
      official: (i.source as SourceDoc).reliability === 'official',
      title: i.title,
      url: i.url,
      summary: i.summary ?? '',
    }))
  const itemsSince = raw.length ? raw[raw.length - 1].createdAt : ev.itemsSince
  if (!notes.length && !items.length) return false
  if (ctx.config.dryRun) return false

  const budget = await checkBudget(ctx, settings)
  if (!budget.ok) throw new Error(`budget: ${budget.reason}`)
  const entries = ev.entries ?? []
  const titles = await videoTitles(ctx, notes)
  const gameList = await existingGames(ctx)
  const allowed = new Set([...notes.flatMap((n) => urlsIn(n.text)), ...items.map((i) => i.url)])
  const result = await callTool<LiveAnswer>({
    apiKey: ctx.config.anthropicKey!,
    model: ctx.config.draftModel,
    system: LIVE_SYSTEM,
    prompt: livePrompt({
      event: ev.name,
      intro: ev.intro,
      entries,
      notes,
      items,
      videoTitles: titles,
      games: gameList.map((g) => g.name),
      first: !relId(ev.article),
    }),
    tool: LIVE_TOOL as unknown as Parameters<typeof callTool>[0]['tool'],
    maxTokens: 3000,
    fetchImpl: ctx.fetch,
  })
  await recordUsage(ctx, {
    purpose: 'live',
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  })
  const answer = cleanLive(result.input, entries, allowed)
  const games = await resolveGames(ctx, answer, gameList)
  const applied = applyLive(entries, answer, ctx.now.toISOString(), notes.length > 0, games)
  const intro = answer.intro || ev.intro || ''

  // Notes handled: re-read so a /live add sent meanwhile isn't lost.
  const fresh = await getEvent(ctx, ev.id)
  const handled = new Set(notes.map((n) => n.id))
  const freshNotes = (fresh.notes ?? []).map((n) => (handled.has(n.id) ? { ...n, done: true } : n))
  const base = { notes: freshNotes, itemsSince, lastUpdateAt: ctx.now.toISOString() }

  if (!applied.changed && intro === (ev.intro ?? '')) {
    await saveEvent(ctx, ev.id, base)
    return false
  }

  let cover = relId(ev.cover)
  if (!cover) cover = await coverFromItems(ctx, ev, items)
  let articleId = relId(ev.article)
  const adminUrl = (id: number) => `${ctx.config.serverUrl}/admin/collections/articles/${id}`
  const title = answer.title || `${ev.name}: every announcement, live`

  if (!articleId) {
    if (!applied.entries.length) {
      await saveEvent(ctx, ev.id, { ...base, intro, ...(cover ? { cover } : {}) })
      return false
    }
    const settingsAuthor = await authorId(ctx, settings)
    const created = await ctx.payload.create({
      collection: 'articles',
      data: {
        title,
        excerpt: intro.slice(0, 300) || title,
        content: liveLexical({
          intro,
          entries: applied.entries,
          updatedAt: ctx.now.toISOString(),
          webUrl: ctx.config.webUrl,
        }),
        category: answer.category ?? 'conference',
        seo: { title, description: intro.slice(0, 155) },
        aiAssisted: true,
        status: 'draft',
        _status: 'draft',
        author: settingsAuthor,
        tags: [await eventTag(ctx, ev.name)],
        ...(cover ? { coverImage: cover } : {}),
      } as never,
      draft: true,
      overrideAccess: true,
    })
    articleId = Number(created.id)
  } else {
    if (cover && !relId(ev.cover)) {
      await ctx.payload.update({
        collection: 'articles',
        id: articleId,
        data: { coverImage: cover } as never,
        draft: !ev.published,
        overrideAccess: true,
      })
    }
    await writeArticle(ctx, ev, articleId, intro, applied.entries, false)
  }

  const update: Record<string, unknown> = {
    ...base,
    article: articleId,
    intro,
    entries: applied.entries,
    ...(cover ? { cover } : {}),
  }

  if (ctx.config.bot) {
    if (!ev.published) {
      // One card, kept up to date, until the editor publishes.
      const msg = card(ev, {
        title,
        intro,
        entries: applied.entries,
        adminUrl: adminUrl(articleId),
        hasCover: !!cover,
      })
      if (ev.discordMessageId) {
        await editBotMessage(ctx.config.bot, ev.discordMessageId, msg, ctx.fetch).catch(
          async () => {
            update.discordMessageId = await sendBotMessage(ctx.config.bot!, msg, ctx.fetch)
          },
        )
      } else {
        update.discordMessageId = await sendBotMessage(ctx.config.bot, msg, ctx.fetch)
      }
    } else if (applied.added.length || applied.changed) {
      const rev = (ev.rev ?? 0) + 1
      update.rev = rev
      update.previous = { intro: ev.intro ?? '', entries }
      await sendBotMessage(
        ctx.config.bot,
        {
          content: `🔴 MAJ live « ${ev.name} » :\n${[
            ...applied.added.map(
              (e) => `+ #${e.id.slice(1)} ${e.headline}${e.game ? ` (jeu : ${e.game.name})` : ''}`,
            ),
            ...applied.updated.map((e) => `✎ #${e.id.slice(1)} ${e.headline}`),
          ].join('\n')}`.slice(0, 1900),
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 2,
                  label: 'Annuler cette MAJ',
                  custom_id: `scout:evundo:${ev.id}:${rev}`,
                },
                { type: 2, style: 4, label: 'Stop live', custom_id: `scout:evstop:${ev.id}` },
              ],
            },
          ],
        },
        ctx.fetch,
      )
    }
  }
  await saveEvent(ctx, ev.id, update)
  return true
}

/** The recap article, drafted when the live ends, validated like any draft. */
async function writeRecap(ctx: ScoutContext, settings: SettingsDoc, ev: EventDoc): Promise<void> {
  const entries = ev.entries ?? []
  if (!entries.length || ctx.config.dryRun || relId(ev.recapArticle)) return
  const budget = await checkBudget(ctx, settings)
  if (!budget.ok) throw new Error(`budget: ${budget.reason}`)
  const result = await callTool<DraftAnswer>({
    apiKey: ctx.config.anthropicKey!,
    model: ctx.config.draftModel,
    system: RECAP_SYSTEM,
    prompt: recapPrompt(ev.name, entries),
    tool: DRAFT_TOOL as unknown as Parameters<typeof callTool>[0]['tool'],
    maxTokens: 4000,
    fetchImpl: ctx.fetch,
  })
  await recordUsage(ctx, {
    purpose: 'recap',
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  })
  const clean = cleanDraft(result.input, 'conference')
  const cover = relId(ev.cover)
  const created = await ctx.payload.create({
    collection: 'articles',
    data: {
      title: clean.title,
      excerpt: clean.excerpt,
      content: toLexical(clean.blocks, [], recapVideos(entries)),
      category: clean.category,
      seo: { title: clean.title, description: clean.seo_description },
      aiAssisted: true,
      status: 'draft',
      _status: 'draft',
      author: await authorId(ctx, settings),
      tags: [await eventTag(ctx, ev.name)],
      ...(cover ? { coverImage: cover } : {}),
    } as never,
    draft: true,
    overrideAccess: true,
  })
  const recapId = Number(created.id)
  await saveEvent(ctx, ev.id, { recapArticle: recapId })
  if (ctx.config.bot) {
    const adminUrl = `${ctx.config.serverUrl}/admin/collections/articles/${recapId}`
    await sendBotMessage(
      ctx.config.bot,
      {
        content: `📋 **Résumé de « ${ev.name} »** prêt (${entries.length} annonces).`,
        embeds: [
          {
            title: clean.title.slice(0, 256),
            url: adminUrl,
            description: clean.excerpt.slice(0, 4000),
            color: COLORS.draft,
            fields: [
              {
                name: 'Image',
                value: cover
                  ? 'celle du live'
                  : "⚠️ pas d'image : ajoute-la dans /admin avant de publier.",
              },
            ],
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3,
                label: 'Publier le résumé',
                custom_id: `scout:evrecap:${ev.id}`,
              },
              { type: 2, style: 4, label: 'Rejeter', custom_id: `scout:evrecapno:${ev.id}` },
              { type: 2, style: 5, label: 'Ouvrir dans /admin', url: adminUrl },
            ],
          },
        ],
      },
      ctx.fetch,
    )
  }
}

/** The scout run's live step: update the running event, close it when asked. */
export async function runLive(ctx: ScoutContext, settings: SettingsDoc): Promise<number> {
  let ev = await current(ctx)
  if (!ev) return 0
  if (
    ev.status === 'live' &&
    ctx.now.getTime() - new Date(ev.startedAt).getTime() > MAX_HOURS * 3_600_000
  ) {
    await saveEvent(ctx, ev.id, { status: 'ending' })
    ev = { ...ev, status: 'ending' }
  }
  const changed = await updateEvent(ctx, settings, ev)
  if (ev.status === 'ending') {
    const fresh = await getEvent(ctx, ev.id)
    const articleId = relId(fresh.article)
    if (articleId) {
      await writeArticle(ctx, fresh, articleId, fresh.intro ?? '', fresh.entries ?? [], true)
    }
    await saveEvent(ctx, ev.id, { status: 'ended', endedAt: ctx.now.toISOString() })
    await writeRecap(ctx, settings, { ...fresh, status: 'ended' })
    if (fresh.discordMessageId && ctx.config.bot && !fresh.published) {
      await editBotMessage(
        ctx.config.bot,
        fresh.discordMessageId,
        {
          content: `⏹️ Live « ${fresh.name} » terminé sans avoir été publié. Résumé en brouillon ci-dessous.`,
          components: [],
        },
        ctx.fetch,
      ).catch(() => {})
    }
  }
  return changed ? 1 : 0
}
