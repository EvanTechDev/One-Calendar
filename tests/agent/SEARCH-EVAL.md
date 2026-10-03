# Semantic search evaluation

A successful first attempt makes **one model request**, with SDK retries disabled. The model
compiles explicit dates, people, categories and concept alternatives. Event records
are never sent to the model. All candidate pages are read locally, then matched
against title, full description, location, category name and participants. Groups
are ANDed; translations and expressions within a group are ORed. Scores order
matches; no relative cutoff removes weaker matches. Pagination reuses a sealed
result snapshot and makes zero AI calls.

If all candidates were scanned and none matched, one additional model request
receives the original intent, failed query and candidate count (no event text).
It supplies multiple alternative expressions in one response. The server keeps
every subject group and original term, locks dates/people/categories, then scans
the same candidates again. With no date constraints, this includes the entire
history. No candidates means there is nothing for rewording to recover, so no
second call is made. Each search is capped at two model calls to avoid quota storms.

`search-match.test.ts` and `tests/calendar/api/agent-search.test.ts` verify the
local contract, complete candidate coverage beyond 200 events, hard constraints,
one call on a hit, bounded zero-result recovery, stable pagination, and upstream
429 propagation (including failures of the recovery request). They include
description/location-only recovery from 2020, past 200 candidates, and paging
56 recovered matches without more model calls.
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
Even after recovery, an empty result means no compiled expression matched the
complete candidate set, not proof that no semantically relevant event exists.
Failed or rate-limited recovery returns an error, never a false empty success.

Provider 429 is returned as 429, preserving a valid Retry-After value. Stage logs
separate compilation, candidate collection, local matching and zero-result recovery. Searches retain the
270-second processing deadline; pagination tokens expire after 15 minutes and are
bound to the user/auth secret. Edited/deleted results require a new search.
