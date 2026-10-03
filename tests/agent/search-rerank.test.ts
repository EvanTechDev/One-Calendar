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
