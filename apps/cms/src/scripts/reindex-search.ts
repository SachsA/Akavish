/**
 * Backfill the Meilisearch index with all published articles.
 *
 * Run with:  pnpm reindex:search
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { reindexAllArticles } from '../lib/article-search-sync'

const run = async () => {
  console.log('[search] booting Payload…')
  console.log(`[search] MEILISEARCH_HOST = ${process.env.MEILISEARCH_HOST ?? '(unset)'}`)

  const payload = await getPayload({ config })

  console.log('[search] reindexing published articles…')
  const count = await reindexAllArticles(payload)

  console.log(`[search] done — indexed ${count} published article(s)`)
  process.exit(0)
}

run().catch((err) => {
  console.error('[search] reindex failed:', err)
  process.exit(1)
})
