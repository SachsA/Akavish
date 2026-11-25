'use client'

// /account → Preferences: "Notifications on this device". Push is per browser:
// the switch turns it on or off here only, and says why when it can't
// (blocked, iPhone not from the home screen, unsupported, not set up yet).

import { useEffect, useState } from 'react'
import { useI18n } from './I18nProvider'
import { currentSubscription, disablePush, enablePush, pushSupport, type PushSupport } from '@/lib/push-client'

export function PushToggle() {
  const { t, locale } = useI18n()
  const [support, setSupport] = useState<PushSupport | null>(null)
  const [on, setOn] = useState<boolean | null>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'denied' | 'failed'>('idle')

  useEffect(() => {
    const s = pushSupport()
    setSupport(s)
    if (s !== 'ok') return
    if (Notification.permission === 'denied') setState('denied')
    currentSubscription()
      .then((sub) => setOn(!!sub))
      .catch(() => setOn(false))
  }, [])

  async function toggle() {
    if (on === null || state === 'busy') return
    setState('busy')
    if (on) {
      await disablePush()
      setOn(false)
      setState('idle')
      return
    }
    const outcome = await enablePush(locale)
    setOn(outcome === 'on')
    setState(outcome === 'on' ? 'idle' : outcome)
  }

  const note =
    support === 'off'
      ? t.push.notYet
      : support === 'unsupported'
        ? t.push.unsupported
        : support === 'ios-home-screen'
          ? t.push.ios
          : state === 'denied'
            ? t.push.denied
            : state === 'failed'
              ? t.push.failed
              : on
                ? t.push.onHint
                : t.push.offHint

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-white">{t.push.title}</span>
        {support === 'ok' && (
          <button
            type="button"
            role="switch"
            aria-checked={on === true}
            aria-label={t.push.title}
            disabled={on === null || state === 'busy' || (state === 'denied' && !on)}
            onClick={toggle}
            className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
              on ? 'bg-emerald-500' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[#ffffff] shadow-sm transition-transform ${
                on ? 'translate-x-5' : ''
              }`}
            />
          </button>
        )}
      </div>
      <p className={`mt-2 text-xs ${state === 'denied' || state === 'failed' ? 'text-danger' : 'text-zinc-400'}`}>
        {support === null ? '' : note}
      </p>
    </div>
  )
}
