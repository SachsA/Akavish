import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Tags } from './collections/Tags'
import { Authors } from './collections/Authors'
import { Games } from './collections/Games'
import { Companies } from './collections/Companies'
import { Platforms } from './collections/Platforms'
import { Articles } from './collections/Articles'
import { Subscribers } from './collections/Subscribers'
import {
  esportFollowsHandler,
  notificationsHandler,
  notifySettingsHandler,
  pushHandler,
} from './lib/esport-follows'
import {
  Bookmarks,
  EsportFollows,
  GameFollows,
  PushSubscriptions,
  ReaderNotifications,
  Readers,
} from './collections/Readers'
import { CommentReports, Comments, CommentVotes, CommunitySettings } from './collections/Comments'
import { ScoutItems } from './collections/scout/ScoutItems'
import { ScoutSettings } from './collections/scout/ScoutSettings'
import { ScoutSources } from './collections/scout/ScoutSources'
import { ScoutStories } from './collections/scout/ScoutStories'
import { ScoutEvents } from './collections/scout/ScoutEvents'
import { ScoutUsage } from './collections/scout/ScoutUsage'
import { EsportMatches } from './collections/esport/EsportMatches'
import { EsportTournaments } from './collections/esport/EsportTournaments'
import { esportRawHandler, runEsportSync } from './esport/sync'
import { discordInteractionsHandler, runDraftJob, scoutReportHandler } from './scout/interactions'
import { scoutConfig } from './scout/config'
import { registerCommands } from './scout/discord-commands'
import { releaseStaleScoutRuns, runScout } from './scout/run'
import { confirmHandler, subscribeHandler, unsubscribeHandler } from './lib/newsletter'
import { schedulePublishHandler } from './lib/schedule-publish'
import {
  liveArticlesHandler,
  translateArticle,
  translateBackfillHandler,
  translateTaxonomy,
} from './lib/translate'
import {
  clerkWebhookHandler,
  readerBookmarksHandler,
  readerFollowingHandler,
  readerFollowsHandler,
  readerSavedHandler,
  readerSyncHandler,
} from './lib/readers'
import {
  commentModerateHandler,
  commentReportHandler,
  commentsHandler,
  commentVoteHandler,
} from './lib/comments'
import { mediaWebpHandler } from './lib/media-webp'
import { revalidateAllHandler } from './lib/revalidate-web'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  // The scout's Discord slash commands (/live, event mode) are (re)registered
  // at start-up when the scout and its bot are configured. Never blocks boot.
  onInit: async (payload) => {
    const config = scoutConfig()
    if (!config.enabled || !config.bot || config.dryRun) return
    registerCommands(config.bot).then(
      () => payload.logger.info('[scout] Discord /live command registered'),
      (err) =>
        payload.logger.warn({
          msg: '[scout] Discord commands not registered',
          error: err instanceof Error ? err.message : String(err),
        }),
    )
  },
  serverURL: process.env.SERVER_URL || 'http://localhost:3001',
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '— Akavish CMS',
    },
    components: {
      // Header: the logged-in account and a visible "Log out" button.
      actions: ['/components/admin/AccountBar#AccountBar'],
    },
  },
  collections: [
    Users,
    Media,
    Tags,
    Authors,
    Games,
    Companies,
    Platforms,
    Articles,
    Subscribers,
    // Reader accounts (Clerk) and their saved articles (src/lib/readers.ts).
    Readers,
    Bookmarks,
    GameFollows,
    EsportFollows,
    ReaderNotifications,
    PushSubscriptions,
    // Comments under articles (src/lib/comments.ts).
    Comments,
    CommentVotes,
    CommentReports,
    // The AI scout (src/scout/, design doc linked in PROGRESS.md).
    ScoutSources,
    ScoutItems,
    ScoutStories,
    ScoutUsage,
    ScoutEvents,
    // Esport schedules and results from PandaScore (src/esport/).
    EsportTournaments,
    EsportMatches,
  ],
  globals: [ScoutSettings, CommunitySettings],
  // Newsletter double opt-in, called by the web (src/lib/newsletter.ts).
  // Public on purpose: no login, no access to the collection itself.
  endpoints: [
    { path: '/newsletter/subscribe', method: 'post', handler: subscribeHandler },
    { path: '/newsletter/confirm', method: 'post', handler: confirmHandler },
    { path: '/newsletter/unsubscribe', method: 'post', handler: unsubscribeHandler },
    // Schedule an article's publication from a script (src/lib/schedule-publish.ts).
    { path: '/articles-schedule', method: 'post', handler: schedulePublishHandler },
    // French version: translate every article not translated yet (lib/translate.ts).
    { path: '/translate/backfill', method: 'post', handler: translateBackfillHandler },
    // Re-make the sizes of images uploaded before WebP (lib/media-webp.ts).
    { path: '/media-webp', method: 'post', handler: mediaWebpHandler },
    // One raw PandaScore match, to check the mapping (src/esport/sync.ts).
    { path: '/esport/raw', method: 'get', handler: esportRawHandler },
    // Drop the site's whole cache by hand (lib/revalidate-web.ts).
    { path: '/revalidate-web', method: 'post', handler: revalidateAllHandler },
    // Which articles are live showcase pages right now (public: ids only).
    { path: '/live-articles', method: 'get', handler: liveArticlesHandler },
    // AI scout, step 2: Discord's "Interactions Endpoint URL" (button clicks).
    // Signature-checked; only the owner's clicks are accepted.
    { path: '/scout/discord', method: 'post', handler: discordInteractionsHandler },
    { path: '/scout/report', method: 'get', handler: scoutReportHandler },
    // Reader accounts and saved articles, for the website (READER_API_SECRET)
    // and Clerk's webhook (signed). Details in src/lib/readers.ts.
    { path: '/reader-api/sync', method: 'post', handler: readerSyncHandler },
    { path: '/reader-api/bookmarks', method: 'get', handler: readerBookmarksHandler },
    { path: '/reader-api/bookmarks', method: 'post', handler: readerBookmarksHandler },
    { path: '/reader-api/bookmarks', method: 'delete', handler: readerBookmarksHandler },
    { path: '/reader-api/saved', method: 'get', handler: readerSavedHandler },
    { path: '/reader-api/follows', method: 'get', handler: readerFollowsHandler },
    { path: '/reader-api/follows', method: 'post', handler: readerFollowsHandler },
    { path: '/reader-api/follows', method: 'delete', handler: readerFollowsHandler },
    { path: '/reader-api/following', method: 'get', handler: readerFollowingHandler },
    // Esport follows, the bell's notifications and their settings (src/lib/esport-follows.ts).
    { path: '/reader-api/esport-follows', method: 'get', handler: esportFollowsHandler },
    { path: '/reader-api/esport-follows', method: 'post', handler: esportFollowsHandler },
    { path: '/reader-api/esport-follows', method: 'delete', handler: esportFollowsHandler },
    { path: '/reader-api/notifications', method: 'get', handler: notificationsHandler },
    { path: '/reader-api/notifications', method: 'post', handler: notificationsHandler },
    { path: '/reader-api/notify-settings', method: 'get', handler: notifySettingsHandler },
    { path: '/reader-api/notify-settings', method: 'post', handler: notifySettingsHandler },
    // Web push: the browsers a reader turned notifications on in (src/lib/web-push.ts).
    { path: '/reader-api/push', method: 'get', handler: pushHandler },
    { path: '/reader-api/push', method: 'post', handler: pushHandler },
    { path: '/reader-api/push', method: 'delete', handler: pushHandler },
    { path: '/reader-api/comments', method: 'get', handler: commentsHandler },
    { path: '/reader-api/comments', method: 'post', handler: commentsHandler },
    { path: '/reader-api/comments', method: 'delete', handler: commentsHandler },
    { path: '/reader-api/comments/vote', method: 'post', handler: commentVoteHandler },
    { path: '/reader-api/comments/report', method: 'post', handler: commentReportHandler },
    { path: '/reader-api/comments/moderate', method: 'post', handler: commentModerateHandler },
    { path: '/clerk/webhook', method: 'post', handler: clerkWebhookHandler },
  ],
  // Jobs queue, used by scheduled publishing (Articles → "Schedule publish").
  // autoRun checks the queue every minute inside the CMS server process, which
  // is long-running on Railway. Payload only starts it in the web server
  // (`getPayload({ cron: true })`), so scripts (seed, migrations, tests) and
  // `next build` never run jobs.
  // Production logs as one JSON object per line (Railway parses them, so
  // `level` and the other fields become filterable). Dev keeps Payload's
  // coloured output.
  logger:
    process.env.NODE_ENV === 'production'
      ? { options: { level: 'info', formatters: { level: (label: string) => ({ level: label }) } } }
      : undefined,
  jobs: {
    autoRun: [
      { cron: '* * * * *', queue: 'default' },
      // The AI scout's own queue, so a slow run never delays a scheduled publish.
      { cron: '* * * * *', queue: 'scout' },
      // French translations (lib/translate.ts): long Claude calls, on their
      // own queue so they never hold up a scheduled publish.
      { cron: '* * * * *', queue: 'translate', limit: 5 },
      // Esport results and schedules (src/esport/sync.ts).
      { cron: '* * * * *', queue: 'esport' },
    ],
    tasks: [
      {
        // The French version of one article (lib/translate.ts), queued when
        // it's published or its English changes. One retry; then "failed".
        slug: 'translateArticle',
        retries: 1,
        inputSchema: [{ name: 'articleId', type: 'number', required: true }],
        handler: async ({ input, req }) => {
          const id = (input as { articleId: number }).articleId
          try {
            const result = await translateArticle(req.payload, id)
            if (result !== 'translated') {
              // Nothing to do: don't leave the article marked "pending".
              const doc = await req.payload.findByID({
                collection: 'articles',
                id,
                depth: 0,
                overrideAccess: true,
              })
              const fr = (doc as unknown as { fr?: { status?: string } }).fr
              if (fr?.status === 'pending') {
                await req.payload.update({
                  collection: 'articles',
                  id,
                  data: {
                    fr: { ...fr, status: result === 'up-to-date' ? 'auto' : 'failed' },
                  } as never,
                  overrideAccess: true,
                  context: { translating: true },
                })
              }
            }
            return { output: { result } }
          } catch (error) {
            req.payload.logger.error({
              msg: '[translate] failed',
              article: id,
              error: String(error),
            })
            await req.payload
              .update({
                collection: 'articles',
                id,
                data: { fr: { status: 'failed' } } as never,
                overrideAccess: true,
                context: { translating: true },
              })
              .catch(() => {})
            throw error
          }
        },
      },
      {
        // French names for new tags (queued by the Tags hook) and bios.
        slug: 'translateTaxonomy',
        retries: 1,
        handler: async ({ req }) => {
          const output = await translateTaxonomy(req.payload)
          return { output }
        },
      },
      {
        // Every 5 minutes: collect, triage, digest if due (src/scout/run.ts).
        // Does nothing unless SCOUT_ENABLED=true. The schedule is declared
        // either way so the database schema doesn't depend on an env var.
        slug: 'scoutTick',
        schedule: [
          {
            cron: '0 */5 * * * *',
            queue: 'scout',
            hooks: {
              // A run killed mid-way (a redeploy) would block every next one.
              beforeSchedule: async (args) => {
                await releaseStaleScoutRuns(args.req.payload).catch((err) =>
                  args.req.payload.logger.error({
                    msg: '[scout] stale run check failed',
                    error: String(err),
                  }),
                )
                return args.defaultBeforeSchedule(args)
              },
            },
          },
        ],
        retries: 0,
        handler: async ({ req }) => {
          await runScout(req.payload)
          return { output: {} }
        },
      },
      {
        // Every 10 minutes: matches and tournaments from PandaScore. Does
        // nothing without PANDASCORE_TOKEN; declared either way so the schema
        // doesn't depend on an env var.
        slug: 'esportSync',
        schedule: [{ cron: '0 */10 * * * *', queue: 'esport' }],
        retries: 0,
        handler: async ({ req }) => {
          const results = await runEsportSync(req.payload)
          return { output: { results } }
        },
      },
      {
        // One draft or revision, queued from Discord (src/scout/interactions.ts).
        slug: 'scoutDraft',
        retries: 0,
        inputSchema: [
          { name: 'storyId', type: 'number', required: true },
          { name: 'feedback', type: 'textarea' },
          // An image URL pasted in Discord (Modifier): becomes the cover.
          { name: 'imageUrl', type: 'text' },
          // Its credit, from the same form ("BLAST / Luc Bouchon").
          { name: 'imageCredit', type: 'text' },
          // "Autre image": the next cover, the text untouched.
          { name: 'nextImage', type: 'checkbox' },
        ],
        handler: async ({ input, req }) => {
          await runDraftJob(
            req.payload,
            input as {
              storyId: number
              feedback?: string
              imageUrl?: string
              imageCredit?: string
              nextImage?: boolean
            },
          )
          return { output: {} }
        },
      },
    ],
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Schema is managed by versioned migrations (src/migrations), NOT push mode,
    // in every environment. Change a collection → `pnpm migrate:create <name>`,
    // commit the file, and `pnpm migrate` applies it (dev locally, prod via the
    // Railway pre-deploy step). See DEPLOYMENT.md §5.
    push: false,
  }),
  sharp,
  // Transactional email (password resets, account verification) through Resend's
  // REST API. Without an adapter Payload only *logs* emails to the console, which
  // means a forgotten admin password is unrecoverable — hence this.
  // Enabled only when RESEND_API_KEY is set: a fresh clone or local dev falls
  // back to Payload's console adapter, so no cloud account is needed to work on
  // the CMS. Mirrors how R2 storage degrades gracefully below.
  email: process.env.RESEND_API_KEY
    ? resendAdapter({
        apiKey: process.env.RESEND_API_KEY,
        // Must belong to a domain verified in Resend, otherwise sends are rejected.
        defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@mail.akavish.gg',
        defaultFromName: process.env.EMAIL_FROM_NAME || 'Akavish',
      })
    : undefined,
  cors: [process.env.WEB_URL || 'http://localhost:3000'],
  csrf: [process.env.WEB_URL || 'http://localhost:3000'],
  plugins: [
    // Store uploads in Cloudflare R2 (S3-compatible API) instead of the local
    // disk — hosts like Railway have an ephemeral filesystem, so local files
    // vanish on every redeploy. Disabled automatically when R2 isn't configured,
    // so a fresh clone still works with local storage.
    s3Storage({
      enabled: Boolean(process.env.R2_BUCKET),
      // Keep the plugin's fields (e.g. `_objectKey`) in the schema even when
      // R2 is off locally. Without it, the schema depends on R2_BUCKET: a
      // migration generated on a laptop missed `_objectkey` and the media API
      // broke in production (Payload 3.93, Nov 2026). Default in Payload v4.
      alwaysInsertFields: true,
      collections: {
        media: {
          // Serve files straight from the public R2 domain rather than proxying
          // them through Payload (the media collection is public anyway).
          disablePayloadAccessControl: true,
          generateFileURL: ({ filename, prefix }) => {
            const key = prefix ? `${prefix}/${filename}` : filename
            return `${process.env.R2_PUBLIC_URL}/${key}`
          },
        },
      },
      bucket: process.env.R2_BUCKET || '',
      config: {
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
        // R2 requires 'auto'; standard AWS regions are rejected.
        region: 'auto',
        // S3 API endpoint — used for uploads only, never to serve files.
        endpoint: process.env.R2_ENDPOINT,
        forcePathStyle: true,
      },
    }),
  ],
})
