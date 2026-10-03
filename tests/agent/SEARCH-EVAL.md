# Semantic search evaluation

A new search makes **one model request**, with SDK retries disabled. The model
compiles explicit dates, people, categories and concept alternatives. Event records
are never sent to the model. All candidate pages are read locally, then matched
against title, full description, location, category name and participants. Groups
are ANDed; translations and expressions within a group are ORed. Scores order
matches; no relative cutoff removes weaker matches. Pagination reuses a sealed
result snapshot and makes zero AI calls.

`search-match.test.ts` and `tests/calendar/api/agent-search.test.ts` verify the
local contract, complete candidate coverage beyond 200 events, hard constraints,
one model call per search, stable pagination, and upstream 429 propagation.
The route tests supply compiler fixtures. They **do not prove** the real model
will generate the right alternatives for every question.

`search.live.test.ts` evaluates the real compiler followed by the real local
matcher on synthetic Tokyo travel, dog-walking, and coffee intent examples.
With `GROQ_API_KEY` already set, run from `packages/agent`:

```sh
RUN_SEARCH_LIVE=1 NODE_OPTIONS=--max-old-space-size=1400 ./node_modules/.bin/vitest run ../../tests/agent/search.live.test.ts --maxWorkers=1
```

This makes four model calls and is skipped by default. It checks that the compiler
does not invent dates/people/categories, as well as the resulting event IDs.
There is no guarantee of semantic completeness: missing translations or implicit
connections that cannot be expressed by the compiled terms can still miss events.
An empty result never triggers extra AI calls or silently removes constraints.

Provider 429 is returned as 429, preserving a valid Retry-After value. Stage logs
separate compilation, candidate collection and local matching. Searches retain the
270-second processing deadline; pagination tokens expire after 15 minutes and are
bound to the user/auth secret. Edited/deleted results require a new search.
