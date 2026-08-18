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
  collections: [Users, Media, Tags, Authors, Games, Articles],
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
