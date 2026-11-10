// ─── Run context ─────────────────────────────────────────────────────────────
// What one scout run needs, injectable so the integration tests can replace
// the network (feeds, Claude, Discord) and the clock.

import type { Payload } from 'payload'
import type { FetchLike } from './anthropic'
import type { ScoutConfig } from './config'
import type { DiscordMessage } from './discord'

export interface ScoutContext {
  payload: Payload
  config: ScoutConfig
  now: Date
  /** Feeds and Claude API. */
  fetch: FetchLike
  /** Posts to Discord, or logs in dry run / without a webhook. */
  notify: (message: DiscordMessage) => Promise<void>
}

// Local shapes of the scout collections. Not imported from payload-types.ts:
// that file is generated and gitignored, so CI type-checks without it.
export type ID = number

export interface SourceDoc {
  id: ID
  name: string
  url: string
  kind: 'rss' | 'x'
  reliability: 'official' | 'high' | 'variable'
  cadence: 'fast' | 'normal'
  general?: boolean | null
  active?: boolean | null
  lastFetchedAt?: string | null
  consecutiveFailures?: number | null
  etag?: string | null
  lastModified?: string | null
}

export interface ItemDoc {
  id: ID
  title: string
  url: string
  summary?: string | null
  publishedAt?: string | null
  source: ID | SourceDoc
  status: 'new' | 'triaged' | 'ignored'
  story?: ID | null
  createdAt: string
}

export interface StoryDoc {
  id: ID
  title: string
  score: number
  significance?: number | null
  sourceCount?: number | null
  game?: string | null
  category?: string | null
  status: 'new' | 'listed' | 'drafted' | 'published' | 'rejected'
  firstSeenAt: string
  lastItemAt?: string | null
  updatedAt: string
}

export interface SettingsDoc {
  paused?: boolean | null
  threshold?: number | null
  lastMorningDigest?: string | null
  lastEveningDigest?: string | null
  lastBudgetAlert?: string | null
}

/** Id of a relationship that may or may not be populated. */
export const idOf = (v: ID | { id: ID } | null | undefined): ID | null =>
  v == null ? null : typeof v === 'object' ? Number(v.id) : Number(v)
