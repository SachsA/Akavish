'use client'

import { UserButton } from '@clerk/nextjs'
import { BookmarkIcon } from './BookmarkIcon'
import { SlidersIcon } from './SlidersIcon'
import { StarIcon } from './StarIcon'
import { useI18n } from './I18nProvider'

/** Clerk's avatar menu, plus links to the reader's own page (preferences, followed games, saved articles). */
export function AccountMenu() {
  const { t, href } = useI18n()
  return (
    <UserButton afterSignOutUrl={href('/')}>
      <UserButton.MenuItems>
        <UserButton.Link
          label={t.account.preferencesMenu}
          labelIcon={<SlidersIcon />}
          href={`${href('/account')}#preferences`}
        />
        <UserButton.Link label={t.account.gamesMenu} labelIcon={<StarIcon />} href={`${href('/account')}#games`} />
        <UserButton.Link label={t.account.savedMenu} labelIcon={<BookmarkIcon />} href={`${href('/account')}#saved`} />
      </UserButton.MenuItems>
    </UserButton>
  )
}
