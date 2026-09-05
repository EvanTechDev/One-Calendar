# Standalone tool bindings

The authored tool definitions live in `../../src/tools.ts` and are bound to
a `CalendarToolkit` per request. The calendar app binds them to its
database-backed toolkit in `apps/calendar/lib/agent/toolkit.ts`.

The standalone eve runtime (this directory) binds them to the HTTP toolkit
in `../../src/http-toolkit.ts`, which talks to a running calendar instance
through its REST API using a bearer session. Set:

- `CALENDAR_BASE_URL` — origin of the running calendar app
- `CALENDAR_COOKIE` — a signed-in session cookie value

Without these, tools return a configuration error instead of data. This is
deliberate: the standalone agent must never receive direct database
credentials, because every scope/authorization decision lives in the app.
