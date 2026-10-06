# Web Reference Width fixture

This renders the real calendar entry, providers, views, and global stylesheet at
1280 × 900 using a fixed date, English, UTC, light theme, and empty calendar data.
The host supplies deterministic API responses; Next's dynamic import boundary
is represented by React lazy/Suspense in this browser-only fixture.

Run the manual Workspace Checks workflow with `visual_baseline=true`. For an
artifact-only run, also set `focused_only=true`. The workflow runs the Vite
fixture and Chromium on GitHub Actions and uploads `reference-width.png` and
server diagnostics, named with the workflow commit SHA.

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
