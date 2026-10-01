# @zntr/agent

The calendar copilot: tool definitions, instructions and parsing helpers
behind the calendar app's AI features, built directly on the AI SDK.

## Layout

```
src/
  types.ts         CalendarToolkit port — what the agent can do, as an interface
  tools.ts         Tool set (AI SDK native) bound to a toolkit at request time
  parse.ts         NL quick-create: parseEventSchema + sanitize + instructions
  scheduling.ts    Pure free-slot math (no Date libraries, no timezone deps)
  instructions.ts  System prompt builder for the chat agent
```

## Runtime

`apps/calendar/app/api/agent/chat/route.ts` builds the toolkit from the
app's own database layer (per authenticated user), binds `src/tools.ts`
and streams the result into the command palette.

`apps/calendar/app/api/agent/parse-event/route.ts` does NOT use the tool
loop: a single `generateObject` call parses one line of natural language
into a sparse event draft for the create-event popover, with field-level
degradation in `sanitizeParsedEvent` (an invalid field is dropped, the
popover keeps the user's value).

## Why the port (CalendarToolkit)?

The package must not import the app's database, crypto or cache layers —
apps and packages only meet at interfaces in this repo (see AGENTS.md).
The port also makes the agent testable with an in-memory toolkit:
`tests/agent/`.

## Env

- `GROQ_API_KEY` — required. Free keys: https://console.groq.com
  Without it the calendar hides every AI affordance (build-time
  `NEXT_PUBLIC_AI_ENABLED` flag) and the agent routes answer 503.
- `GROQ_MODEL` — optional, defaults to `openai/gpt-oss-120b` (the strongest
  tool-calling model on Groq's free tier; Llama 3.3 70B is Enterprise-only)

## Rate limiting caveat

The chat route limits each user to 20 requests / 5 minutes and the
parse-event route to 15 requests / minute, through the calendar's
Redis-backed fixed-window counter. Like the rest of that cache layer, it
**fails open**: a self-hosted deployment without `REDIS_URL` effectively
has no rate limit on the agent. Configure Redis in production.
