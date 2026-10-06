import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SWRConfig } from 'swr'
import {
  CalendarHostProvider,
  type CalendarHost,
} from '@zntr/utils/calendar-host'
import { CalendarDataHost } from '@zntr/ui/calendar/components/providers/calendar-data-host'
import { useData } from '@zntr/ui/calendar/components/providers/data-provider'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('loads and edits calendar data through the supplied host transport', async () => {
  vi.stubGlobal('fetch', () => {
    throw new Error('The calendar escaped its host transport')
  })

  const host: CalendarHost = {
    session: { data: { user: { id: 'host-user' } }, isPending: false },
    navigation: { push() {}, replace() {}, openExternal() {} },
    request: async (input, init) => {
      const url = new URL(String(input), 'https://precal.xyehr.cn')
      let body: unknown
      switch (url.pathname) {
        case '/api/events':
          body = { events: [] }
          break
        case '/api/countdowns':
          body = { countdowns: [] }
          break
        case '/api/bookmarks':
          body = { bookmarks: [] }
          break
        case '/api/settings':
          body = { settings: { language: 'en', timezone: 'UTC' } }
          break
        case '/api/categories':
          body =
            init?.method === 'POST'
              ? {
                  category: {
                    ...JSON.parse(String(init.body)),
                    id: 'new-category',
                    userId: 'host-user',
                    sortOrder: 0,
                    createdAt: '2026-10-06T00:00:00.000Z',
                  },
                }
              : { categories: [] }
          break
        default:
          throw new Error(`Unexpected calendar request: ${url}`)
      }
      return { ok: true, status: 200, json: async () => body } as Response
    },
  }

  function Categories() {
    const { categories, createCategory, loading } = useData()
    return (
      <>
        <output>{loading === 'loaded' ? 'Ready' : 'Loading'}</output>
        <ul>
          {categories.map((category) => (
            <li key={category.id}>{category.name}</li>
          ))}
        </ul>
        <button
          onClick={() => void createCategory({ name: 'Work', color: 'blue' })}
        >
          Add category
        </button>
      </>
    )
  }

  render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        revalidateOnFocus: false,
        errorRetryCount: 0,
      }}
    >
      <CalendarHostProvider value={host}>
        <CalendarDataHost>
          <Categories />
        </CalendarDataHost>
      </CalendarHostProvider>
    </SWRConfig>,
  )

  await screen.findByText('Ready')
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
  })
  expect(await screen.findByRole('listitem')).toHaveTextContent('Work')
})
