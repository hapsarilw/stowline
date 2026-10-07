# Stowline traceability

One row per requirement in docs/SRS.md: 66 functional and 25 non-functional. Status is one of: not started, in progress, done, blocked. The Test column names the test file or scenario that covers the requirement. Milestone follows the PRD release plan and the decisions in docs/BUILD_NOTES.md.

Last updated: Oct 7, 2026, after M2.

## Functional requirements

| ID | Requirement | Pri | PRD | Milestone | Status | Test |
| --- | --- | --- | --- | --- | --- | --- |
| FR-01 | Plans list: one row per port call with vessel, voyage, port, ETD, progress, violations, status, planner, last update | M | F-01 | M6 | not started | — |
| FR-02 | Filter by status, Assigned to me, Has violations; search vessel, voyage, port; sort by ETD | M | F-01 | M6 | not started | — |
| FR-03 | Row selection opens a preview: bay fill, stability, open violations by rule, recent activity | S | F-01 | M6 | not started | — |
| FR-04 | Open plan loads the plan into the workspace at its own URL | M | F-01 | M6 | not started | — |
| FR-05 | New plan creates a Draft for a chosen vessel, voyage and port from the arrival condition | S | F-01 | M6 | not started | — |
| FR-06 | Workspace shows top bar, load list, center view, details, bay navigator, stability strip at 1440 × 900 and 1920 × 1080; side panels 320 px | M | F-02 | M2 | done | `e2e/screenshots.spec.ts` (1440 and 1920, both themes), `e2e/layout.spec.ts` (top bar fits at 1280, 1440, 1920), `Workspace.test.tsx` |
| FR-07 | Each side panel collapses to a 40 px rail and expands again | M | F-02 | M2 | done | `Workspace.test.tsx` (both panels to 40 px rails and back), `LoadList.test.tsx` |
| FR-08 | Center view switches 3D, Bay, Split; Split is resizable | M | F-02 | M2 | done | `Workspace.test.tsx` (tabs, arrow keys, split resize by keyboard and pointer). The 3D view is a placeholder until M3 |
| FR-09 | Top bar: vessel and voyage, port rotation with current port, status, planned count, Undo, Redo, Validate, Save | M | F-02 | M2 | in progress | `Workspace.test.tsx` (TopBar). Save is off until the mock API in M6 |
| FR-10 | Bay navigator: deck and hold fill per bay, bays with violations marked, jump on click | M | F-02 | M2 | done | `BayView.test.tsx` (bay navigator: fill, jump, current bay), `e2e/screenshots.spec.ts` |
| FR-11 | Dark and light theme switch; the choice persists | S | F-16 | M6 | done | `e2e/tokens.spec.ts` (switch and persist across reload), `stores.test.ts` |
| FR-12 | Load list shows ID, type, weight, POD, reefer and DG flags in 32 px rows | M | F-03 | M2 | done | `LoadList.test.tsx`, `e2e/screenshots.spec.ts` |
| FR-13 | Load list search, filter by POD, type, reefer, DG, unplanned only; sort by any column | M | F-03 | M2 | done | `query.test.ts`, `LoadList.test.tsx` (search, filter chips, sort every column) |
| FR-14 | Load list renders only visible rows; 1,240 rows scroll without dropped frames | M | F-03 | M2 | done | `LoadList.test.tsx` (visible rows only), `e2e/layout.spec.ts` (scrolls all 928 rows with under 60 rendered) |
| FR-15 | Multi-select rows; footer shows selected count and total weight | M | F-03 | M2 | done | `LoadList.test.tsx` (selected count and total weight) |
| FR-16 | Selecting a planned row selects its container in the 3D view and bay view | S | F-03 | M3 | in progress | `LoadList.test.tsx`: a planned row selects its container and bay in the bay view. The 3D view: M3 |
| FR-17 | With a row focused, Enter picks up the container and moves focus to the bay grid | M | F-06, F-17 | M4 | not started | — |
| FR-18 | 3D view draws hull, deckhouse and every placed container with instanced meshes | M | F-04 | M3 | not started | — |
| FR-19 | Orbit, pan, zoom; presets Iso, Port, Starboard, Top, Bow with a 600 ms camera move | M | F-04 | M3 | not started | — |
| FR-20 | Color by POD, weight, type or violation status, with a legend | M | F-04 | M3 | not started | — |
| FR-21 | Toggle hull transparency; show only one POD | M | F-04 | M3 | not started | — |
| FR-22 | Hover tooltip with ID, slot, type, weight, POD; click selects and opens the Inspector | M | F-04 | M3 | not started | — |
| FR-23 | Gap opens at the selected bay in 400 ms with a bay label | S | F-04 | M3 | not started | — |
| FR-24 | Without WebGL 2, a message and a button that opens the bay view | M | F-04, F-17 | M3 | not started | — |
| FR-25 | Loading skeleton while the 3D code loads | S | F-04 | M3 | not started | — |
| FR-26 | Bay view cross section with row and tier numbers, Port and Starboard labels, hatch cover line | M | F-05 | M2 | done | `BayView.test.tsx`, `e2e/screenshots.spec.ts` (bay view) |
| FR-27 | Cell states: empty, plug, occupied, selected, focused, valid, valid with warning, invalid, locked, has violation, picked-up origin | M | F-05 | M2 | done | `Cell.test.tsx` (all 11 states) |
| FR-28 | Full bay view cells show last 4 digits, POD, weight; Split uses the compact form | M | F-05 | M2 | done | `BayView.test.tsx` (full in Bay, compact in Split), `Cell.test.tsx` |
| FR-29 | Stack total weight and bar against the limit under each stack | M | F-05 | M2 | done | `BayView.test.tsx` (stack totals, red when over) |
| FR-30 | Previous and next controls step through the bays | M | F-05 | M2 | done | `BayView.test.tsx` (stepping, first and last bay) |
| FR-31 | Place by dragging a load list row onto a bay cell | M | F-06 | M4 | not started | — |
| FR-32 | During a drag the 3D view shows the next free slot of each stack in the selected bay as a target; drop there places | S | F-06 | M4 | not started | — |
| FR-33 | Move a top-of-stack container by dragging its cell to another cell | M | F-06 | M4 | not started | — |
| FR-34 | While held, next free slots are marked valid, warning or invalid; hovered slot shows the reason | M | F-06 | M4 | in progress | Domain: `checkPlacement`, `nextFreeSlots` (`rules/placement.test.ts`, `rules/boundaries.test.ts`). Marks in the UI: M4 |
| FR-35 | Invalid drop refused: return in 220 ms, slot shakes once, message gives the reason | M | F-06 | M4 | in progress | Domain: refusal with the reason (`rules/golden.test.ts` AT-02). Return, shake and message: M4 |
| FR-36 | Bay grid keys: arrows move focus, Enter picks up or places, Esc cancels | M | F-06, F-17 | M4 | not started | — |
| FR-37 | Live region announces the focused slot, its container and the rule result | M | F-17 | M4 | not started | — |
| FR-38 | 3D ghost of the held container at the target, green when valid, red when invalid | M | F-06 | M4 | not started | — |
| FR-39 | With several rows selected, placing one picks up the next | S | F-06 | M4 | not started | — |
| FR-40 | Rule engine evaluates R1 to R6 after every command on the changed stacks | M | F-07 | M1 | done | `rules/incremental.test.ts` (property: incremental equals full), `rules/rules.test.ts`, `rules/golden.test.ts` |
| FR-41 | Validate runs all rules in a Web Worker and reports errors and warnings | M | F-07 | M1 | done | `Workspace.test.tsx` (Validate reports 6 errors and 1 warning), `e2e/worker.spec.ts` (real worker). The violations list: M5 |
| FR-42 | Violations panel groups errors and warnings, filters by severity, shows rule, message, slot, containers | M | F-07 | M5 | not started | — |
| FR-43 | Show selects the violation, moves the camera to its bay, dims uninvolved containers | M | F-07 | M5 | not started | — |
| FR-44 | Suggested fix per violation; Apply fix runs it as one command; when none exists the row says so | M | F-07 | M5 | in progress | Domain: `suggestFix` for all six rules (`rules/fixes.test.ts`). Panel and Apply fix: M5 |
| FR-45 | New violation slides in over 160 ms and is announced; a resolved one gives a message with Undo | M | F-07 | M5 | not started | — |
| FR-46 | Inspector shows ID, type, ISO code, weight, POL, POD, reefer set point, DG class, status, slot as bay, row, tier | M | F-08 | M2 | done | `Inspector.test.tsx` |
| FR-47 | Inspector shows stack weight against the limit and each rule result: pass, warning, error, not applicable | M | F-08 | M2 | done | `Inspector.test.tsx` (each rule: pass, warning, error, not applicable) |
| FR-48 | Unplace, Lock/Unlock, Swap; each disabled when BR-03 or BR-04 forbids it | M | F-08 | M4 | in progress | Domain: BR-03, BR-04 and D3 in `applyCommand` (`commands/commands.test.ts`). Inspector actions: M4 |
| FR-49 | A move of a container loaded at an earlier port is recorded and counted as a restow | S | F-08 | M4 | in progress | Domain: `shiftCount` (`commands/commands.test.ts`). Shown in the plan: M4, M6 |
| FR-50 | Stability strip always shows GM, trim, list, BM with SF, each with OK, Check or Limit | M | F-09 | M2 | done | `gauges.test.tsx` (gauge model and strip, OK, Check, Limit with icon and text) |
| FR-51 | While a container is held over a slot, the strip previews the change in GM, trim and list | M | F-09 | M4 | in progress | Domain: one pure function, 1.1 ms per call on the sample (`stability.bench.ts`). Preview: M4 |
| FR-52 | After a command, numbers count to the new value in 300 ms | S | F-09 | M2 | done | `gauges.test.tsx` (`useTween`: 300 ms count, instant with reduced motion) |
| FR-53 | Stability drawer: BM and SF curves with 85% and 100% lines, drafts fwd, mid, aft, GM, trim and list gauges, hydrostatics | M | F-09 | M5 | not started | — |
| FR-54 | Strength curves change with the weight per bay | S | F-09 | M1 | done | `stability/stability.test.ts` (strength curves change with weight per bay, zero change at the ends) |
| FR-55 | Port timeline: one stop per port with discharge count and restow moves | S | F-10 | M5 | not started | — |
| FR-56 | Selecting a stop hides discharged containers and lifts that port's containers 20 ms apart, deck before hold; Play steps through | S | F-10 | M5 | not started | — |
| FR-57 | Place, move, unplace, swap, lock and apply fix are each one command with an inverse; Ctrl/Cmd+Z undo, plus Shift redo | M | F-11 | M4 | in progress | Domain: commands with inverses, `batch` (`commands/commands.test.ts`, property tests). Keys and history: M4 |
| FR-58 | Each command adds an entry to the plan's activity log | S | F-11 | M6 | not started | — |
| FR-59 | Save sends the plan with its base version; on success the version rises by one | M | F-12 | M6 | not started | — |
| FR-60 | If the server holds a newer version, Save is refused, local commands kept, user reviews or retries | M | F-12 | M6 | not started | — |
| FR-61 | Unsaved commands are kept in the browser and restored after a reload | S | F-12 | M6 | not started | — |
| FR-62 | Send for review sets In review; Approve only for senior planner with zero errors; Return sets Draft and needs a comment | S | F-13 | M6 | not started | — |
| FR-63 | An approved plan is read only; Revise creates a new Draft version | S | F-13 | M6 | not started | — |
| FR-64 | Import load list reads JSON, checks each row, lists rejected rows with the reason | S | F-14 | M6 | not started | — |
| FR-65 | Export downloads an approved plan as JSON (required for the M6 gate, decision D10) | C | F-15 | M6 | not started | — |
| FR-66 | With reduced motion, every animation is instant or a 100 ms fade | M | F-17 | M2 | in progress | Global reduced-motion rule in `src/styles/index.css`, `useTween`. 3D and drop animations: M3, M4. End to end check: M7 |

