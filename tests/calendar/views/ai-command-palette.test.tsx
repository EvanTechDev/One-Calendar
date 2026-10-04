import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

const { sendMessage, stop, setMessages, chatState } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_AI_ENABLED = '1'
  return {
    sendMessage: vi.fn(),
    stop: vi.fn(),
    setMessages: vi.fn(),
    chatState: { status: 'ready', messages: [] as unknown[] },
  }
})
vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    ...chatState,
    stop,
    setMessages,
    sendMessage,
    addToolApprovalResponse: vi.fn(),
  }),
}))
vi.mock('@/components/app/ai/chat-transcript', () => ({
  ChatTranscript: () => null,
}))
vi.mock('@zntr/i18n/calendar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@zntr/i18n/calendar')>()),
  useLanguage: () => ['en'],
}))

import {
  AiCommandPalette,
  type PaletteActions,
} from '@/components/app/ai/ai-command-palette'

const fetchSearch = vi.fn()
beforeEach(() => {
  chatState.status = 'ready'
  chatState.messages = []
  stop.mockClear()
  setMessages.mockClear()
  sendMessage.mockClear()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('fetch', fetchSearch)
  fetchSearch.mockReset().mockImplementation(() => new Promise(() => {}))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function typeQuestion(question: string) {
  const input = screen.getByRole('combobox')
  fireEvent.change(input, { target: { value: question } })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
  return input
}

function selectMode(name: string) {
  fireEvent.keyDown(screen.getByRole('button', { name: /^Mode:/ }), {
    key: 'Enter',
  })
  fireEvent.click(
    screen.getByRole('menuitemradio', { name: new RegExp(`^${name}`) }),
  )
}

it('external close cancels work and reopens on a clean command menu', async () => {
  const onOpenChange = vi.fn()
  const { rerender } = render(
    <AiCommandPalette open onOpenChange={onOpenChange} />,
  )
  const input = await typeQuestion('find my trip')
  fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true })
  expect(
    screen.getByRole('button', { name: 'Mode: Search' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  fireEvent.keyDown(input, { key: 'Enter' })
  const signal = fetchSearch.mock.calls[0][1].signal as AbortSignal
  rerender(<AiCommandPalette open={false} onOpenChange={onOpenChange} />)
  expect(signal.aborted).toBe(true)
  rerender(<AiCommandPalette open onOpenChange={onOpenChange} />)
  expect(
    screen.getByRole('button', { name: 'Mode: Commands' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('combobox')).toHaveValue('')
})

it('the search entry opens keyword search immediately and reopening applies the requested entry mode', async () => {
  const onOpenChange = vi.fn()
  const { rerender } = render(
    <AiCommandPalette open initialMode="search" onOpenChange={onOpenChange} />,
  )
  expect(
    screen.getByRole('button', { name: 'Mode: Search' }),
  ).toBeInTheDocument()
  await typeQuestion('Monday')
  expect(fetchSearch).not.toHaveBeenCalled()
  selectMode('Ask AI')
  rerender(
    <AiCommandPalette
      open={false}
      initialMode="search"
      onOpenChange={onOpenChange}
    />,
  )
  rerender(
    <AiCommandPalette open initialMode="search" onOpenChange={onOpenChange} />,
  )
  expect(
    screen.getByRole('button', { name: 'Mode: Search' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('combobox')).toHaveValue('')
})

it('a stalled request stops loading and offers retry after the deadline', async () => {
  render(<AiCommandPalette open onOpenChange={vi.fn()} />)
  selectMode('Search')
  const input = await typeQuestion('找出所有遛狗的日程')
  vi.useFakeTimers()
  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
  expect(fetchSearch).toHaveBeenCalledTimes(1)
  const signal = fetchSearch.mock.calls[0][1].signal as AbortSignal
  await act(async () => {
    await vi.advanceTimersByTimeAsync(285_000)
  })
  expect(signal.aborted).toBe(true)
  expect(
    screen.getByText('Search timed out. Please try again.'),
  ).toBeInTheDocument()
  expect(screen.queryByText('Searching your calendar…')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('option', { name: 'Try again' }))
  expect(fetchSearch).toHaveBeenCalledTimes(2)
})

it('a pasted question can be clicked and a configuration failure is visible', async () => {
  fetchSearch.mockResolvedValue({ ok: false, status: 503 })
  render(<AiCommandPalette open onOpenChange={vi.fn()} />)
  selectMode('Search')
  await typeQuestion('  找出所有遛狗的日程  ')
  fireEvent.click(screen.getByRole('button', { name: 'Semantic search' }))
  expect(
    await screen.findByText('Search is not configured on this deployment'),
  ).toBeInTheDocument()
  expect(fetchSearch).toHaveBeenCalledTimes(1)
})

it('keeps Enter for a highlighted app command', async () => {
  const openSettings = vi.fn()
  render(
    <AiCommandPalette
      open
      onOpenChange={vi.fn()}
      actions={{ openSettings } as unknown as PaletteActions}
    />,
  )
  const input = await typeQuestion('Settings')
  fireEvent.pointerMove(screen.getByRole('option', { name: 'Settings' }))
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 })
  expect(openSettings).toHaveBeenCalledTimes(1)
  expect(fetchSearch).not.toHaveBeenCalled()
})

it('a date selects go-to-date before semantic search', async () => {
  const goToDate = vi.fn()
  render(
    <AiCommandPalette
      open
      onOpenChange={vi.fn()}
      actions={{ goToDate } as unknown as PaletteActions}
    />,
  )
  const input = await typeQuestion('2026-10-05')
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 })
  expect(goToDate).toHaveBeenCalledTimes(1)
  expect(fetchSearch).not.toHaveBeenCalled()
})

it.each(['找出所有遛狗的日程', 'find my trip', '找出所有遛狗的日程 '])(
  'typing %s then Enter sends one search request and shows loading',
  async (question) => {
    render(<AiCommandPalette open onOpenChange={vi.fn()} />)
    selectMode('Search')
    const input = screen.getByRole('combobox')
    for (let i = 1; i <= question.length; i++) {
      fireEvent.change(input, { target: { value: question.slice(0, i) } })
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    }
    // Let cmdk finish updating its selected item just as it would between keystrokes.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 })
    await waitFor(() => expect(fetchSearch).toHaveBeenCalledTimes(1))
    expect(fetchSearch.mock.calls[0][0]).toBe('/api/agent/search')
    expect(JSON.parse(fetchSearch.mock.calls[0][1].body)).toEqual({
      text: question.trim(),
    })
    expect(screen.getByText('Searching your calendar…')).toBeInTheDocument()
  },
)

it('searches server event descriptions without calling AI and opens an unloaded event', async () => {
  const goToEvent = vi.fn()
  fetchSearch.mockResolvedValue({
    ok: true,
    json: async () => ({
      results: [
        {
          id: 'event-1',
          title: 'Team planning',
          startDate: '2026-10-05T09:00:00Z',
          endDate: '2026-10-05T10:00:00Z',
          isAllDay: false,
          location: null,
          color: null,
        },
      ],
      cursor: null,
    }),
  })
  render(
    <AiCommandPalette
      open
      onOpenChange={vi.fn()}
      actions={{ goToEvent } as unknown as PaletteActions}
    />,
  )
  selectMode('Search')
  const input = await typeQuestion('workshop')
  expect(
    await screen.findByRole('option', { name: /Team planning/ }),
  ).toBeInTheDocument()
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 })
  expect(goToEvent).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'event-1' }),
  )
  expect(fetchSearch).toHaveBeenCalledTimes(1)
  expect(fetchSearch.mock.calls[0][0]).toBe('/api/events/search?q=workshop')
})

