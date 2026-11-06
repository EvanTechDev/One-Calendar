# Web Reference Width fixture

This renders the real calendar entry, providers, views, and global stylesheet at
1280 × 900 using a fixed date, English, UTC, light theme, and empty calendar data.
The host supplies deterministic API responses; Next's dynamic import boundary
is represented by React lazy/Suspense in this browser-only fixture.

Run the Vite fixture and Chromium capture locally or on an external desktop.
GitHub Actions now builds applications and installers but does not run visual
captures. Save `reference-width.png` and server diagnostics with the producing
commit SHA when recording new evidence.

The screenshot is a reference artifact for the shared calendar component and
stylesheet. Record its producing commit and review the actual image before
claiming a visual pass. Native window sizing and operating-system rendering
have separate target-system acceptance checks.

`reference-width.png` is the initial reviewed artifact; `reference-width.json`
records its producing commit, CI run, viewport and fixture conditions. The image
shows the fully rendered calendar header, sidebar and week grid at the Reference
Width. Compare subsequent shared UI migrations under the same fixture conditions.

For this desktop migration, the current Termux machine is used only to edit
the fixture. Run its server and capture only in the external CI environment.
