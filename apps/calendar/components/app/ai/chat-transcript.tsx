'use client'

/**
 * The streaming transcript inside the AI command palette.
 *
 * Scroll behaviour is delegated to MessageScroller (@shadcn/react):
 *  - follows the stream only while the reader is at the live edge;
 *  - any scroll/keyboard/touch interaction detaches — the interface never
 *    moves the reader against their intent;
 *  - each user prompt is a scroll anchor, so a new turn starts reading
 *    from the question, not the tail of the reply;
 *  - a jump-to-latest button appears whenever the reader is detached.
 *
 * Heights use dvh, not vh: mobile browser chrome (URL bar, toolbars)
 * shrinks the DYNAMIC viewport, and a vh-sized transcript left its tail
 * unreachable under the browser UI with no way to scroll to it.
 *
 * Assistant text renders through Streamdown: markdown built for streams,
 * tolerant of unterminated fences/emphasis while chunks arrive. Tool calls
 * render as Marker rows; destructive tools pause in `approval-requested`
 * state and show approve/deny buttons (see route.ts needsApproval).
 */
import * as React from 'react'
import type { useChat } from '@ai-sdk/react'
import { Streamdown } from 'streamdown'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@zntr/ui/message-scroller'
import { Marker, MarkerContent, MarkerIcon } from '@zntr/ui/marker'
import { Button } from '@zntr/ui/button'
import { Spinner } from '@zntr/ui/spinner'
import type { translations } from '@zntr/i18n/calendar'
import {
  Bookmark,
  CalendarPlus,
  CalendarSearch,
  ChartNoAxesColumn,
  Clock,
  Hourglass,
  Sparkles,
  Trash2,
  TriangleAlert,
  Wrench,
} from 'lucide-react'

const TOOL_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  'tool-list_events': CalendarSearch,
  'tool-create_event': CalendarPlus,
  'tool-update_event': Wrench,
  'tool-delete_event': Trash2,
  'tool-list_categories': Wrench,
  'tool-get_schedule_summary': ChartNoAxesColumn,
  'tool-find_free_time': Clock,
  'tool-list_bookmarks': Bookmark,
  'tool-bookmark_event': Bookmark,
  'tool-remove_bookmark': Bookmark,
  'tool-list_countdowns': Hourglass,
  'tool-create_countdown': Hourglass,
  'tool-delete_countdown': Trash2,
}

function toolLabel(type: string): string {
  return type.replace(/^tool-/, '').replaceAll('_', ' ')
}

type ChatMessages = ReturnType<typeof useChat>['messages']
type MessagePart = ChatMessages[number]['parts'][number]
type Translation = (typeof translations)[keyof typeof translations]

/** Narrow shape of a tool part in the approval flow. */
interface ApprovalToolPart {
  type: string
  state?: string
  toolCallId?: string
  input?: unknown
  approval?: { id: string }
}

function asToolPart(part: MessagePart): ApprovalToolPart | null {
  if (!part.type.startsWith('tool-')) return null
  return part as unknown as ApprovalToolPart
}

export function ChatTranscript({
  t,
  messages,
  busy,
  error,
  onApproval,
}: {
  t: Translation
  messages: ChatMessages
  busy: boolean
  error: Error | null
  /** addToolApprovalResponse from useChat. */
  onApproval: (response: { id: string; approved: boolean }) => void
}) {
  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      {/* dvh-aware: fill what the dialog allows, never more than the
          dynamic viewport minus the dialog's own chrome. */}
      <MessageScroller className="h-[min(24rem,calc(100dvh-14rem))]">
        <MessageScrollerViewport aria-label={t.aiAssistant}>
          <MessageScrollerContent className="gap-3 px-3 py-3">
            {messages.length === 0 && !busy && (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <Sparkles className="size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t.aiAssistantHint}
                </p>
              </div>
            )}

            {messages.map((message) => (
              <MessageScrollerItem
                key={message.id}
                messageId={message.id}
                // The user's question anchors the turn: reading starts at
                // the prompt while the answer grows into the screen below.
                scrollAnchor={message.role === 'user'}
                className="flex flex-col gap-1.5"
              >
                {message.role === 'user' ? (
                  <div className="max-w-[85%] self-end rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                    {message.parts?.map((part, i) =>
                      part.type === 'text' ? (
                        <span key={i}>{part.text}</span>
                      ) : null,
                    )}
                  </div>
                ) : (
                  <div className="flex max-w-full flex-col gap-1.5 self-start">
                    {message.parts?.map((part, i) => (
                      <AssistantPart
                        key={i}
                        part={part}
                        t={t}
                        onApproval={onApproval}
                      />
                    ))}
                  </div>
                )}
              </MessageScrollerItem>
            ))}

            {busy && (
              <MessageScrollerItem className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Spinner className="size-3" />
                {t.aiAssistantThinking}
              </MessageScrollerItem>
            )}

            {error && (
              <MessageScrollerItem className="rounded-lg bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
                {t.aiAssistantError}
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        {/* Visible only while the reader is detached from the live edge:
            the way back after scrolling up mid-stream. */}
        <MessageScrollerButton direction="end" />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

function AssistantPart({
  part,
  t,
  onApproval,
}: {
  part: MessagePart
  t: Translation
  onApproval: (response: { id: string; approved: boolean }) => void
}) {
  if (part.type === 'text' && part.text) {
    return (
      <Streamdown
        // Scope prose styling: compact spacing so the palette reads like
        // a panel, not an article.
        className="rounded-lg bg-muted px-3 py-1.5 text-sm [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_pre]:my-1.5 [&_pre]:overflow-x-auto [&_table]:my-1.5 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 first:[&_p]:mt-0 last:[&_p]:mb-0"
      >
        {part.text}
      </Streamdown>
    )
  }

  const toolPart = asToolPart(part)
  if (!toolPart) return null

  const Icon = TOOL_ICONS[toolPart.type] ?? Wrench

  // A destructive tool paused for confirmation: say what it wants to do
  // and let the user decide. Deny feeds an output-denied result back to
  // the model, which reports it instead of acting.
  if (toolPart.state === 'approval-requested' && toolPart.approval) {
    const approvalId = toolPart.approval.id
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
        <Marker>
          <MarkerIcon>
            <TriangleAlert className="text-destructive" />
          </MarkerIcon>
          <MarkerContent className="text-foreground">
            {t.aiAssistantConfirmAction}: {toolLabel(toolPart.type)}
          </MarkerContent>
        </Marker>
        {toolPart.input !== undefined && (
          <pre className="overflow-x-auto rounded bg-background/60 px-2 py-1 text-xs text-muted-foreground">
            {JSON.stringify(toolPart.input, null, 2)}
          </pre>
        )}
        <div className="flex gap-2">
          <Button
            size="xs"
            variant="destructive"
            onClick={() => onApproval({ id: approvalId, approved: true })}
          >
            {t.aiAssistantApprove}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => onApproval({ id: approvalId, approved: false })}
          >
            {t.aiAssistantDeny}
          </Button>
        </div>
      </div>
    )
  }

  if (toolPart.state === 'output-denied') {
    return (
      <Marker>
        <MarkerIcon>
          <TriangleAlert />
        </MarkerIcon>
        <MarkerContent>
          {toolLabel(toolPart.type)} — {t.aiAssistantDenied}
        </MarkerContent>
      </Marker>
    )
  }

  return (
    <Marker>
      <MarkerIcon>
        <Icon />
      </MarkerIcon>
      <MarkerContent>{toolLabel(toolPart.type)}</MarkerContent>
    </Marker>
  )
}
