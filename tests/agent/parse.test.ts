import { describe, expect, it } from 'vitest'
import { buildParseInstructions, sanitizeParsedEvent } from '@zntr/agent/parse'
import type { AgentCategory } from '@zntr/agent/types'

const categories: AgentCategory[] = [
  { id: 'cat-1', name: 'Work', color: '#3b82f6' },
  { id: 'cat-2', name: 'Personal', color: '#10b981' },
]

describe('sanitizeParsedEvent', () => {
  it('passes a fully valid draft through, normalized', () => {
    const draft = sanitizeParsedEvent(
      {
        title: '  去公司开会 ',
        start: '2026-09-06T18:00:00+08:00',
        end: '2026-09-06T19:00:00+08:00',
        isAllDay: false,
        location: '公司',
        description: '带上笔记本',
        categoryId: 'cat-1',
        color: 'red',
        rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE',
      },
      { categories },
    )
    expect(draft).toEqual({
      title: '去公司开会',
      start: '2026-09-06T10:00:00.000Z',
      end: '2026-09-06T11:00:00.000Z',
      isAllDay: false,
      location: '公司',
      description: '带上笔记本',
      categoryId: 'cat-1',
      color: '#EF4444',
      rrule: 'FREQ=WEEKLY;BYDAY=MO,WE',
    })
  })

  it('drops an end that is not after the start instead of failing', () => {
    const draft = sanitizeParsedEvent(
      {
        title: 'Meeting',
        start: '2026-09-06T18:00:00+08:00',
        end: '2026-09-06T17:00:00+08:00',
      },
      { categories },
    )
    expect(draft.start).toBe('2026-09-06T10:00:00.000Z')
    expect(draft.end).toBeUndefined()
  })

  it('drops unparseable instants per-field', () => {
    const draft = sanitizeParsedEvent(
      {
        title: 'Meeting',
        start: 'next friday lol',
        end: '2026-09-06T19:00:00+08:00',
      },
      { categories },
    )
    expect(draft.start).toBeUndefined()
    expect(draft.end).toBe('2026-09-06T11:00:00.000Z')
  })

  it('drops a hallucinated categoryId but keeps the rest', () => {
    const draft = sanitizeParsedEvent(
      { title: 'Gym', categoryId: 'cat-999', location: '健身房' },
      { categories },
    )
    expect(draft.categoryId).toBeUndefined()
    expect(draft.location).toBe('健身房')
  })

  it('drops invented colors and invalid rrules', () => {
    const draft = sanitizeParsedEvent(
      { title: 'X', color: 'mauve', rrule: 'every monday' },
      { categories },
    )
    expect(draft.color).toBeUndefined()
    expect(draft.rrule).toBeUndefined()
  })

  it('drops empty and oversized titles so the route can fall back to the raw text', () => {
    expect(
      sanitizeParsedEvent({ title: '   ' }, { categories }).title,
    ).toBeUndefined()
    expect(
      sanitizeParsedEvent({ title: 'x'.repeat(201) }, { categories }).title,
    ).toBeUndefined()
  })

  it('ignores non-string garbage from the model', () => {
    const draft = sanitizeParsedEvent(
      {
        title: 'Meeting',
        start: 123,
        isAllDay: 'yes',
        location: { name: 'office' },
      } as unknown as Parameters<typeof sanitizeParsedEvent>[0],
      { categories },
    )
    expect(draft).toEqual({ title: 'Meeting' })
  })

  it('a nothing-extractable input still succeeds with just the title', () => {
    expect(sanitizeParsedEvent({ title: '午餐' }, { categories })).toEqual({
      title: '午餐',
    })
  })
})

describe('buildParseInstructions', () => {
  it('embeds the category list and the current time context', () => {
    const instructions = buildParseInstructions({
      timezone: 'Asia/Shanghai',
      nowIso: '2026-09-05T10:00:00.000Z',
      categories,
    })
    expect(instructions).toContain('Asia/Shanghai')
    expect(instructions).toContain('2026-09-05T10:00:00.000Z')
    expect(instructions).toContain('cat-1 — Work')
    expect(instructions).toContain('cat-2 — Personal')
  })

  it('forbids categoryId when the user has no categories', () => {
    const instructions = buildParseInstructions({
      timezone: 'UTC',
      nowIso: '2026-09-05T10:00:00.000Z',
      categories: [],
    })
    expect(instructions).toContain('never return categoryId')
  })
})
