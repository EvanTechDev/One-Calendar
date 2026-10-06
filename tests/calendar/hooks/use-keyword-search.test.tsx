import { act, cleanup, renderHook } from '../host-render'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKeywordSearch } from '@/hooks/use-keyword-search'
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('keyword search request lifecycle', () => {
  it('debounces typing and continues empty pages instead of reporting a false empty result', async () => {
    vi.useFakeTimers()
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [], cursor: '200' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: 'distant', title: 'Needle' }],
          cursor: null,
        }),
      })
    vi.stubGlobal('fetch', fetcher)
    const view = renderHook(({ text }) => useKeywordSearch(text, true), {
      initialProps: { text: 'nee' },
    })
    view.rerender({ text: 'needle' })
    expect(fetcher).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(String(fetcher.mock.calls[1][0])).toContain('cursor=200')
    expect(view.result.current.results.map((r) => r.id)).toEqual(['distant'])
  })
  it('aborts old queries and refuses late responses after query changes or closing', async () => {
    vi.useFakeTimers()
    let resolveOld!: (value: unknown) => void
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve
          }),
      )
      .mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ id: 'new' }], cursor: null }),
      })
    vi.stubGlobal('fetch', fetcher)
    const view = renderHook(({ text, open }) => useKeywordSearch(text, open), {
      initialProps: { text: 'old', open: true },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
    })
    const oldSignal = fetcher.mock.calls[0][1].signal as AbortSignal
    view.rerender({ text: 'new', open: true })
    expect(oldSignal.aborted).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
      resolveOld({
        ok: true,
        json: async () => ({ results: [{ id: 'old' }], cursor: null }),
      })
    })
    expect(view.result.current.results.map((r) => r.id)).toEqual(['new'])
    view.rerender({ text: 'new', open: false })
    expect(view.result.current.status).toBe('ready')
    expect(view.result.current.results.map((r) => r.id)).toEqual(['new'])
    view.rerender({ text: '', open: true })
    expect(view.result.current.status).toBe('idle')
    expect(view.result.current.results).toEqual([])
  })
})
