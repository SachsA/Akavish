'use client'

import { SignInButton, useClerk, useUser } from '@clerk/nextjs'
import { useCallback, useEffect, useId, useState } from 'react'
import type { CommentList, CommentView } from '@/lib/readers'
import { readerMessage } from '@/lib/reader-messages'
import { RoleBadge } from './RoleBadge'
import { useI18n } from './I18nProvider'
import { REGION_COOKIE, type Locale } from '@/lib/i18n/config'
import { formatDate } from '@/lib/i18n/dates'
import type { Messages } from '@/lib/i18n/messages'

// Comments under an article. Rules (apps/cms/src/lib/comments.ts): verified
// readers only, plain text, threads one level deep with "replying to @name",
// likes / dislikes, top comments by likes then oldest, no editing, delete your
// own, Owner / Admin / Mod hide, restore and delete anyone's, report once.
// Nothing renders when comments are switched off in /admin.

const MAX = 2000
const REASONS = ['spam', 'harassment', 'illegal', 'other'] as const

type Load = { list: CommentList; comments: CommentView[] }

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  // The page's language is on <html lang> (set by the [locale] layout).
  const locale: Locale = document.documentElement.lang === 'fr' ? 'fr' : 'en'
  if (!res.ok) throw new Error(data.code ? readerMessage(data.code, locale) : (data.message ?? readerMessage(undefined, locale)))
  return data
}

