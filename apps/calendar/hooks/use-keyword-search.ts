'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EventSearchHit } from '@/lib/api-client'

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  results: EventSearchHit[]
  cursor: string | null
  loadingMore: boolean
}
const empty: State = {
  status: 'idle',
  results: [],
  cursor: null,
  loadingMore: false,
}

export function useKeywordSearch(
  query: string,
  enabled: boolean,
  categories: string[] = [],
) {
  const [state, setState] = useState<State>(empty)
  const active = useRef<AbortController | null>(null)
  const categoryKey = JSON.stringify([...categories].sort())
  const read = useCallback(
    async (cursor: string | null, append: boolean) => {
      active.current?.abort()
      const controller = new AbortController()
      active.current = controller
      setState((old) =>
        append
          ? { ...old, loadingMore: true }
          : { ...empty, status: 'loading' },
      )
      const matches: EventSearchHit[] = []
      try {
        do {
          const params = new URLSearchParams({ q: query.trim() })
          for (const category of JSON.parse(categoryKey) as string[])
            params.append('category', category)
          if (cursor) params.set('cursor', cursor)
          const response = await fetch(`/api/events/search?${params}`, {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(30_000),
            ]),
          })
          if (!response.ok) throw new Error('Search failed')
          const page = (await response.json()) as {
            results: EventSearchHit[]
            cursor: string | null
          }
          controller.signal.throwIfAborted()
          if (page.cursor && page.cursor === cursor)
            throw new Error('Search cursor did not advance')
          matches.push(...page.results)
          cursor = page.cursor
        } while (cursor && matches.length < 30)
        setState((old) => ({
          status: 'ready',
          results: [
            ...new Map(
              [...(append ? old.results : []), ...matches].map((hit) => [
                hit.id,
                hit,
              ]),
            ).values(),
          ],
          cursor,
          loadingMore: false,
        }))
      } catch {
        if (!controller.signal.aborted)
          setState((old) => ({ ...old, status: 'error', loadingMore: false }))
      }
    },
    [query, categoryKey],
  )
  useEffect(() => {
    active.current?.abort()
    setState(query.trim() && enabled ? { ...empty, status: 'loading' } : empty)
    if (!enabled || !query.trim()) return
    const timer = setTimeout(() => void read(null, false), 250)
    return () => {
      clearTimeout(timer)
      active.current?.abort()
    }
  }, [query, enabled, read])
  return {
    ...state,
    retry: () => void read(null, false),
    more: () => {
      if (!state.loadingMore && state.cursor) void read(state.cursor, true)
    },
  }
}
