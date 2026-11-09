/**
 * Newsletter double opt-in (src/lib/newsletter.ts): the guarantees the privacy
 * policy makes. Runs against the local/CI Postgres like api.int.spec.ts; every
 * address is unique to the run and deleted afterwards. Emails go to Payload's
 * console adapter (no RESEND_API_KEY in tests); `sendEmail` is spied on to read
 * the link.
 */
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import {
  confirm,
  hashToken,
  normalizeEmail,
  PENDING_TTL_MS,
  RESEND_COOLDOWN_MS,
  subscribe,
  unsubscribe,
  unsubscribeToken,
  verifyUnsubscribeToken,
} from '@/lib/newsletter'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

let payload: Payload
const RUN = `n${Date.now().toString(36)}`
const address = (name: string) => `${RUN}-${name}@example.com`

async function findSub(email: string) {
  const { docs } = await payload.find({
    collection: 'subscribers',
    where: { email: { equals: email } },
    overrideAccess: true,
    showHiddenFields: true,
  })
  return docs[0] as
    | { id: number; status: string; tokenHash: string; confirmationSentAt?: string }
    | undefined
}

/** Subscribe and return the raw token from the confirmation link that was "sent". */
async function subscribeAndGetToken(email: string, now = Date.now()) {
  const send = vi.spyOn(payload, 'sendEmail')
  const result = await subscribe(payload, { email, consent: true, source: 'test' }, now)
  const html = String((send.mock.calls.at(-1)?.[0] as { html?: string } | undefined)?.html ?? '')
  send.mockRestore()
  const token = html.match(/newsletter\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1]
  return { result, token }
}

beforeAll(async () => {
  payload = await getPayload({ config })
})

afterAll(async () => {
  await payload.delete({
    collection: 'subscribers',
    where: { email: { like: RUN } },
    overrideAccess: true,
  })
})

describe('normalizeEmail', () => {
  it('trims and lowercases, rejects what is not an address', () => {
    expect(normalizeEmail('  Alex@Example.COM ')).toBe('alex@example.com')
    expect(normalizeEmail('no-at-sign')).toBeNull()
    expect(normalizeEmail('a@b')).toBeNull()
    expect(normalizeEmail(42)).toBeNull()
    expect(normalizeEmail(`${'a'.repeat(250)}@example.com`)).toBeNull()
  })
})

describe('subscribe', () => {
  it('needs a valid address and explicit consent', async () => {
    expect(await subscribe(payload, { email: 'nope', consent: true })).toEqual({
      ok: false,
      error: 'invalid-email',
    })
    expect(await subscribe(payload, { email: address('noconsent'), consent: 'yes' })).toEqual({
      ok: false,
      error: 'consent-required',
    })
    expect(await findSub(address('noconsent'))).toBeUndefined()
  })

  it('creates a pending subscriber, emails a link, and stores only the token hash', async () => {
    const email = address('new')
    const { result, token } = await subscribeAndGetToken(email)
    expect(result).toEqual({ ok: true, emailed: true })
    expect(token).toBeTruthy()

    const sub = await findSub(email)
    expect(sub?.status).toBe('pending')
    expect(sub?.tokenHash).toBe(hashToken(token!))
    expect(sub?.tokenHash).not.toContain(token!)
    expect(sub?.confirmationSentAt).toBeTruthy()
  })

  it('does not email the same address again within the cooldown', async () => {
    const email = address('cooldown')
    const now = Date.now()
    await subscribeAndGetToken(email, now)
    const again = await subscribeAndGetToken(email, now + 60_000)
    expect(again.result).toEqual({ ok: true, emailed: false })
    expect(again.token).toBeUndefined()

    const later = await subscribeAndGetToken(email, now + RESEND_COOLDOWN_MS + 1)
    expect(later.result).toEqual({ ok: true, emailed: true })
  })

  it('answers the same for an already confirmed address, without emailing', async () => {
    const email = address('already')
    const { token } = await subscribeAndGetToken(email)
    await confirm(payload, token)
    const again = await subscribeAndGetToken(email, Date.now() + RESEND_COOLDOWN_MS + 1)
    expect(again.result).toEqual({ ok: true, emailed: false })
    expect((await findSub(email))?.status).toBe('confirmed')
  })

  it('deletes unconfirmed sign-ups older than 30 days', async () => {
    const email = address('stale')
    await subscribeAndGetToken(email)
    // Another sign-up 31 days later sweeps it.
    await subscribe(
      payload,
      { email: address('sweeper'), consent: true },
      Date.now() + PENDING_TTL_MS + 86_400_000,
    )
    expect(await findSub(email)).toBeUndefined()
  })
})

describe('confirm and unsubscribe', () => {
  it('confirms with the emailed token, idempotently, and hands back an unsubscribe token', async () => {
    const email = address('confirm')
    const { token } = await subscribeAndGetToken(email)
    const first = await confirm(payload, token)
    expect(first.result).toBe('confirmed')
    expect(await confirm(payload, token)).toEqual(first)
    const sub = await findSub(email)
    expect(sub?.status).toBe('confirmed')
    expect(first).toEqual({ result: 'confirmed', unsubscribeToken: unsubscribeToken(sub!.id) })
  })

  it('rejects unknown or malformed confirmation tokens', async () => {
    expect(await confirm(payload, 'x'.repeat(43))).toEqual({ result: 'invalid' })
    expect(await confirm(payload, undefined)).toEqual({ result: 'invalid' })
  })

  it('only accepts unsubscribe tokens signed with the secret', () => {
    expect(verifyUnsubscribeToken(unsubscribeToken(42))).toBe('42')
    const [, signature] = unsubscribeToken(42).split('.')
    expect(verifyUnsubscribeToken(`43.${signature}`)).toBeNull()
    expect(verifyUnsubscribeToken('42.forged')).toBeNull()
    expect(verifyUnsubscribeToken('42')).toBeNull()
    expect(verifyUnsubscribeToken(undefined)).toBeNull()
  })

  it('unsubscribing deletes the subscriber', async () => {
    const email = address('leave')
    const { token } = await subscribeAndGetToken(email)
    const confirmed = await confirm(payload, token)
    const leave = confirmed.result === 'confirmed' ? confirmed.unsubscribeToken : ''
    expect(await unsubscribe(payload, leave)).toBe('unsubscribed')
    expect(await findSub(email)).toBeUndefined()
    expect(await unsubscribe(payload, leave)).toBe('invalid')
    expect(await unsubscribe(payload, 'short')).toBe('invalid')
  })
})

describe('access', () => {
  it('the public cannot list or create subscribers through the API', async () => {
    await expect(
      payload.find({ collection: 'subscribers', overrideAccess: false }),
    ).rejects.toThrow()
    await expect(
      payload.create({
        collection: 'subscribers',
        data: {
          email: address('direct'),
          status: 'pending',
          tokenHash: 'x',
          consentAt: new Date().toISOString(),
        },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
