import { roleBadge } from '@/lib/roles'

/** The small badge next to a reader's name (Owner, Admin, Mod, Author). Nothing for plain readers. */
export function RoleBadge({ role }: { role: string | null | undefined }) {
  const badge = roleBadge(role)
  if (!badge) return null
  return (
    <span
      title={badge.title}
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide leading-none ${badge.className}`}
    >
      {badge.label}
      <span className="sr-only"> ({badge.title})</span>
    </span>
  )
}
