'use client'

// In the admin header, next to the avatar: who is logged in, and a plain
// "Log out" button. Payload's own logout sits at the bottom of the side menu,
// easy to miss: on 2026-11-23 the scout's editor account was still logged in
// and the Readers group (admins only) looked gone.

import { useAuth, useConfig } from '@payloadcms/ui'

export function AccountBar() {
  const { user } = useAuth<{ email?: string; role?: string }>()
  const { config } = useConfig()
  if (!user) return null
  const logoutHref = `${config.routes.admin}${config.admin.routes.logout}`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* On a phone the header has room for the button only. */}
      <style>{'@media (max-width: 768px) { .akv-account-email { display: none } }'}</style>
      <span className="akv-account-email" style={{ fontSize: 13, color: 'var(--theme-elevation-600)', whiteSpace: 'nowrap' }}>
        {user.email}
        {user.role ? ` · ${user.role}` : ''}
      </span>
      <a
        href={logoutHref}
        style={{
          fontSize: 13,
          padding: '6px 12px',
          borderRadius: 4,
          border: '1px solid var(--theme-elevation-250)',
          color: 'var(--theme-text)',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Log out
      </a>
    </div>
  )
}
