# @zntr/agent

AI SDK building blocks for Zentra Calendar's copilot, natural-language
quick-create, and semantic search. This package owns model-facing schemas,
instructions, tools, and pure matching/scheduling logic; the calendar app owns
authentication, provider configuration, and persistence.

## Architecture and layout

| Source                                 | Responsibility                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `src/types.ts`                         | `CalendarToolkit` port and event, category, bookmark, and countdown contracts |
| `src/tools.ts`                         | `buildCalendarTools()`: AI SDK tools bound to a toolkit at request time       |
| `src/instructions.ts`                  | System instructions for the chat agent                                        |
| `src/parse.ts`                         | Quick-create schema, instructions, and field-level draft sanitization         |
| `src/search.ts`, `src/search-match.ts` | Search-query compilation, validation, local matching, and ranking             |
| `src/presets.ts`, `src/scheduling.ts`  | Named time ranges and dependency-light free-slot calculations                 |
| `src/validation.ts`                    | Tool-input guards and the event-color vocabulary                              |
| `src/gateway.ts`                       | Compact provider-error summaries without request-body logging                 |

## Chat vs. quick-create

| Path                          | Model flow                                                                     | Result                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `POST /api/agent/chat`        | `streamText` with up to 12 tool-capable steps, followed by a tool-free summary | A streamed command-palette response; tools can read or change the signed-in user's calendar |
| `POST /api/agent/parse-event` | One `generateObject` call; no tools or event writes                            | A sparse event draft for the create-event popover                                           |

Quick-create drops invalid fields individually in `sanitizeParsedEvent`. An
absent field means “not stated,” so the popover preserves its current value;
the title falls back to the input text when necessary.

Semantic search is a separate `POST /api/agent/search` flow. It compiles a
query, scans all candidate pages locally, and may make one additional model
call to expand expressions after a complete zero-match scan. Pagination reuses
the sealed result ordering without another model call.

## Toolkit boundary

`apps/calendar/lib/agent/toolkit.ts` implements `CalendarToolkit` with the same
user-scoped functions used by the MCP server. A new toolkit closes over the
authenticated user ID for each request, so toolkit methods do not accept a
user ID and this package never imports application database, crypto, or cache
code.

Tool exceptions become `{ error }` results that the model can correct. The
`delete_event` and `delete_countdown` tools require palette approval before
execution. Tests in `tests/agent/` use in-memory toolkit implementations.

## Environment

| Variable                 | Behavior                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `GROQ_API_KEY`           | Required for chat, quick-create, and new semantic searches; those requests return 503 when it is missing               |
| `GROQ_MODEL`             | Optional Groq model override; defaults to `openai/gpt-oss-120b`                                                        |
| `NEXT_PUBLIC_AI_ENABLED` | Derived at build time from the presence of `GROQ_API_KEY`; hides AI affordances when disabled without exposing the key |

## Rate limits

Limits are per authenticated user and use fixed-window counters in
`rate_limit_counters`. An atomic `INSERT … ON CONFLICT DO UPDATE` prevents lost
increments; counter failures do not fail open. Exhausted budgets return 429.

| Bucket              | Limit                   |
| ------------------- | ----------------------- |
| `agent-chat`        | 20 requests / 5 minutes |
| `agent-parse-event` | 15 requests / minute    |
| `agent-search`      | 10 requests / minute    |
