# Semantic search evaluation

The search endpoint now compiles explicit constraints, reads all candidate pages,
and asks the model to judge every event against the original question. It never
uses concepts as a lexical prefilter. Failed or incomplete batches fail the
request, rather than presenting a partial list as complete.

`search-rerank.test.ts` and `tests/calendar/api/agent-search.test.ts` mock model
decisions. They test candidate coverage (including beyond 200 rows), field
delivery, user isolation, batch completeness and stable encrypted pagination.
They **do not measure model relevance**.

Judgment requests run with at most two batches in flight per search. Each batch
still carries at most 20 events with full fields; every candidate is judged before
the global cutoff and pagination. A failed batch cancels its sibling and stops
queued work. The fake-clock orchestration test measures six 100ms batches taking
300ms instead of the serial 600ms. This isolates scheduling overhead, not actual
provider latency or rate limits. Production `judge-batch-completed` logs include
the batch number and `durationMs` so real improvement can be measured.

`search-rerank.live.test.ts` calls the real query compiler and judge using only
synthetic events. It checks travel with no shared words, Chinese dog walking
against an English title, and the distinction between coffee-related events and
going to drink coffee. It also rejects an airport transfer with no evidence of
the requested destination.

With `GROQ_API_KEY` already set in the environment, run from `packages/agent`:

```sh
RUN_SEARCH_LIVE=1 NODE_OPTIONS=--max-old-space-size=1400 ./node_modules/.bin/vitest run ../../tests/agent/search-rerank.live.test.ts --maxWorkers=1
```

The live test makes eight model calls. It is skipped by default. A deterministic
mock pass is not a substitute for this evaluation, and a live pass is evidence
for these fixtures, not a guarantee for every calendar. Add captured failing
queries with anonymized event fields here before changing prompts again.

Searches have a 270-second processing deadline (route duration 300 seconds).
Large calendars can time out; timeout is an error, never a successful truncated
search. Pagination tokens expire after 15 minutes and are bound to the user and
the current auth secret. Edited/deleted results require a new search.
