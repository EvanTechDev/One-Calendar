import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { UIMessage } from 'ai'
import { translations } from '@zntr/i18n/calendar'
import { ChatTranscript } from '@zntr/ui/calendar/components/app/ai/chat-transcript'

// Layout/scrolling is not the seam under test; keep the real markdown and Marker.
vi.mock('@zntr/ui/message-scroller', () => ({
  MessageScrollerProvider: ({ children }: React.PropsWithChildren) => (
    <>{children}</>
  ),
  MessageScroller: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  MessageScrollerViewport: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  MessageScrollerContent: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  MessageScrollerItem: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  MessageScrollerButton: () => null,
}))
afterEach(cleanup)
const t = translations.en

it('shows exactly three generated follow-ups below the answer, sending only the clicked prompt', () => {
  const prompts = [
    'Show Monday’s conflicts',
    'Find a free afternoon',
    'Plan time for a break',
  ]
  const onSuggestion = vi.fn()
  const messages: UIMessage[] = [
    {
      id: 'a1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-suggest_followups',
          toolCallId: 's1',
          state: 'output-available',
          input: { prompts },
          output: { prompts },
        },
        { type: 'text', text: 'Your schedule is ready.' },
      ],
    },
  ]
  const view = (busy: boolean) => (
    <ChatTranscript
      t={t}
      messages={messages}
      busy={busy}
      error={null}
      onApproval={vi.fn()}
      onSuggestion={onSuggestion}
    />
  )
  const { rerender } = render(view(true))
  expect(
    screen.queryByRole('button', { name: prompts[0] }),
  ).not.toBeInTheDocument()
  rerender(view(false))
  expect(screen.getAllByRole('button')).toHaveLength(3)
  expect(screen.queryByText('Completed')).not.toBeInTheDocument()
  expect(
    screen
      .getByText('Your schedule is ready.')
      .compareDocumentPosition(
        screen.getByRole('button', { name: prompts[0] }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(onSuggestion).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: prompts[1] }))
  expect(onSuggestion).toHaveBeenCalledExactlyOnceWith(prompts[1])
})

it('does not expose incomplete or failed suggestion tool output as chat actions', () => {
  render(
    <ChatTranscript
      t={t}
      busy={false}
      error={null}
      onApproval={vi.fn()}
      onSuggestion={vi.fn()}
      messages={[
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-suggest_followups',
              toolCallId: 's1',
              state: 'input-available',
              input: { prompts: ['One', 'Two', 'Three'] },
            },
            {
              type: 'tool-suggest_followups',
              toolCallId: 's2',
              state: 'output-available',
              input: {},
              output: { error: 'Invalid prompts' },
            },
          ],
        },
      ]}
    />,
  )
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

function transcript(
  parts: UIMessage['parts'],
  busy = false,
  onApproval = vi.fn(),
) {
  return (
    <ChatTranscript
      t={t}
      messages={[{ id: 'a1', role: 'assistant', parts }]}
      busy={busy}
      error={null}
      onApproval={onApproval}
    />
  )
}

it('a Marker tracks execution, exposes the result, and reports toolkit errors as failed', () => {
  const { rerender } = render(
    transcript(
      [
        {
          type: 'tool-list_events',
          toolCallId: 'c1',
          state: 'input-available',
          input: { query: 'planning' },
        },
      ],
      true,
    ),
  )
  expect(screen.getByText('Running')).toBeInTheDocument()
  rerender(
    transcript([
      {
        type: 'tool-list_events',
        toolCallId: 'c1',
        state: 'output-available',
        input: {},
        output: { total: 2 },
      },
    ]),
  )
  expect(screen.queryByText('Running')).not.toBeInTheDocument()
  expect(screen.getByText('Completed')).toBeInTheDocument()
  const summary = screen.getByText('Completed').closest('summary')!
  fireEvent.click(summary)
  expect(summary.parentElement).toHaveAttribute('open')
  expect(screen.getByText(/"total": 2/)).toBeVisible()
  rerender(
    transcript([
      {
        type: 'tool-list_events',
        toolCallId: 'c1',
        state: 'output-available',
        input: {},
        output: { error: 'Calendar unavailable' },
      },
    ]),
  )
  expect(screen.queryByText('Completed')).not.toBeInTheDocument()
  expect(screen.getByText('Failed')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Calendar unavailable')
})

it.each([true, false])(
  'approval choice %s is sent for the requested tool call',
  (approved) => {
    const onApproval = vi.fn()
    render(
      transcript(
        [
          {
            type: 'tool-delete_event',
            toolCallId: 'c2',
            state: 'approval-requested',
            input: { event_id: 'e1' },
            approval: { id: 'approval-2' },
          },
        ],
        false,
        onApproval,
      ),
    )
    expect(screen.getByText('Confirm action')).toBeInTheDocument()
    expect(screen.getByText(/"event_id": "e1"/)).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: approved ? 'Approve' : 'Deny' }),
    )
    expect(onApproval).toHaveBeenCalledExactlyOnceWith({
      id: 'approval-2',
      approved,
    })
  },
)

it('stopped and denied tools never appear to keep running', () => {
  const { rerender } = render(
    transcript([
      {
        type: 'tool-list_events',
        toolCallId: 'c1',
        state: 'input-available',
        input: {},
      },
    ]),
  )
  expect(screen.getByText('Stopped')).toBeInTheDocument()
  rerender(
    transcript([
      {
        type: 'tool-delete_event',
        toolCallId: 'c2',
        state: 'output-denied',
        input: {},
        approval: { id: 'a2', approved: false },
      },
    ]),
  )
  expect(screen.getByText(t.aiAssistantDenied)).toBeInTheDocument()
  expect(screen.queryByText('Running')).not.toBeInTheDocument()
})

it('renders assistant markdown as formatted content rather than syntax', () => {
  render(
    transcript([
      {
        type: 'text',
        text: '## Your week\n\n**Planning**\n\n- Review the roadmap\n- [Open calendar](https://example.com)\n\n| Day | Event |\n| --- | --- |\n| Monday | Planning |',
      },
    ]),
  )
  expect(screen.getByRole('heading', { name: 'Your week' })).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  // Streamdown's link confirmation renders an interactive button first.
  expect(screen.getByRole('button', { name: 'Open calendar' })).toHaveAttribute(
    'data-streamdown',
    'link',
  )
  expect(screen.getByRole('table')).toBeInTheDocument()
})
