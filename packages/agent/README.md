# @zntr/agent

The calendar copilot: one authored agent, two runtimes.

## Layout

```
src/
  types.ts         CalendarToolkit port — what the agent can do, as an interface
  tools.ts         Tool set authored with eve's defineTool, bound to a toolkit
  adapter.ts       Lowers eve tool definitions onto AI SDK tools
  scheduling.ts    Pure free-slot math (no Date libraries, no timezone deps)
  instructions.ts  System prompt builder shared by both runtimes
  http-toolkit.ts  Toolkit implemented against a running calendar's REST API
agent/             eve app root (filesystem-first agent)
  agent.ts         Model config: Groq llama via @ai-sdk/groq
  instructions.md  eve's always-on prompt (mirror of src/instructions.ts)
  tools/*.ts       One-per-file re-exports of src/tools.ts, HTTP-bound
```

## Runtimes

1. **In-app (primary)** — `apps/calendar/app/api/agent/chat/route.ts` builds
   the toolkit from the app's own database layer (per authenticated user),
   lowers `src/tools.ts` onto the AI SDK and streams the result into the
   command palette. No eve server involved; nothing extra to deploy.

2. **Standalone eve app** — `cd packages/agent && eve dev`. eve discovers
   `agent/`, runs the same tool definitions bound to the HTTP toolkit, and
   serves the standard eve protocol. Needs `GROQ_API_KEY` plus
   `CALENDAR_BASE_URL`/`CALENDAR_COOKIE` (see agent/tools/README.md).

## Why the port (CalendarToolkit)?

The package must not import the app's database, crypto or cache layers —
apps and packages only meet at interfaces in this repo (see AGENTS.md).
The port also makes the agent testable with an in-memory toolkit:
`tests/agent/`.

## Env

- `GROQ_API_KEY` — required. Free keys: https://console.groq.com
- `GROQ_MODEL` — optional, defaults to `llama-3.3-70b-versatile`
