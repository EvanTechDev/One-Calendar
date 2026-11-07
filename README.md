<div align="center">
  <img width="1200" alt="Zentra" src="https://github.com/user-attachments/assets/44bc5cd4-4776-4db2-9cca-84d2855f6014" />

  <h1>Zentra</h1>
  <p><strong>Open-source tools for planning, meeting, and getting work done.</strong></p>
  <p>A self-hostable productivity suite with an AI-powered calendar, live video meetings, and a native desktop experience.</p>

  <p>
    <a href="https://calendar.xyehr.cn">Open Calendar</a> ·
    <a href="https://docs.xyehr.cn/docs/one-calendar">Documentation</a> ·
    <a href="https://github.com/EvanTechDev/One-Calendar/issues">Report an issue</a>
  </p>

  <p>
    <a href="./LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-black?style=flat-square"></a>
    <img alt="Bun 1.4.4" src="https://img.shields.io/badge/Bun-1.4.4-black?style=flat-square&logo=bun">
    <a href="https://github.com/EvanTechDev/One-Calendar/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/EvanTechDev/One-Calendar?style=flat-square&logo=github"></a>
  </p>
</div>

## Products

| Product        | What it does                                                                                               | Source                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Calendar**   | AI-assisted scheduling, recurring events, invitations, reminders, analytics, and MCP integrations          | [`apps/calendar`](./apps/calendar)               |
| **Meet**       | Live video meetings with chat, attendance, and shared Calendar identity                                    | [`apps/meet`](./apps/meet)                       |
| **Desktop**    | Cross-platform Tauri client with native reminders, secure sessions, and encrypted read-only offline access | [`apps/calendar-client`](./apps/calendar-client) |
| **Web & Docs** | Marketing website and task-focused user documentation                                                      | [`apps/web`](./apps/web), [`docs`](./docs)       |

## Quick start

### Prerequisites

- [Bun 1.4.4](https://bun.sh)
- [Node.js 25](https://nodejs.org) for framework tooling
- PostgreSQL for Calendar and Meet

### Run the workspace

```bash
git clone https://github.com/EvanTechDev/One-Calendar.git
cd One-Calendar
bun install
cp apps/calendar/.env.example apps/calendar/.env
bun run dev
```

Configure `apps/calendar/.env` before using authenticated or database-backed features. The main development servers are:

| App           | Local URL               |
| ------------- | ----------------------- |
| Calendar      | `http://localhost:3000` |
| Meet          | `http://localhost:3001` |
| Documentation | `http://localhost:3002` |

See the [Calendar guide](./apps/calendar/README.md) for environment setup, database migrations, and deployment.

## Everyday commands

Run these from the repository root:

| Command              | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `bun run dev`        | Start all development servers                             |
| `bun run build`      | Generate locales and build workspaces in dependency order |
| `bun run type-check` | Type-check every workspace                                |
| `bun run lint:check` | Run oxlint without applying fixes                         |
| `bun run test`       | Run workspace tests in isolation                          |
| `bun run format`     | Format supported files                                    |

Use `bun run --filter <workspace> <script>` to target one app or package.

## Repository map

```text
apps/
  calendar/          Next.js Calendar product and API
  meet/              Next.js LiveKit meeting app
  calendar-client/   Tauri + React desktop client
  web/               Astro marketing site
packages/
  shared/            Calendar product code and meeting domain logic
  agent/             AI tools, parsing, and search
  auth/              Better Auth, security, and cross-app identity
  ui/                Shared interface primitives
  i18n/              Locale generation and translation tooling
  utils/             Generic utilities
docs/                Fumadocs user documentation
tests/               Tests grouped by owning workspace
```

Each app owns its routes and infrastructure. Shared product behavior lives in `packages/`; apps never import one another.

## Contributing

Contributions are welcome. Read [AGENTS.md](./AGENTS.md) for architecture rules, database conventions, testing guidance, and commit requirements. Keep changes focused and run the relevant checks before opening a pull request.

## Support

Zentra is supported by [Cloudflare Project Alexandria](https://blog.cloudflare.com/expanding-our-support-for-oss-projects-with-project-alexandria/).

If Zentra is useful to you, consider starring the repository—it helps others discover the project.

[![Star History Chart](https://api.star-history.com/chart?repos=EvanTechDev/One-Calendar&type=date&legend=top-left&sealed_token=Crp2JYUSXiqnSjscXYiQqvrfjlnvXTZMMqvt4MBs8TIPTHmVOLlkb1LaF9xLYY-hr5M9kVpX7lCJDDXFs2BOL8ivS3efKU9SzV2EZlZBfALpd_n01IPCosklvkEI4r3s0UCFlmL-8mSCinZzDYsEqxwEZeAcNp1Gv2h-ahRy_E1zEZ1SM9B-GN67Ffyn)](https://www.star-history.com/?repos=EvanTechDev%2FOne-Calendar&type=date&legend=top-left)

## License

Made with ❤️ and published under the [MIT License](./LICENSE).
