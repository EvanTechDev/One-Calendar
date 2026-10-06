# Zentra Calendar Desktop Client

The frontend is bundled locally. The native runtime reads public service
configuration from `ZENTRA_DESKTOP_ENV` (`dev` or `production`) and
`ZENTRA_API_ORIGIN` at compile time. Defaults are the production environment and
`https://calendar.xyehr.cn`; dev builds default to `https://precal.xyehr.cn`.

Dev builds must also supply `--config src-tauri/tauri.dev.conf.json`. The runtime
checks the environment against the application identifier to keep the two
installations and their application-data directories separate.

## Remote builds

Use the manual Workspace Checks workflow and choose `desktop_environment`.
It builds Windows x64 (NSIS), Linux x64 (AppImage), macOS Intel and Apple Silicon
(DMG) and uploads each installation artifact. Set `focused_only=true` when only
the native build matrix is needed. Public origins can be configured through the
repository variables `ZENTRA_API_ORIGIN` and `ZENTRA_DEV_API_ORIGIN`.

The matrix also installs/copies the produced package and launches it on its native
runner architecture. An opt-in `ZENTRA_SMOKE_TEST=1` diagnostic records a real
frontend IPC startup and native window properties; ordinary launches produce no
such report. Linux additionally runs at two display scales under Xvfb and captures
screenshots. Smoke reports and logs are retained as separate workflow artifacts.

The current Termux environment is only for source editing and reading; builds,
tests and native runtime acceptance happen in CI or an external desktop system.

## Current implementation milestone

The local application host, environment identity, outer-window sizing and browser
opening are being established in CORE-227. Browser OAuth session handoff is the
next milestone, CORE-228. Installer artifacts from this stage are integration
builds, not the completed first-version product described in CORE-225.

## Development tooling

`pnpm --filter calendar-client build` builds the frontend;
`pnpm --filter calendar-client build:tauri` runs the native bundler, which invokes
that frontend build itself. Export the two environment variables before invoking
the native CLI. The example environment file documents their values; it is not
automatically read by Cargo.
