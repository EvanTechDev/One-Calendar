# Zentra Calendar Desktop

The Tauri client bundles `/app` locally from `@zntr/ui/calendar`, the same
calendar components, data providers and recurrence implementation used by Web.
Sign-in, sign-up, password recovery and account settings stay inside the client.
Web and desktop share a No internet screen that preserves the mounted calendar
and editor while disconnected, then revalidates data when connectivity returns.

## Architecture

- Shared calendar code lives in `packages/ui/src/calendar`, exported by
  `@zntr/ui/calendar`. The host port lives in `packages/utils/src/calendar-host`,
  exported by `@zntr/utils/calendar-host`. Web and desktop import them directly.
  Each app registers its own Tailwind source paths.
- React requests use `CalendarHost.request`: Tauri IPC → Rust → Calendar API.
  Streaming responses and cancellation use the same port. Session cookies remain
  in Rust and the operating system credential store.
- The embedded official-origin auth view uses the existing Better Auth forms,
  including BotID browser instrumentation, email verification and two-factor
  authentication. The remote view has no native IPC access. Sign-in uses authorization
  code and S256 PKCE. Exchanging the code creates an independent desktop session.
  Signing out of either browser or desktop leaves the other session intact.
- Opening account settings creates a single-use, 60-second handoff into an
  ephemeral official-origin view inside Settings. The standalone `/account`
  route is removed. External browser links still use a handoff: an
  already signed-in browser keeps its current account. A signed-out browser gets
  a new independent session.
- Close hides the window in the tray; Open and Quit are explicit tray actions.
  The fixed outer window is 1320 × 880 logical pixels, clamped to screen space.
  Fullscreen is available from the tray or F11 (Escape exits). The embedded
  identity header also has a fullscreen button. Edge-drag resizing remains disabled.
- The native reminder worker refreshes the server's recurrence-expanded feed
  independently of the displayed range. It checks online before delivery and
  stores hashed Fired records per account and origin, preserving Catch-Up rules.
  System notifications are silent; the bundled reminder sound plays once.
- File exports use the native save dialog. URL imports use a separate,
  cookie-free native HTTP client. Fonts and calendar assets are bundled.

## Build environments

`ZENTRA_DESKTOP_ENV` is `dev` or `production`; `ZENTRA_API_ORIGIN` is an HTTPS
origin. Defaults are `https://precal.xyehr.cn` for dev and
`https://calendar.xyehr.cn` for production. Cargo reads these at compile time.
Dev builds also pass `--config src-tauri/tauri.dev.conf.json`.

Names, application IDs, deep-link schemes, credentials, application data and
update channels are separate between environments. The runtime rejects a
mismatched environment and application ID.

Deploy the Calendar backend from the same implementation before distributing a
client that points to it. Desktop sign-in needs the `/api/auth/desktop/*` routes
and the official native OAuth registration; an older backend cannot complete the
callback. The server selects dev for `precal.xyehr.cn` and production otherwise,
or accepts an explicit matching `ZENTRA_DESKTOP_ENV`. Existing OAuth migrations
must already be applied, including `0022_relax_legacy_account_issuer.sql`.

Linux installations require WebKitGTK 4.1, the Secret Service credential store,
an application-indicator provider, `desktop-file-utils` and `xdg-utils`. The last
two packages register the browser login callback. A locked credential store is
reported in the client; unlocking it and retrying saves the session.

## Remote checks and releases

The manual Workspace Checks workflow runs the consolidated workspace checks and
can build Windows x64 NSIS, Linux x64 AppImage, macOS Intel DMG and Apple Silicon
DMG. Native smoke installs/copies each installer and checks actual frontend IPC,
visibility and outer window geometry. Linux also captures screenshots at two
display scales. Smoke evidence is uploaded separately from installers.

Desktop Release is manual for dev (`version=X.Y.Z`) and triggered by
`desktop-vX.Y.Z` tags for production. Configure GitHub environments `desktop-dev`
and `desktop-production`, each with its own:

- variable `ZENTRA_UPDATER_PUBLIC_KEY`;
- secret `TAURI_SIGNING_PRIVATE_KEY` and optional key password
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

Public API origins can be overridden by repository variables
`ZENTRA_DEV_API_ORIGIN` and `ZENTRA_API_ORIGIN`. The four installers must all pass
smoke before publication. Versioned releases are immutable; the `desktop-dev`
and `desktop-stable` channel releases hold `latest.json` pointing to those signed
assets. Versions must increase independently in each channel. If publication
stops after creating a draft, inspect and remove that unpublished draft before
retrying the same version.

Users explicitly check, download and restart to install an update. Tauri verifies
the updater signature. Windows installers currently have no publisher signature;
macOS installers have no Developer ID notarization.

## Validation status

The acceptance procedure is in [ACCEPTANCE.md](./ACCEPTANCE.md). Record results
against their exact source revision in CORE-225 and its child issues. Workspace
checks include the real PostgreSQL authentication contract; native startup,
session restoration, tray/reminder delivery and signed updates each need their
own evidence. Earlier installer builds do not establish acceptance of later
source revisions.

The current Termux machine is for source editing only. Run builds, development
servers and checks in CI or on an external desktop. On those systems,
`pnpm --filter calendar-client build` builds the frontend and
`pnpm --filter calendar-client build:tauri` builds the installer.