it('switching modes preserves the draft and aborts a pending semantic search', async () => {
  render(<AiCommandPalette open onOpenChange={vi.fn()} />)
  selectMode('Search')
  const input = await typeQuestion('find my trip')
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 })
  const signal = fetchSearch.mock.calls.find(
    ([url]) => url === '/api/agent/search',
  )![1].signal as AbortSignal
  selectMode('Ask AI')
  expect(signal.aborted).toBe(true)
  expect(screen.getByRole('textbox', { name: 'Ask AI' })).toHaveValue(
    'find my trip',
  )
  expect(
    fetchSearch.mock.calls.filter(([url]) => url === '/api/agent/search'),
  ).toHaveLength(1)
  for (const [url, options] of fetchSearch.mock.calls) {
    if (url.startsWith('/api/events/search'))
      expect(options.signal.aborted).toBe(true)
  }
  expect(sendMessage).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Ask AI' }), {
    key: 'Enter',
    shiftKey: true,
  })
  expect(sendMessage).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Ask AI' }), {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
  })
  expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ text: 'find my trip' })
})

it('renders the same event row in keyword and semantic search, with paging and Enter navigation', async () => {
  const hit = {
    id: 'e1',
    title: 'Team planning',
    startDate: '2026-10-05T09:00:00Z',
    endDate: '2026-10-05T10:00:00Z',
    isAllDay: false,
    color: '#3B82F6',
    location: 'Office',
  }
  const second = { ...hit, id: 'e2', title: 'Next planning' }
  const goToEvent = vi.fn()
  const query = {
    concepts: [['private-compiled-token']],
    names: ['Private Name'],
  }
  fetchSearch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [hit], cursor: null }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [hit],
        total: 2,
        page: 1,
        hasMore: true,
        searchToken: 'sealed',
        query,
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [second],
        total: 2,
        page: 2,
        hasMore: false,
        searchToken: 'sealed',
        query,
      }),
    })
  render(
    <AiCommandPalette
      open
      onOpenChange={vi.fn()}
      actions={{ goToEvent } as unknown as PaletteActions}
    />,
  )
  selectMode('Search')
  await typeQuestion('planning')
  const localRow = await screen.findByRole('option', { name: /Team planning/ })
  const content = localRow.innerHTML
  const classes = localRow.className
  expect(fetchSearch).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
  expect(goToEvent).not.toHaveBeenCalled()
  const semanticRow = await screen.findByRole('option', {
    name: /Team planning/,
  })
  expect(semanticRow.innerHTML).toBe(content)
  expect(semanticRow.className).toBe(classes)
  expect(
    screen.queryByText(/private-compiled-token|Private Name|Searched:/),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('option', { name: 'Load more' }))
  await screen.findByRole('option', { name: /Next planning/ })
  expect(JSON.parse(fetchSearch.mock.calls[2][1].body)).toEqual({
    page: 2,
    searchToken: 'sealed',
  })
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowUp' })
  fireEvent.pointerMove(semanticRow)
  fireEvent.keyDown(screen.getByRole('combobox'), {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
  })
  expect(goToEvent).toHaveBeenCalledExactlyOnceWith(hit)
})

