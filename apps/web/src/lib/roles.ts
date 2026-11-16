// Reader roles (CMS `readers` collection, set by an admin) and the badge each
// one shows next to the reader's name. Client-safe.

import { messagesFor } from './i18n/messages'
import type { Locale } from './i18n/config'

export const READER_ROLES = ['owner', 'admin', 'moderator', 'author', 'reader'] as const
export type ReaderRole = (typeof READER_ROLES)[number]

export interface RoleBadgeStyle {
  label: string
  /** Shown on hover and read by screen readers. */
  title: string
  /** Solid colours with fixed text, so they read the same in both themes. */
  className: string
}

/** Badge colours; the words (label, title) are in lib/i18n/messages (`roles`). */
export const ROLE_BADGES: Record<Exclude<ReaderRole, 'reader'>, { className: string }> = {
  owner: { className: 'bg-amber-400 text-[#1c1917]' },
  admin: { className: 'bg-rose-700 text-[#ffffff]' },
  moderator: { className: 'bg-sky-700 text-[#ffffff]' },
  author: { className: 'bg-emerald-700 text-[#ffffff]' },
}

export function roleBadge(role: string | null | undefined, locale: Locale = 'en'): RoleBadgeStyle | null {
  if (!role || !Object.hasOwn(ROLE_BADGES, role)) return null
  const key = role as keyof typeof ROLE_BADGES
  return { ...messagesFor(locale).roles[key], ...ROLE_BADGES[key] }
}
