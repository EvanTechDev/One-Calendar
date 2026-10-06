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
import { AssistantIcon } from './assistant-icon'
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
  Check,
  ChevronDown,
  Clock,
  Hourglass,
  Trash2,
  TriangleAlert,
  Wrench,
  CircleDashed,
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

function toolLabel(type: string, t: Translation): string {
  const labels: Record<string, string> = {
    'tool-list_events': t.searchEvents,
    'tool-create_event': t.createEvent,
    'tool-update_event': t.aiToolUpdateEvent,
    'tool-delete_event': t.aiToolDeleteEvent,
    'tool-list_categories': t.aiToolCategories,
    'tool-get_schedule_summary': t.aiToolSummary,
    'tool-find_free_time': t.aiToolFreeTime,
    'tool-list_bookmarks': t.bookmarks,
    'tool-bookmark_event': t.bookmark,
    'tool-remove_bookmark': t.removeBookmark,
    'tool-list_countdowns': t.countdownTitle,
    'tool-create_countdown': t.countdownAdd,
    'tool-delete_countdown': t.aiToolDeleteCountdown,
  }
  return labels[type] ?? type.replace(/^tool-/, '').replaceAll('_', ' ')
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
  output?: unknown
  errorText?: string
  approval?: { id: string; approved?: boolean }
}

function asToolPart(part: MessagePart): ApprovalToolPart | null {
  if (part.type === 'dynamic-tool')
    return { ...part, type: `tool-${part.toolName}` }
  if (!part.type.startsWith('tool-')) return null
  return part as unknown as ApprovalToolPart
}

