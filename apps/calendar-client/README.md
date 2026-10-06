# Zentra Calendar Desktop

The Tauri client bundles `/app` locally from `@zntr/calendar-ui`, the same
calendar components, data providers and recurrence implementation used by Web.
Authentication and other webpages open in the system browser. This version
requires a connection; failed requests expose a retry action.

## Architecture

- React requests use `CalendarHost.request`: Tauri IPC → Rust → Calendar API.
  Streaming responses and cancellation use the same port. Session cookies remain
  in Rust and the operating system credential store.
- Browser sign-in uses the existing Better Auth OAuth provider, authorization
  code and S256 PKCE. Exchanging the code creates an independent desktop session.
  Signing out of either browser or desktop leaves the other session intact.
- Opening an account page creates a single-use, 60-second browser handoff. An
  already signed-in browser keeps its current account. A signed-out browser gets
  a new independent session. Account management remains on the Web.
- Close hides the window in the tray; Open and Quit are explicit tray actions.
  The fixed outer window is 1200 × 720 logical pixels, clamped to screen space.
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

This branch contains the desktop implementation for CORE-225 and its child tasks.
Consolidated review, real database tests, four-platform installation and native
OAuth/tray/reminder/two-version update acceptance are still pending. Earlier
installer builds do not establish acceptance of the current source.

The current Termux machine is for source editing only. Run builds, development
servers and checks in CI or on an external desktop. On those systems,
`pnpm --filter calendar-client build` builds the frontend and
`pnpm --filter calendar-client build:tauri` builds the installer.
