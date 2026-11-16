import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import Link from '@/components/LocaleLink'
import { getMessages, localHref, setRequestLocale } from '@/lib/i18n/server'
import { currentUser } from '@clerk/nextjs/server'
import { AccountActions } from '@/components/AccountActions'
import { Pagination } from '@/components/Pagination'
import { RoleBadge } from '@/components/RoleBadge'
import { SavedArticleList, type SavedItem } from '@/components/SavedArticleList'
import { parsePage } from '@/lib/pagination'
import { fetchSavedArticles, profileFromUser, syncReader, type Reader } from '@/lib/readers'
import { log } from '@/lib/log'

// The signed-in reader's page: who they are (with their badge) and the
// articles they saved. Protected by the middleware (`/account(.*)`), personal,
// so never cached and never indexed.
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  setRequestLocale((await params).locale)
  return { title: getMessages().account.title, robots: { index: false } }
}

const SAVED_PER_PAGE = 12

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ page?: string | string[] }>
}) {
  setRequestLocale((await params).locale)
  const t = getMessages()
  const page = parsePage((await searchParams).page)
  if (page === null) notFound()

  const user = await currentUser()
  if (!user) redirect(`${localHref('/sign-in')}?redirect_url=${localHref('/account')}`)

  const profile = profileFromUser(user)
  const name = profile.displayName ?? profile.username ?? profile.email ?? t.account.reader

  // The CMS side (role, saved articles) can be down or not configured: the
  // page still shows who you are, and says the rest is unavailable.
  let reader: Reader | null = null
  let saved: Awaited<ReturnType<typeof fetchSavedArticles>> | null = null
  try {
    reader = await syncReader(profile)
    saved = await fetchSavedArticles(user.id, { page, limit: SAVED_PER_PAGE })
  } catch (error) {
    log.warn('account page without reader data', { error })
  }
  if (saved && page > 1 && page > saved.totalPages) notFound()

  const items: SavedItem[] = (saved?.articles ?? []).map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    category: a.category,
    coverImage: a.coverImage,
    game: a.game?.name,
    savedAt: a.savedAt,
  }))

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center gap-4 mb-10">
        {profile.imageUrl && (
          <Image
            src={profile.imageUrl}
            alt=""
            width={64}
            height={64}
            // Clerk's own CDN, already sized: no need to route it through ours.
            unoptimized
            className="w-16 h-16 rounded-full bg-zinc-800 object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black tracking-tight text-white">
            <span className="truncate">{name}</span>
            <RoleBadge role={reader?.role} />
          </h1>
          {profile.email && <p className="text-sm text-zinc-400 truncate">{profile.email}</p>}
          {reader && (
            <p className="text-sm text-zinc-400">
              {t.account.commentsAs} <span className="text-zinc-200 font-medium">@{reader.username}</span>
            </p>
          )}
          {!profile.emailVerified && (
            <p className="text-sm text-danger">
              {t.account.verifyEmail}
            </p>
          )}
          {reader?.authorSlug && (
            <Link
              href={`/author/${reader.authorSlug}`}
              className="text-sm text-zinc-300 hover:text-white underline underline-offset-2"
            >
              {t.account.authorPage}
            </Link>
          )}
        </div>
      </div>

      <div className="mb-12">
        <AccountActions />
      </div>

      <h2 className="text-xl font-bold text-white mb-4">
        {t.account.saved}
        {saved && saved.total > 0 ? ` (${saved.total})` : ''}
      </h2>

      {!saved ? (
        <p className="text-zinc-400">{t.account.unavailable}</p>
      ) : saved.total === 0 ? (
        <p className="text-zinc-400">{t.account.nothingSaved(t.save.save)}</p>
      ) : (
        <>
          <SavedArticleList items={items} />
          <Pagination basePath="/account" page={saved.page} totalPages={saved.totalPages} />
        </>
      )}
    </div>
  )
}