export function ChatTranscript({
  t,
  messages,
  busy,
  error,
  onApproval,
  timedOut = false,
  onContinue,
  onSuggestion,
}: {
  t: Translation
  messages: ChatMessages
  busy: boolean
  error: Error | null
  /** addToolApprovalResponse from useChat. */
  onApproval: (response: { id: string; approved: boolean }) => void
  timedOut?: boolean
  onContinue?: () => void
  onSuggestion?: (prompt: string) => void
}) {
  const awaitingApproval = messages.some((message) =>
    message.parts.some(
      (part) => asToolPart(part)?.state === 'approval-requested',
    ),
  )
  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      {/* dvh-aware: fill what the dialog allows, never more than the
          dynamic viewport minus the dialog's own chrome. */}
      <MessageScroller className="h-auto min-h-0 flex-1 basis-80">
        <MessageScrollerViewport aria-label={t.aiAssistant}>
          <MessageScrollerContent className="gap-6 px-4 py-5">
            {messages.length === 0 && !busy && (
              <div className="my-auto flex flex-col items-start gap-3 px-2 py-8">
                <AssistantIcon className="size-6 text-muted-foreground" />
                <h3 className="text-base font-medium">{t.aiAssistant}</h3>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {t.aiAssistantHint}
                </p>
              </div>
            )}

            {messages.map((message, messageIndex) => (
              <MessageScrollerItem
                key={message.id}
                messageId={message.id}
                // The user's question anchors the turn: reading starts at
                // the prompt while the answer grows into the screen below.
                scrollAnchor={message.role === 'user'}
                className="flex flex-col gap-1.5"
              >
                {message.role === 'user' ? (
                  <div className="max-w-[85%] self-end whitespace-pre-wrap rounded-xl bg-muted px-3 py-2 text-sm leading-relaxed wrap-break-word">
                    {message.parts?.map((part, i) =>
                      part.type === 'text' ? (
                        <span key={i}>{part.text}</span>
                      ) : null,
                    )}
                  </div>
                ) : (
                  <div className="flex w-full min-w-0 flex-col gap-3 self-start">
                    {message.parts?.map((part, i) => (
                      <AssistantPart
                        key={i}
                        part={part}
                        t={t}
                        onApproval={onApproval}
                        busy={busy && messageIndex === messages.length - 1}
                      />
                    ))}
                    {onSuggestion &&
                      !(busy && messageIndex === messages.length - 1) && (
                        <FollowupSuggestions
                          parts={message.parts}
                          disabled={busy || awaitingApproval}
                          onSelect={onSuggestion}
                        />
                      )}
                  </div>
                )}
              </MessageScrollerItem>
            ))}

            {busy && (
              <MessageScrollerItem
                role="status"
                className="flex items-center gap-2 px-1 text-xs text-muted-foreground"
              >
                <Spinner className="size-3" />
                {t.aiAssistantThinking}
              </MessageScrollerItem>
            )}

            {(error || timedOut) && (
              <MessageScrollerItem
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {timedOut ? t.aiAssistantTimedOut : t.aiAssistantError}
              </MessageScrollerItem>
            )}
            {!busy && messages.length > 0 && onContinue && (
              <MessageScrollerItem>
                <Button size="sm" variant="ghost" onClick={onContinue}>
                  {t.aiAssistantContinue}
                </Button>
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
  busy,
}: {
  part: MessagePart
  t: Translation
  onApproval: (response: { id: string; approved: boolean }) => void
  busy: boolean
}) {
  if (part.type === 'text' && part.text) {
    return (
      <Streamdown
        isAnimating={busy}
        // Scope prose styling: compact spacing so the palette reads like
        // a panel, not an article.
        className="agent-markdown min-w-0 text-sm leading-relaxed"
      >
        {part.text}
      </Streamdown>
    )
  }

  const toolPart = asToolPart(part)
  if (!toolPart) return null
  if (toolPart.type === 'tool-suggest_followups') return null

  const Icon = TOOL_ICONS[toolPart.type] ?? Wrench
  const approvalId =
    toolPart.state === 'approval-requested' ? toolPart.approval?.id : undefined
  const denied =
    toolPart.state === 'output-denied' || toolPart.approval?.approved === false
  // Our toolkit returns { error } as an output so the agent can recover.
  // Transport success alone must not turn that into a green "completed" row.
  const outputError =
    toolPart.output &&
    typeof toolPart.output === 'object' &&
    'error' in toolPart.output
      ? String(toolPart.output.error)
      : undefined
  const failed = toolPart.state === 'output-error' || !!outputError
  const done = toolPart.state === 'output-available' && !failed
  const running = busy && !approvalId && !denied && !failed && !done
  const status = approvalId
    ? t.aiAssistantConfirmAction
    : denied
      ? t.aiAssistantDenied
      : failed
        ? t.aiToolFailed
        : done
          ? t.aiToolCompleted
          : running
            ? t.aiToolRunning
            : t.aiToolStopped
  const StatusIcon = failed ? TriangleAlert : done ? Check : CircleDashed
  return (
    <div className="rounded-lg border bg-muted/20">
      <details className="group/tool" open={approvalId ? true : undefined}>
        <summary className="cursor-pointer list-none rounded-lg px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <Marker className="gap-2 text-xs">
            <MarkerIcon>
              <Icon />
            </MarkerIcon>
            <MarkerContent className="flex-1 font-medium text-foreground">
              {toolLabel(toolPart.type, t)}
            </MarkerContent>
            <span
              className={
                failed
                  ? 'flex items-center gap-1.5 text-destructive'
                  : 'flex items-center gap-1.5'
              }
              aria-live="polite"
            >
              {running ? (
                <Spinner className="size-3" />
              ) : (
                <StatusIcon className="size-3" />
              )}
              {status}
            </span>
            <ChevronDown className="size-3 transition-transform group-open/tool:rotate-180" />
          </Marker>
        </summary>
        <div className="space-y-3 border-t px-3 py-2 text-xs">
          {toolPart.input !== undefined && (
            <ToolDetail label={t.aiToolInput} value={toolPart.input} />
          )}
          {toolPart.output !== undefined && (
            <ToolDetail label={t.aiToolOutput} value={toolPart.output} />
          )}
          {failed && (
            <p role="alert" className="text-destructive">
              {toolPart.errorText ?? outputError ?? t.aiToolFailed}
            </p>
          )}
        </div>
      </details>
      {approvalId && (
        <div className="flex gap-2 border-t px-3 py-2">
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
      )}
    </div>
  )
}

function FollowupSuggestions({
  parts,
  disabled,
  onSelect,
}: {
  parts: MessagePart[]
  disabled: boolean
  onSelect: (prompt: string) => void
}) {
  const result = parts
    .map(asToolPart)
    .findLast(
      (part) =>
        part?.type === 'tool-suggest_followups' &&
        part.state === 'output-available' &&
        part.output &&
        typeof part.output === 'object' &&
        'prompts' in part.output,
    )?.output
  if (!result || typeof result !== 'object' || !('prompts' in result))
    return null
  const prompts = result.prompts
  if (
    !Array.isArray(prompts) ||
    prompts.length !== 3 ||
    !prompts.every(
      (prompt) =>
        typeof prompt === 'string' && prompt.trim() && prompt.length <= 120,
    )
  )
    return null
  return (
    <div className="flex flex-col items-start gap-1.5 pt-1">
      {prompts.map((prompt) => (
        <Button
          key={prompt}
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-auto max-w-full justify-start whitespace-normal py-1.5 text-left text-xs font-normal"
          onClick={(event) => {
            event.stopPropagation()
            onSelect(prompt)
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {prompt}
        </Button>
      ))}
    </div>
  )
}

function ToolDetail({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 font-medium text-muted-foreground">{label}</p>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word rounded bg-muted/50 p-2 text-xs">
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}
