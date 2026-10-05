# Zentra Docs

English user documentation for Zentra Calendar and Zentra Meet. The 24 pages cover planning and organizing a schedule, coordinating with others, automation, meeting preparation, live collaboration, and follow-up.

## Maintain content

Pages live in `content/docs/`; each folder's `meta.json` controls navigation. Before changing a page, check its user goal and source files in the [content guide](#content-guide). Frontmatter requires a title, description, and content metadata.

Markdown exports, `/llms.txt`, and `/llms-full.txt` use the same MDX as the website. Search uses Fumadocs' English index.

For inline emphasis, use `<strong>` or `<em>` within a paragraph instead of Markdown emphasis markers. This avoids the current Fumadocs serializer's recursion on bold and italic Markdown when an installation resolves `mdast-util-to-markdown` 2.1.3.

## Layout

Use the layout from commit `1cc1b28` with a compact type scale: a fixed navigation column, a top toolbar, an article column, and a right-hand table of contents. Keep the current neutral grey/white palette, Inter and JetBrains Mono, and the supplied template's callouts, code blocks, tabs, and page actions.

The toolbar and sidebar header share a 56px height. Desktop search and theme buttons are 32px with 15px icons. Sidebar groups and document links share a 14px font, with 4px between groups and 4px before their document lists. Article text is 15px; the right-hand table of contents uses 12px text. It appears from 1100px wide, including 1200×720 screens; narrower screens use the top popover. Between 1100px and 1279px, the navigation and TOC columns narrow to leave room for the article. Keep this breakpoint aligned in `components/toc-slots.tsx` and `app/global.css`. The article footer reserves 48px above previous/next navigation, reduced to 32px on mobile. Its cards show Previous or Next followed by the article title, using the template's existing footer component.

The TOC reserves its full width in the grid: 292px below 1280px and 334px on larger desktop screens, with 12px of trailing padding. The sidebar is 304px wide, narrows to 272px between 1100px and 1279px, and grows to 324px from 1600px. Adjust grid widths rather than translating the TOC over the article. The article and its body can shrink within their column, keeping text separate from the TOC.

`lib/layout.shared.tsx` configures Zentra's brand, navigation search, and resource links. `components/docs-toolbar.tsx` places breadcrumbs and page controls above the article. `components/ai/page-actions.tsx` retains the template's split copy button and Markdown, GitHub, and AI menus. The home page adds grouped four-column topic cards, which reflow to two or one column on smaller screens. `components/topic-cards.tsx` renders those cards; their scoped styles live in `app/global.css`.

The sidebar omits the home page from its document list; the top Docs wordmark links to `/docs`. Its resource links are Docs, GitHub, and Report an issue; Open app remains in the toolbar. A soft mask fades scrolling labels over 32px at the top and 48px at the bottom, blending into the fixed header and resource links. Matching vertical padding keeps the first and last rows clear when scrolled to either end.

`components/toc.tsx` and `components/toc-slots.tsx` preserve the straight-line table of contents from the template's Fumadocs UI 16.8.1, including its mobile popover. The current library's default TOC uses a different animated track, so use these local slots rather than switching back to that default. Their upstream MIT notice is in `components/toc.LICENSE`.

Below 768px, toolbar controls, navigation rows, and TOC links have 44px touch targets. Copy page remains in the existing page-actions menu; its separate toolbar button is hidden to leave space for the current title. The navigation drawer uses the dynamic viewport height, a shorter 24px edge fade, and safe-area padding. The mobile TOC row is 44px tall, with its open list constrained to the available screen height. Keep its reserved grid height and trigger height in sync.

At 600px and below, home cards become single-column horizontal links. Mobile articles use tighter heading spacing, locally scrolling tables, and stacked previous/next cards. Keep wide content inside its own scroll container rather than hiding article overflow.

## Content guide

Write for people making scheduling and meeting decisions, not for developers learning our implementation. Start with the task and its effect on data, then explain choices, examples, permissions, lifecycle, and failure recovery where relevant. Avoid padding pages with instructions for obvious clicks.

The organizational references are Linear's [Cycles](https://linear.app/docs/use-cycles), [Custom views](https://linear.app/docs/custom-views), and [Notifications](https://linear.app/docs/notifications), consulted through Context7. Their useful pattern is a focused overview followed by concrete behavior, interactions between settings, and exceptions. They are writing references, not evidence of Zentra features.

Keep one primary purpose per page. Use tables to compare real choices, steps for a sequence, and links for details owned by another guide. Distinguish searching from acting, hiding from deleting, participant access from ownership, and live delivery from retained history. Every behavior claim must match the source below; do not fill gaps with assumptions about another calendar or meeting product.

Paths in this table are relative to the repository root. Overview and troubleshooting pages synthesize these guides rather than defining separate behavior.

