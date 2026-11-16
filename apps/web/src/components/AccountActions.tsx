'use client'

import { SignOutButton, useClerk } from '@clerk/nextjs'
import { useI18n } from './I18nProvider'

const button =
  'px-3 py-1.5 rounded-md border border-zinc-800 text-sm text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors'

/** "Manage account" (Clerk's profile: name, avatar, email, connected logins, deletion) and sign out. */
export function AccountActions() {
  const clerk = useClerk()
  const { t, href } = useI18n()
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} onClick={() => clerk.openUserProfile()}>
        {t.account.manage}
      </button>
      <SignOutButton redirectUrl={href('/')}>
        <button type="button" className={button}>
          {t.account.signOut}
        </button>
      </SignOutButton>
    </div>
  )
}