export function Comments({ articleId }: { articleId: string }) {
  const { t, locale } = useI18n()
  const { isLoaded, isSignedIn, user } = useUser()
  const [state, setState] = useState<Load | null>(null)
  const [failed, setFailed] = useState(false)
  const [more, setMore] = useState(false)

  const load = useCallback(
    async (page = 1) => {
      const res = await fetch(`/api/comments?article=${articleId}&page=${page}`)
      if (!res.ok) throw new Error(String(res.status))
      const list = (await res.json()) as CommentList
      setState((prev) => ({
        list,
        comments: page === 1 || !prev ? list.comments : [...prev.comments, ...list.comments],
      }))
      setFailed(false)
    },
    [articleId]
  )

  // Load at once (whether Clerk has loaded or not), and again once the reader
  // is known to be signed in, for their votes and rights.
  const signedIn = isLoaded && isSignedIn === true
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching keyed on the article and on who's signed in
    load().catch(() => setFailed(true))
  }, [load, signedIn])

  // A link to one comment (#comment-12, from the moderation channel): scroll to it.
  useEffect(() => {
    if (!state || typeof window === 'undefined') return
    const hash = window.location.hash
    if (hash.startsWith('#comment-')) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'center' })
  }, [state])

  if (failed) {
    return (
      <section aria-labelledby="comments-title" className="mt-12">
        <h2 id="comments-title" className="text-xl font-bold text-white mb-2">{t.comments.title}</h2>
        <p className="text-zinc-400 text-sm">{t.comments.unavailable}</p>
      </section>
    )
  }
  if (!state || !state.list.enabled) return null

  const { list, comments } = state
  const viewer = list.viewer
  // Clerk's own answer first: the CMS copy is only refreshed when the reader
  // writes, so an account synced before it was verified (or before comments
  // existed) would be stuck behind its own stale flag. Every write is checked
  // again on the server against Clerk anyway.
  const verified = user
    ? user.primaryEmailAddress?.verification?.status === 'verified'
    : viewer?.verified === true
  const refresh = () => load().catch(() => setFailed(true))

  return (
    <section aria-labelledby="comments-title" className="mt-12">
      <h2 id="comments-title" className="text-xl font-bold text-white mb-4">
        {t.comments.title}
        {list.total > 0 ? ` (${list.total})` : ''}
      </h2>

      {list.closed ? (
        <p className="text-sm text-zinc-400 mb-6">{t.comments.closed}</p>
      ) : !isSignedIn ? (
        <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
          <span>{t.comments.join}</span>
          <SignInButton mode="modal">
            <button type="button" className="px-3 py-1.5 rounded-md bg-emerald-700 text-on-accent font-semibold hover:bg-emerald-600 transition-colors">
              {t.comments.signIn}
            </button>
          </SignInButton>
        </div>
      ) : viewer?.banned ? (
        <p className="text-sm text-zinc-400 mb-6">{readerMessage('banned', locale)}</p>
      ) : !verified ? (
        <p className="text-sm text-zinc-400 mb-6">{readerMessage('unverified', locale)}</p>
      ) : (
        <CommentForm articleId={articleId} onPosted={refresh} />
      )}

      {comments.length === 0 ? (
        !list.closed && <p className="text-sm text-zinc-400">{t.comments.none}</p>
      ) : (
        <ol className="space-y-6">
          {comments.map((c) => (
            <li key={c.id}>
              <Comment
                comment={c}
                articleId={articleId}
                canAct={!!isSignedIn && !!verified && !viewer?.banned}
                canModerate={!!viewer?.canModerate}
                closed={list.closed}
                onChange={refresh}
              />
              {c.replies && c.replies.length > 0 && (
                <ol className="mt-4 ml-4 sm:ml-8 pl-4 border-l border-zinc-800 space-y-4">
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <Comment
                        comment={r}
                        articleId={articleId}
                        canAct={!!isSignedIn && !!verified && !viewer?.banned}
                        canModerate={!!viewer?.canModerate}
                        closed={list.closed}
                        onChange={refresh}
                      />
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}

      {list.page < list.totalPages && (
        <button
          type="button"
          disabled={more}
          onClick={async () => {
            setMore(true)
            await load(list.page + 1).catch(() => setFailed(true))
            setMore(false)
          }}
          className="mt-6 px-3 py-1.5 rounded-md border border-zinc-800 text-sm text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors disabled:opacity-60"
        >
          {more ? t.comments.loading : t.comments.more}
        </button>
      )}
    </section>
  )
}

function CommentForm({
  articleId,
  replyTo,
  replyToName,
  onPosted,
  onCancel,
}: {
  articleId: string
  replyTo?: number
  replyToName?: string | null
  onPosted: () => void
  onCancel?: () => void
}) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await send('/api/comments', 'POST', { articleId, body: text, replyTo: replyTo ?? null })
      setText('')
      onPosted()
      onCancel?.()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={replyTo ? 'mt-3' : 'mb-8'}>
      <label htmlFor={id} className="sr-only">
        {replyTo ? t.comments.replyTo(replyToName ?? null) : t.comments.add}
      </label>
      {replyTo && (
        <p className="text-xs text-zinc-400 mb-1">
          {t.comments.replyingTo} <span className="text-zinc-200">@{replyToName ?? t.comments.reader}</span>
        </p>
      )}
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        rows={replyTo ? 2 : 3}
        maxLength={MAX}
        placeholder={replyTo ? t.comments.writeReply : t.comments.writeComment}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden focus:border-zinc-400"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="px-3 py-1.5 rounded-md bg-emerald-700 text-on-accent text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-60"
        >
          {busy ? t.comments.posting : replyTo ? t.comments.reply : t.comments.post}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-zinc-400 hover:text-white">
            {t.comments.cancel}
          </button>
        )}
        <span className="text-xs text-zinc-400 ml-auto">
          {text.length}/{MAX}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  )
}

function Comment({
  comment: c,
  articleId,
  canAct,
  canModerate,
  closed,
  onChange,
}: {
  comment: CommentView
  articleId: string
  canAct: boolean
  canModerate: boolean
  closed: boolean
  onChange: () => void
}) {
  const { t, locale } = useI18n()
  const clerk = useClerk()
  const [votes, setVotes] = useState({ likes: c.likes, dislikes: c.dislikes, myVote: c.myVote })
  const [replying, setReplying] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(c.reported)
  const [error, setError] = useState<string | null>(null)

  // New data from the server (after a refresh) wins over local state.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- syncing props into local state on refresh */
    setVotes({ likes: c.likes, dislikes: c.dislikes, myVote: c.myVote })
    setReported(c.reported)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [c.likes, c.dislikes, c.myVote, c.reported])

  const act = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function vote(value: 1 | -1) {
    if (!canAct) return clerk.openSignIn()
    const next = votes.myVote === value ? 0 : value
    await act(async () => setVotes(await send('/api/comments/vote', 'POST', { commentId: c.id, value: next })))
  }

  const placeholder =
    c.status === 'deleted'
      ? t.comments.deleted
      : c.status === 'hidden' && c.body === null
        ? t.comments.hiddenByMod
        : null
  const live = c.status === 'visible'

  return (
    <article id={`comment-${c.id}`} className="scroll-mt-24">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {c.author ? (
          <>
            <span className="font-semibold text-zinc-100">{c.author.name}</span>
            <RoleBadge role={c.author.role} />
          </>
        ) : (
          <span className="text-zinc-400">{t.comments.deletedAuthor}</span>
        )}
        <time dateTime={c.createdAt} className="text-xs text-zinc-400">
          {timeAgo(c.createdAt, t, locale)}
        </time>
        {c.status === 'hidden' && canModerate && (
          <span className="text-xs font-semibold text-danger">{t.comments.hidden}</span>
        )}
      </header>
      {c.replyToName && c.parentId !== null && (
        <p className="text-xs text-zinc-400 mt-0.5">
          {t.comments.replyingTo} <span className="text-zinc-300">@{c.replyToName}</span>
        </p>
      )}

      {placeholder ? (
        <p className="mt-1 text-sm italic text-zinc-400">{placeholder}</p>
      ) : (
        // Plain text: links and HTML are shown as typed, never turned into anything.
        <p className="mt-1 text-sm text-zinc-200 whitespace-pre-wrap wrap-break-word">{c.body}</p>
      )}

      {c.status !== 'deleted' && (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-zinc-400">
          {live && (
            <>
              <VoteButton label={t.comments.like} ownVote={t.comments.ownVote} count={votes.likes} active={votes.myVote === 1} disabled={c.mine} onClick={() => vote(1)} up />
              <VoteButton label={t.comments.dislike} ownVote={t.comments.ownVote} count={votes.dislikes} active={votes.myVote === -1} disabled={c.mine} onClick={() => vote(-1)} />
              {canAct && !closed && (
                <SmallButton onClick={() => setReplying((v) => !v)}>{t.comments.reply}</SmallButton>
              )}
              {canAct && !c.mine && (
                <SmallButton onClick={() => setReporting((v) => !v)} disabled={reported}>
                  {reported ? t.comments.reported : t.comments.report}
                </SmallButton>
              )}
            </>
          )}
          {canModerate && c.status === 'visible' && (
            <SmallButton onClick={() => act(() => send('/api/comments/moderate', 'POST', { commentId: c.id, action: 'hide' }).then(onChange))}>
              {t.comments.hide}
            </SmallButton>
          )}
          {canModerate && c.status === 'hidden' && (
            <SmallButton onClick={() => act(() => send('/api/comments/moderate', 'POST', { commentId: c.id, action: 'restore' }).then(onChange))}>
              {t.comments.restore}
            </SmallButton>
          )}
          {(c.mine || canModerate) && (
            <SmallButton
              danger
              onClick={() => {
                if (!window.confirm(c.mine ? t.comments.confirmDeleteOwn : t.comments.confirmDelete)) return
                act(() => send(`/api/comments?id=${c.id}`, 'DELETE').then(onChange))
              }}
            >
              {t.comments.delete}
            </SmallButton>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}

      {reporting && (
        <ReportForm
          commentId={c.id}
          onDone={(hidden) => {
            setReporting(false)
            setReported(true)
            if (hidden) onChange()
          }}
          onCancel={() => setReporting(false)}
        />
      )}

      {replying && (
        <CommentForm
          articleId={articleId}
          replyTo={c.id}
          replyToName={c.author?.name}
          onPosted={onChange}
          onCancel={() => setReplying(false)}
        />
      )}
    </article>
  )
}

function ReportForm({
  commentId,
  onDone,
  onCancel,
}: {
  commentId: number
  onDone: (hidden: boolean) => void
  onCancel: () => void
}) {
  const { t, locale } = useI18n()
  const [reason, setReason] = useState<string>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = useId()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) return setError(readerMessage('bad-reason', locale))
    setBusy(true)
    setError(null)
    try {
      const res = await send('/api/comments/report', 'POST', { commentId, reason, note })
      onDone(Boolean(res.hidden))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 p-3 rounded-md border border-zinc-800 bg-zinc-900 text-sm">
      <fieldset>
        <legend className="font-semibold text-zinc-100 mb-2">{t.comments.reportWhy}</legend>
        <div className="grid gap-1">
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-zinc-300">
              <input type="radio" name={name} value={r} checked={reason === r} onChange={() => setReason(r)} />
              {t.comments.reasons[r]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block mt-3 text-zinc-400">
        {t.comments.note}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          rows={2}
          className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-zinc-100 focus:outline-hidden focus:border-zinc-400"
        />
      </label>
      <p className="mt-2 text-xs text-zinc-400">
        {t.comments.reportInfo}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-md bg-emerald-700 text-on-accent font-semibold hover:bg-emerald-600 disabled:opacity-60">
          {busy ? t.comments.sending : t.comments.report}
        </button>
        <button type="button" onClick={onCancel} className="text-zinc-400 hover:text-white">
          {t.comments.cancel}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-danger">
          {error}
        </p>
      )}
    </form>
  )
}

function VoteButton({
  label,
  count,
  active,
  disabled,
  onClick,
  up = false,
  ownVote,
}: {
  label: string
  ownVote: string
  count: number
  active: boolean
  disabled: boolean
  onClick: () => void
  up?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${label} (${count})`}
      title={disabled ? ownVote : label}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors disabled:cursor-default ${
        active ? 'text-emerald-400 bg-zinc-900' : 'hover:text-white hover:bg-zinc-900'
      }`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`w-4 h-4 ${up ? '' : 'rotate-180'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
        <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0 4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 17.6 21H7" />
      </svg>
      <span>{count}</span>
    </button>
  )
}

function SmallButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 rounded-md transition-colors disabled:opacity-60 disabled:cursor-default ${
        danger ? 'hover:text-danger hover:bg-zinc-900' : 'hover:text-white hover:bg-zinc-900'
      }`}
    >
      {children}
    </button>
  )
}

function timeAgo(iso: string, t: Messages, locale: Locale): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return t.comments.justNow
  if (s < 3600) return t.comments.minutesAgo(Math.floor(s / 60))
  if (s < 86_400) return t.comments.hoursAgo(Math.floor(s / 3600))
  if (s < 7 * 86_400) return t.comments.daysAgo(Math.floor(s / 86_400))
  // Older: the date. Comments load in the browser, so the English style can be the reader's.
  const region = document.cookie.includes(`${REGION_COOKIE}=GB`) ? 'GB' : 'US'
  return formatDate(iso, { locale, region })
}
