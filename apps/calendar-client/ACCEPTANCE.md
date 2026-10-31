# Desktop acceptance record

Implementation is tracked by CORE-225 and its existing child issues. A build or
unit-test pass alone does not complete native acceptance. Record the source SHA,
installer checksum, OS version, environment, result and artifact link for each
run. Protocol tests and the automated evidence below do not replace the remaining
real-account checks.

## Recorded evidence

### Embedded identity, fullscreen and offline preservation

- `7f609365` / [37507282887](https://github.com/EvanTechDev/One-Calendar/actions/runs/37507282887): workspace type checks, lint and tests passed, including recovery without remounting the same draft in inline, dialog and popover editors, and retaining Web identity during session-fetch failure. Calendar and Meet production builds passed. Reviewed production-styled calendar, shared sign-in/sign-up, and light/dark No Internet captures.
- The same run passed four installed identity-document/fullscreen checks, but its Linux screenshot exposed vertically stacked WebViews despite correct outer-window geometry. That run does **not** establish correct embedded layout. The follow-up adds native child-position/size assertions and a GTK overlay.
- `9e751baf` / [37512722812](https://github.com/EvanTechDev/One-Calendar/actions/runs/37512722812): all four installed sign-in-document/fullscreen/geometry jobs passed. The inspected Linux screenshot confirms the GTK overlay now fills the intended content region. The macOS screenshot exposed a titlebar-origin offset that numerical bounds alone did not catch; the follow-up derives the native content offset from the actual viewport rather than hard-coding titlebar dimensions.
- `9fa0644e` / [37517702032](https://github.com/EvanTechDev/One-Calendar/actions/runs/37517702032): the full workspace type-check/lint/test gate, Next production build and production-CSS visual captures passed. All four installed identity/fullscreen/bounds jobs passed. Inspected the Windows native screenshot after the fullscreen round trip: the toolbar and entire form fit the smaller CI display. Its 1024×720 work area correctly caps the requested 1320×880 outer window; the child occupies exactly the remaining 1008×628 content region below the 53px toolbar. Earlier inspected Linux and corrected macOS captures establish their platform layout evidence.

Current Windows Dev trial: [artifact 11437697441](https://github.com/EvanTechDev/One-Calendar/actions/runs/37517702032/artifacts/11437697441),
`Zentra Calendar Dev_0.1.0_x64-setup.exe`, revision `9fa0644e`.
SHA-256: `ded39018ea4db8ae901b41014c353357bca9ecfdfbac9e4fbd0b8ce6f1517f9e`.

These checks exercise a real installed remote identity document, not a completed
account login. Vercel rejected the latest feature deployments, including
`9fa0644e`, with "Deployment rate limited — retry in 24 hours." The official dev
origin therefore has not been verified with the new embedded settings route and
BotID changes. A Git push or native installer pass does not establish that this
backend revision is live.

### Shared UI migration and visual repair

- `7b74357d` / [37462106922](https://github.com/EvanTechDev/One-Calendar/actions/runs/37462106922): workspace type checks, lint, tests and all four installed native startup checks passed after moving the shared code to `packages/ui/calendar` and removing the Web forwarding modules. The initial screenshot job could not load its authenticated entry without a database; it did not establish visual acceptance.
- `bd89de62` / [37464233248](https://github.com/EvanTechDev/One-Calendar/actions/runs/37464233248): Next production build, compiled-CSS calendar assertions, desktop surface captures and Tailwind source tests passed. Reviewed the actual production-styled week at 1280×900 and 1200×680, populated seven-column month, light/dark and narrow desktop entry, browser-login waiting, connection failure, account/update and loading-failure screenshots. Also inspected the installed Linux WebKit screenshot from the first run. Its credential-store error reflects the CI desktop's unavailable keyring, not completed login acceptance.

The Web regression was missing calendar utility rules in Next's generated CSS:
the old Vite-only screenshots could not catch it. Both app stylesheet entries
now explicitly register their shared source directories. The regression capture
rejects Vite calendar CSS before injecting the built Next styles and fonts.

### Earlier native implementation

| Check                                                                                                        | Revision / GitHub Actions run                                                                    | Result                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace type checks, lint, tests; Next.js production build                                                 | `b00b735d` / [37434044441](https://github.com/EvanTechDev/One-Calendar/actions/runs/37434044441) | Passed these jobs. Authentication includes 26 memory/PostgreSQL desktop cases with email verification and TOTP.                                 |
| Shared calendar frame at 1280×900 and 1200×680                                                               | `60c50609` / [37422363994](https://github.com/EvanTechDev/One-Calendar/actions/runs/37422363994) | Vite-fixture screenshots only. They did not validate Next production CSS and missed the later reported missing calendar utilities.              |
| Installed Windows and both macOS startup/window checks                                                       | `09b3ca77` / [37430483400](https://github.com/EvanTechDev/One-Calendar/actions/runs/37430483400) | Passed these three targets.                                                                                                                     |
| Installed signed update, corrupt-signature rejection, retry, restart and app-data retention on Windows/Linux | `b00b735d` / [37434044441](https://github.com/EvanTechDev/One-Calendar/actions/runs/37434044441) | Passed both updater jobs.                                                                                                                       |
| Production installed signed updates on all four targets                                                      | `678aaab8` / [37437008633](https://github.com/EvanTechDev/One-Calendar/actions/runs/37437008633) | All four actual updater jobs passed, including corrupt-signature rejection, retry, automatic restart, installation-path and app-data retention. |
| Production startup/window geometry                                                                           | `678aaab8` / [37437008633](https://github.com/EvanTechDev/One-Calendar/actions/runs/37437008633) | Windows and both macOS jobs passed. Linux also reached correct 1200×720 outer geometry; its later second-instance lifecycle check failed.       |
| Linux startup, fixed geometry, protocol registration, close/reopen lifecycle and signed update               | `55fb4b8a` / [37439991205](https://github.com/EvanTechDev/One-Calendar/actions/runs/37439991205) | Both jobs passed with a shared desktop D-Bus session, including normal/high-DPI startup and restoring the original window/process.              |

The final focused Linux run is green; the earlier failures above remain recorded
to preserve the red/green evidence. Real-account browser login, OS
credential restoration, reminder delivery and signed-in upgrade checks remain
pending. The matching backend must serve the configured official origin, and
long-term release signing environments must be configured before public publishing.

On 2026-10-06, the user authorized merging the feature branch into `dev` for
Windows trial use. `dev` was fast-forwarded from `01df0867` to `55fb4b8a`.
Vercel's resulting dev deployment, `calendar-pedl926zz-zntr-labs.vercel.app`, is
Ready and serves `precal.xyehr.cn`. The official development desktop session
endpoint now returns the expected unauthenticated 401; OAuth metadata returns
200 with the correct `https://precal.xyehr.cn/api/auth` issuer and desktop scope.
An unauthenticated desktop authorization request reaches the OAuth sign-in page.
This establishes backend availability, not a completed native account login.

Windows trial installer: `Zentra Calendar Dev_0.1.0_x64-setup.exe`, revision
`b00b735d`, [artifact 11398373495](https://github.com/EvanTechDev/One-Calendar/actions/runs/37434044441/artifacts/11398373495).
Its SHA-256 is `8160096abd8528be7206196b98c602f187db787f5f5bed86cb3b67ac201e566f`.
It passed installed Windows startup checks and targets the development backend.

## Automated gate

The current requested layout is `packages/ui/src/calendar` with the host port in
`packages/utils/src/calendar-host`. The window is now 1320×880 logical outer
pixels, with fullscreen available and edge resizing disabled. Sign-in, sign-up,
password recovery and account settings are embedded in the client; `/account`
has been removed. The earlier evidence above describes earlier revisions, not
acceptance of these changes.

Run Workspace Checks with the implementation branch, `desktop_environment=dev`
and `production_ui=true`. It runs workspace type checks, lint and tests,
including the desktop authentication contract against an isolated PostgreSQL
service, native Rust tests, four installed-application startup checks, and the
production-CSS calendar and desktop-surface screenshots. Repeat the native matrix for
production environment isolation after the dev run passes.

The production UI check takes stylesheets and font classes from the built Next
root layout, then applies them to a deterministic calendar with Vite's calendar
CSS explicitly disabled. It asserts the populated month has seven columns and
captures the 1280px/1200px Web layouts and 1320×880 sign-in, sign-up, recovery,
settings, offline and error states. The
separate `visual_baseline` input is a Vite-only reference and cannot establish
production Web appearance on its own.

Inspect the screenshots against `tests/calendar/visual/reference-width.png`.
Exercise day/week/month/year views, event creation/editing and recurrence scopes,
invites, meeting links, categories, bookmarks, countdowns, analytics, preferences,
file import/export, search, AI streaming/cancellation and natural-language create.

## Installed-app acceptance

For Windows x64, Linux x64 and both macOS architectures:

1. Install the matching artifact. Sign-in appears inside the existing window.
   Switch to sign-up and password recovery, complete email verification/TOTP as
   applicable, and verify real calendar data becomes editable. Retry sign-in and
   reject an expired or repeated callback. The embedded official-origin document
   must generate BotID proofs without receiving native IPC permissions.
2. Quit and restart: login persists. Browser logout preserves desktop login;
   desktop logout preserves browser login. Restart after desktop logout remains
   signed out. A revoked desktop session cannot keep reading calendar data.
3. Open Settings and Account inside the client. Verify profile/security changes
   and both account-panel and native sign-out clear the correct desktop session.
   Opening other settings tabs must not create a hidden account WebView. Open an
   invite with a signed-out browser, then with a different browser account. The
   latter must retain its own account.
   Check ordinary links, new-window links and programmatic external navigation.
4. Close the window: the process and tray remain. Open from the tray and reopen
   through the application shortcut: one window returns. Quit ends the process.
   Check 1320×880 logical outer sizing on normal/high-DPI screens and clamping on
   smaller screens. Enter/exit fullscreen with an embedded identity view present;
   exit restores fixed sizing and edge dragging cannot resize the window.
5. Create a reminder outside the visible calendar range. Close to tray and wait
   for it. Verify one sound and one notification. Edit/delete before delivery;
   check a recurrence override, reconnect catch-up, wake-from-sleep catch-up,
   restart deduplication and account switching. Denied OS notifications must not
   repeatedly replay the same reminder.
6. Disconnect while editing, with a modal/popover open, and while AI is streaming.
   The shared No Internet screen must remain usable; retry/reconnection must
   retain the same calendar, session, selected view and unsaved draft instead of
   returning to sign-in or remounting the app. Verify this on Web and desktop.
   No offline write queue or stale success indication should appear.

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
