# Zentra documentation plan

Write in English for people using Calendar and Meet to organize their work. Explain tasks, scope, outcomes, and constraints. Avoid expanding self-explanatory button clicks or theme changes into tutorials.

Follow the structure of [Linear's cycle documentation](https://linear.app/docs/use-cycles): explain the purpose, then behavior, exceptions, and related workflows. Follow the [Writing Guidelines](https://github.com/vercel-labs/writing-guidelines) for prose.

## Pages and sources

Paths below are relative to the repository root. Review the corresponding page when product behavior changes. These sources support maintenance; implementation details do not belong in the user guide unless needed to explain a behavior.

| Page                              | User goal                                       | Primary sources                                                                                                                                    |
| --------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/docs`                           | Choose a guide by task                          | The pages below                                                                                                                                    |
| `/docs/calendar`                  | Distinguish categories, series, and invitations | `apps/calendar/components/app/calendar.tsx`, `apps/calendar/components/app/event/event-editor.tsx`                                                 |
| `/docs/calendar/recurring-events` | Choose an edit or deletion scope                | `apps/calendar/components/app/event/event-editor.tsx`, `apps/calendar/lib/recurrence/engine.ts`                                                    |
| `/docs/calendar/time-zones`       | Interpret schedules across time zones           | `apps/calendar/lib/zoned-date.ts`, `apps/calendar/lib/recurrence/engine.ts`, `apps/calendar/app/api/events/route.ts`                               |
| `/docs/calendar/invitations`      | Invite and respond to specific dates            | `apps/calendar/app/api/invites/route.ts`, `apps/calendar/app/api/invites/self/route.ts`, `apps/calendar/lib/invites/rsvp-target.ts`                |
| `/docs/calendar/reminders`        | Choose channels and account for email limits    | `apps/calendar/lib/reminders/email-schedule.ts`, `apps/calendar/lib/reminders/reconcile.ts`, `apps/calendar/components/app/event/event-editor.tsx` |
| `/docs/calendar/search`           | Find events beyond the current view             | `apps/calendar/components/app/ai/ai-command-palette.tsx`, `apps/calendar/hooks/use-keyword-search.ts`                                              |
| `/docs/calendar/ai`               | Fill drafts or act through tools                | `apps/calendar/components/app/event/event-editor.tsx`, `packages/agent/src/tools.ts`, `apps/calendar/app/api/agent/`                               |
| `/docs/calendar/import-export`    | Choose formats and verify migration scope       | `apps/calendar/components/app/analytics/import-export.tsx`, `apps/calendar/lib/ics.ts`, `apps/calendar/lib/calendar-range.ts`                      |
| `/docs/meet`                      | Connect events and calls                        | `apps/calendar/components/app/event/event-meeting-field.tsx`, `apps/meet/app/api/meetings/route.ts`, `packages/meetings/src/operations.ts`         |
| `/docs/meet/access`               | Manage organizer identity and link status       | `apps/meet/lib/creator-token.ts`, `apps/meet/lib/organiser.ts`, `apps/meet/app/api/connection-details/route.ts`                                    |
| `/docs/meet/privacy`              | Choose encryption and chat retention            | `apps/meet/components/home-actions.tsx`, `apps/meet/hooks/use-e2ee.ts`, `apps/meet/app/api/meetings/[id]/chat/route.ts`                            |
| `/docs/meet/presenting`           | Prepare devices and control the viewing layout  | `apps/meet/components/room/meeting-room.tsx`, `apps/meet/components/room/pre-join-screen.tsx`, `apps/meet/lib/join-preferences.ts`                 |
| `/docs/meet/history`              | Find available meeting records                  | `apps/meet/components/dashboard/meeting-history.tsx`, `packages/meetings/src/operations.ts`                                                        |
| `/docs/integrations/mcp`          | Authorize and manage external AI access         | `apps/calendar/components/app/settings/mcp-settings.tsx`, `apps/calendar/lib/mcp/handler.ts`, `apps/calendar/lib/mcp/scopes.ts`                    |
| `/docs/troubleshooting`           | Narrow down a problem from its symptoms         | Implementations referenced above                                                                                                                   |

## Writing conventions

- Give each page one user goal. Start with scope; explain outcomes or limits in each section.
- Use `title` for the page heading and navigation, and `description` for its summary. `meta.contentType`, `meta.category`, and `meta.plan` identify its type, product, and this plan.
- Use `Steps` and `Step` for a sequence. Prefer explaining behavior to documenting long click paths.
- Use English product terminology consistently. Keep labels short enough to scan in navigation.
- Do not promise two-way sync, complete account backups, call recording, waiting rooms, or automatic permission inheritance that the product does not implement.
- Verify any performance claim, service-level commitment, or privacy guarantee against its source before adding it.