| Pages                                                     | Reader's decision                                        | Source of behavior                                                                                                                                                                           |
| --------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calendar/events`                                         | Set timing, participants, and save scope                 | `apps/calendar/components/app/event/event-editor.tsx`; `apps/calendar/lib/validation.ts`                                                                                                     |
| `calendar/views`                                          | Choose a horizon and navigate                            | `apps/calendar/components/app/calendar.tsx`; `apps/calendar/components/app/settings/settings-dialog.tsx`; `apps/calendar/lib/calendar-range.ts`                                              |
| `calendar/categories`                                     | Organize, filter, and retire categories                  | `apps/calendar/components/app/sidebar/sidebar.tsx`; `apps/calendar/app/api/categories/route.ts`; `apps/calendar/lib/drizzle/schema.ts`                                                       |
| `calendar/recurring-events`, `calendar/time-zones`        | Change a schedule without changing unintended dates      | `apps/calendar/lib/recurrence/engine.ts`; `apps/calendar/lib/zoned-date.ts`; `apps/calendar/components/app/event/event-editor.tsx`                                                           |
| `calendar/invitations`                                    | Share the right dates and respond with the right account | `apps/calendar/app/api/invites/self/route.ts`; `apps/calendar/components/app/event/event-editor.tsx`                                                                                         |
| `calendar/reminders`                                      | Choose a delivery channel and lead time                  | `apps/calendar/lib/notifications.ts`; `apps/calendar/hooks/use-notifications.ts`; `apps/calendar/lib/reminders`                                                                              |
| `calendar/search`, `calendar/ai`                          | Find records, fill a draft, or execute changes           | `apps/calendar/components/app/ai/ai-command-palette.tsx`; `apps/calendar/app/api/agent`; `packages/agent/src/tools.ts`                                                                       |
| `calendar/bookmarks`, `calendar/countdowns`               | Keep references or track milestones                      | `apps/calendar/components/app/sidebar/bookmark-panel.tsx`; `apps/calendar/components/app/sidebar/countdown.tsx`; `apps/calendar/lib/countdown-sort.ts`; `apps/calendar/lib/bookmark-sort.ts` |
| `calendar/import-export`                                  | Transfer records with verified coverage                  | `apps/calendar/components/app/analytics/import-export.tsx`                                                                                                                                   |
| `meet/index`, `meet/access`, `meet/privacy`               | Choose ownership, retention, and link lifecycle          | `packages/meetings/src/operations.ts`; `apps/meet/app/api/meetings/route.ts`; `apps/meet/app/api/connection-details/route.ts`; `apps/calendar/components/app/event/event-meeting-field.tsx`  |
| `meet/joining`, `meet/presenting`, `meet/troubleshooting` | Prepare devices and isolate call failures                | `apps/meet/components/room/pre-join-screen.tsx`; `apps/meet/lib/join-preferences.ts`; `apps/meet/components/room/meeting-room.tsx`; `apps/meet/lib/user-choices.ts`                          |
| `meet/chat`, `meet/history`                               | Distinguish live participation from saved records        | `apps/meet/hooks/use-room-chat.ts`; `apps/meet/app/api/meetings/[id]/chat/route.ts`; `apps/meet/hooks/use-upcoming-meetings.ts`; `packages/meetings/src/operations.ts`                       |
| `integrations/mcp`                                        | Authorize, inspect, and revoke an external client        | `apps/calendar/lib/mcp/types.ts`; `apps/calendar/lib/mcp/server.ts`; `apps/calendar/components/app/settings/mcp-settings.tsx`                                                                |

When checking content, compile the real MDX, validate internal routes and heading links, and exercise English search using representative terms from new topics. A passing type check alone does not establish that instructions are accurate or pages are discoverable.

## Workspace commands

Run these from the repository root. Dependencies use the root pnpm lockfile.

```sh
pnpm --filter @zntr/docs dev
pnpm --filter @zntr/docs type-check
pnpm --filter @zntr/docs lint:check
pnpm --filter @zntr/docs test:mdx
pnpm --filter @zntr/docs build
```

The development port is 3002. `type-check` generates MDX and Next.js route types, then checks TypeScript without starting a server. `lint` runs oxlint with fixes; `lint:check` checks without fixing. Both use `../config/oxlint.json`. Formatting follows the repository's Prettier configuration.

`test:mdx` compiles all documentation pages through Fumadocs' production MDX loader and checks that explicit emphasis elements survive Markdown export without running a Next.js build. The workspace also pins `mdast-util-to-markdown` to 2.1.2 as a dependency-level precaution ([upstream issue](https://github.com/fuma-nama/fumadocs/issues/3604)).

## Deploy

Set the application root to `docs` and install dependencies from the workspace with `pnpm install --frozen-lockfile`. Use the repository's pnpm version and root lockfile so deployment applies the same dependency overrides. Set `BASE_URL` to the public documentation origin. Vercel's production and deployment host variables are also supported. This origin is used for canonical links and the Markdown index; it is not Calendar's MCP endpoint.

Site metadata and repository links live in `lib/site.ts`. Icons use Zentra's existing brand assets. Next.js generates PNG social cards without remote fonts or image services.
