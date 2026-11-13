// Reader roles (CMS `readers` collection, set by an admin) and the badge each
// one shows next to the reader's name. Client-safe.

export const READER_ROLES = ['owner', 'admin', 'moderator', 'author', 'reader'] as const
export type ReaderRole = (typeof READER_ROLES)[number]

export interface RoleBadgeStyle {
  label: string
  /** Shown on hover and read by screen readers. */
  title: string
  /** Solid colours with fixed text, so they read the same in both themes. */
  className: string
}

export const ROLE_BADGES: Record<Exclude<ReaderRole, 'reader'>, RoleBadgeStyle> = {
  owner: { label: 'Owner', title: 'Akavish’s creator', className: 'bg-amber-400 text-[#1c1917]' },
  admin: { label: 'Admin', title: 'Akavish administrator', className: 'bg-rose-700 text-[#ffffff]' },
  moderator: { label: 'Mod', title: 'Moderator', className: 'bg-sky-700 text-[#ffffff]' },
  author: { label: 'Author', title: 'Writes for Akavish', className: 'bg-emerald-700 text-[#ffffff]' },
}

export function roleBadge(role: string | null | undefined): RoleBadgeStyle | null {
  return role && Object.hasOwn(ROLE_BADGES, role) ? ROLE_BADGES[role as keyof typeof ROLE_BADGES] : null
}
