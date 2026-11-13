'use client'

import { SignInButton, useClerk, useUser } from '@clerk/nextjs'
import { useCallback, useEffect, useId, useState } from 'react'
import type { CommentList, CommentView } from '@/lib/readers'
import { readerMessage } from '@/lib/reader-messages'
import { RoleBadge } from './RoleBadge'

// Comments under an article. Rules (apps/cms/src/lib/comments.ts): verified
// readers only, plain text, threads one level deep with "replying to @name",
// likes / dislikes, top comments by likes then oldest, no editing, delete your
// own, Owner / Admin / Mod hide, restore and delete anyone's, report once.
// Nothing renders when comments are switched off in /admin.

const MAX = 2000
const REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or hate' },
  { value: 'illegal', label: 'Illegal content' },
  { value: 'other', label: 'Something else' },
] as const

type Load = { list: CommentList; comments: CommentView[] }

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message ?? readerMessage(data.code))
  return data
}

export function Comments({ articleId }: { articleId: string }) {
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
        <h2 id="comments-title" className="text-xl font-bold text-white mb-2">Comments</h2>
        <p className="text-zinc-400 text-sm">Comments are unavailable right now.</p>
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
        Comments{list.total > 0 ? ` (${list.total})` : ''}
      </h2>

      {list.closed ? (
        <p className="text-sm text-zinc-400 mb-6">Comments are closed on this article.</p>
      ) : !isSignedIn ? (
        <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
          <span>Join the conversation:</span>
          <SignInButton mode="modal">
            <button type="button" className="px-3 py-1.5 rounded-md bg-emerald-700 text-on-accent font-semibold hover:bg-emerald-600 transition-colors">
              Sign in to comment
            </button>
          </SignInButton>
        </div>
      ) : viewer?.banned ? (
        <p className="text-sm text-zinc-400 mb-6">{readerMessage('banned')}</p>
      ) : !verified ? (
        <p className="text-sm text-zinc-400 mb-6">{readerMessage('unverified')}</p>
      ) : (
        <CommentForm articleId={articleId} onPosted={refresh} />
      )}

      {comments.length === 0 ? (
        !list.closed && <p className="text-sm text-zinc-400">No comments yet. Be the first.</p>
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
          {more ? 'Loading…' : 'More comments'}
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
        {replyTo ? `Reply to ${replyToName ?? 'this comment'}` : 'Add a comment'}
      </label>
      {replyTo && (
        <p className="text-xs text-zinc-400 mb-1">
          Replying to <span className="text-zinc-200">@{replyToName ?? 'reader'}</span>
        </p>
      )}
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        rows={replyTo ? 2 : 3}
        maxLength={MAX}
        placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="px-3 py-1.5 rounded-md bg-emerald-700 text-on-accent text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-60"
        >
          {busy ? 'Posting…' : replyTo ? 'Reply' : 'Post'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-zinc-400 hover:text-white">
            Cancel
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
    c.status === 'deleted' ? 'Comment deleted.' : c.status === 'hidden' && c.body === null ? 'Hidden by a moderator.' : null
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
          <span className="text-zinc-400">[deleted]</span>
        )}
        <time dateTime={c.createdAt} className="text-xs text-zinc-400">
          {timeAgo(c.createdAt)}
        </time>
        {c.status === 'hidden' && canModerate && (
          <span className="text-xs font-semibold text-danger">Hidden</span>
        )}
      </header>
      {c.replyToName && c.parentId !== null && (
        <p className="text-xs text-zinc-400 mt-0.5">
          Replying to <span className="text-zinc-300">@{c.replyToName}</span>
        </p>
      )}

      {placeholder ? (
        <p className="mt-1 text-sm italic text-zinc-400">{placeholder}</p>
      ) : (
        // Plain text: links and HTML are shown as typed, never turned into anything.
        <p className="mt-1 text-sm text-zinc-200 whitespace-pre-wrap break-words">{c.body}</p>
      )}

      {c.status !== 'deleted' && (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-zinc-400">
          {live && (
            <>
              <VoteButton label="Like" count={votes.likes} active={votes.myVote === 1} disabled={c.mine} onClick={() => vote(1)} up />
              <VoteButton label="Dislike" count={votes.dislikes} active={votes.myVote === -1} disabled={c.mine} onClick={() => vote(-1)} />
              {canAct && !closed && (
                <SmallButton onClick={() => setReplying((v) => !v)}>Reply</SmallButton>
              )}
              {canAct && !c.mine && (
                <SmallButton onClick={() => setReporting((v) => !v)} disabled={reported}>
                  {reported ? 'Reported' : 'Report'}
                </SmallButton>
              )}
            </>
          )}
          {canModerate && c.status === 'visible' && (
            <SmallButton onClick={() => act(() => send('/api/comments/moderate', 'POST', { commentId: c.id, action: 'hide' }).then(onChange))}>
              Hide
            </SmallButton>
          )}
          {canModerate && c.status === 'hidden' && (
            <SmallButton onClick={() => act(() => send('/api/comments/moderate', 'POST', { commentId: c.id, action: 'restore' }).then(onChange))}>
              Restore
            </SmallButton>
          )}
          {(c.mine || canModerate) && (
            <SmallButton
              danger
              onClick={() => {
                if (!window.confirm(c.mine ? 'Delete your comment? This can’t be undone.' : 'Delete this comment?')) return
                act(() => send(`/api/comments?id=${c.id}`, 'DELETE').then(onChange))
              }}
            >
              Delete
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
  const [reason, setReason] = useState<string>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = useId()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) return setError(readerMessage('bad-reason'))
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
        <legend className="font-semibold text-zinc-100 mb-2">Why are you reporting this comment?</legend>
        <div className="grid gap-1">
          {REASONS.map((r) => (
            <label key={r.value} className="flex items-center gap-2 text-zinc-300">
              <input type="radio" name={name} value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block mt-3 text-zinc-400">
        Anything to add? (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          rows={2}
          className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-zinc-100 focus:outline-none focus:border-zinc-400"
        />
      </label>
      <p className="mt-2 text-xs text-zinc-400">
        Reports go to the moderators. A comment reported by several readers is hidden until they look at it.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-md bg-emerald-700 text-on-accent font-semibold hover:bg-emerald-600 disabled:opacity-60">
          {busy ? 'Sending…' : 'Report'}
        </button>
        <button type="button" onClick={onCancel} className="text-zinc-400 hover:text-white">
          Cancel
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
}: {
  label: string
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
      title={disabled ? 'You can’t vote on your own comment' : label}
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

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
