# Zentra Docs

English user documentation for Zentra Calendar and Zentra Meet. Pages focus on recurring schedules, time zones, invitations, AI, meeting access, and privacy boundaries.

## Maintain content

Pages live in `content/docs/`; each folder's `meta.json` controls navigation. Before changing a page, check its user goal and source files in the [content plan](./CONTENT-PLAN.md). Frontmatter requires a title, description, and content metadata.

Markdown exports, `/llms.txt`, and `/llms-full.txt` use the same MDX as the website. Search uses Fumadocs' English index.

For inline emphasis, use `<strong>` or `<em>` within a paragraph instead of Markdown emphasis markers. This avoids the current Fumadocs serializer's recursion on bold and italic Markdown when an installation resolves `mdast-util-to-markdown` 2.1.3.

## Layout

Preserve the original supplied template's components and styling: Inter and JetBrains Mono, its purple-accented light/dark palette, article title and description layout, callouts, code blocks, tabs, and page actions. This is the supplied template's design, not the unmodified Fumadocs default theme. Adapt branding and documentation content without replacing those components.

`lib/layout.shared.tsx` configures Zentra's brand and repository link. `components/ai/page-actions.tsx` retains the template's split copy button and Markdown, GitHub, and AI menus. The home page adds grouped four-column topic cards, which reflow to two or one column on smaller screens. `components/topic-cards.tsx` renders those cards; their scoped styles live after the original theme in `app/global.css`.

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
