// ─── CMS content in the page's language ──────────────────────────────────────
// Articles carry their French version (`fr`, machine-translated in the CMS:
// apps/cms/src/lib/translate.ts). On a French page the article shows it; an
// article not translated yet stays in English (the page says so). Tag names
// and author bios have a French field too. Pure.

import type { Article } from '@akavish/types'
import type { Locale } from './config'

export function localizeArticle(article: Article, locale: Locale): Article {
  if (locale !== 'fr' || !article.fr) return article
  const fr = article.fr
  return {
    ...article,
    title: fr.title,
    excerpt: fr.excerpt || article.excerpt,
    content: fr.content,
    // No French SEO fields: the page falls back to the (French) title and excerpt.
    seo: { title: fr.seo?.title, description: fr.seo?.description },
    coverImageAlt: fr.coverImageAlt ?? article.coverImageAlt,
  }
}

/** Whether this article reads in the page's language (English always does). */
export function isInLanguage(article: Article, locale: Locale): boolean {
  return locale === 'en' || Boolean(article.fr)
}

/** A French field when the page is French and it's filled, else the English one. */
export function pick(locale: Locale, en: string, fr: string | null | undefined): string {
  return locale === 'fr' && fr?.trim() ? fr.trim() : en
}
