<img width="1500" height="500" alt="Zentra banner" src="https://github.com/user-attachments/assets/44bc5cd4-4776-4db2-9cca-84d2855f6014" />

## Zentra

Zntr builds fully open-source, self-hostable cloud products. This monorepo contains all of them: Zentra Calendar (the next gen calendar powered by AI agent), Zentra Meet (video meetings), the desktop client, and the shared packages behind them.

## Contributing

Contributions are welcome. See [AGENTS.md](./AGENTS.md) for workspace commands and conventions.

## Repository layout

- `apps/`: Calendar web app, Meet, desktop client, and marketing website.
- `packages/calendar/`: shared Calendar UI, state, recurrence, styles, and web/desktop host interface.
- `packages/`: reusable UI primitives, auth, meetings, agent, utilities, and translations.
- `docs/`: the user documentation website.
- `tests/`: workspace tests, mirroring source ownership.
- `config/` and `scripts/`: shared tooling and workspace orchestration.

Within `apps/calendar/`, `app/` owns routing, `features/` groups business modules,
`components/` owns the app shell and landing page, and `lib/` holds infrastructure.
Application code lives directly under the workspace root, without a `src/` wrapper.

## License

Made with ❤️

Published under the [MIT License](./LICENSE).

This project is supported by [Cloudflare Project Alexandria](https://blog.cloudflare.com/expanding-our-support-for-oss-projects-with-project-alexandria/).

## Star history

[![Star History Chart](https://api.star-history.com/chart?repos=EvanTechDev/One-Calendar&type=date&legend=top-left&sealed_token=Crp2JYUSXiqnSjscXYiQqvrfjlnvXTZMMqvt4MBs8TIPTHmVOLlkb1LaF9xLYY-hr5M9kVpX7lCJDDXFs2BOL8ivS3efKU9SzV2EZlZBfALpd_n01IPCosklvkEI4r3s0UCFlmL-8mSCinZzDYsEqxwEZeAcNp1Gv2h-ahRy_E1zEZ1SM9B-GN67Ffyn)](https://www.star-history.com/?repos=EvanTechDev%2FOne-Calendar&type=date&legend=top-left)
