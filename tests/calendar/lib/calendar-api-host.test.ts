// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCalendarApi } from '@/lib/api-client'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('calendar API host', () => {
  it('keeps concurrent calendar reads scoped to their host', async () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('A hosted calendar must use its supplied transport')
    })

    const official = createCalendarApi(async (input) => {
      const url = new URL(String(input), 'https://calendar.xyehr.cn')
      if (url.pathname !== '/api/events') {
        throw new Error(`Unexpected calendar request: ${url}`)
      }
      return Response.json({
        events: [{ id: 'work-event', title: 'Team planning' }],
      })
    })
    const preview = createCalendarApi(async (input) => {
      const url = new URL(String(input), 'https://precal.xyehr.cn')
      if (url.pathname !== '/api/events') {
        throw new Error(`Unexpected calendar request: ${url}`)
      }
      return Response.json({
        events: [{ id: 'preview-event', title: 'Preview calendar' }],
      })
    })

    const [officialCalendar, previewCalendar] = await Promise.all([
      official.events.list(),
      preview.events.list(),
    ])

    expect(officialCalendar.events).toEqual([
      { id: 'work-event', title: 'Team planning' },
    ])
    expect(previewCalendar.events).toEqual([
      { id: 'preview-event', title: 'Preview calendar' },
    ])
  })
})
