// ─── Article ───────────────────────────────────────────────────────────────

export type ArticleCategory =
  | 'news'
  | 'leak'
  | 'review'
  | 'preview'
  | 'conference'
  | 'esport'

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
  tags: string[]
  game?: Game
  author: Author
  publishedAt?: string
  createdAt: string
  updatedAt: string
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
