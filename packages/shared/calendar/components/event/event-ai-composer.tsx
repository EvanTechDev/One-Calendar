import { CalendarDays, Clock3, MapPin } from 'lucide-react'
import { AssistantIcon } from '#calendar/components/ai/assistant-icon'

interface EventAiComposerProps {
  label: string
}

/**
 * A calendar taking shape, rather than a collection of anonymous loading bars.
 * The title input stays mounted above this panel so keyboard focus is never
 * interrupted while the parsed draft is being prepared.
 */
export function EventAiComposer({ label }: EventAiComposerProps) {
  return (
    <section
      className="event-ai-composer"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="event-ai-composer__header">
        <span className="event-ai-composer__mark" aria-hidden="true">
          <AssistantIcon />
        </span>
        <span className="event-ai-composer__label">{label}</span>
        <span className="event-ai-composer__ellipsis" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>

      <div className="event-ai-composer__schedule" aria-hidden="true">
        <div className="event-ai-composer__times">
          <span>09</span>
          <span>12</span>
          <span>15</span>
          <span>18</span>
        </div>
        <div className="event-ai-composer__track">
          <div className="event-ai-composer__event">
            <span className="event-ai-composer__event-icon">
              <CalendarDays />
            </span>
            <span className="event-ai-composer__event-copy">
              <i />
              <i />
            </span>
            <Clock3 className="event-ai-composer__event-clock" />
          </div>
          <div className="event-ai-composer__scan" />
        </div>
      </div>

      <div className="event-ai-composer__fields" aria-hidden="true">
        <span>
          <CalendarDays />
        </span>
        <span>
          <Clock3 />
        </span>
        <span>
          <MapPin />
        </span>
      </div>
    </section>
  )
}
