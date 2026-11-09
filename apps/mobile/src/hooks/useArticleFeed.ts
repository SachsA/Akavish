import { useCallback, useEffect, useRef, useState } from 'react'
import { articlesApi, type Article, type ArticleCategory } from '@akavish/api-client'
import { appendPage, FEED_PAGE_SIZE, hasMore } from '../lib/feed'

type FeedError = 'initial' | 'refresh' | 'more' | null

interface FeedState {
  articles: Article[]
  page: number
  totalPages: number
  /** `loading` only before the first page has arrived (or on a retry). */
  status: 'loading' | 'ready' | 'error'
  refreshing: boolean
  loadingMore: boolean
  /** Which request failed last; cleared by the next success. */
  error: FeedError
}

const INITIAL: FeedState = {
  articles: [],
  page: 0,
  totalPages: 1,
  status: 'loading',
  refreshing: false,
  loadingMore: false,
  error: null,
}

/**
 * Published articles, newest first, one page at a time: first page on mount,
 * `refresh` for pull-to-refresh, `loadMore` at the end of the list. Pass a
 * category for a section feed, nothing for the home feed.
 *
 * Only the latest request is applied: a pull-to-refresh while a "load more" is
 * in flight wins, and a stale page can't land on top of fresh data.
 */
export function useArticleFeed(category?: ArticleCategory) {
  const [state, setState] = useState<FeedState>(INITIAL)
  const latest = useRef(0)

  // State is only set in the promise callbacks, never synchronously, so calling
  // this from the mount effect doesn't trigger a cascading render.
  const fetchPage = useCallback(
    (page: number, mode: 'initial' | 'refresh' | 'more') => {
      const request = ++latest.current
      return articlesApi.list({ page, limit: FEED_PAGE_SIZE, category }).then(
        (res) => {
          if (request !== latest.current) return
          setState((s) => ({
            ...s,
            articles: mode === 'more' ? appendPage(s.articles, res.data) : res.data,
            page: res.page,
            totalPages: res.totalPages,
            status: 'ready',
            refreshing: false,
            loadingMore: false,
            error: null,
          }))
        },
        () => {
          if (request !== latest.current) return
          setState((s) => ({
            ...s,
            // A failed refresh or "load more" keeps what's already on screen.
            status: s.articles.length > 0 ? 'ready' : 'error',
            refreshing: false,
            loadingMore: false,
            error: mode,
          }))
        },
      )
    },
    [category],
  )

  useEffect(() => {
    void fetchPage(1, 'initial')
  }, [fetchPage])

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, refreshing: true }))
    void fetchPage(1, 'refresh')
  }, [fetchPage])

  const retry = useCallback(() => {
    setState((s) => ({ ...s, status: s.articles.length > 0 ? 'ready' : 'loading', error: null }))
    void fetchPage(1, 'initial')
  }, [fetchPage])

  const canLoadMore =
    state.status === 'ready' &&
    !state.refreshing &&
    !state.loadingMore &&
    hasMore(state.page, state.totalPages)

  const loadMore = useCallback(() => {
    if (!canLoadMore) return
    setState((s) => ({ ...s, loadingMore: true, error: null }))
    void fetchPage(state.page + 1, 'more')
  }, [canLoadMore, fetchPage, state.page])

  return { ...state, refresh, retry, loadMore }
}
