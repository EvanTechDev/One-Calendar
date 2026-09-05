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
 * Assistant text renders through Streamdown: markdown built for streams,
 * tolerant of unterminated fences/emphasis while chunks arrive.
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
import { Spinner } from '@zntr/ui/spinner'
import type { translations } from '@zntr/i18n/calendar'
import {
  CalendarPlus,
  CalendarSearch,
  ChartNoAxesColumn,
  Clock,
  Sparkles,
  Trash2,
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
}

function toolLabel(type: string): string {
  return type.replace(/^tool-/, '').replaceAll('_', ' ')
}

type ChatMessages = ReturnType<typeof useChat>['messages']
type Translation = (typeof translations)[keyof typeof translations]

export function ChatTranscript({
  t,
  messages,
  busy,
  error,
}: {
  t: Translation
  messages: ChatMessages
  busy: boolean
  error: Error | null
}) {
  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller className="h-96">
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
                    {message.parts?.map((part, i) => {
                      if (part.type === 'text' && part.text) {
                        return (
                          <Streamdown
                            key={i}
                            // Scope prose styling: compact spacing so the
                            // palette reads like a panel, not an article.
                            className="rounded-lg bg-muted px-3 py-1.5 text-sm [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_pre]:my-1.5 [&_pre]:overflow-x-auto [&_table]:my-1.5 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 first:[&_p]:mt-0 last:[&_p]:mb-0"
                          >
                            {part.text}
                          </Streamdown>
                        )
                      }
                      if (part.type.startsWith('tool-')) {
                        const Icon = TOOL_ICONS[part.type] ?? Wrench
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground"
                          >
                            <Icon className="size-3" />
                            <span>{toolLabel(part.type)}</span>
                          </div>
                        )
                      }
                      return null
                    })}
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
