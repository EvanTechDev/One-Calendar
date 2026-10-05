# Zentra Docs

English user documentation for Zentra Calendar and Zentra Meet. Pages focus on recurring schedules, time zones, invitations, AI, meeting access, and privacy boundaries.

## Maintain content

Pages live in `content/docs/`; each folder's `meta.json` controls navigation. Before changing a page, check its user goal and source files in the [content plan](./CONTENT-PLAN.md). Frontmatter requires a title, description, and content metadata.

Markdown exports, `/llms.txt`, and `/llms-full.txt` use the same MDX as the website. Search uses Fumadocs' English index.

For inline emphasis, use `<strong>` or `<em>` within a paragraph instead of Markdown emphasis markers. This avoids the current Fumadocs serializer's recursion on bold and italic Markdown when an installation resolves `mdast-util-to-markdown` 2.1.3.

## Layout

The desktop layout has a fixed navigation rail, a top breadcrumb and action bar, and an article with a right-hand table of contents. The home page uses four-column topic cards. On smaller screens, navigation becomes a drawer and cards reflow to two or one column.

Layout tokens and responsive rules live in `app/global.css`. `components/docs-toolbar.tsx` owns page actions, search, and theme controls; `components/topic-cards.tsx` renders the home page cards. Navigation, search, and table-of-contents behavior remain provided by Fumadocs.

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
