import { AssistantIcon } from '@zntr/calendar/components/ai/assistant-icon'
import { Button } from '@zntr/ui/button'
import { Kbd } from '@zntr/ui/kbd'
import { Textarea } from '@zntr/ui/textarea'
import { ArrowUp, ChevronDown, RotateCcw, X } from 'lucide-react'

// Presentation-only copy of ai-command-palette's chat mode and
// chat-transcript's empty state. Keep labels aligned with calendar/locales/en.json.
export function LandingAssistantPreview() {
  return (
    <figure className="landing-ai-preview">
      <div
        className="landing-ai-palette dark"
        role="img"
        aria-label="Calendar’s Ask AI command panel, with its empty conversation and message composer"
      >
        <div inert aria-hidden="true">
          <div className="landing-ai-chrome flex items-center gap-1 border-b pb-2">
            <Button variant="ghost" size="sm" className="gap-1.5 px-2">
              <AssistantIcon className="size-4" />
              Ask AI
              <ChevronDown className="size-3 text-muted-foreground" />
            </Button>
            <div className="flex flex-1 justify-end">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled
                aria-label="New conversation"
              >
                <RotateCcw />
              </Button>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Close">
              <X />
            </Button>
          </div>
          <div className="landing-ai-empty flex flex-col items-start gap-3 px-6 py-8">
            <AssistantIcon className="size-6 text-muted-foreground" />
            <h4 className="text-base font-medium">AI Assistant</h4>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Ask about your schedule, create events, or find free time
            </p>
          </div>
          <div className="relative mx-1 my-2 rounded-lg border bg-muted/30">
            <Textarea
              aria-label="Ask AI"
              placeholder="Ask your calendar anything…"
              readOnly
              rows={2}
              className="h-20 min-h-0 max-h-28 field-sizing-fixed resize-none overflow-y-auto border-0 bg-transparent! pr-12 shadow-none"
            />
            <Button
              size="icon-sm"
              className="absolute bottom-2 right-2"
              disabled
              aria-label="Send"
            >
              <ArrowUp />
            </Button>
          </div>
          <div className="landing-ai-footer flex items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> Send
              <span className="landing-ai-newline">Shift ↵ · New line</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>esc</Kbd> Close
            </span>
          </div>
        </div>
      </div>
      <figcaption>AI command palette · Interface preview</figcaption>
    </figure>
  )
}
