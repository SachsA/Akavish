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
import { Articles } from './collections/Articles'
import { Subscribers } from './collections/Subscribers'
import { ScoutItems } from './collections/scout/ScoutItems'
import { ScoutSettings } from './collections/scout/ScoutSettings'
import { ScoutSources } from './collections/scout/ScoutSources'
import { ScoutStories } from './collections/scout/ScoutStories'
import { ScoutUsage } from './collections/scout/ScoutUsage'
import { discordInteractionsHandler, runDraftJob } from './scout/interactions'
import { runScout } from './scout/run'
import { confirmHandler, subscribeHandler, unsubscribeHandler } from './lib/newsletter'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL: process.env.SERVER_URL || 'http://localhost:3001',
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '— Akavish CMS',
    },
  },
  collections: [
    Users,
    Media,
    Tags,
    Authors,
    Games,
    Articles,
    Subscribers,
    // The AI scout (src/scout/, design doc linked in PROGRESS.md).
    ScoutSources,
    ScoutItems,
    ScoutStories,
    ScoutUsage,
  ],
  globals: [ScoutSettings],
  // Newsletter double opt-in, called by the web (src/lib/newsletter.ts).
  // Public on purpose: no login, no access to the collection itself.
  endpoints: [
    { path: '/newsletter/subscribe', method: 'post', handler: subscribeHandler },
    { path: '/newsletter/confirm', method: 'post', handler: confirmHandler },
    { path: '/newsletter/unsubscribe', method: 'post', handler: unsubscribeHandler },
    // AI scout, step 2: Discord's "Interactions Endpoint URL" (button clicks).
    // Signature-checked; only the owner's clicks are accepted.
    { path: '/scout/discord', method: 'post', handler: discordInteractionsHandler },
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
    ],
    tasks: [
      {
        // Every 5 minutes: collect, triage, digest if due (src/scout/run.ts).
        // Does nothing unless SCOUT_ENABLED=true. The schedule is declared
        // either way so the database schema doesn't depend on an env var.
        slug: 'scoutTick',
        schedule: [{ cron: '0 */5 * * * *', queue: 'scout' }],
        retries: 0,
        handler: async ({ req }) => {
          await runScout(req.payload)
          return { output: {} }
        },
      },
      {
        // One draft or revision, queued from Discord (src/scout/interactions.ts).
        slug: 'scoutDraft',
        retries: 0,
        inputSchema: [
          { name: 'storyId', type: 'number', required: true },
          { name: 'feedback', type: 'textarea' },
        ],
        handler: async ({ input, req }) => {
          await runDraftJob(req.payload, input as { storyId: number; feedback?: string })
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
