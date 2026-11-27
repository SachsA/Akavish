// On an esport article's card, over the cover's top-left corner: which game
// it is about (CS2, LoL…), and "Transfers" / "Mercato" for roster news, so a
// mixed list reads at a glance: the game in its colour (ESPORT_GAME_BADGE),
// the Mercato label quieter. Fixed colours: they sit on a photo, in both themes.
// `inline`: next to the section name in the home page's Top stories (no
// photo there), the Mercato label in the theme's colours. Never blurred by
// anti-spoil: the game gives nothing away.
import type { Article } from '@akavish/types'
import { ESPORT_GAME_BADGE, ESPORT_GAME_LABEL, esportGameOfSlug } from '@/lib/esport'
import { getMessages } from '@/lib/i18n/server'

/** The tag of roster news (the Mercato page, transfers/page.tsx). */
const TRANSFERS_TAG = 'transfers'

export function EsportBadges({ article, inline = false }: { article: Article; inline?: boolean }) {
  if (article.category !== 'esport') return null
  const t = getMessages()
  const game = esportGameOfSlug(article.game?.slug)
  const label = game ? ESPORT_GAME_LABEL[game] : article.game?.name
  const transfer = article.tags.includes(TRANSFERS_TAG)
  if (!label && !transfer) return null
  return (
    <span
      className={
        inline
          ? 'inline-flex flex-wrap items-center gap-1.5'
          : 'absolute left-2 top-2 z-20 flex flex-wrap gap-1.5'
      }
    >
      {label && (
        <span
          className={`rounded-sm font-bold uppercase tracking-wide ${inline ? 'px-1.5 text-[11px] leading-5' : 'px-2 py-0.5 text-xs shadow-sm'} ${
            game ? ESPORT_GAME_BADGE[game] : 'bg-[#09090b]/85 text-[#ffffff]'
          }`}
        >
          {label}
        </span>
      )}
      {transfer && (
        // Quieter than the game: the game is what a mixed list needs first.
        <span
          className={`rounded-sm px-1.5 text-[11px] font-medium ${
            inline
              ? 'bg-zinc-800 leading-5 text-zinc-300'
              : 'bg-[#09090b]/60 py-0.5 text-[#e4e4e7] backdrop-blur-xs'
          }`}
        >
          {t.esport.transfers}
        </span>
      )}
    </span>
  )
}
