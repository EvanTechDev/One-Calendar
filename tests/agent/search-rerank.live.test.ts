import { expect, it } from 'vitest'
import { generateObject } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import {
  buildRerankInstructions,
  rerankCandidates,
  searchJudgmentsSchema,
} from '@zntr/agent/search-rerank'
import type { AgentEventSummary } from '@zntr/agent/types'
import {
  buildSearchInstructions,
  sanitizeSearchQuery,
  searchQuerySchema,
} from '@zntr/agent/search'

// Opt-in: real provider, synthetic fixtures only, never a user's calendar.
const live = process.env.RUN_SEARCH_LIVE === '1' && !!process.env.GROQ_API_KEY
it.skipIf(!live)(
  'real model: travel without keywords, cross-language and coffee intent',
  async () => {
    const model = createGroq({ apiKey: process.env.GROQ_API_KEY })(
      process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b',
    )
    const records = [
      { id: 'flight', title: 'Flight to Tokyo' },
      {
        id: 'transfer',
        title: 'Go to Airport in Shanghai',
        description: 'Transfer to PVG for the Tokyo holiday flight',
      },
      { id: 'unknown-transfer', title: 'Go to Airport in Shanghai' },
      { id: 'osaka', title: 'Osaka sightseeing' },
      { id: 'dog', title: 'Walk the dog' },
      {
        id: 'drink',
        title: 'Catch up with Sam',
        location: 'Blue Bottle',
        description: 'Drink espresso together',
      },
      {
        id: 'repair',
        title: 'Coffee machine repair',
        description: 'Replace broken pump',
      },
    ].map((e) => ({
      ...e,
      startDate: '2026-04-12T08:00:00Z',
      endDate: '2026-04-12T09:00:00Z',
      isAllDay: false,
    })) satisfies AgentEventSummary[]
    for (const [intent, expected] of [
      ['找去东京旅游的日程', ['flight', 'transfer']],
      ['找出所有遛狗的日程', ['dog']],
      ['帮我找所有我去喝咖啡的日程', ['drink']],
      ['帮我找所有咖啡相关的日程', ['drink', 'repair']],
    ] as const) {
      const now = new Date('2026-10-03T00:00:00Z')
      const { object: compiled } = await generateObject({
        model,
        schema: searchQuerySchema,
        system: buildSearchInstructions({
          timezone: 'Asia/Shanghai',
          nowIso: now.toISOString(),
          categories: [],
        }),
        prompt: intent,
      })
      const query = sanitizeSearchQuery(compiled, {
        timezone: 'Asia/Shanghai',
        now,
        categories: [],
      })
      // None of these questions mentions a date, person or category. Catch
      // compiler hallucinations too, rather than feeding the judge an ideal plan.
      expect(query.start, intent).toBeUndefined()
      expect(query.end, intent).toBeUndefined()
      expect(query.names, intent).toBeUndefined()
      expect(query.categoryIds, intent).toBeUndefined()
      const result = await rerankCandidates(
        records,
        'relevance',
        async (batch, signal) => {
          const { object } = await generateObject({
            model,
            abortSignal: signal,
            schema: searchJudgmentsSchema,
            system: buildRerankInstructions(intent, query),
            prompt: JSON.stringify(batch),
          })
          return object.judgments
        },
      )
      expect(result.map((e) => e.id).sort(), intent).toEqual(
        [...expected].sort(),
      )
    }
  },
  240_000,
)