## Non-functional requirements

| ID | Requirement | Target | Milestone | Status | Test |
| --- | --- | --- | --- | --- | --- |
| NFR-01 | Frame rate while orbiting the 3D view | 55 fps or more, 10,000 containers, mid-range laptop with integrated graphics | M3 | not started | — |
| NFR-02 | Target marks after pick-up | Visible bay marked within 100 ms | M4 | not started | — |
| NFR-03 | Rule check after one command | Under 10 ms | M1 | done | `src/domain/rules/rules.bench.ts`: 1.68 ms mean, 2.48 ms p99 at 10,000 containers (BUILD_NOTES) |
| NFR-04 | Full validation in the worker | Under 200 ms, no main thread task over 50 ms | M1 | done | `e2e/worker.spec.ts`: 18 to 28 ms round trip at 10,000 containers, no long task (BUILD_NOTES) |
| NFR-05 | Draw calls for the ship scene | Under 50 | M3 | not started | — |
| NFR-06 | JavaScript size | Plans route 200 kB gzip or less; 3D chunk 350 kB gzip or less | M0 | not started | — |
| NFR-07 | First load of the plans route | LCP under 2.5 s on fast 4G, Lighthouse performance 90 or more | M7 | not started | — |
| NFR-08 | Memory | Heap grows less than 10% after 200 commands and 200 undos | M7 | not started | — |
| NFR-09 | Accessibility standard | WCAG 2.2 AA, no critical or serious axe findings, both routes and themes | M7 | in progress | `e2e/a11y.spec.ts`: no critical or serious axe findings on the workspace, both themes, with the bay view, violations tab and collapsed panels. Plans route, manual checklist: M6, M7 |
| NFR-10 | Keyboard | Every function works without a pointer, no focus trap, logical order | M4 | not started | — |
| NFR-11 | Contrast | Text 4.5:1 or more; controls and focus ring 3:1 or more | M0 | in progress | axe color-contrast passes in both themes (`e2e/a11y.spec.ts`). The token contrast test and the control border exception (D9) are for M7 |
| NFR-12 | Meaning without color | Every status has an icon and text; every container shows its POD code | M2 | in progress | `Cell.test.tsx` (POD code in every cell), `ui.test.tsx` (status icon with text). 3D labels: M3 |
| NFR-13 | Target size | 24 × 24 px or more | M2 | in progress | `e2e/target-size.spec.ts`: every workspace target is 24 px or more, including every cell in the Bay view. Other routes: M6 |
| NFR-14 | Announcements | Slot descriptions polite, refused drops assertive; 3D canvas text alternative points to the bay grid | M4 | not started | — |
| NFR-15 | Motion | Reduced motion setting honored everywhere | M7 | not started | — |
| NFR-16 | Unsaved work | Survives a reload or a crash | M6 | not started | — |
| NFR-17 | 3D failure | An error in the 3D view does not break the workspace | M3 | not started | — |
| NFR-18 | Request failure | Every failed request shows a message with Retry | M6 | not started | — |
| NFR-19 | Imported files | Parsed as data only; file text shown as text, never markup | M6 | not started | — |
| NFR-20 | Secrets | None in the client bundle | M7 | not started | — |
| NFR-21 | Types | TypeScript strict, no `any` in the domain layer | M0 | done | `tsconfig.json` strict, `tsconfig.domain.json`, `@typescript-eslint/no-explicit-any` in `eslint.config.js`; `tools/layering.test.ts` |
| NFR-22 | Layering | Domain imports nothing from React, three.js or the DOM | M0 | done | `tools/layering.test.ts` (lint rule), `tsconfig.domain.json` (no DOM types) |
| NFR-23 | Test coverage | Domain 90% of lines or more, whole app 70% or more | M7 | in progress | `npm run test:coverage`: domain 99.4% of lines (threshold 90%). Whole app measured once at 98.1% of lines. Threshold for the whole app: M7 |
| NFR-24 | Pipeline | Lint, type check, unit, end to end, axe and bundle size on every push | M7 | in progress | `.github/workflows/ci.yml` runs lint, type check and unit tests with domain coverage. End to end, axe and bundle size are not in CI yet |
| NFR-25 | Browsers | Latest two Chrome, Edge, Firefox, Safari at 1280 × 720 or larger | M7 | not started | — |
