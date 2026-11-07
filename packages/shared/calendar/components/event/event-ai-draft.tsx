interface EventAiDraftProps {
  label: string
  text: string
}

export function EventAiDraft({ label, text }: EventAiDraftProps) {
  return (
    <div
      className="event-ai-draft"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={label}
    >
      <div className="event-ai-draft__scene" aria-hidden="true">
        <div className="event-ai-draft__illumination" />
        <div className="event-ai-draft__scanner">
          <span className="event-ai-draft__scanner-cap" />
        </div>

        <div className="event-ai-draft__manuscript">
          <span className="event-ai-draft__source-mark" />
          <p className="event-ai-draft__text">{text.trim()}</p>
        </div>

        <div className="event-ai-draft__structure">
          <span className="event-ai-draft__spine" />
          <div className="event-ai-draft__detail event-ai-draft__detail--first">
            <span className="event-ai-draft__detail-mark" />
            <span className="event-ai-draft__detail-rule" />
          </div>
          <div className="event-ai-draft__detail event-ai-draft__detail--second">
            <span className="event-ai-draft__detail-mark" />
            <span className="event-ai-draft__detail-rule" />
          </div>
          <div className="event-ai-draft__detail event-ai-draft__detail--third">
            <span className="event-ai-draft__detail-mark" />
            <span className="event-ai-draft__detail-rule" />
          </div>
        </div>
      </div>
      <div className="event-ai-draft__baseline" aria-hidden="true" />
    </div>
  )
}
