import { describe, expect, it, vi } from 'vitest'
import { rerankCandidates } from '@zntr/agent/search-rerank'
import type { AgentEventSummary } from '@zntr/agent/types'

const row = (id: string, title = id): AgentEventSummary => ({
  id,
  title,
  startDate: '2026-04-12T08:00:00Z',
  endDate: '2026-04-12T09:00:00Z',
  isAllDay: false,
})

describe('AI adjudication orchestration (not a model quality evaluation)', () => {
  it('overlaps at most two batches while judging every event exactly once', async () => {
    vi.useFakeTimers()
    try {
      const events = Array.from({ length: 120 }, (_, i) => row(String(i)))
      const seen: string[] = []
      let active = 0
      let peak = 0
      const started = Date.now()
      let elapsed = 0
      const pending = rerankCandidates(events, 'relevance', async (batch) => {
        active++
        peak = Math.max(peak, active)
        seen.push(...batch.map((event) => event.id))
        await new Promise((resolve) => setTimeout(resolve, 100))
        active--
        return batch.map((event) => ({
          id: event.id,
          relevant: true,
          score: 90,
          evidence: 'Fixture match',
        }))
      }).then((results) => {
        elapsed = Date.now() - started
        return results
      })
      await vi.advanceTimersByTimeAsync(1_000)
      const results = await pending
      expect(seen).toEqual(events.map((event) => event.id))
      expect(results).toHaveLength(events.length)
      expect(peak).toBe(2)
      expect(elapsed).toBe(300)
    } finally {
      vi.useRealTimers()
    }
  })
  it('sends every candidate, including zero lexical matches and late pages', async () => {
    const events = Array.from({ length: 205 }, (_, i) => row(String(i)))
    events.push(row('flight', 'Flight to Tokyo'))
    const judge = vi.fn(async (batch: AgentEventSummary[]) =>
      batch.map((e) => ({
        id: e.id,
        relevant: e.id === 'flight',
        score: e.id === 'flight' ? 95 : 0,
        evidence:
          e.id === 'flight'
            ? 'Travel to the requested destination'
            : 'Unrelated',
      })),
    )
    const result = await rerankCandidates(events, 'relevance', judge)
    expect(
      judge.mock.calls.flatMap(([batch]) => batch.map((e) => e.id)),
    ).toEqual(events.map((e) => e.id))
    expect(result.map((e) => e.id)).toEqual(['flight'])
  })
  it('cancels the sibling and stops queued work when a batch is incomplete', async () => {
    const events = Array.from({ length: 60 }, (_, i) => row(String(i)))
    let siblingSignal: AbortSignal | undefined
    const judge = vi.fn(
      async (batch: AgentEventSummary[], signal: AbortSignal) => {
        if (batch[0].id === '0') return []
        siblingSignal = signal
        await new Promise<void>((_, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          })
        })
        return []
      },
    )
    await expect(rerankCandidates(events, 'relevance', judge)).rejects.toThrow(
      'Incomplete search judgments',
    )
    expect(siblingSignal?.aborted).toBe(true)
    expect(judge).toHaveBeenCalledTimes(2)
  })
  it('propagates cancellation to both requests without starting queued work', async () => {
    const events = Array.from({ length: 60 }, (_, i) => row(String(i)))
    const controller = new AbortController()
    const signals: AbortSignal[] = []
    const judge = vi.fn(async (_: AgentEventSummary[], signal: AbortSignal) => {
      signals.push(signal)
      await new Promise<void>((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        })
      })
      return []
    })
    const result = rerankCandidates(
      events,
      'relevance',
      judge,
      controller.signal,
    )
    const rejected = expect(result).rejects.toThrow('Search cancelled')
    controller.abort(new Error('Search cancelled'))
    await rejected
    expect(signals).toHaveLength(2)
    expect(signals.every((signal) => signal.aborted)).toBe(true)
    expect(judge).toHaveBeenCalledTimes(2)
  })
  it('ranks globally after out-of-order completion, including the relative cutoff', async () => {
    const events = Array.from({ length: 40 }, (_, i) => row(String(i)))
    let releaseFirst!: () => void
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const finished: string[] = []
    const result = await rerankCandidates(
      events,
      'relevance',
      async (batch) => {
        if (batch[0].id === '0') await first
        else releaseFirst()
        finished.push(batch[0].id)
        return batch.map((event) => ({
          id: event.id,
          relevant: true,
          score: event.id === '25' ? 100 : event.id === '5' ? 80 : 20,
          evidence: 'Fixture relevance score',
        }))
      },
    )
    expect(finished).toEqual(['20', '0'])
    expect(result.map((event) => event.id)).toEqual(['25', '5'])
  })
  it('fails incomplete or invented decisions instead of returning a partial success', async () => {
    const events = [row('one'), row('two')]
    await expect(
      rerankCandidates(events, 'relevance', async () => []),
    ).rejects.toThrow()
    await expect(
      rerankCandidates(events, 'relevance', async () => [
        { id: 'invented', relevant: true, score: 100, evidence: 'guess' },
        { id: 'two', relevant: false, score: 0, evidence: 'unrelated' },
      ]),
    ).rejects.toThrow()
  })
  it('does not turn the best of unrelated events into a result', async () => {
    expect(
      await rerankCandidates([row('noise')], 'relevance', async () => [
        { id: 'noise', relevant: false, score: 30, evidence: 'No evidence' },
      ]),
    ).toEqual([])
  })
})
