'use client'

import Link from 'next/link'
import { useId, useState, type FormEvent } from 'react'
import type { SignupSource } from '@/lib/newsletter'

// Newsletter sign-up form: email + explicit consent box (GDPR: unticked by
// default, one purpose, link to the policy). Posts to /api/newsletter; the
// reader then gets a confirmation email and is only subscribed once they
// click it (double opt-in, apps/cms/src/lib/newsletter.ts).
//
// Inputs are uncontrolled, read from the form on submit: a controlled input can
// be reset by hydration if someone types before the page is interactive (that
// bit the header search box, see SearchBar).

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done' }
  | { kind: 'error'; message: string }

export function NewsletterSignup({
  source,
  title = 'Get the newsletter',
  blurb = 'The week’s biggest gaming news, leaks and reviews in your inbox. No spam, unsubscribe in one click.',
}: {
  source: SignupSource
  title?: string
  blurb?: string
}) {
  const id = useId()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setStatus({ kind: 'sending' })
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(form.get('email') ?? ''),
          consent: form.get('consent') === 'on',
          website: String(form.get('website') ?? ''),
          source,
        }),
      })
      if (res.ok) {
        setStatus({ kind: 'done' })
        return
      }
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      setStatus({
        kind: 'error',
        message:
          res.status === 429
            ? 'Too many attempts. Try again in a minute.'
            : (data.message ?? 'Something went wrong. Try again.'),
      })
    } catch {
      setStatus({ kind: 'error', message: 'Network error. Check your connection and try again.' })
    }
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6"
    >
      <h2 id={`${id}-title`} className="text-lg font-bold text-white">
        {title}
      </h2>

      {status.kind === 'done' ? (
        <p role="status" className="mt-2 text-sm text-zinc-300">
          <strong className="text-white">Check your inbox.</strong> We sent you a link to confirm
          your subscription. Nothing arrives until you click it.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-zinc-400">{blurb}</p>
          <form onSubmit={onSubmit} className="mt-4 space-y-3" noValidate>
            <div className="flex flex-col sm:flex-row gap-2">
              <label htmlFor={`${id}-email`} className="sr-only">
                Email address
              </label>
              <input
                id={`${id}-email`}
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400"
              />
              <button
                type="submit"
                disabled={status.kind === 'sending'}
                className="px-4 py-2 rounded-md bg-emerald-700 text-on-accent text-sm font-semibold whitespace-nowrap hover:bg-emerald-600 disabled:opacity-60 transition-colors"
              >
                {status.kind === 'sending' ? 'Sending…' : 'Subscribe'}
              </button>
            </div>

            {/* Honeypot: hidden from people and screen readers, filled by bots. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor={`${id}-website`}>Website</label>
              <input
                id={`${id}-website`}
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="flex items-start gap-2">
              <input
                id={`${id}-consent`}
                name="consent"
                type="checkbox"
                required
                className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
              />
              <label htmlFor={`${id}-consent`} className="text-xs text-zinc-400 leading-relaxed">
                I agree to receive the Akavish newsletter by email. I can unsubscribe at any time.
                See the{' '}
                <Link href="/privacy" className="underline hover:text-white">
                  privacy policy
                </Link>
                .
              </label>
            </div>

            {status.kind === 'error' && (
              <p role="alert" className="text-sm text-danger">
                {status.message}
              </p>
            )}
          </form>
        </>
      )}
    </section>
  )
}
