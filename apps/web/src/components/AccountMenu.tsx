'use client'

import { UserButton } from '@clerk/nextjs'
import { BookmarkIcon } from './BookmarkIcon'
import { useI18n } from './I18nProvider'

/** Clerk's avatar menu, plus a link to the reader's own page (saved articles, badge). */
export function AccountMenu() {
  const { t, href } = useI18n()
  return (
    <UserButton afterSignOutUrl={href('/')}>
      <UserButton.MenuItems>
        <UserButton.Link label={t.account.savedMenu} labelIcon={<BookmarkIcon />} href={href('/account')} />
      </UserButton.MenuItems>
    </UserButton>
  )
}
