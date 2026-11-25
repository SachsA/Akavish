'use client'

// Log in / Sign up, or the reader's avatar menu, in the header.
//
// A client component on purpose: Clerk's server-side <SignedIn> / <SignedOut>
// read the session cookie, and that made every page of the site dynamic (no
// cache at all, `private, no-store`). Here the pages are the same for
// everyone and cached; the browser shows the right buttons. Until Clerk has
// loaded, the signed-out buttons are shown (most visitors), so nothing jumps.

import { SignInButton, SignUpButton, useAuth } from '@clerk/nextjs'
import { AccountMenu } from './AccountMenu'
import { NotificationBell } from './NotificationBell'
import { useI18n } from './I18nProvider'

const logIn = 'hidden sm:inline py-1 whitespace-nowrap hover:text-white transition-colors'
const signUp =
  'px-2 min-[360px]:px-3 py-1.5 rounded-md bg-emerald-700 text-on-accent text-xs font-semibold whitespace-nowrap hover:bg-emerald-600 transition-colors'

export function HeaderAuth() {
  const { t } = useI18n()
  const { isLoaded, isSignedIn } = useAuth()

  if (isLoaded && isSignedIn)
    return (
      <>
        <NotificationBell />
        <AccountMenu />
      </>
    )

  // Hidden on phones so the header fits (with the language menu, and in
  // French, it didn't at 360 px); the sign-up modal links to sign-in anyway.
  const buttons = (
    <>
      <button type="button" className={logIn} disabled={!isLoaded}>
        {t.header.logIn}
      </button>
      <button type="button" className={signUp} disabled={!isLoaded}>
        {t.header.signUp}
      </button>
    </>
  )
  if (!isLoaded) return buttons
  return (
    <>
      <SignInButton mode="modal">
        <button type="button" className={logIn}>
          {t.header.logIn}
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button type="button" className={signUp}>
          {t.header.signUp}
        </button>
      </SignUpButton>
    </>
  )
}
