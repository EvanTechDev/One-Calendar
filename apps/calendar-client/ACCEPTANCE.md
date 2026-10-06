# Desktop acceptance record

Implementation is tracked by CORE-225 and its existing child issues. A build or
unit-test pass alone does not complete native acceptance. Record the source SHA,
installer checksum, OS version, environment, result and artifact link for each
run. Protocol tests and the automated evidence below do not replace the remaining
real-account checks.

## Recorded evidence

| Check                                                                                                        | Revision / GitHub Actions run                                                                    | Result                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace type checks, lint, tests; Next.js production build                                                 | `b00b735d` / [37434044441](https://github.com/EvanTechDev/One-Calendar/actions/runs/37434044441) | Passed these jobs. Authentication includes 26 memory/PostgreSQL desktop cases with email verification and TOTP.                                 |
| Shared calendar frame at 1280×900 and 1200×680                                                               | `60c50609` / [37422363994](https://github.com/EvanTechDev/One-Calendar/actions/runs/37422363994) | Screenshots inspected against the reference. This is frame/layout evidence, not authenticated interaction evidence.                             |
| Installed Windows and both macOS startup/window checks                                                       | `09b3ca77` / [37430483400](https://github.com/EvanTechDev/One-Calendar/actions/runs/37430483400) | Passed these three targets.                                                                                                                     |
| Installed signed update, corrupt-signature rejection, retry, restart and app-data retention on Windows/Linux | `b00b735d` / [37434044441](https://github.com/EvanTechDev/One-Calendar/actions/runs/37434044441) | Passed both updater jobs.                                                                                                                       |
| Production installed signed updates on all four targets                                                      | `678aaab8` / [37437008633](https://github.com/EvanTechDev/One-Calendar/actions/runs/37437008633) | All four actual updater jobs passed, including corrupt-signature rejection, retry, automatic restart, installation-path and app-data retention. |
| Production startup/window geometry                                                                           | `678aaab8` / [37437008633](https://github.com/EvanTechDev/One-Calendar/actions/runs/37437008633) | Windows and both macOS jobs passed. Linux also reached correct 1200×720 outer geometry; its later second-instance lifecycle check failed.       |

These runs were not wholly green: Linux's second-instance lifecycle failure is
still under investigation. Real-account browser login, OS
credential restoration, reminder delivery and signed-in upgrade checks remain
pending. The matching backend must serve the configured official origin, and
long-term release signing environments must be configured before public publishing.

Backend deployment probe at `678aaab8`: Vercel deployment `6879425921` succeeded
at `https://calendar-i1p3ugmik-zntr-labs.vercel.app`. Its unauthenticated desktop
session endpoint returns the expected 401, but the development origin
`https://precal.xyehr.cn/api/auth/desktop/session` still returns 404. The preview's
OAuth metadata advertises `https://precal.xyehr.cn/api/auth` as issuer and uses
that origin for authorization/token endpoints. A preview-only deployment is
therefore insufficient: promote the matching backend to the configured dev
origin before attempting installed-client login acceptance.

## Automated gate

Run Workspace Checks with the implementation branch, `desktop_environment=dev`
and `visual_baseline=true`. It runs workspace type checks, lint and tests,
including the desktop authentication contract against an isolated PostgreSQL
service, native Rust tests, four installed-application startup checks, and the
reference/desktop-content-width screenshots. Repeat the native matrix for
production environment isolation after the dev run passes.

Inspect the screenshots against `tests/calendar/visual/reference-width.png`.
Exercise day/week/month/year views, event creation/editing and recurrence scopes,
invites, meeting links, categories, bookmarks, countdowns, analytics, preferences,
file import/export, search, AI streaming/cancellation and natural-language create.

## Installed-app acceptance

For Windows x64, Linux x64 and both macOS architectures:

1. Install the matching artifact. Log in through the system browser, verify the
   callback returns to the existing window and real calendar data is editable.
   Cancel/retry sign-in and reject an expired or repeated callback.
2. Quit and restart: login persists. Browser logout preserves desktop login;
   desktop logout preserves browser login. Restart after desktop logout remains
   signed out. A revoked desktop session cannot keep reading calendar data.
3. Open Account and an invite from the client with a signed-out browser, then
   with a different browser account. The latter must retain its own account.
   Check ordinary links, new-window links and programmatic external navigation.
4. Close the window: the process and tray remain. Open from the tray and reopen
   through the application shortcut: one window returns. Quit ends the process.
   Check fixed outer sizing on normal, high-DPI and smaller screens.
5. Create a reminder outside the visible calendar range. Close to tray and wait
   for it. Verify one sound and one notification. Edit/delete before delivery;
   check a recurrence override, reconnect catch-up, wake-from-sleep catch-up,
   restart deduplication and account switching. Denied OS notifications must not
   repeatedly replay the same reminder.
6. Disconnect while editing and while AI is streaming; confirm visible failure,
   cancellation and successful retry after reconnection. No offline write queue
   or stale success indication should appear.

## Signed two-version update

The Installed Desktop Update Check (also available through Workspace Checks'
`updater_environment` input) builds 0.0.1 and 0.0.2 with a disposable runner-local
key. It installs A, serves a corrupt B first, checks signature rejection, retries
the valid B, and verifies restart, unchanged installation path, preserved app
data and no remaining update. Its Rust `acceptance` feature and loopback HTTP
endpoint override are excluded from release builds. The workflow uploads only
runtime reports; it publishes neither keys nor installers. Run it for each
environment. This automated rehearsal does not establish persistence of a real
signed-in session through an update.

Provision separate updater keys in the `desktop-dev` and `desktop-production`
GitHub environments as documented in README. Never place private keys in logs or
artifacts. Use two increasing versions on the same channel.

1. Publish and install version A using Desktop Release. Sign in and record the
   installation path, selected theme and active account.
2. Publish version B to that channel. In A's About panel, check for updates,
   download and install. Confirm the app restarts as B at the same installation
   location, retains its account/theme and leaves no second running copy.
3. Interrupt the download, then retry. Confirm a failed update leaves A runnable.
   In an isolated test release, corrupt the artifact bytes without changing its
   signature: installation must fail and the installed app must stay runnable.
4. Repeat on all target systems and both channels. A dev install must neither
   discover nor overwrite production; a production install must not receive dev
   artifacts. A current version reports no available update.

Do not publish a stable release or mark CORE-235/CORE-240 accepted until the
corresponding evidence is attached in Linear. Release credentials and the actual
installed-app runs are external prerequisites, not covered by source review.
