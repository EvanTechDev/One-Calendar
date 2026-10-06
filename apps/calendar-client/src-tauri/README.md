# Calendar native host

The WebView loads the locally bundled React calendar. Rust owns authenticated
HTTP, credential storage, window/tray behavior, reminders and signed updates.
See [the desktop guide](../README.md) for configuration and acceptance evidence.

## Navigation and authentication

Only bundled application documents stay inside the WebView. Other pages open in
the system browser; first-party pages can receive an independent browser session.
Sign-in uses browser OAuth with PKCE and returns through the environment-specific
application protocol.

Vercel BotID verifies credential and mail-sending requests on that browser's auth
API. It does not run inside this WebView or on native OAuth token exchanges.

## Capabilities and CSP

The renderer uses narrowly scoped native commands. Authenticated requests go
through Rust rather than direct WebView HTTP; session cookies never reach React.
`tauri.conf.json` defines the bundled-page CSP and production identifier, while
`tauri.dev.conf.json` isolates the development app and its protocol.
