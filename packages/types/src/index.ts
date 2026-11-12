// ─── Article ───────────────────────────────────────────────────────────────

export type ArticleCategory = 'news' | 'leak' | 'review' | 'preview' | 'conference' | 'esport'

export type ArticleStatus = 'draft' | 'published' | 'archived'

export interface Article {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  category: ArticleCategory
  status: ArticleStatus
  coverImage?: string
  /**
   * Same cover, 960px wide ('card' variant). For lists on clients that can't
   * resize on the fly (the mobile app): the hero is 1920px. The web doesn't
   * need it, next/image resizes.
   */
  coverImageCard?: string
  /** The editor's alt text for the cover (required on uploads in the CMS). */
  coverImageAlt?: string
  tags: string[]
  game?: Game
  author: Author
  publishedAt?: string
  createdAt: string
  updatedAt: string
  seo?: { title?: string; description?: string }
  /** Picked by the editor as the homepage lead story. */
  featured?: boolean
  /** Drafted with the AI scout and approved by an editor: the article shows a note. */
  aiAssisted?: boolean
  /** Reviews: the verdict out of 10. */
  score?: number
}

// ─── Game ──────────────────────────────────────────────────────────────────

export interface Game {
  id: string
  slug: string
  name: string
  coverImage?: string
  platform: string[]
  genre: string[]
  releaseDate?: string
}

// ─── Author ────────────────────────────────────────────────────────────────

export interface Author {
  id: string
  slug?: string
  name: string
  avatar?: string
  bio?: string
}

// ─── Pagination ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

// ─── API ───────────────────────────────────────────────────────────────────

export interface ApiError {
  message: string
  code?: string
  status: number
}
