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

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_AI_ENABLED = '1'
})
vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    status: 'ready',
    messages: [],
    stop: vi.fn(),
    setMessages: vi.fn(),
    sendMessage: vi.fn(),
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

it('a stalled request stops loading and offers retry after the deadline', async () => {
  render(<AiCommandPalette open onOpenChange={vi.fn()} />)
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
  await typeQuestion('  找出所有遛狗的日程  ')
  fireEvent.click(screen.getByRole('option', { name: /Semantic search:/ }))
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
    const input = screen.getByRole('combobox')
    for (let i = 1; i <= question.length; i++) {
      fireEvent.change(input, { target: { value: question.slice(0, i) } })
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    }
    await screen.findByRole('option', { name: /Semantic search:/ })
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
