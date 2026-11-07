# Zentra Docs

English user documentation for Zentra Calendar and Zentra Meet: 24 pages covering scheduling, coordination, automation, meeting preparation, live collaboration, and follow-up.

**Quick links:** [Commands](#commands) · [Content guide](#content-guide) · [Layout contract](#layout-contract) · [Fumadocs constraints](#fumadocs-constraints) · [Deploy](#deploy)

## Commands

Run from the repository root; all dependencies use the root `bun.lock`.

| Task                                                | Command                                  |
| --------------------------------------------------- | ---------------------------------------- |
| Start the docs on port 3002                         | `bun run --filter @zntr/docs dev`        |
| Generate MDX and route types, then check TypeScript | `bun run --filter @zntr/docs type-check` |
| Lint without fixing                                 | `bun run --filter @zntr/docs lint:check` |
| Compile and test the real MDX pipeline              | `bun run --filter @zntr/docs test:mdx`   |
| Create a production build                           | `bun run --filter @zntr/docs build`      |

`type-check` does not start a server. `lint` applies oxlint fixes, while `lint:check` is read-only; both use `../config/oxlint.json`. From the repository root, use `bun run format` or `bun run format:check` for the shared `bun fmt` configuration in `bunfig.toml`.

## Maintain content

- Pages live in `content/docs/`; each folder's `meta.json` controls navigation.
- Frontmatter requires a title, description, and content metadata.
- Before editing, check the page's reader goal and behavior sources in the [content guide](#content-guide).
- Markdown exports, `/llms.txt`, and `/llms-full.txt` use the same MDX as the website. Search uses Fumadocs' English index.

## Content guide

Write for people making scheduling and meeting decisions, not developers learning the implementation.

- Start with the task and its effect on data. Add choices, examples, permissions, lifecycle, and failure recovery only where relevant; do not document obvious clicks.
- Give each page one primary purpose. Use tables for real choices, steps for sequences, and links for details owned by another guide.
- Distinguish searching from acting, hiding from deleting, participant access from ownership, and live delivery from retained history.
- Every behavior claim must match the sources below. Overview and troubleshooting pages synthesize these guides rather than defining separate behavior.

Linear's [Cycles](https://linear.app/docs/use-cycles), [Custom views](https://linear.app/docs/custom-views), and [Notifications](https://linear.app/docs/notifications), consulted through Context7, are organizational references: a focused overview followed by concrete behavior, interacting settings, and exceptions. They are writing references, **not evidence of Zentra features**.

Paths below are relative to the repository root.

| Pages                                                     | Reader's decision                                        | Source of behavior                                                                                                                                                                                                               |
| --------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calendar/events`                                         | Set timing, participants, and save scope                 | `packages/shared/calendar/components/event/event-editor.tsx`; `apps/calendar/lib/validation.ts`                                                                                                                                  |
| `calendar/views`                                          | Choose a horizon and navigate                            | `packages/shared/calendar/components/calendar.tsx`; `packages/shared/calendar/components/settings/settings-dialog.tsx`; `packages/shared/calendar/lib/calendar-range.ts`                                                         |
| `calendar/categories`                                     | Organize, filter, and retire categories                  | `packages/shared/calendar/components/sidebar/sidebar.tsx`; `apps/calendar/app/api/categories/route.ts`; `apps/calendar/lib/drizzle/schema.ts`                                                                                    |
| `calendar/recurring-events`, `calendar/time-zones`        | Change a schedule without changing unintended dates      | `packages/shared/calendar/lib/recurrence/engine.ts`; `packages/shared/calendar/lib/zoned-date.ts`; `packages/shared/calendar/components/event/event-editor.tsx`                                                                  |
| `calendar/invitations`                                    | Share the right dates and respond with the right account | `apps/calendar/app/api/invites/self/route.ts`; `packages/shared/calendar/components/event/event-editor.tsx`                                                                                                                      |
| `calendar/reminders`                                      | Choose a delivery channel and lead time                  | `packages/shared/calendar/lib/notifications.ts`; `packages/shared/calendar/hooks/use-notifications.ts`; `apps/calendar/lib/reminders`                                                                                            |
| `calendar/search`, `calendar/ai`                          | Find records, fill a draft, or execute changes           | `packages/shared/calendar/components/ai/ai-command-palette.tsx`; `apps/calendar/app/api/agent`; `packages/agent/src/tools.ts`                                                                                                    |
| `calendar/bookmarks`, `calendar/countdowns`               | Keep references or track milestones                      | `packages/shared/calendar/components/sidebar/bookmark-panel.tsx`; `packages/shared/calendar/components/sidebar/countdown.tsx`; `packages/shared/calendar/lib/countdown-sort.ts`; `packages/shared/calendar/lib/bookmark-sort.ts` |
| `calendar/import-export`                                  | Transfer records with verified coverage                  | `packages/shared/calendar/components/analytics/import-export.tsx`                                                                                                                                                                |
| `meet/index`, `meet/access`, `meet/privacy`               | Choose ownership, retention, and link lifecycle          | `packages/shared/meetings/operations.ts`; `apps/meet/app/api/meetings/route.ts`; `apps/meet/app/api/connection-details/route.ts`; `packages/shared/calendar/components/event/event-meeting-field.tsx`                            |
| `meet/joining`, `meet/presenting`, `meet/troubleshooting` | Prepare devices and isolate call failures                | `apps/meet/components/room/pre-join-screen.tsx`; `apps/meet/lib/join-preferences.ts`; `apps/meet/components/room/meeting-room.tsx`; `apps/meet/lib/user-choices.ts`                                                              |
| `meet/chat`, `meet/history`                               | Distinguish live participation from saved records        | `apps/meet/hooks/use-room-chat.ts`; `apps/meet/app/api/meetings/[id]/chat/route.ts`; `apps/meet/hooks/use-upcoming-meetings.ts`; `packages/shared/meetings/operations.ts`                                                        |
| `integrations/mcp`                                        | Authorize, inspect, and revoke an external client        | `packages/shared/calendar/lib/mcp/types.ts`; `apps/calendar/lib/mcp/server.ts`; `packages/shared/calendar/components/settings/mcp-settings.tsx`                                                                                  |

### Validate changes

Compile the real MDX, validate internal routes and heading links, and exercise English search with representative terms from new topics. A passing type check alone does not prove that instructions are accurate or pages are discoverable.

`test:mdx` compiles every page through Fumadocs' production MDX loader and verifies that explicit emphasis elements survive Markdown export, without running a Next.js build.

## Layout contract

Preserve the layout from commit `1cc1b28`: compact type, a fixed navigation column, top toolbar, article column, and right-hand table of contents. Keep the neutral grey/white palette, Inter and JetBrains Mono, and the supplied template's callouts, code blocks, tabs, and page actions.

### Desktop geometry

| Element                          | Contract                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Toolbar and sidebar header       | Shared 56px height                                                                                                  |
| Desktop search and theme buttons | 32px controls with 15px icons                                                                                       |
| Sidebar                          | 14px group and document links; 4px between groups and 4px before document lists                                     |
| Article and TOC                  | 15px article text; 12px TOC text                                                                                    |
| TOC visibility                   | Right-hand TOC from 1100px, including 1200×720; narrower screens use the top popover                                |
| TOC grid width                   | 292px below 1280px and 334px on larger desktops, plus 12px trailing padding                                         |
| Sidebar width                    | 304px by default; 272px from 1100–1279px; 324px from 1600px                                                         |
| Article footer                   | 48px above previous/next navigation, reduced to 32px on mobile; cards show Previous or Next, then the article title |

From 1100–1279px, narrow the navigation and TOC columns to preserve article space. Reserve the TOC's full grid width and adjust grid columns rather than translating it over the article. The article and body may shrink within their column, but text must remain separate from the TOC. Keep the breakpoint aligned in `components/toc-slots.tsx` and `app/global.css`. Use the template's existing footer component.

### Components and navigation

| Location                                       | Responsibility                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `lib/layout.shared.tsx`                        | Zentra brand, navigation search, and resource links                                      |
| `components/docs-toolbar.tsx`                  | Breadcrumbs and page controls above the article                                          |
| `components/ai/page-actions.tsx`               | Template split copy button plus Markdown, GitHub, and AI menus                           |
| `components/topic-cards.tsx`, `app/global.css` | Grouped home cards and their scoped styles; four columns reflow to two or one            |
| `content/changelog/`                           | Separately maintained entries for `/changelog`, which shares the Docs layout and toolbar |

The sidebar omits the home page; the top Docs wordmark links to `/docs`. Resource links are Docs, Changelog, GitHub, and Report an issue, while Open app stays in the toolbar. A soft mask fades scrolling labels over 32px at the top and 48px at the bottom, blending into the fixed header and resource links. Matching vertical padding keeps the first and last rows clear at either scroll end.

### Mobile and narrow screens

- **Below 768px:** toolbar controls, navigation rows, and TOC links have 44px touch targets. Copy page remains in page actions; hide its separate toolbar button to preserve space for the current title.
- **Navigation drawer:** opens from the left with the Zentra logo and “Zentra | Docs” beside the existing close control. The brand returns to `/docs` and closes the drawer, even when already home. `components/mobile-sidebar-brand.tsx` uses the sidebar banner slot without replacing navigation.
- **Mobile viewport:** the drawer uses dynamic viewport height, a 24px edge fade, and safe-area padding. The TOC row is 44px tall; constrain its open list to the available height and keep reserved grid and trigger heights synchronized.
- **At 600px and below:** home cards become single-column horizontal links. Articles use tighter heading spacing, locally scrolling tables, and stacked previous/next cards. Wide content stays in its own scroll container; do not hide article overflow.

## Fumadocs constraints

- For inline emphasis, use `<strong>` or `<em>` inside a paragraph instead of Markdown emphasis markers. The current Fumadocs serializer can recurse on bold and italic Markdown when an installation resolves `mdast-util-to-markdown` 2.1.3.
- The workspace pins `mdast-util-to-markdown` to 2.1.2 as a dependency-level precaution; see the [upstream issue](https://github.com/fuma-nama/fumadocs/issues/3604).
- `components/toc.tsx` and `components/toc-slots.tsx` preserve the straight-line TOC and mobile popover from the template's Fumadocs UI 16.8.1. The current library default uses a different animated track; retain these local slots instead of switching back to that default. The upstream MIT notice is in `components/toc.LICENSE`.

## Deploy

Set the application root to `docs` and install workspace dependencies with `bun install --frozen-lockfile`. Use the Bun version declared in the root `package.json` together with the root lockfile so deployment applies the same dependency overrides.

Set `BASE_URL` to the public documentation origin; Vercel's production and deployment host variables are also supported. This origin feeds canonical links and the Markdown index—it is not Calendar's MCP endpoint.

Site metadata and repository links live in `lib/site.ts`. Icons use Zentra's existing brand assets. Next.js generates PNG social cards without remote fonts or image services.