it('typing a new query cancels AI and restores server keyword search', async () => {
  let resolveSearch!: (value: unknown) => void
  fetchSearch.mockImplementation((url: string) =>
    url.startsWith('/api/events/search')
      ? Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              {
                id: 'e1',
                title: 'Workshop',
                startDate: '2026-10-05T09:00:00Z',
                endDate: '2026-10-05T10:00:00Z',
                isAllDay: false,
              },
            ],
            cursor: null,
          }),
        })
      : new Promise((resolve) => {
          resolveSearch = resolve
        }),
  )
  render(<AiCommandPalette open onOpenChange={vi.fn()} />)
  selectMode('Search')
  const input = await typeQuestion('trip')
  fireEvent.keyDown(input, { key: 'Enter' })
  const signal = fetchSearch.mock.calls[0][1].signal as AbortSignal
  await typeQuestion('workshop')
  expect(signal.aborted).toBe(true)
  expect(
    await screen.findByRole('option', { name: /Workshop/ }),
  ).toBeInTheDocument()
  await act(async () =>
    resolveSearch({ ok: true, json: async () => ({ results: [], total: 0 }) }),
  )
  expect(screen.getByRole('option', { name: /Workshop/ })).toBeInTheDocument()
  expect(fetchSearch).toHaveBeenCalledTimes(2)
})

it('cycles all three modes with Alt arrows without submitting or showing number shortcuts', async () => {
  render(<AiCommandPalette open onOpenChange={vi.fn()} />)
  const input = await typeQuestion('draft')
  fireEvent.keyDown(input, { key: 'ArrowUp', altKey: true })
  const composer = screen.getByRole('textbox', { name: 'Ask AI' })
  expect(composer).toHaveValue('draft')
  fireEvent.keyDown(composer, { key: 'ArrowUp', altKey: true })
  expect(
    screen.getByRole('button', { name: 'Mode: Search' }),
  ).toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('combobox'), {
    key: 'ArrowUp',
    altKey: true,
  })
  expect(
    screen.getByRole('button', { name: 'Mode: Commands' }),
  ).toBeInTheDocument()
  expect(screen.queryByText(/Ctrl.*1/)).not.toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('button', { name: /^Mode:/ }), {
    key: 'Enter',
  })
  expect(screen.getAllByRole('menuitemradio')).toHaveLength(3)
  expect(
    screen.queryByRole('menuitemradio', { name: /Semantic/ }),
  ).not.toBeInTheDocument()
  expect(fetchSearch).not.toHaveBeenCalled()
  expect(sendMessage).not.toHaveBeenCalled()
})

it('Enter still searches after arrow navigation in an empty result list', async () => {
  render(<AiCommandPalette open onOpenChange={vi.fn()} />)
  selectMode('Search')
  const input = await typeQuestion('nothing local')
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(fetchSearch).toHaveBeenCalledTimes(1)
})

it('stops a stalled agent and retains its transcript when the palette closes', async () => {
  chatState.status = 'streaming'
  chatState.messages = [
    { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Working' }] },
  ]
  vi.useFakeTimers()
  const { rerender } = render(<AiCommandPalette open onOpenChange={vi.fn()} />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(285_000)
  })
  expect(stop).toHaveBeenCalledTimes(1)
  rerender(<AiCommandPalette open={false} onOpenChange={vi.fn()} />)
  expect(setMessages).not.toHaveBeenCalledWith([])
})
