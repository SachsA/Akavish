import type { Locale } from '../config'
import { en, type Messages } from './en'
import { fr } from './fr'

export type { Messages }

const ALL: Record<Locale, Messages> = { en, fr }

export function messagesFor(locale: Locale): Messages {
  return ALL[locale] ?? en
}
