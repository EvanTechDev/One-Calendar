# calendar-client (Tauri shell)

Desktop shell around the hosted Zentra Calendar web app
(`https://calendar.xyehr.cn/app`). Windows are created in
`tauri.conf.json`; `src/lib.rs` only attaches the navigation allowlist.

## Navigation allowlist

`src/lib.rs` attaches `on_navigation` in `setup`: the webview may only load
`https://calendar.xyehr.cn` and its subdomains. No OAuth IdP hosts are
allowed — the hosted app enables no social providers
(`apps/calendar/lib/auth.ts` configures password + twoFactor + emailOTP
only; `APP_CONFIG.auth.enabledOAuthProviders` is empty), so login never
redirects off-origin. There is no `http://localhost` exception: `devUrl`
points at production; add one only if a local `devUrl` is ever configured.

## Capability grants

- `core:default` — required for basic webview/window operation.
- `opener:default` — the hosted app opens product links in the system
  browser: the Help menu's Status item calls
  `window.open(statusPageUrl, '_blank')` (`components/app/calendar.tsx`),
  and privacy/terms pages render `target="_blank"` links
  (`components/landing/legal-page-shell.tsx`). The navigation allowlist
  blocks in-webview navigation to foreign hosts, so `opener` is the only
  escape hatch — which is the intended product behavior.

## Webview CSP

`app.security.csp` in `tauri.conf.json` restricts the webview. `frame-src
'none'`: the app embeds no IdP iframes (no social providers). `connect-src`
covers the app origin and all `*.xyehr.cn` API origins (the app fetches
same-origin via relative URLs). The hosted Next.js app ships its own CSP
headers (plan 007) — the webview enforces the intersection of both; when
debugging a blocked resource, check both.

Maintenance: when a new OAuth provider, API origin, or iframe embed is
added to the hosted app, the allowlists in `src/lib.rs`,
`tauri.conf.json`, and the web app's CSP must move together. Open gap: the
auth forms render a Turnstile widget (`challenges.cloudflare.com` script +
iframe, see `components/auth/*-form.tsx`), which is NOT whitelisted in the
Tauri CSP or plan 007's hosted CSP — verify widget behavior in the
desktop shell at release, and whitelist the host in both if the CAPTCHA
breaks.
