// On an esport article's card, over the cover's top-left corner: which game
// it is about (CS2, LoL…), and "Transfers" / "Mercato" for roster news, so a
// mixed list reads at a glance. Fixed colours: they sit on a photo, in both themes.
import type { Article } from '@akavish/types'
import { ESPORT_GAME_LABEL, esportGameOfSlug } from '@/lib/esport'
import { getMessages } from '@/lib/i18n/server'

/** The tag of roster news (the Mercato page, transfers/page.tsx). */
const TRANSFERS_TAG = 'transfers'

export function EsportBadges({ article }: { article: Article }) {
  if (article.category !== 'esport') return null
  const t = getMessages()
  const game = esportGameOfSlug(article.game?.slug)
  const label = game ? ESPORT_GAME_LABEL[game] : article.game?.name
  const transfer = article.tags.includes(TRANSFERS_TAG)
  if (!label && !transfer) return null
  return (
    <span className="absolute left-2 top-2 z-20 flex flex-wrap gap-1.5">
      {label && (
        <span className="rounded-sm bg-[#09090b]/85 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[#ffffff] shadow-sm">
          {label}
        </span>
      )}
      {transfer && (
        <span className="rounded-sm bg-[#047857] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[#ffffff] shadow-sm">
          {t.esport.transfers}
        </span>
      )}
    </span>
  )
}
