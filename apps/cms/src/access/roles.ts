import type { Access, FieldAccess, PayloadRequest } from 'payload'

// ─── Editorial roles (CMS `users`) ───────────────────────────────────────────
// admin  — everything, including users, subscribers and settings.
// editor — writes, edits and publishes any article; manages games, tags,
//          authors and media; sees the scout.
// writer — writes articles under their own author profile and saves drafts;
//          can't publish, can't touch a published article, can't delete.
//
// These are the people who make the site. Readers (Clerk accounts, the
// `readers` collection) have their own roles, which only drive the badge next
// to their name and what they may do on the site: see Readers.ts.

export const EDITOR_ROLES = ['admin', 'editor', 'writer'] as const
export type EditorRole = (typeof EDITOR_ROLES)[number]

type MaybeUser = PayloadRequest['user'] | null | undefined

/** The role of a logged-in CMS user; null for anyone else (visitors, API keys of other collections). */
export function editorRole(user: MaybeUser): EditorRole | null {
  if (!user || user.collection !== 'users') return null
  const role = (user as { role?: unknown }).role
  return EDITOR_ROLES.includes(role as EditorRole) ? (role as EditorRole) : null
}

export const isAdminUser = (user: MaybeUser) => editorRole(user) === 'admin'
/** Admin or editor. */
export const isEditorUser = (user: MaybeUser) => {
  const role = editorRole(user)
  return role === 'admin' || role === 'editor'
}
/** Any CMS user, whatever the role. */
export const isStaffUser = (user: MaybeUser) => editorRole(user) !== null

export const admins: Access = ({ req }) => isAdminUser(req.user)
export const editors: Access = ({ req }) => isEditorUser(req.user)
export const staff: Access = ({ req }) => isStaffUser(req.user)
export const adminsField: FieldAccess = ({ req }) => isAdminUser(req.user)

/** Id of the author profile a CMS user writes as (Users → "Author profile"). */
export function authorIdOf(user: MaybeUser): number | string | null {
  if (!user || user.collection !== 'users') return null
  const author = (user as { author?: unknown }).author
  if (author && typeof author === 'object' && 'id' in author) return (author as { id: number | string }).id
  if (typeof author === 'number' || typeof author === 'string') return author
  return null
}
