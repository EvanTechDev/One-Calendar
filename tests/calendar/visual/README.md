# Calendar visual reference

A deterministic browser fixture for reviewing the shared calendar component and its production stylesheet at a fixed reference width. It renders the real calendar entry, providers, views, and global CSS—not a static mock.

**Quick links:** [Run the capture](#run-the-capture) · [Fixture contract](#fixture-contract) · [Artifacts and evidence](#artifacts-and-evidence)

## Run the capture

Run the Vite fixture and Chromium capture on a graphical local machine or an external desktop. For the current desktop migration, the Termux machine is edit-only: run the servers and capture elsewhere.

> **GitHub Actions does not capture visuals.** Its build workflows produce applications and installers only; visual evidence must come from a separate local or external-desktop run.

Run these commands from the repository root in three terminals. The capture requires Playwright Chromium, a production Calendar server on port 3000, and the fixture on port 4173.

```sh
# Terminal 1: build once, then serve the production Calendar app
bun run --filter zentra-calendar build
bun run --filter zentra-calendar start
```

```sh
# Terminal 2: serve the fixture with Vite-only calendar CSS disabled
ZENTRA_VISUAL_PRODUCTION_CSS=1 bun x --no-install vite --config tests/calendar/visual/vite.config.ts
```

```sh
# Terminal 3: capture with Chromium using Next's production CSS
node tests/calendar/visual/production-css.mjs
```

The production check takes stylesheets and font classes from the built Next root layout and applies them to the deterministic fixture. A Vite-only screenshot cannot establish production Web appearance on its own.

## Fixture contract

Compare shared UI migrations under the same conditions.

| Setting               | Value                                                        |
| --------------------- | ------------------------------------------------------------ |
| Reference viewport    | 1280 × 900                                                   |
| Date                  | `2026-10-05T09:00:00.000Z`                                   |
| Language and timezone | English, UTC                                                 |
| Theme and view        | Light, week                                                  |
| Calendar data         | Empty                                                        |
| Host behavior         | Deterministic API responses                                  |
| Rendering             | Real calendar entry, providers, views, and global stylesheet |

This is a browser-only fixture: Next's dynamic import boundary is represented by React lazy/Suspense. The production capture also covers additional Web widths and desktop surfaces; keep those checks distinct from the reference-width baseline.

## Artifacts and evidence

| Artifact                 | Purpose                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `reference-width.png`    | Initial reviewed reference image showing the fully rendered calendar header, sidebar, and week grid |
| `reference-width.json`   | Producing commit, workflow run, viewport, and fixture conditions                                    |
| `artifacts/calendar-ui/` | Generated captures, `production.css`, and `evidence.json` from the production check                 |

When recording new evidence, save the reviewed `reference-width.png`, its metadata, and server diagnostics with the producing commit SHA. Record the source commit and inspect the actual image before claiming a visual pass.

This screenshot is a reference artifact for the shared calendar component and stylesheet, not proof of native behavior. Native window sizing and operating-system rendering require separate target-system acceptance checks.
