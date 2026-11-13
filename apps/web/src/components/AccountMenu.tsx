'use client'

import { UserButton } from '@clerk/nextjs'
import { BookmarkIcon } from './BookmarkIcon'

/** Clerk's avatar menu, plus a link to the reader's own page (saved articles, badge). */
export function AccountMenu() {
  return (
    <UserButton afterSignOutUrl="/">
      <UserButton.MenuItems>
        <UserButton.Link label="Saved articles" labelIcon={<BookmarkIcon />} href="/account" />
      </UserButton.MenuItems>
    </UserButton>
  )
}
