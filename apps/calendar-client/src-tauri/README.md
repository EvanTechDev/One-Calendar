# Calendar native host

The Tauri host runs the locally bundled React calendar from
`@zntr/shared/calendar`. React owns the product UI; Rust owns native
integration, authenticated transport, credentials, offline data, and updates.
Remote identity pages are isolated from the bundled renderer.

See the [desktop guide](../README.md) for build environments, releases,
platform requirements, and acceptance evidence.

## Responsibilities

| Area                 | Source                                                   | Responsibility                                                                                                             |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Shell and navigation | `src/lib.rs`                                             | Main window, tray, fullscreen, deep links, navigation policy, and native command registration                              |
| Identity             | `src/auth.rs`, `src/identity.rs`, `src/protocol.rs`      | OAuth/PKCE sign-in, session restoration, credential storage, embedded auth/settings views, and Linux callback registration |
| API and offline data | `src/transport.rs`, `src/offline.rs`                     | Authenticated streaming requests, cancellation, encrypted cache access, and read-only offline behavior                     |
| Integrations         | `src/integrations.rs`                                    | Browser handoffs, connectivity checks, file export, cookie-free URL import, and notification permission                    |
| Background services  | `src/reminders.rs`, `src/autostart.rs`, `src/updates.rs` | Reminder delivery, login startup, and signed update checks/installation                                                    |

Calendar requests follow `CalendarHost.request` → Tauri IPC → Rust → Calendar
API. Session cookies stay in Rust and the operating system credential store;
React receives public session state rather than credentials.

## Navigation and authentication

- Only bundled `/`, `/index.html`, and `/app` documents navigate inside the
  main WebView. Other main-window navigations and new windows are denied and
  routed to the system browser when their URL scheme is supported.
- Supported first-party browser destinations can use a short-lived handoff
  into an independent browser session. Other HTTP(S) and `mailto` links open
  directly in the browser or mail client.
- Sign-in, sign-up, password recovery, and account settings use an incognito
  official-origin child view restricted to the required identity routes. It
  has no native IPC capability or persistent WebView cookies.
- Sign-in uses an OAuth authorization code with S256 PKCE. The callback returns
  through the environment-specific application protocol, and Rust exchanges
  the code for a desktop session independent of the browser session.
- Vercel BotID protects the official browser credential and mail-sending
  flows. It does not run in the bundled calendar renderer or during native
  OAuth token exchange.

## Capabilities and CSP

`capabilities/default.json` grants `core:default` only to the `main` window.
React calls an explicit set of Rust commands; the generic request bridge
accepts only same-origin `/api/` paths and excludes authentication, desktop,
and MCP endpoints.

`tauri.conf.json` defines the production identifier, deep-link scheme, and
bundled-renderer CSP. Production connections from `connect-src` are limited to
Tauri IPC, scripts are limited to self, and frames, objects, and form
submissions are disabled. The development CSP additionally permits the Vite
server, HMR WebSockets, and inline development scripts.

`tauri.dev.conf.json` gives development builds a separate product name,
application identifier, and callback scheme, isolating their credentials,
application data, and update channel from production.
