// ─── Default sources ─────────────────────────────────────────────────────────
// Loaded into `scout-sources` the first time the scout runs (an empty
// collection only: after that, the admin is the source of truth). Every URL
// was checked on 2026-11-10 with the scout's own User-Agent and served a valid
// RSS/Atom feed (from this repo's dev sandbox, Node's own HTTP clients got 403
// from several sites while curl with the same User-Agent got 200: a network
// artefact there, so production statuses are the ones to trust). A feed that
// refuses the scout shows "HTTP 403" in its status: untick it. Never switch to
// a browser User-Agent to get through.
//
// Reddit is deliberately absent (commercial use needs Reddit's written
// agreement, see the design doc). Rockstar, Ubisoft, Naughty Dog, EA and
// Bethesda publish no feed: their news reaches us through PlayStation Blog,
// Xbox Wire and the press, and through their X accounts from step 3.

export type Reliability = 'official' | 'high' | 'variable'
export type Cadence = 'fast' | 'normal'

export interface DefaultSource {
  name: string
  url: string
  reliability: Reliability
  /** `fast` = every 5 min (official sources), `normal` = every 15. */
  cadence: Cadence
  language: 'en' | 'fr' | 'other'
  /** General outlet: keep only items that look like games news (see `isGamingItem`). */
  general?: boolean
}

export const DEFAULT_SOURCES: DefaultSource[] = [
  // Official: read every 5 minutes, an announcement here confirms a rumour.
  {
    name: 'PlayStation Blog',
    url: 'https://blog.playstation.com/feed/',
    reliability: 'official',
    cadence: 'fast',
    language: 'en',
  },
  {
    name: 'Xbox Wire',
    url: 'https://news.xbox.com/en-us/feed/',
    reliability: 'official',
    cadence: 'fast',
    language: 'en',
  },
  {
    name: 'Nintendo (UK)',
    url: 'https://www.nintendo.co.uk/news.xml',
    reliability: 'official',
    cadence: 'fast',
    language: 'en',
  },
  {
    name: 'CD Projekt',
    url: 'https://www.cdprojekt.com/en/feed/',
    reliability: 'official',
    cadence: 'fast',
    language: 'en',
  },
  {
    name: 'Steam: Counter-Strike 2',
    url: 'https://store.steampowered.com/feeds/news/app/730/',
    reliability: 'official',
    cadence: 'fast',
    language: 'en',
  },

  // Games press.
  {
    name: 'IGN',
    url: 'https://feeds.feedburner.com/ign/all',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'GameSpot',
    url: 'https://www.gamespot.com/feeds/news/',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Gematsu',
    url: 'https://www.gematsu.com/feed',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Video Games Chronicle',
    url: 'https://www.videogameschronicle.com/feed/',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Game Informer',
    url: 'https://www.gameinformer.com/news.xml',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'PC Gamer',
    url: 'https://www.pcgamer.com/rss/',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Kotaku',
    url: 'https://kotaku.com/rss',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Nintendo Life',
    url: 'https://www.nintendolife.com/feeds/latest',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Insider Gaming',
    url: 'https://insider-gaming.com/feed/',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Aftermath',
    url: 'https://aftermath.site/rss/',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'MP1st',
    url: 'https://mp1st.com/feed',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'GamesBeat',
    url: 'https://gamesbeat.com/feed/',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },

  {
    name: 'GamesRadar+',
    url: 'https://www.gamesradar.com/rss/',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Push Square',
    url: 'https://www.pushsquare.com/feeds/latest',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Pure Xbox',
    url: 'https://www.purexbox.com/feeds/latest',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Destructoid',
    url: 'https://www.destructoid.com/feed/',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Rock Paper Shotgun',
    url: 'https://www.rockpapershotgun.com/feed',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Siliconera',
    url: 'https://www.siliconera.com/feed/',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Game Developer',
    url: 'https://www.gamedeveloper.com/rss.xml',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Eurogamer',
    url: 'https://www.eurogamer.net/feed',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Polygon',
    url: 'https://www.polygon.com/rss/index.xml',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'GamesIndustry.biz',
    url: 'https://www.gamesindustry.biz/feed',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'The Verge: Games',
    url: 'https://www.theverge.com/rss/games/index.xml',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  // French press (drafts are written in English anyway).
  {
    name: 'Jeuxvideo.com',
    url: 'https://www.jeuxvideo.com/rss/rss-news.xml',
    reliability: 'high',
    cadence: 'normal',
    language: 'fr',
  },

  {
    name: 'Le Monde: Pixels',
    url: 'https://www.lemonde.fr/pixels/rss_full.xml',
    reliability: 'high',
    cadence: 'normal',
    language: 'fr',
    general: true,
  },
  {
    name: 'IGN France',
    url: 'https://fr.ign.com/feed.xml',
    reliability: 'high',
    cadence: 'normal',
    language: 'fr',
  },
  {
    name: 'Gamekult',
    url: 'https://www.gamekult.com/feed.xml',
    reliability: 'high',
    cadence: 'normal',
    language: 'fr',
  },
  {
    name: 'Numerama',
    url: 'https://www.numerama.com/feed/',
    reliability: 'high',
    cadence: 'normal',
    language: 'fr',
    general: true,
  },

  // Business: general outlets, only their games stories are kept.
  {
    name: 'Fortune',
    url: 'https://fortune.com/feed/fortune-feeds/?id=3230629',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
    general: true,
  },
  {
    name: 'Breakit',
    url: 'https://www.breakit.se/feed/artiklar',
    reliability: 'high',
    cadence: 'normal',
    language: 'other',
    general: true,
  },

  // Esport news (results come from a data API at step 4).
  {
    name: 'HLTV',
    url: 'https://www.hltv.org/rss/news',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'VLR.gg',
    url: 'https://www.vlr.gg/rss',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
  },
  {
    name: 'Dexerto',
    url: 'https://www.dexerto.com/feed/',
    reliability: 'high',
    cadence: 'normal',
    language: 'en',
    // Also covers food, films and influencers: keep only its games stories.
    general: true,
  },
]

// Words that mark a games story in a general outlet. Deliberately broad: the
// AI triage drops what isn't news worth covering, this only saves it from
// reading every Fortune article about coffee prices.
const GAMING_WORDS =
  /\b(video ?games?|gaming|gamers?|jeux? vid[ée]o|esports?|e-sport|playstation|ps5|xbox|nintendo|switch 2|steam|valve|ubisoft|rockstar|gta|activision|blizzard|electronic arts|\bea\b|epic games|fortnite|riot games|embracer|paradox|remedy|cd projekt|take-two|sega|bandai|square enix|capcom|konami|tencent games|krafton|game studio|studio de jeu|spel(bolag|studio)?|datorspel|tv-spel)\b/i

/** Whether an item from a general outlet looks like games news. */
export function isGamingItem(title: string, summary = ''): boolean {
  return GAMING_WORDS.test(`${title} ${summary}`)
}
