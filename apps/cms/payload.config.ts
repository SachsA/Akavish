import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

import { Users } from './src/collections/Users'
import { Media } from './src/collections/Media'
import { Tags } from './src/collections/Tags'
import { Authors } from './src/collections/Authors'
import { Games } from './src/collections/Games'
import { Articles } from './src/collections/Articles'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL: process.env.CMS_URL ?? 'http://localhost:3001',
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: '— Akavish CMS',
    },
  },
  collections: [Users, Media, Tags, Authors, Games, Articles],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET ?? 'akavish-change-me',
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
  }),
  cors: [
    process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
  ],
  csrf: [
    process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
  ],
})
