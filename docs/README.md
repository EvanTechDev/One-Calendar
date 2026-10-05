# Zentra Docs

English user documentation for Zentra Calendar and Zentra Meet. Pages focus on recurring schedules, time zones, invitations, AI, meeting access, and privacy boundaries.

## Maintain content

Pages live in `content/docs/`; each folder's `meta.json` controls navigation. Before changing a page, check its user goal and source files in the [content plan](./CONTENT-PLAN.md). Frontmatter requires a title, description, and content metadata.

Markdown exports, `/llms.txt`, and `/llms-full.txt` use the same MDX as the website. Search uses Fumadocs' English index.

For inline emphasis, use `<strong>` or `<em>` within a paragraph instead of Markdown emphasis markers. This avoids the current Fumadocs serializer's recursion on bold and italic Markdown when an installation resolves `mdast-util-to-markdown` 2.1.3.

## Layout

Use the layout from commit `1cc1b28` with a compact type scale: a fixed navigation column, a top toolbar, an article column, and a right-hand table of contents. Keep the current neutral grey/white palette, Inter and JetBrains Mono, and the supplied template's callouts, code blocks, tabs, and page actions.

The toolbar and sidebar header share a 56px height. Sidebar groups and document links share a 14px font, with 12px between groups and 4px before their document lists. Article text is 15px. The right-hand table of contents appears from 1100px wide, including 1200×720 screens; narrower screens use the top popover. Between 1100px and 1279px, the navigation and TOC columns narrow to leave room for the article. Keep this breakpoint aligned in `components/toc-slots.tsx` and `app/global.css`. The article footer reserves 48px above previous/next navigation, reduced to 32px on mobile.

The TOC reserves its full width in the grid: 268px below 1280px and 310px on larger desktop screens, with 12px of trailing padding. Adjust its grid width rather than translating it over the article. The article and its body can shrink within their column, keeping text separate from the TOC.

`lib/layout.shared.tsx` configures Zentra's brand, navigation search, and resource links. `components/docs-toolbar.tsx` places breadcrumbs and page controls above the article. `components/ai/page-actions.tsx` retains the template's split copy button and Markdown, GitHub, and AI menus. The home page adds grouped four-column topic cards, which reflow to two or one column on smaller screens. `components/topic-cards.tsx` renders those cards; their scoped styles live in `app/global.css`.

The sidebar omits the home page from its document list; the top Docs wordmark links to `/docs`. A soft mask fades scrolling labels at the list's edges, blending into the fixed header and resource links. The list's padding keeps its first and last rows clear when scrolled to either end.

`components/toc.tsx` and `components/toc-slots.tsx` preserve the straight-line table of contents from the template's Fumadocs UI 16.8.1, including its mobile popover. The current library's default TOC uses a different animated track, so use these local slots rather than switching back to that default. Their upstream MIT notice is in `components/toc.LICENSE`.

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
