# Stowline build notes

Started Oct 7, 2026. This file records decisions taken during the build, gaps found in the PRD, SRS and design, and every measured number with the machine it was measured on.

## Pre-build review (Oct 7, 2026)

Sources read: CLAUDE.md, docs/PRD.md, docs/SRS.md, and every file in design/ except support.js.

### Product summary

1. Stowline is a desktop web app where a vessel planner places containers on a ship, in a 3D view and in a 2D bay grid that stay in sync.
2. The sample is MV Nusantara Pioneer, voyage 042W, at Singapore: 2,740 containers on board and 312 of 1,240 load list containers planned.
3. Six rules run on every move: stack weight, reefer plug, DG segregation, overstow, 20ft/40ft stacking (errors) and heavy over light (warning).
4. A drop that would cause an error is refused with the reason. A drop that only causes a warning is allowed.
5. Drag, click and keyboard all end in the same command. Every command passes the placement check and has an inverse for undo and redo.
6. The violations panel lists each issue with Show (camera flies to it, others dimmed) and Apply fix (one command).
7. A simplified stability model (GM, trim, list, drafts, bending moment, shear force) is recalculated from the whole plan and previewed during a drag.
8. Port playback steps through the rotation and shows discharges and restows per port.
9. A plan moves Draft, In review, Approved through a mock API (MSW and IndexedDB) with version checks. An approved plan is read only and can be exported.
10. It is a portfolio demo: WCAG 2.2 AA with a full keyboard path, 55 fps at 10,000 containers, no real backend, no certified calculation.

### Decisions (all accepted Oct 7, 2026)

| # | Topic | Decision |
| --- | --- | --- |
| D1 | Half slots | The slot key always uses the ISO bay: odd bays for 20ft halves, even bays for 40ft. The half is derived from the key. The bay view gets a 40 / 20 fore / 20 aft selector (for bay 18: 18, 17, 19). The golden fixture R5 slot is 290284. The selector needs a small design, shown before merge. |
| D2 | Swap and BR-03 | Swap is exempt from BR-03 (top only) but honors BR-04 (locks) on both containers. Apply fix runs as a `batch` command that holds the commands of the fix and inverts as one unit. This adds `{ kind: 'batch'; commands: Command[] }` to the SRS Command type. |
| D3 | Unplace of onboard containers | Unplace is disabled for containers with origin `onboard`. Moving them is allowed and counts as a restow (BR-17). |
| D4 | Two meanings of restow | Internal names: `shiftCount` for moves of onboard containers at this port (BR-17, `Plan.restowCount`), `restows` for future crane moves caused by overstow (R4, FR-55). Visible copy stays as designed. |
| D5 | DG next bay | Neighbours across bays: ±4 for 40ft bays, ±2 for 20ft bays, same row and tier. When a pair spans two bays, the message names the lower bay number. |
| D6 | Design controls not in the SRS | Removed: Switch vessel popup, clickable rotation chips (shown as plain text), "1×" speed control, Seagoing/Harbour limits, ⌘K hint, Vessel and Port filters, "Request from terminal", BAPLIE/COPRAR wording. Kept and wired: the "/" search shortcut (prototype logic) and the U, L, S keys in the Inspector (Unplace, Lock, Swap). |
| D7 | UI the SRS needs but the design lacks | Theme toggle, role switcher, Approve, Return with comment, Revise and the read-only state, conflict "Review changes" view, New plan, import result list, Export, developer switch for a forced 409. Built in M6 from existing tokens and components, shown before commit. |
| D8 | ARIA | Landmarks get readable labels ("Load list", "3D view", "Bay view", and so on) instead of component names. Roles are fixed so axe passes: load list header row inside its grid, no `aria-selected` inside `role=table`. Toasts are polite; refused drops stay assertive. Visible copy does not change. |
| D9 | Contrast | The focus ring uses `var(--accent)` (4.56:1 on the light background) instead of the hard-coded #3B9EFF (2.46:1). Control borders keep `--border2` (1.71:1) and rely on the WCAG 1.4.11 exception: every control is identified by its label or icon. No token changes. |
| D10 | M6 gate | FR-65 (Export, priority C) is treated as required, because the M6 gate covers process steps 1 to 11 and step 11 is the export. |
| D11 | Other plans in the plans list | Only plans with vessel geometry and placements can be opened. For the other eleven, Open plan is disabled and the reason is shown. |
| D12 | Copy | Loading skeleton shows the computed container count. A refused move says the container returned to its slot; a refused load list drop says it returned to the load list. The Resolved toast follows the Components copy (new value, for example "Stack 18-04 deck back to 79.3 t of 90.0 t"). The plans search placeholder drops "container ID". The import control reads "Import load list". |
| D13 | Sample identity | Generated container IDs use NSPU only. The random draw for the prefix is kept, so the seeded plan does not change. The generated IMO numbers will be checked and replaced with clearly fictional values if they match real ships. |
| D14 | NFR-06 with the mock API in the browser | Owner decision, Oct 8, 2026: the plans route may load 300 kB gzip in total while Mock Service Worker answers the API in the browser; the app itself keeps the SRS limit of 200 kB. `npm run measure:js` checks both on the production build. When a real server replaces the mock, the 200 kB limit applies to the whole route again. |

### Other gaps and how they are handled

| Where | Gap | Handling |
| --- | --- | --- |
| PRD BR-15 vs SRS FR-63 | The PRD implies a change after approval creates a new Draft automatically; the SRS needs an explicit Revise | Follow the SRS |
| PRD success metrics vs NFR-02 | The PRD measures from hover, the SRS from pick-up | Measure both |
| PRD success metrics vs NFR-09 | "No critical issues" vs "no critical or serious findings" | Follow the SRS |
| PRD step 12 | Sail has no FR | Not built |
| PRD roles | Terminal planner and chief officer have no FR | Read-only roles in the role switcher (D7) |
| PRD line 78, SRS line 32 | Diagrams are placeholders | Noted; no action |
| SRS Interfaces | No endpoint lists vessels for New plan | Add `GET /api/vessels` to the mock |
| SRS Interfaces | No endpoint for Revise | `POST /api/plans/:id/status` with `to: 'draft'` on an approved plan creates the next version |
| SRS strength curves, step 2 | Buoyancy distribution not specified | Uniform buoyancy over the cargo length with a linear trim correction |
| SRS performance targets | No benchmark vessel geometry | A scaled generator with about 11,000 slots, filled to 10,000 containers |
| Drawer hydrostatics | Fixed strings, including Deadweight 71,260 t, not in the SRS | Displacement and GM computed. Deadweight = 71,260 t + (displacement − 98,420 t) |
| Light theme | Drawer SVGs, cell text, DG badge, violation outlines and 3D legend use hard-coded dark colors; the Plans screen has no light design | Mapped to tokens |
| SRS supported environment | 1280 × 720 must work; designs exist only for 1440 and 1920 | Top bar overflow checked in M2 |
| SRS delivery | Vercel is not in the CLAUDE.md stack | Accepted as the deploy target (not an npm dependency) |
| Stowline.dc.html line 91 | The note says 2 locked containers; the code locks 3 (180102, 180202, 180204) | Follow the code |
| stowline-data.js line 142 | Heavy over light has no tolerance | Weights stored as whole tenths of a tonne, so the 10.0/10.1 and 90.0/90.1 boundaries are exact |
| CLAUDE.md feature folders | No folder for the shell, TopBar and BayNavigator | `src/features/workspace` |

### Check of "From prototype to production"

The prototype engine was run on its own sample plan. It returns 2,740 containers and 7 violations (6 errors, 1 warning), matching the golden fixture. Vessel geometry: 22 bays (02 to 86), 4,292 forty-foot slots, 404 plug slots. AT-04 holds (6 violations and 79.3 t after the stack fix). AT-02 holds ("Stack limit: 96.4 t of 90.0 t").

| # | Change | Confirmed | Evidence |
| --- | --- | --- | --- |
| 1 | 3D view repaints every box per frame, polygon picking | Yes | stow3d.js:85 sorts on every draw; stow3d.js:38 and :144 pick with a point-in-polygon test |
| 2 | One state object, full copy per undo step | Yes | workspace-vm.js:25; workspace-vm.js:71 stores a copy of the slots per step |
| 3 | Full re-check after each move | Yes | workspace-vm.js:66 |
| 4 | One container per 40ft slot | Yes | stowline-data.js:59-63; the 20ft box is stored at 300284 |
| 5 | 148 load list rows vs 1,240; 253 SGSIN containers vs 312 | Yes | 60 unplanned plus 88 planned rows; planned rows come only from bays 10, 14 and 18 (stowline-data.js:228) |
| 6 | 5 of 7 fixes; reefer and 20ft show "Review manually" | Yes | Both return no fix. The 20ft fix is hard-coded to four slots in bay 30 (stowline-data.js:195). The DG fix only searches toward the stern. |
| 7 | Swap and Apply fix skip the rule check | Yes | workspace-vm.js:122, :372 |
| 8 | Onboard containers move freely | Yes | workspace-vm.js:109-117 checks only the lock and the top of the stack |
| 9 | Overstow counts every container above | Yes | stowline-data.js:144. The fixture is unaffected (2 and 1). |
| 10 | DG neighbours only in the same bay | Yes | stowline-data.js:124-129 |
| 11 | Stability adds a change per move; strength curves never change | Yes | workspace-vm.js:48-50, stowline-data.js:209; BM/SF fixed at workspace-vm.js:396 |
| 12 | A load list row can only be ticked | Yes | workspace-vm.js:236 |
| 13 | Save and Validate only show a message | Yes | workspace-vm.js:128-129 (version 14 hard-coded); the Draft badge is fixed text (Stowline Workspace.dc.html:63) |
| 14 | Plans list controls not wired | Yes | Stowline Plans.dc.html:31-34, :53-54, :126-127 |

Further changes found in the prototype:

15. ID prefixes TRLU, KDMU, BXOU and VNRU (1,186 of 2,740 containers) become NSPU (D13).
16. R5 diverges from BR-09: full validation never flags a 40ft on a 20ft with an empty half (stowline-data.js:141), and the placement check refuses every 40ft on 20ft (stowline-data.js:176).
17. Swap checks only the source lock, not the target (workspace-vm.js:353).
18. The Split resize handle is not interactive (Stowline Workspace.dc.html:267); FR-08 requires it.
19. The playback slider has no keyboard support and no `aria-valuenow` (Stowline Workspace.dc.html:244).
20. The R5 violation id and slot use 300284 while its message says 290284 (D1).
21. The Flags column cannot be sorted (workspace-vm.js:229); FR-13 says any column.

### Architecture

```
src/
  main.tsx
  app/          router, AppShell, ErrorBoundary, theme provider
  domain/       pure TS: no React, three or DOM (lint rule)
    geometry/   vessel, bays, BBRRTT keys and halves, positions, sample and bench vessels
    plan/       types, stack index
    rules/      r1 to r6, segregation table, placement check, full and incremental validation, fixes
    commands/   command types, apply, invert, history
    stability/  model, strength curves, preview
    sample/     seeded RNG, plan and load list generators, plans catalog
    io/         import schema, export
  worker/       validation.worker.ts (Comlink) and its client
  state/        plan-store.ts, view-store.ts
  api/          client, types, errors; mock/ handlers, IndexedDB wrapper, seed
  features/     workspace, plans, load-list, bay-view, viewport3d, inspector, violations, stability, playback
  ui/           Button, Chip, Badge, StatusIcon, Tabs, LiveRegion, icons
  styles/       tokens.css (dark and light variables)
e2e/            at-01 to at-10, a11y, keyboard, bench (fps, memory)
.github/workflows/ci.yml
```

Unit tests and benchmarks sit next to their code (`*.test.ts`, `*.bench.ts`).

### Dependencies (versions checked on npm Oct 7, 2026; all approved)

| Package | Version | Note |
| --- | --- | --- |
| react, react-dom | 19.3.0 | R3F 9.8 requires below 19.4 |
| typescript | 6.0.3 | Not 7.0.2: typescript-eslint 8.71 requires below 6.1 |
| vite, @vitejs/plugin-react | 8.3.3, 6.1.2 | |
| react-router | 8.4.0 | |
| zustand | 5.0.15 | |
| three, @react-three/fiber, @react-three/drei | 0.186.1, 9.8.1, 10.7.9 | |
| @tanstack/react-virtual | 3.14.13 | |
| tailwindcss, @tailwindcss/vite | 4.3.3 | |
| comlink | 4.4.2 | |
| msw | 3.0.2 | Runs in the production demo |
| vitest, @vitest/coverage-v8 | 5.0.3 | |
| fast-check | 4.10.2 | |
| @testing-library/react, user-event, jest-dom | 16.3.3, 14.6.7, 7.0.1 | |
| jsdom | 30.1.2 | |
| @playwright/test, @axe-core/playwright | 1.63.0, 4.13.0 | |
| eslint, typescript-eslint, eslint-plugin-react-hooks | 10.12.0, 8.71.1, 7.1.1 | NFR-22 uses the built-in `no-restricted-imports` |
| @types/three, @types/react, @types/react-dom | 0.186.0, 19.x, 19.x | |
| @lhci/cli | 0.15.1 | NFR-07 |

Not added: size-limit (a short Node script with zlib checks bundle size), idb (own IndexedDB wrapper), a drag-and-drop library (pointer-based drag), three-mesh-bvh (only if picking misses its budget, and only after asking), Prettier. Fonts load from Google Fonts, as in the design.

### Risks

M3, 3D view:

1. Colors may not match the design. R3F turns on tone mapping by default, and the prototype is a parallel projection with flat face shading and dark edges. Response: `<Canvas flat>`, orthographic camera, face shading baked into the geometry, edges darkened in a shader, screenshot comparison with design/shots/cv.png.
2. Draw calls and frame rate. Estimate about 12 draw calls: one InstancedMesh per container size (20ft, 40ft, 40ft high cube), about 5 for the ship, about 4 for overlays. No shadows, pixel ratio capped at 2, render on demand.
3. Animations that touch every container (bay gap, playback lift, dimming). Response: per-instance attributes and uniforms in the shader; matrices rewritten only for containers a command changed. Dimming uses color, not transparency.
4. Picking cost at 10,000 instances. Response: at most one raycast per frame with a bounding sphere; the view store updates only when the hovered instance changes. Ask before adding a library if it costs more than 2 ms.
5. 3D chunk size (NFR-06). Response: lazy chunk, only the drei parts in use, bundle check in CI from M0.
6. 55 fps cannot be measured in CI (headless browsers have no GPU). Response: benchmark route run in a visible browser on the development machine. Whether that machine counts as "mid-range with integrated graphics" is the owner's call.
7. WebGL fallback. Response: tests that force `getContext('webgl2')` to return null, an error boundary and a lost-context handler.

M4, placement:

1. The half-slot model (D1) touches geometry, rules, bay view and commands, so it is built into the domain from M0 and M1.
2. HTML5 drag and drop behaves differently across browsers and is unreliable in Playwright WebKit. Response: pointer-based drag controller in the view store; grid and 3D targets end in the same command.
3. 100 ms to mark targets. Response: on pick-up, check only the next free slot of each stack in the visible bay (32 checks at most) through the stack index.
4. Incremental and full validation drifting apart, now that DG crosses bays. Response: each change also re-checks neighbouring stacks; property tests for incremental equals full, and command plus inverse returns the same plan.
5. Stale worker results. Response: results tagged with the plan revision and dropped if newer commands ran.
6. Inverses must restore lock, origin, restow count and load list state. History stores commands only (NFR-08).
7. Keyboard path. The virtualized load list unmounts rows, so focus uses `aria-activedescendant` with scroll to row. Announcements are polite and debounced; refused drops are assertive. Safari does not Tab to buttons by default, so the flow relies on arrow keys and Enter, tested on WebKit early.
8. Stability preview per hover (FR-51). Response: the plan store keeps running sums, and the preview uses the same function on the sums plus or minus one container.

## M0 Foundation (Oct 7, 2026)

### What was decided while building

| Topic | Decision |
| --- | --- |
| Extra dependencies | `prettier` 3.9.9 (asked for in the M0 prompt). `@types/node` 24 (needed by vite.config.ts, playwright.config.ts and the tests in tools/). Nothing else beyond the approved list. three, R3F, drei, zustand, TanStack Virtual, Comlink, MSW, fast-check, Testing Library, jsdom, axe, coverage and Lighthouse are approved but not installed yet: each is added in the milestone that first uses it. |
| Node | CI and `.nvmrc` use Node 24. The development machine has Node 25.9.0, an odd release that Vitest 5.0.3 does not list as supported (npm prints an engine warning). Tests, lint and build run fine on it. |
| TypeScript | 6.0.3, strict, plus `noUncheckedIndexedAccess`. `tsconfig.domain.json` type checks src/domain alone with `lib: ES2023` and no `types`, so any DOM or Node global fails there. |
| Benchmarks | Vitest 5 removed the `bench` import. A benchmark is a `test` that takes `{ bench }` (see `geometry.bench.ts`). `npm run bench` passes, no numbers are reported yet. |
| Tokens | `src/styles/tokens.css` holds THEMES.dark and THEMES.light `vars` and the 3D scene colors (`g`, as `--g-*`), plus the four POD colors (`--pod-*`, same in both themes). `src/styles/index.css` maps them to Tailwind with `@theme inline` (`bg-bg`, `text-text2`, `border-border2`, `bg-pod-nlrtm`, and so on). Values are unchanged. The focus ring uses `var(--accent)` (D9). The reduced-motion rule from the design is in the base layer. |
| Slot model (D1) | `src/domain/geometry`. Keys are BBRRTT. Even bays are 40ft. Odd bays are 20ft halves: bay-1 is the fore half and bay+1 the aft half of the 40ft bay between them. `slotKeyFor`, `slot40Key`, `halfOfKey` convert. Plugs and existence are looked up through the 40ft slot. The 20ft container NSPU 318204 6 is at 290284, half `fore`. |
| Vessel as data | `Vessel` carries `plugs` (the 404 plug slot keys) and `deckhouseX`, so GET /api/vessels/:id can serve it. `createGeometry(vessel)` builds the lookups. Extra fields beyond the SRS entity list. |
| Types | The SRS data model, plus `Command` kind `batch` (D2), `HistoryEntry` (command and inverse), and `Plan.shiftCount` instead of `restowCount` (D4). `toTenths` is in `constants.ts` for exact limit checks. |
| Vessel identity | IMO 9000000, fictional and with a wrong check digit on purpose. The Plans screen catalog (M6) still has to replace the generated IMO numbers in the prototype. |
| Sample data | `generateSampleCall()` in `src/domain/sample/generate.ts`. Same RNG seed and same draw order as createPlan, so every container is in the same slot with the same weight, POD, type and DG class (fingerprint test). The owner prefix draw is kept and ignored, so IDs are NSPU only. A repeated ID moves to the next free serial; named containers keep theirs. Set points are numbers (`reeferSetPointC`): -18 for reefers on board, as the prototype's fallback text, and the scripted load list values (-25, -18, +4). |
| 312 planned | The prototype has 253 containers loaded at SGSIN. 59 more are marked: the top container of a deck stack, not scripted, not locked, loaded at IDJKT, chosen by a second seeded RNG (seed 312, sorted by slot key then shuffled). Only the port of loading changes. Checked by running the prototype's own rule engine on the generated data: it still returns the 7 golden violations, and no container moved, changed weight, POD or type. |
| 1,240 rows | 3 named rows, then the same random generator (seed 1240) continues up to 928 unplanned rows, plus the 312 planned rows. The first 60 rows equal the prototype's. The prototype's `COUNTS.unplannedT` constant (18,374.6 t) is not carried over: counters are computed from data. |
| Plan header | Plan `042W-SGSIN`, Draft, version 14 (the design's save message and conflict example), planner `rina-adiputri`, ETD 2026-10-08T22:00+08:00. |

### Not done in M0

- Bundle size check in CI (NFR-06) and the token contrast test (NFR-11): not in the M0 prompt.
- CI has been written but has not run on GitHub: the repository has no remote. The same three commands were run locally.
- Playwright is not in CI. One smoke test (`e2e/tokens.spec.ts`) passes locally on Chromium.

### M0 measurements

| Date | What | Result | Machine | Runtime |
| --- | --- | --- | --- | --- |
| Oct 7, 2026 | `vite build` of the placeholder app (React 19.3 only) | JS 219.87 kB (68.70 kB gzip), CSS 13.37 kB (3.65 kB gzip) | MacBook Pro Mac14,9, Apple M2 Pro, 32 GB | Node 25.9.0, Vite 8.3.3 |
| Oct 7, 2026 | Unit test run, 48 tests in 4 files | 1.4 s | same | Vitest 5.0.3 |

The JS figure is not the NFR-06 number: that is measured per route when the routes exist.

## M1 Rule engine (Oct 7, 2026)

### What was decided while building

| Topic | Decision |
| --- | --- |
| Dependencies | `comlink` 4.4.2, `fast-check` 4.10.2, `@vitest/coverage-v8` 5.0.3. All on the approved list. |
| Where things are | `src/domain/plan` (context and immutable state), `rules` (R1 to R6, placement check, validation, fixes), `commands`, `stability`. `src/worker` holds the Comlink worker. `src/domain/testing` holds test builders and is left out of coverage. |
| Violation | Two fields beyond the SRS: `slot` (where the violation is shown) and `bay` (its 40ft bay), as the prototype had. Ids are `rule:slot`, for example `overstow:100382` and `twenty:290284`, plus `stack:18-4-D` and `dg:140284-140484` as in the SRS. Ties in the sort are broken by slot, so the order is stable. |
| R4 overstow | Counts only the containers above that go to a later port (change 9). `slotKeys` holds the blocked container and those later-port containers. In the placement check, the restow count is the number of later-port containers over the lowest earlier-port box after the drop. |
| R5 20ft and 40ft | Both cases from BR-09: a 20ft on a 40ft, and a 40ft on a tier with one 20ft half empty. A 40ft on two 20ft is allowed. For support (placement check step 3), any container in the tier below carries a 40ft; a 20ft needs its own half filled. |
| R3 neighbours (D5) | Positions along the ship are counted in 20ft bays: a 40ft in bay B covers B-1 and B+1. End to end means 2 apart, so 40ft bays are neighbours at ±4 and 20ft halves at ±2, including the fore and aft halves of one 40ft slot. Left and right follow the row order across the centre line (02 and 01 are neighbours). Above and below are tier ±2. Deck tier 82 and hold tier 16 are not neighbours. |
| Incremental check | `revalidate` keeps the violations of untouched stacks and checks the touched stacks again: their stack rules, and every DG pair with a container in them. A fast-check property proves it equals full validation after random command sequences, with and without the rule check. |
| Commands | `applyCommand(state, ctx, command, { check })`. With the check (default) a place or move must pass the placement check, and no command may create an error id that the touched stacks did not have before. Undo and redo use `check: false`. The physical rules always hold, check or not: the slot exists and is free, stacks have no gaps, only the top is lifted (BR-03), locked containers stay (BR-04), onboard containers are not unplaced (D3). Swap is exempt from BR-03 (D2) but needs two containers of the same length. |
| Shifts (BR-17, D4) | `shiftCount` is the number of containers loaded at an earlier port that are not in their arrival slot. A move away adds 1, a move back takes 1 off, so undo is exact. A container moved twice counts once. |
| Fixes | Targets are the next free slot of every stack in every bay, nearest first: same bay, then same deck or hold, then row, then tier. Only targets with no error and no warning are used, and the fix must resolve the violation. R4 swaps the blocked container with the top one when that orders the stack, otherwise it reorders the stack as one `batch` of swaps. R6 swaps the two. On the seeded plan 6 of 7 violations get a fix. The reefer has none, because no plug slot is free on the seeded ship. The result says so and offers Unplace. |
| Fix copy | Kept from the prototype: `Move NSPU 771032 1 (17.1 t) to …`, `Swap with … at …, 0 restows`, `Swap with … at …, heavy box below`, `Move to empty deck stack … (on hatch)`. New: `(separated by n bays)` (the prototype always said 2), `Reorder stack 18-02 deck: 2 swaps, 0 restows`, `Move to plug slot …`, and the reasons when there is no fix. |
| Stability | `calibrateStability` solves the displacement, KG, trim and heeling moment without containers from the seeded plan. `computeStability` is one pure function and the seeded plan reads exactly GM 1.84, trim 0.62, list 0.4, drafts 12.10 and 12.72, BM 78, SF 64. It sums in slot order, so the same plan gives the same numbers to the last bit, whatever commands led to it. z is the container centre above the keel. |
| Strength curves (FR-54) | 61 stations from the bow end of bay 02 to the stern end of bay 86 (6.6 m beyond each bay centre), bounding 60 cells. The change in weight per bay is spread over the bay's length, balanced by a uniform plus linear buoyancy change, then summed for shear force and bending moment. The change is zero at both ends. Negative bending moment is sagging, so weight amidships lowers the 78% hogging peak. BM% and SF% are the largest absolute values on the curves. |
| Gauge states | `gaugeState`: GM below 1.20 is Limit, below 1.40 Check. Trim over 1.50 Limit, over 1.00 Check. List at 2.0 or more Limit, over 0.3 Check. BM and SF over 100% Limit, over 85% Check. These match the prototype and the SRS boundary values. |
| Benchmark vessel | `generateBenchCall()`: 24 bays (02 to 94), 22 rows, deck tiers 82 to 96, hold tiers 02 to 24, 10,560 forty-foot slots, 10,000 containers. Stacks are full and ordered, with reefers in plug slots, 20ft pairs at the bottom of every fifth hold row, and 2% DG. Its only violations are DG and heavy over light. |
| Worker | `validationApi.validate` takes plain data (vessel, containers, placements) and builds the context each call. `createValidationClient()` starts the worker. The app does not use the client yet (M2, M5), so the worker is not in a production build yet. It is tested on the dev server. |
| Benchmarks | Vitest warns that its module runner adds overhead to exported functions in benchmarks. The Node figures below are therefore on the high side. The worker figures from Chromium are the ones that count for NFR-04. |

### Not done in M1

- No UI. The Validate button, violations panel, fixes and stability display come in M2, M4 and M5.
- The worker is not in a production build until the app imports the client.

### M1 measurements

| Date | What | Result | Machine | Runtime |
| --- | --- | --- | --- | --- |
| Oct 7, 2026 | NFR-03: one command on the 10,000-container vessel, `applyCommand` with the rule check, then `revalidate` (`npm run bench`, 596 samples) | mean 1.68 ms, p99 2.48 ms, max 5.12 ms (target under 10 ms) | MacBook Pro Mac14,9, Apple M2 Pro, 32 GB | Node 25.9.0, Vitest 5.0.3 |
| Oct 7, 2026 | Full validation in Node on the 10,000-container vessel, `validateAll` (71 samples) | mean 14.3 ms, p99 19.2 ms | same | same |
| Oct 7, 2026 | NFR-04: full validation in the Web Worker on the 10,000-container vessel, 5 runs after a warm-up (`e2e/worker.spec.ts`) | round trip 18.1 to 27.6 ms, time in the worker 10.0 to 18.3 ms, no long task on the main thread (target under 200 ms, no task over 50 ms) | same | Chrome for Testing 153.0.8010.12 (Playwright 1.63, headless), Vite dev server |
| Oct 7, 2026 | Stability model, `computeStability` (`npm run bench`) | sample plan 2,740 containers: mean 1.06 ms, p99 3.51 ms. 10,000 containers: mean 4.06 ms, p99 11.8 ms | MacBook Pro Mac14,9, Apple M2 Pro, 32 GB | Node 25.9.0, Vitest 5.0.3 |
| Oct 7, 2026 | Domain coverage (`npm run test:coverage`, 135 tests in 14 files) | lines 99.41%, statements 96.96%, branches 90.69%, functions 99.46% | same | same |

## M2 Workspace panels (Oct 7, 2026)

### What was decided while building

| Topic | Decision |
| --- | --- |
| Dependencies | `zustand` 5.0.15, `react-router` 8.4.0, `@tanstack/react-virtual` 3.14.13, `@testing-library/react` 16.3.3, `user-event` 14.6.7, `jest-dom` 7.0.1, `jsdom` 30.1.2, `@axe-core/playwright` 4.13.0. All on the approved list. |
| Stores | `src/state/plan-store.ts` holds the plan, violations, stability and history. Every change goes through `apply`, which runs the domain command (placement check, inverse) and re-checks only the touched stacks. `undo` and `redo` use the inverse. `src/state/view-store.ts` holds the view: panels, tabs, split ratio, bay, half view, selection, focus, load list query, ticked rows, toast. `src/state/actions.ts` holds Validate, which uses the worker. |
| Route | `/` goes to `/plans/042W-SGSIN`. Any other plan id shows "Plan not found". The plans list and the API are M6. |
| Pure view models | What the components draw is worked out in plain functions with their own tests: `bay-view/model.ts` (cells, totals, arrow moves), `inspector/model.ts`, `stability/gauges.ts`, `load-list/query.ts`. Plus domain additions `bayOccupancy`, `stackWeightTenths`, `indexViolations`. |
| Disabled controls | Controls whose work belongs to a later milestone are shown in the components sheet's disabled state, not left as dead buttons: Save (M6), Import load list (M6), Stability details button (M5), Inspector Unplace, Lock and Swap (M4). Save therefore looks faded next to design 01. |
| D6 applied | No Switch vessel popup, the rotation is a plain list (`aria-current="step"` on SGSIN), no "1×" control, no Vessel and Port filters. The "/" shortcut focuses the load list search (and opens the panel if collapsed). |
| D1 applied | A "40ft / Fore 20ft / Aft 20ft" tab control in the bay view header. In the 40ft view a slot with 20ft containers shows two half cells. In the fore and aft views the key is the odd-bay key (290284 for NSPU 318204 6) and a 40ft container shows in both. This control is not in the design: show it to the owner before M4. |
| D8 applied | Landmarks have readable names ("Load list", "3D view", "Bay view", "Details", "Bay navigator", "Stability"). The load list is one scrolling grid with a sticky header row and `aria-rowcount`/`aria-rowindex` for the virtual rows. It uses `aria-activedescendant`, so there is one tab stop, and arrow keys, Home, End, PageUp, PageDown and Space work. Counts use screen reader text instead of `aria-label` on a `span`. |
| D9 applied | The focus ring uses `var(--accent)`. |
| D12 applied | The Inspector shows the reefer set point as in the components sheet (`−18.0 °C`). The loading skeleton text is not used: the placeholder says the 3D view is not built yet. |
| Filters | POD and Type are chips with a caret that open a list (`role="listbox"`, arrow keys, Enter, Esc). The prototype cycled through values on each click. |
| Flags sort | The Flags column sorts (change 21): reefer and dangerous goods first when descending. |
| Initial state | As in design 01: bay 18, NSPU 482913 5 selected, three unplanned rows ticked (the 4th to 6th in list order), so the footer reads "3 selected · 69.6 t". The first 60 rows of the load list are the prototype's, so the same three rows are ticked. |
| Numbers that differ from the design | The load list shows the first rows by weight: with 928 unplanned rows, not 60, the heaviest are 29.9 t, not 28.9 t. The footer reads "928 shown" where the design had "60 shown". The Inspector, bay 18 cells, stack totals, "161 / 208 slots" and the stability strip match the design exactly. |
| Key shortcuts | Undo and redo (Ctrl or Cmd + Z, plus Shift) work from anywhere on the page except in a text field. |
| NFR-13 target size | The design's controls that are 22 px or less were enlarged, with the smallest visual change: the view tabs and "Full bay view" are 24 px (design 22 px), the sort buttons are 24 px high, the row checkbox keeps its 14 px box with a 24 px hit area, the split handle keeps its 6 px bar with a 24 px hit area. Cells of the bay grid are about 14 px high in Split, as designed. The Bay view (cells over 24 px) and the keyboard give the same function, which is the "equivalent" exception of WCAG 2.5.8. |
| 1280 x 720 | The design only covers 1440 and 1920. Below 1360 px the top bar drops its three dividers and uses tighter gaps, a shorter progress bar and chip padding so every control stays on screen. The Split view is crowded at 720 px high: the Bay tab is the better view there. |
| Tests | jsdom component tests for cell states, load list filters and sort, gauges, Inspector, bay view, shell and stores. Playwright: screenshots, axe, layout, target size. Component tests give jsdom a size for every element (`src/test/setup.ts`), since TanStack Virtual needs one. |

### Gate result

- **Screens match designs 01 and 03 side by side:** checked by rendering the prototype (`design/Stowline.dc.html` served over HTTP in Chromium) and the app at 1440 x 900 dark and light and 1920 x 1080, and comparing the screenshots by eye. This is a visual check, not a pixel diff: the numbers on screen differ where the data does (see above) and the disabled controls and the added theme button show. Design 03 is the keyboard pick-up state, which is M4: only the cells, legend, totals and layout can be compared now, and they match.
- **axe reports no critical or serious finding:** `e2e/a11y.spec.ts`, dark and light, with the Split view, the Bay view, the violations tab and both panels collapsed.

### Not done in M2

- The 3D view (M3), drag and the pick-up and place keys (M4), the violations list (M5), save and the plans list (M6).
- The Components sheet pieces that need those: the drag ghost and the target tooltip are built (`Cell`, `TooltipCard`) but nothing drives them yet. Cells accept `marks` for valid, warning, invalid and origin.
- The "Request from terminal", "Import file" and empty load list states from the components sheet (M6).
- CI does not run Playwright. Baseline screenshots are made on one machine.

### M2 measurements

| Date | What | Result | Machine | Runtime |
| --- | --- | --- | --- | --- |
| Oct 7, 2026 | `vite build`, workspace route (React, React Router, Zustand, TanStack Virtual, the app) | JS 428.32 kB (134.62 kB gzip), CSS 27.43 kB (6.74 kB gzip). Worker chunk `validation.worker` 13.22 kB and `client` 4.10 kB (1.84 kB gzip) load on the first Validate | MacBook Pro Mac14,9, Apple M2 Pro, 32 GB | Node 25.9.0, Vite 8.3.3 |
| Oct 7, 2026 | Unit and component tests, 245 tests in 24 files | domain lines 99.43% (statements 97.02%, branches 90.63%); whole app lines 98.12% (one-off run) | same | Vitest 5.0.3 |
| Oct 7, 2026 | End to end, 19 tests | all pass; screenshots at 1440 x 900 and 1920 x 1080, dark and light, and the bay view | same | Chrome for Testing 153.0.8010.12 (Playwright 1.63, headless) |
| Oct 7, 2026 | Full validation in the worker, 10,000 containers (5 runs) | round trip 24.9 to 31.5 ms, no long task | same | same, Vite dev server |

The bundle figure is for the workspace route only. NFR-06 is measured per route against its limits in M7, when the plans route exists.

## M3 3D view (Oct 7, 2026)

### What was decided while building

| Topic | Decision |
| --- | --- |
| Dependencies | `three` 0.186.1, `@react-three/fiber` 9.8.1, `@react-three/drei` 10.7.9, `@types/three` 0.186.0. All on the approved list. Lines for outlines come from three's own `three/addons/lines`. drei is used for `OrbitControls` only. |
| Structure | `src/features/viewport3d/Viewport3D.tsx` is the shell in the main bundle: WebGL 2 check, error boundary, loading skeleton, fallback. `scene/ViewportScene.tsx` and everything under `scene/` load on demand in their own chunk with three.js. The DOM overlays (toolbar, legend, hints, tooltip) are in `Overlays.tsx`. |
| Camera | Orthographic, to match the prototype's parallel projection. The five presets use the prototype's yaw, pitch and target, and zoom to fit the ship the same way (90% of the width or 80% of the height). Moves take 600 ms with the same ease. drei `OrbitControls` gives orbit, pan and zoom, limited to 0.6x to 6x of the fit and 1° to 88° from vertical. |
| Colors exact | `flat` (no tone mapping) and unlit materials, so POD colors are the CSS values. Face shading (top 1.0, side 0.8, end 0.62) is baked into the box vertex colors as sRGB factors, as the design multiplies them. Edges are a shader patch, under a pixel wide, mixed after the sRGB conversion. Dimmed containers are drawn opaque in the dim color blended 55% over the background, instead of transparent: same look, no sorting problems. |
| Instances | One InstancedMesh per size class: 20ft, 40ft, 40ft high cube (40HC and RF), 20ft high cube. `ContainerLayer.sync` diffs the plan's placements by object identity (the plan store keeps unchanged placements as the same objects), so a swap writes 4 instances and a move 2. Colors are rewritten for the changed slots and for slots whose violation changed; changing mode, theme, POD filter or focus recolors everything. |
| Bay gap | The prototype's 3.2 m per side, 400 ms. The layer keeps each instance's base x and bay, and the gap writes only the x of each matrix. The real instance matrices move, so picking stays exact during and after the gap. |
| Pointer moves | Own `pointermove` listener, one raycast per animation frame (`Raycaster` on the instanced meshes, `instanceId` to slot key). The hover outline is moved and the tooltip DOM is filled directly. An e2e test counts React commits while sweeping the pointer over the ship: 0, with a click as the control. |
| Labels | BOW, STERN and BAY nn are DOM elements over the canvas, projected in the frame loop. drei `Html` was tried first and logged React 19 "synchronously unmount a root" errors. |
| Focus mode | View store `highlight`: containers outside the set are dimmed and the set gets red (error) or amber (warning) outlines. Ready for Show (FR-43, M5). The camera move to the bay is M5. |
| Show only POD | Dims the other PODs, as the prototype does, rather than hiding them. |
| Hidden, not unmounted | In the Bay tab the 3D view stays mounted with `hidden`, so the camera and the loaded scene survive tab switches. |
| Fallback | No WebGL 2 at start: "3D view unavailable · WebGL couldn't start. The bay grid still has every action." with Open bay view. A render error (error boundary) or a lost WebGL context shows the same box, saying the 3D view stopped working. |
| /bench | A lazy route. It loads the benchmark vessel into the plan store (`load` action) and restores the sample plan on leave. It renders every frame, orbits on its own, and reports fps, frame time (mean, p95), CPU time of the render call, GPU time per frame (WebGL timer query where available), draw calls and the GPU name, on screen and on `window.__stowBench`. `npm run bench:3d` runs it on the production build in a visible Chromium. |
| Benchmark vessel | Reshaped: 25 bays of 24 rows, 9 deck tiers, 8 hold tiers, 10,200 slots, deckhouse gap after bay index 13. The M1 version had 12 hold tiers, which stood above the deck. The rule engine benchmarks were re-run on the new shape (below); the results barely moved. |
| Lint | `react-hooks/immutability` (a React Compiler rule) is off for `src/features/viewport3d/scene/**` only: R3F changes three.js objects in `useFrame` and effects by design. |
| Dev hook | In dev builds only, `window.__stowViewport.findPickable()` gives an end-to-end test a container and its screen point. |

### Gate result

- **NFR-05, under 50 draw calls:** met. 10 to 12 draw calls for the whole ship with 10,000 containers (4 instanced meshes, hull inside and outside, hull edges, deck, waterline, deckhouse, outlines when shown). Checked in CI-able headless Playwright too (`e2e/viewport3d.spec.ts`).
- **NFR-01, 55 fps while orbiting with 10,000 containers:** met on this machine, not measured on the target hardware. On the MacBook Pro M2 Pro the view holds 60 fps, the display's refresh cap in this window, at 1x and 2x pixel ratio and at 1920 x 1080. A frame costs about 1.6 to 2.1 ms of GPU time and under 0.6 ms of CPU for the render call, so about 12% of a 60 fps frame. With Chrome's 4x CPU slowdown it still holds 60 fps. **But the M2 Pro is not a mid-range laptop with integrated graphics**: its GPU is several times faster than, for example, an Intel Iris Xe. The headroom suggests the target holds, but that is an estimate, not a measurement.
- **Next step for NFR-01:** run `npm run build && npm run bench:3d` on a mid-range Windows or Linux laptop with integrated graphics (an Intel Iris Xe or AMD Radeon 680M class) and record the result here. If it falls short, the first levers are the pixel ratio cap (now 2, can drop to 1.5) and the edge shader; both are a few lines.

### Accessibility finding, decided

With the 3D toolbar loaded, axe reported one serious finding in the light theme: a pressed toolbar button (camera preset, color mode, hull) drew `--accent` #0B6BD3 on `--accentbg` over white, 4.49:1, just under the 4.5:1 that WCAG AA and NFR-11 need for 12 px text. This was the design's own style. **Decision (owner, Oct 7, 2026): pressed toolbar labels use `--text` on `--accentbg`, as the design's filter chips already do.** No token changed. Applied in both themes for consistency. axe passes in both themes again.

### Not done in M3

- Drag targets and the ghost in 3D (FR-32, FR-38): M4.
- Show moving the camera to the violation (FR-43), port playback lift (FR-56): M5. The layer has what they need (focus set, per-instance base positions).
- Starting the 3D view causes two main-thread tasks of 54 to 70 ms in the production build (measured below). No target covers start-up, but it is visible as a short pause. Possible fix: build the instances in chunks or after first paint (M7).
- Headless screenshots of the 3D view use software WebGL; their baselines allow 2% difference.

### M3 measurements

| Date | What | Result | Machine | Runtime |
| --- | --- | --- | --- | --- |
| Oct 7, 2026 | NFR-01 /bench, 10,000 containers orbiting, production build (`npm run bench:3d`, 10 s, 598 frames) | 59.9 fps, frame time 16.69 ms mean and 17.5 ms p95, GPU 1.61 ms per frame, render call 0.46 ms CPU, 12 draw calls, 120,288 triangles, canvas 1440 x 754 at 2x | MacBook Pro Mac14,9, Apple M2 Pro (ANGLE Metal), 32 GB | Chrome for Testing 153.0.8010.12, headed, Playwright 1.63 |
| Oct 7, 2026 | Same, dev server, at 1x / 2x / 2x at 1920 x 950 canvas | 60.0 / 60.0 / 60.0 fps, p95 17.2 / 17.3 / 17.4 ms, GPU 1.87 ms per frame at 2x | same | same |
| Oct 7, 2026 | Same at 2x with 4x CPU slowdown (DevTools throttling) | 60.0 fps, p95 17.7 ms, GPU 2.06 ms | same | same |
| Oct 7, 2026 | Same in headless Chromium (software WebGL, SwiftShader) | 5.7 fps, 10 draw calls. Not representative of any GPU; reported so nobody reads the CI number as a result | same | Chrome for Testing 153 headless |
| Oct 7, 2026 | NFR-05 draw calls, /bench | 10 to 12 (target under 50) | same | headed and headless |
| Oct 7, 2026 | NFR-06 3D chunk (`ViewportScene`) | 972.96 kB, 261.68 kB gzip (limit 350 kB gzip). Main chunk 393.51 kB, 122.09 kB gzip | same | Vite 8.3.3 |
| Oct 7, 2026 | Start-up of the 3D view, workspace, production build, 3 runs | two long tasks per load: 56 and 70 ms, 62 and 54 ms, 61 and 55 ms | same | Chrome for Testing 153 headed, 2x |
| Oct 7, 2026 | NFR-04 re-checked with the 3D view on the page (worker, 10,000 containers, after the scene loads) | round trip 18.7 to 30.0 ms, no long task | same | Chrome for Testing 153 headless, dev server |
| Oct 7, 2026 | NFR-03 re-run on the reshaped benchmark vessel: one command with the rule check, then the incremental check (602 samples) | mean 1.66 ms, p99 2.31 ms. Full validation: mean 13.7 ms, p99 14.9 ms. Stability model: 3.64 ms mean | same | Node 25.9.0, Vitest 5.0.3 |
| Oct 7, 2026 | Tests | 287 unit and component tests in 30 files, domain lines 99.43%; 28 end to end | same | Vitest 5.0.3, Playwright 1.63 |

## M4 Placement (Oct 8, 2026)

### The placement controller

One pure controller in `src/state/placement.ts`: `step(state, event, plan) → { next, command?, announce?, refusal? }`. Pointer drag, click, keyboard and the 3D view all send it the same events, and `src/state/placement-store.ts` carries out what it returns (runs the command, shows the message, moves the focus).

| State | Event | Next | What happens |
| --- | --- | --- | --- |
| idle | pickFromList (row, via, queue) | holding | Unplanned row only. Announces the valid target count in the bay. A planned or unknown row stays idle and says why |
| idle | pickFromSlot (slot, via) | holding | Top of the stack and not locked (BR-03, BR-04), else idle with the reason |
| idle | startSwap (slot) | swapping | A placed, unlocked container (D2) |
| idle | hover, drop, cancel, chooseSwap | idle | Nothing |
| holding | hover (slot) | over | Runs the placement check on that slot. From the keyboard it reads the slot, its container and the rule result (FR-37) |
| holding | drop with no slot | idle (pointer) or holding (keyboard) | A drag that ends off the grid is cancelled; the keyboard asks to move to a slot first |
| holding, over | drop (slot) | idle | Valid: one `place` or `move` command, settle 180 ms. Same slot as the origin: put back, no command |
| holding, over | drop on a refused slot | idle (pointer) or over (keyboard) | Refused with the reason, the slot shakes once (FR-35). A drag returns the container in 220 ms; from the keyboard it stays in hand, as in the design |
| over | drop, more rows selected | holding (next row) | FR-39: the next selected row is picked up, from the keyboard |
| over | hover (other slot / none) | over / holding | |
| holding, over | cancel | idle | "Cancelled. Container returned to its slot / the load list." |
| holding, over | pick another | holding | The new container replaces the held one |
| holding, over | startSwap, chooseSwap | same | Ignored: put the container down first |
| swapping | chooseSwap (other container) | idle | One `swap` command, or refused with the reason |
| swapping | chooseSwap (itself), cancel | idle | "Swap cancelled." |
| swapping | chooseSwap (empty slot) | swapping | Asks again |
| swapping | pick | holding | |

### What was decided while building

| Topic | Decision |
| --- | --- |
| Pointer drag | Pointer events, not HTML5 drag and drop: one path for the load list, the bay cells and the 3D canvas, and a ghost that follows the pointer by a transform without React renders. A press becomes a drag after 4 px, so a click still selects. One hit test per frame: `[data-slot]` under the pointer, or the 3D target through a small bridge (`viewport3d/bridge.ts`) the lazy scene registers. Esc during a drag cancels. |
| Drag ghost | The chip from screen 02 (78 x 28 px, POD color, last 4 digits, POD, weight) follows the real cursor. The design draws a cursor arrow inside the chip because it is a still picture; the app uses the real cursor. |
| Keyboard pick-up | Enter on a load list row (FR-17) or a bay cell (FR-36). The focus goes to the first valid target in the bay, the controller is put over it so the strip previews it, and the grid takes the focus. A 20ft container switches the bay view to the fore half, a 40ft one back to 40ft slots. |
| Queue (FR-39) | Only a selected row brings the other selected rows, in list order from the next row, wrapping round. |
| Tooltip | On the target under the pointer, as in mkCell: the reason, or "Valid · stack X t of Y t", and "Drop disabled at …" or "Drop to place at … · Trim ±0.00 m". The keyboard gets the same text from the live region. |
| Origin cell | Drawn empty with the dashed accent outline, without its violation mark or selection ring, as mkCell does. |
| Stability preview (FR-51) | `previewDelta` runs the same model on the plan with the candidate command (SRS "Drag preview"). GM to 3 decimals, trim in m, list in degrees, placed as in the design (the labels sit over the units, as they do in screen 02). |
| 3D (FR-32, FR-38) | `scene/targets.ts`: one InstancedMesh of translucent boxes for the next free slots in the selected bay (green, amber, red), and a ghost at the target at 35% with a dashed outline, green when valid and red when not, as `stow3d.js` draws it. It follows the placement store by subscription, not React. A click on a target while holding places; a click on a container while swapping picks it. |
| Inspector (FR-48) | Unplace (off when locked, under another container or onboard: BR-03, BR-04, D3), Lock or Unlock, Swap (off when locked: D2; "Pick target" while swapping). While a container is held it shows "Picked up" or "Placing", the target's rule results, and Cancel and Place, as in the design. U, L and S run the actions from anywhere except a text field. |
| Status while held | The design says "Unplanned". A container lifted from a slot keeps its own status ("Planned this call", "Onboard from IDJKT"), using text the design already has. |
| Undo (FR-57) | The result message after every command offers Undo. The TopBar buttons, Ctrl or Cmd+Z and Shift for redo, and the message all go through one function that also drops anything held. The plan store keeps each command's line for the activity log (FR-58); showing the log is M6. |
| Live regions | The bay view's status bar is the polite live region. The workspace's hidden one now speaks only when the bay view is not on screen, so a sentence is not read twice. Refused drops are an alert. |
| "/" shortcut | Moved to a document listener: it did not work while the focus was on the page itself. |
| Reduced motion (FR-66) | Shake, settle and the held ghost play through `ui/motion.ts`, which plays a 100 ms fade instead when reduced motion is set. The drag ghost fades in 100 ms instead of travelling back. The toast fades instead of sliding. The global reduced-motion rule now also limits animations to one run: before, it made the 3D skeleton pulse every 100 ms, a flash. |
| Measuring NFR-02 | The bay view records `performance.measure('nfr-02 target marks')` from the pick-up to two frames after the marks render (the first frame callback runs before the paint, the second after it, so it errs long). `npm run bench:pickup` reads it on the production build, and also times from the input event's own timestamp. |

### New copy (decided Oct 8, 2026)

The design has no text for these cases. The owner left the choice to me: all approved as listed, with one change, "Not done" became "Can't make this change", in the voice of "Can't place … at …".

| Where | Text |
| --- | --- |
| Result message, FR-49 | "… · counts as a restow" after a move or swap of a container loaded at an earlier port |
| Live region | "Move to a slot first. Still holding {id}." · "{id} put back at {slot}." · "Picked up {id}. {n} more rows selected." · "{id} is already planned at {slot}." · "Swap cancelled." · "{slot} is empty. Pick a container to swap with." · "{slot} is empty. Nothing to swap." · "{id} at {slot} is locked. Unlock it first." · "Cannot swap. {reason}." · "Undone: {line}." · "Redone: {line}." |
| Messages | "Can't swap {a} and {b}" (title, with the reason) · "Undone" and "Redone" (with the command's line) · "Can't make this change" (a command the plan refused) · "Unlocked {slot}" |
| Activity log lines | "Placed {id} at {slot}", "Moved {id} from {a} to {b}", "Unplaced {id} from {slot}", "Swapped {id} at {a} with {id} at {b}", "Locked / Unlocked {id} at {slot}", "Undid: …", "Redid: …" |

### Accessibility findings, decided

A new axe scan of the held state (`e2e/a11y.spec.ts`, both themes) found two places where the design itself is under 4.5:1. **Decision (owner, Oct 8, 2026): both recommendations applied.** The row in hand keeps the accent background and dashed outline without the fade; the "Picked up" pill and the preview deltas use `--text` on `--accentbg`. No token changed. The scan now runs with no exclusions and passes in both themes.

| # | Where | Finding | Recommendation |
| --- | --- | --- | --- |
| A1 | Load list row in hand (dark theme) | Screen 02 fades the whole row to 55% opacity. The ID and weight measure 2.96:1, the POD badge 3.33:1 | Keep the accent background and the dashed outline that mark the row, and drop the fade, so the text stays at full contrast. The row still reads as "in hand" |
| A2 | "Picked up" pill in the bay status bar and the stability preview deltas (light theme) | `--accent` on `--accentbg` over white, 4.49:1, as the M3 toolbar finding | The same as your M3 decision: `--text` on `--accentbg`. No token change |

### Gate result

- **Keyboard-only test:** passes. `e2e/placement.spec.ts` AT-03 uses only keys: "/" to the search, Tab to the load list, arrows to NSPU 300653 4, Enter (focus moves to the bay grid on 180286), arrows read the slots, Enter places. The planned count goes from 312 to 313. The save step is M6.
- **NFR-02 measured:** met. Worst of 60 pick-ups 71.7 ms from the input event to the frame after the marks paint (target 100 ms). Numbers below.
- Also passing: AT-02 (refused, "Stack limit: 96.4 t of 90.0 t", load list unchanged), the undo part of AT-04 (a drag from 180488 to 180688 gives 6 violations and "Stack 18-04 deck back to 79.3 t of 90.0 t"; Undo gives 7; Ctrl+Shift+Z and Ctrl+Z), AT-09 (with reduced motion no animation of a placement runs over 100 ms; a control run of the same steps without reduced motion reported animations far over 100 ms, so the check can fail), a drop on a 3D target, Esc in the grid.

### Not done in M4

- Fixed after review (owner, Oct 8, 2026): the Bay tab with both side panels open at 1440 px overflowed the cell text (since M2). The Bay tab now collapses both panels to rails, as screen 03 shows, and leaving it restores them unless a panel was opened in the meantime. A cell under 56 px wide (a panel reopened in the Bay tab) shows the POD without the weight, by a container query, rather than overflowing or cutting a number; the cell label still reads the weight. The reefer, plug and DG corner icons can touch the POD text at that width.
- Activity log display (FR-58) and the restow count in the plan header (FR-49): M6. Apply fix (the first half of AT-04): M5.
- Touch: a press on a list row and a move scrolls the list, which cancels the drag. Pointer and keyboard work. Not in the SRS for version 1.
- A pick-up runs the rule check for the bay's targets about five times (controller, runner, bay view, 3D view, Inspector). It fits NFR-02 with room to spare; one shared result would cut it (M7 if needed).
- NFR-02 on other hardware: measured on the M2 Pro only.

### M4 measurements

| Date | What | Result | Machine | Runtime |
| --- | --- | --- | --- | --- |
| Oct 8, 2026 | NFR-02 Enter on a load list row (`npm run bench:pickup`, production build, 20 runs) | input to marks painted: median 58.0 ms, p95 61.7, max 61.7. Pick-up handler to marks painted: median 56.4, max 60.6 | MacBook Pro Mac14,9, Apple M2 Pro, 32 GB, macOS 26.6.2 | Chrome for Testing 153, headed, Playwright 1.63, 1440 x 900 |
| Oct 8, 2026 | NFR-02 Enter on a bay cell (20 runs) | input: median 55.1 ms, p95 67.6, max 67.6. Handler: median 54.2, max 66.8 | same | same |
| Oct 8, 2026 | NFR-02 pointer drag from a row (20 runs) | input (first pointer move after the press): median 63.8 ms, p95 71.7, max 71.7. Handler: median 31.4, max 61.4. The browser holds pointer moves until the next frame, hence the gap | same | same |
| Oct 8, 2026 | Bundles | main 413.63 kB, 128.71 kB gzip; 3D chunk 976.57 kB, 262.66 kB gzip (limit 350 kB) | same | Vite 8.3.3 |
| Oct 8, 2026 | Tests | 371 unit and component tests in 34 files, domain lines 99.43%; 35 end to end, 7 of them for M4 | same | Vitest 5.0.3, Playwright 1.63 |

## M5 Violations, stability drawer and port playback (Oct 8, 2026)

### What was decided while building

| Topic | Decision |
| --- | --- |
| Domain | New in `domain/plan/ports.ts`: `podCounts` (the legend and the timeline count the same way), `portStops` (discharge count per port and restows summed from the overstow violations, BR-08) and `liftOrder` (deck before hold, then bow to stern, then top down, as `stow3d.js` prepLift). `strengthPosition` places a bay on the strength axis for the chart band. Tests first. |
| Violations panel | `features/violations/model.ts` builds the rows from the plan; the fixes come from `suggestFix`, cached per plan state. Show selects the violation, opens bay and slot, dims the rest with outlines, and flies the camera to the bay with the prototype's view (yaw 214, pitch 30, zoom 2.7). From the Bay tab it switches to Split, since Show needs the 3D view. The design's banner "Focused on 4 containers · … · Clear focus Esc" is over the 3D view; its border and icon follow the severity. |
| No fix | The row gives the reason and, when the domain offers it, an Unplace button for the alternative (SRS "Fix suggestions"). For the sample: "No free slot with a reefer plug on board", Unplace NSPU 220417 3. The design's "Review manually" is not used. |
| New and resolved | A violation that was not there before the last change slides in over 160 ms (the design reuses the toast keyframe, which moves rows sideways; a slide keyframe is used instead) and the "New violation" message announces it. A resolved one gives the "Resolved" message with Undo (M4). |
| Validate | Runs in the worker as before, then opens the violations panel, as the design's validate does. The summary shows the time of the last full check: at load and on Validate. |
| Esc | In the design's order: a container in hand, then a violation focus, then the drawer. |
| Drawer | `features/stability/drawer.ts` turns the model's numbers into the chart paths, peaks, bay band, draft diagram, dials and trim bar; `computeStability` stays the only model. The design's fixed colors are tokens, so the light theme works. The status lines (OK · min 1.20 m, Check · crane limit 0.3°, OK · limit ±1.50 m) and the hydrostatics follow the plan. Seagoing and Harbour limits stay out (D6). Numbers and needles count over 300 ms with `useTween`; the curves change at once. |
| Stability button | Pressed: `--text` on `--accentbg`, the same contrast rule as M3 and M4. |
| Playback entry | **New control, not in the design:** a "Playback" toggle in the 3D toolbar, styled as the Hull button, opens and closes the timeline. The design shows the timeline but nothing that opens it. Opening switches to the 3D tab, as design 06, and closing goes back to the tab before. **Decided (owner left it to my judgement, Oct 8, 2026): kept in the 3D toolbar**, next to the controls of the view it drives. |
| Timeline | As design 06, with the "1×" control left out (D6). The track is a slider (arrows, Home, End, `aria-valuenow`), which fixes prototype gap 19; each stop is also a button. The departure stop can be chosen and shows the full ship. Play moves on after each port's lift and a 1.7 s rest (the prototype's cycle), stops at Hamburg, and Play there starts from Colombo again. |
| Lift | In the 3D frame loop: each container of the port rises 30 m with an ease-out over 500 ms, 20 ms after the one before, and fades to the background color, then is hidden (scaled to nothing, so picking skips it). Containers for earlier ports are hidden. Only containers whose progress changed are written each frame. The prototype fades with transparency; color is used here, as dimming already does, so nothing needs sorting. With reduced motion the port's containers are removed at once. The bay gap closes and the bay label is hidden during playback, as design 06. |
| Apply fix contrast | In the light theme, the accent "Apply fix" label on a selected row's `--sel` was 4.4:1. The button now has the surface color behind it instead of being transparent. No token changed. **Decided (Oct 8, 2026): kept.** |
| Copy | Summary grammar: "1 error blocks approval", and "No errors block approval" when there are none (the design always says "errors block"). Now playing: "1 restow move" (the design prints "1 restow moves"). Banner: "1 container" for a one-slot violation. **Decided (Oct 8, 2026): kept.** |

### Gate result

**The screens match designs 04, 05 and 06.** Checked by eye against renders of the design at 1440 x 900 (the drawer and the playback timeline also in the light theme, which the design does not have), and kept as screenshot baselines in `e2e/screenshots.spec.ts`: violations with Show on the stack weight (page and 3D view), the open drawer and strip, and playback at Jebel Ali (page and 3D view), dark and light. The values agree with the design: 7 violations (6 errors, 1 warning), 4 containers in the stack weight focus; BM 78%, SF +64%, drafts 12.10, 12.41 and 12.72 m, 0.62 m by stern, 98,420 t and 71,260 t; Colombo 562 with 2 restows, Jebel Ali 674 with 1. Differences on purpose: the fix texts come from the live plan (Move NSPU 771032 1 to 180688, where the design says 181686), the reefer row says why there is no fix and offers Unplace, and the controls listed in D6 are left out. Kept as designed: the stability preview labels sit over the gauge units, and on the timeline the "2 restows" badge of Colombo touches Jebel Ali's "−674".

AT-04 (Apply fix: 7 to 6 violations, 18-04 at 79.3 t, Undo gives 7) and AT-07 (Colombo 2 restows, Jebel Ali 1) pass in Playwright.

### Not done in M5

- The 3D lift has no end-to-end timing check; its timing is unit tested (`playback/model.test.ts`, `ContainerLayer.test.ts`) and was checked by eye.
- The focus banner, placed as in the design, covers the toolbar's second row while a violation is in focus, now including the new Playback toggle. Esc or Clear focus frees it.
- Fix suggestions for all violations take about 25 ms after each command while the violations panel is open (measured below). Fine for the sample; with many violations they could move to the worker (M7 if needed).

### M5 measurements

| Date | What | Result | Machine | Runtime |
| --- | --- | --- | --- | --- |
| Oct 8, 2026 | `suggestFix` for the 7 golden violations, 30 runs | median 25.3 ms, max 36.0 ms | MacBook Pro Mac14,9, Apple M2 Pro, 32 GB | Node 25.9.0, Vitest 5.0.3 |
| Oct 8, 2026 | `portStops` and `liftOrder` (Rotterdam, 837 containers), 30 runs | median 0.6 ms, max 1.6 ms | same | same |
| Oct 8, 2026 | Bundles | main 433.27 kB, 133.62 kB gzip; 3D chunk 984.70 kB, 265.00 kB gzip (limit 350 kB) | same | Vite 8.3.3 |
| Oct 8, 2026 | Tests | 410 unit and component tests in 40 files, domain lines 99.45%; 50 end to end | same | Vitest 5.0.3, Playwright 1.63 |

## M6 Plans and workflow (Oct 8, 2026)

### What was decided while building

| Topic | Decision |
| --- | --- |
| Dependency | `msw` 3.0.2 (on the approved list). `public/mockServiceWorker.js` is the file `msw init` writes; Prettier and ESLint skip it. |
| Domain first | `domain/workflow/permissions.ts`: roles, who may edit, send, approve, return, revise and export, and one `transition` function the mock and the screens both use. `domain/loadlist/import.ts`: the load list file checks of the SRS, with a property test that any JSON, and any text, parses without throwing and never lets a bad ID through. Both with tests before the UI. |
| Contract | `src/api/types.ts` holds the wire types for the ten endpoints, used by the client and by the mock. Every error has `{ code, message, details? }`. A 409 on save carries the current version, who saved and when. |
| Mock | `src/api/mock`: handlers for the ten endpoints (plus `GET /api/vessels`, which the SRS table lacks and New plan needs), a database that keeps the plans in IndexedDB and works out each summary with the domain functions (violations, stability, bay fill), and a seed of the 12 voyages of design 07. Every request waits 150 to 400 ms. The browser starts it before the app renders; the tests use the same handlers with no delay, through MSW in Node. `window.__stowMock` gives the developer switches to a person or a test. |
| Seed | Only 042W has vessel geometry and placements (D11): its numbers are computed from the plan and are the golden ones (312 of 1,240, 6 errors, 1 warning). The other eleven keep the design's numbers, with a synthetic bay fill from the design's own generator; Open plan is off for them and says why. IMO numbers are fictional (D13): 9000000 for the sample vessel, then steps of 137. |
| Overstow count | The preview says "Overstow 2" as the design does: one per violation. The two restow moves at Colombo and the one at Jebel Ali are on the port timeline. |
| Save | The history in the plan store is "the commands since the base version". Save sends them with the base version; on success the history is cleared and the base is the new version. The server replays the commands with the rule check, so a command that breaks a rule gives a 422 and saves nothing. |
| Unsaved work | After every command, undo and redo, the commands and the base version are written to `localStorage` per plan. Opening the plan puts them back on top of the loaded plan, and a message says how many came back, and if any could not be applied. |
| Conflict | A refused save shows a message with who saved and when, and "Your 1 change is kept here and not saved", with Review changes and Retry. Review changes lists the server version and the kept changes, and "Apply my changes to version N" loads the newest plan and puts the changes on top, each checked against the rules, then Save works. Retry sends the same base again, so it is refused again until the changes are reviewed. The developer switch is in the account menu: it makes a colleague (Dimas Hartono) save first, once. |
| Roles | Four, in the account menu: Vessel planner (Rina Adiputri), Senior planner (Hendra Wirawan), Terminal planner and Chief officer, the last two read only (the PRD roles with no FR, D7). The role is kept in the browser and sent as a header; the mock enforces it. |
| Workflow | Send for review (planner roles, on a Draft), Approve (senior only, only in review: not offered to anyone else, disabled with "N errors remain" while errors remain), Return (senior, needs a comment), Revise (planner roles, on an approved plan: a new Draft, version + 1), Export (anyone, on an approved plan). In the workspace they are in the top bar; in the plans list, in the preview. Send for review and Approve save first, because the server decides on what it has saved. |
| Read only | An approved plan, or a read only role, refuses commands, undo, redo, pick-up and swap in the store itself (not only by disabling buttons), disables Save, Import and Apply fix, and the Inspector offers no actions. The live region says why when a pick-up is refused. |
| Plans list | Design 07 without the Vessels, Port rotations and Rule library tabs, the Vessel and Port filter buttons, the ⌘K hint and Import BAPLIE (D6). The search placeholder drops "container ID" (D12). The grid is narrower than the design's so that the Updated column fits at 1440 px (the design clips it). The status badge sits on the surface color so its tint does not lower the contrast in the light theme. |
| New plan | A dialog built from the tokens (D7): vessel, voyage, port, ETD, with the server's message under the field it concerns. It starts from the vessel's arrival condition: the containers on board from earlier ports, an empty load list. |
| Import | The file goes to the server as text and every row is checked there. The result is a dialog: "N rows accepted · M rejected from file", and a table of row, ID and reason. A file that is not JSON gives "The file is not valid JSON." The ID in the table is cut at 40 characters and shown as text. |
| Failed requests | One place turns a failed request into a message with Retry (`state/api.ts`); calls that have their own flow for some codes (409, 422, 403) handle those and use the message for the rest. The plan route has a full-page version with Retry and "All plans". |
| Top bar at narrow widths | The new buttons did not fit at 1280 and 1440. Below 1600 px the progress bar is hidden (the count stays), Validate shows its icon and count, and "Send for review" reads "Review" with its full name kept for screen readers; below 1360 the version number is hidden. At 1600 and up, everything is as designed. |
| Dialogs | One `Dialog` for the review, import, return and new plan dialogs: modal, Tab stays inside, Esc closes from anywhere, the focus goes back. |

### Gate result

**The business process test passes** (`e2e/business-process.spec.ts`, 3 runs in a row, 12 to 16 s each). In one run, with three roles: 1 the plans list with ETD, progress, violations and status; 2 open 042W, 312 of 1,240 planned, 2,740 on board; 3 import a file of 10 rows, 7 accepted and 3 listed with a reason; 4 place an imported container with the keyboard onto a marked slot; 5 seven violations listed; 6 Show, then Apply fix six times, one warning left; 7 the stability drawer; 8 the port timeline; 9 Send for review (saves version 15 and sets In review); 10 the senior planner approves and the plan is read only; 11 the terminal planner exports the plan from the list, and the file has the schema, version 15 and 2,740 placements.

Also passing: AT-01, AT-03 in full (keyboard only, version 14 to 15), AT-05 (conflict message, history kept, review, apply, save), AT-06 (not offered, disabled, approved and read only), AT-10. The plans list, the dialogs, the account menu, the conflict and the import report pass axe in both themes.

### NFR-06: the plans route is 288.8 kB gzip, the target is 200 kB (decided: D14)

Measured on the production build with `npm run measure:js` (the scripts the plans route loads): 288.8 kB. Mock Service Worker is 156.1 kB of it, the app 117.7 kB, the plans page 6.1 kB. The workspace route is now lazy loaded too (it was in the main bundle), which took the main bundle from 137.6 to 117.7 kB, but msw cannot be left out: it answers the API. Options, for you to choose:
1. Raise the plans route limit to 300 kB gzip with the mock, and keep 200 kB for the app alone (117.7 + 6.1 + about 10 kB = about 135 kB, under 200). The SRS says the mock is for version 1; with a real server the msw chunk goes away.
2. Keep 200 kB for the whole route, and load msw only on the first API call, in parallel with the page. It does not change the bytes, only when they arrive.
3. Replace msw with a small `fetch` wrapper that answers the same contract. It meets 200 kB, but the stack in CLAUDE.md says Mock Service Worker.
I recommend 1. **Decision (owner, Oct 8, 2026): option 1, recorded as D14.**

### New UI for review (D7)

These have no design and are built from the tokens and existing components: the account menu with the role switcher and the developer switch, the New plan dialog, the Review changes dialog, the conflict message, the Return dialog, the import report, the Revise, Return, Approve and Export buttons, and the short "Review" label of Send for review on a narrow top bar. Please look at them; screenshots of the plans list are in the baselines, the dialogs are checked by axe and by tests.

New copy (my wording, to confirm): "Draft saved" with "Plan 042W-SGSIN · 313 of 1,240 planned · version 15" (the design's text, now real); "Sent for review", "Approved", "Returned to Draft", "Revised" with "Version N is a new Draft"; "Can't save", "Can't change the status", "Can't import the file", "Can't export", "Plan exported", "Plan created"; "Request failed"; "Unsaved changes restored"; "Your changes are on the newest version"; "{name} saved version N at HH:MM"; "Your N changes are kept here and not saved."; "This plan is approved and read only. Revise it to make changes."; "Your role cannot change plans."

### Not done in M6

- Step 12 of the process (Sail) has no requirement and is not built.
- Only 042W can be opened (D11). The other eleven voyages are summaries.
- The mock has one vessel. A second vessel for New plan would need its own geometry.
- A save that is refused with a 422 keeps the changes but does not say which one broke the rule beyond its number; the message holds the reason.
- The workspace's own header does not show who has the plan or when it was last saved.
- No test of the real service worker in the production build; the end-to-end tests run on the dev server.

### M6 measurements

| Date | What | Result | Machine | Runtime |
| --- | --- | --- | --- | --- |
| Oct 8, 2026 | NFR-06 JavaScript of the plans route, production build (`npm run measure:js`) | 288.8 kB gzip: msw 156.1, app 117.7, plans page 6.1, other 8.9. Target 200 kB: not met | MacBook Pro Mac14,9, Apple M2 Pro, 32 GB | Chrome for Testing 153, Vite 8.3.3 |
| Oct 8, 2026 | Bundles | 3D chunk 984.76 kB, 265.03 kB gzip (limit 350 kB); workspace route 33.4 kB gzip on top of the main bundle | same | Vite 8.3.3 |
| Oct 8, 2026 | Tests | 469 unit and component tests in 46 files, domain lines 99.39%; 71 end to end, 3 full runs | same | Vitest 5.0.3, Playwright 1.63 |

## M6b New UI from the design, screens 09 to 16 (Oct 8, 2026)

The owner designed the M6 screens in Claude Design (design/Stowline.dc.html 09 to 16, design/Stowline M6.dc.html). This replaces the token-built versions of M6 (D7).

### What changed

| Screen | Ported |
| --- | --- |
| 09 Account menu | A menu (`role=menu`, `menuitemradio`, `menuitemcheckbox`): name, role and desk; Switch role with a lock icon and "Read only" on two roles; Developer with "Next save returns 409". Enter, Space or ↓ open it on the chosen role, ↑ ↓ Home End move, Enter or Space choose, Esc closes and gives the focus back to the avatar. |
| 10 Top bar | The version next to the status ("v15"). Workflow actions after Save, behind a divider, so Undo, Redo, Validate and Save never move. Primary button by state: Save on a Draft, Approve in review, Revise when approved. Approve blocked with errors stays focusable (`aria-disabled`) and shows "6 errors remain: fix them to approve" on hover and focus. Under 1600 px the rotation collapses to now, next and a "+3" menu (the designer's recommendation over my compact version), and every label and the progress bar stay. |
| 11 Read only | A strip under the top bar with a lock icon and the reason, who approved it and when, or the role, with Revise or Switch role. In the Inspector the three actions are replaced by the same message; Apply fix is disabled with it as its tooltip; Enter in the bay grid reads the slot and the reason. Selection, Show, the camera, color modes and playback still work. |
| 12 Save conflict | The alert sits bottom centre and stays until acted on, and hides any toast while it does. The top bar shows "v14 → v15" with an error icon and Save reads "Save · 1". Review changes shows the server side (from the activity log of that save) and the kept changes side by side; focus starts on "Apply my changes to version 15", which now loads the newest version, re-checks each change and saves. |
| 13 Dialogs | Return: the plan, who it goes back to, a required comment, Ctrl+Enter to return. New plan: two-column form with the planner, "ETD can't be in the past." and "2 fields need fixing". Import report: warning or OK icon, the table, the note about rejected rows, "7 added to the SGSIN load list", Copy report. |
| 14 Failure and loading | The failed-request message shows "Retrying… Attempt N" while it runs again. A plan that fails to open: header with All plans / id, the message, the request line for support (for example "GET /plans/042W-SGSIN · 503 · 16:21:08"), Retry focused, All plans. Loading: panel skeletons, "Loading plan 042W-SGSIN…" and an indeterminate bar; both still with reduced motion. |
| 15 Plans states | Skeleton rows while loading, Clear filters focused when nothing matches, the "can't be opened" note with Open plan `aria-disabled`, and the notes under the preview buttons: "Opens read only", "Opens read only until returned", the reason Approve is blocked. |
| 16 Toasts | The design's copy and actions: Approved with Export, Plan created with Open plan, Unsaved changes restored with Discard. Bottom centre, one at a time, 5 s, paused while hovered or focused. |

### Decisions

| Topic | Decision |
| --- | --- |
| A plan in review is read only | Design 10 and 11 lock it ("disabled because the plan is locked", "Opens read only until returned"). The SRS makes only approved plans read only and does not forbid this. `canEditPlan` now allows editing on a Draft only; the server refuses a save or an import in review with 403. To change a plan in review, the senior planner returns it. Please confirm. |
| Words for the in-review strip | The design words the approved and the role cases only. In review: "This plan is in review and read only until it is returned or approved." (my wording, from the design's own "Sent for review" toast). |
| Import reasons | From design 13: "A container ID is 4 letters, 6 digits and a check digit." and "POD DEBRV is not in the rotation." A POD that is in the rotation but not after the port keeps "POD must be a port after SGSIN in the rotation." |
| Overlap check | Design 12 shows "No overlap. Version 15 doesn't touch slots 180488 or 180688." Not built: it needs the server's changes as slots, and the mock's activity log has only text. The dialog says instead that the rules are re-checked after applying and that a change that no longer fits is left out and named. |
| Retrying | The design says "Attempt 2 of 3". There is no automatic retry limit, so it says "Attempt 2". |
| Loading line | The design says "Vessel geometry, 2,740 containers, load list"; the count is not known before the plan loads, so: "Vessel geometry, containers, load list". |
| Draft saved toast | The design offers Undo on it. Not built: a save clears the history (M6), so there is nothing to undo against the server. |
| Plan exported toast | The design says "BAPLIE file downloaded: 042W-SGSIN-v15.edi". FR-65 exports JSON, so: "File downloaded: stowline-plan-042W-SGSIN.json". |
| Double load fixed | In development React runs the plan route's effect twice; the second load reset the view after the person had started working (it showed as a flaky AT-08). Fetching and showing are now separate, and only the latest fetch is shown. |
| Developer switch | The forced failure can target a path (`setFailNext(status, times, path)`), so a test can fail the plan request and nothing else. |

### Gate result

The business process test passes after the port. The whole suite, 87 end-to-end tests, passed in two full runs in a row; earlier runs failed while the machine's load average was 15 to 44 from other programs, and each of those tests passed on its own (see below). axe passes on screens 09 to 16 in both themes. Screenshot baselines for the new states are in `e2e/m6-states.spec.ts-snapshots`.

### Test reliability under load

With the machine loaded (load average 15 to 44 from other programs), some end-to-end tests timed out or raced. The fixes made them deterministic rather than slower: wait for the 3D view before placement tests, wait for the account menu to close in `switchRole`, dismiss a toast before a screenshot, target forced failures at one path, and match toast titles exactly (Playwright's `hasText` is a case-insensitive substring, so "Approved" matched "…returned or approved."). The axe specs get 60 s, as some run four full scans with the 3D view.

### M6b measurements

| Date | What | Result | Machine | Runtime |
| --- | --- | --- | --- | --- |
| Oct 8, 2026 | NFR-06 plans route JavaScript (`npm run measure:js`) | app 136.1 kB gzip (limit 200), mock API 156.1, total 292.2 (limit 300 with the mock, D14): pass | MacBook Pro Mac14,9, Apple M2 Pro, 32 GB | Chrome for Testing 153, Vite 8.3.3 |
| Oct 8, 2026 | Tests | 470 unit and component tests, domain lines 99.39%; 87 end to end, 2 full runs in a row | same | Vitest 5.0.3, Playwright 1.63 |

## M7 Quality (Oct 8, 2026)

No new feature. An accessibility audit, a performance pass with a profiler, the ten acceptance scenarios on three engines, reliability tests, coverage for the whole app, CI and the deploy setup.

### Accessibility audit: findings and fixes

| Finding | Fix | Test |
| --- | --- | --- |
| The two search fields (plans and load list) showed no focus: the input has no outline and the field around it had no focus style (WCAG 2.4.7) | The field shows the 2 px accent ring while the input has focus, as every other control does | `e2e/keyboard.spec.ts` |
| The load list grid showed no focus when tabbed into before a row was active: `outline-none` with `focus-visible:outline-2` resolves to `outline-style: none` in Tailwind 4 | `focus-visible:outline-solid` | `e2e/keyboard.spec.ts` |
| Accent text on a hovered ghost button (Save in review, Show, Apply fix) was 4.4998:1 in the light theme. The design gives these buttons no hover fill; I had added `--accentbg` | The hover fill is `--hover` (4.69:1 light, 5.70:1 dark). No token changed | `src/styles/tokens.test.ts` |
| Under 24 px: the logo links (20 px), the plans search field (17 px), the ETD sort button (16 px), the breadcrumb link | 24 px high, nothing moves | `e2e/target-size.spec.ts` (now both routes, the dialog and the menu) |

Checked and found working: a Tab walk of both routes reaches every control, shows a ring at each stop, wraps round and never goes back to a region it left; dialogs keep focus until Esc and give it back to the opener; every function has a keyboard path (plans rows take Enter and Space, the split bar takes the arrows, Home and End); reduced motion holds on both routes (nothing over 100 ms, the camera jumps); every text pair the components use is 4.5:1 or more and every focus, outline and icon pair 3:1 or more in both themes; axe finds nothing critical or serious on both routes in both themes; Lighthouse accessibility 1.00.

### WCAG 2.2 AA review

| Criteria | How | Result |
| --- | --- | --- |
| 1.1.1 Non-text content | Icons are `aria-hidden` next to text or have a label; the 3D canvas has a text alternative pointing to the bay grid | Pass (axe, component tests) |
| 1.3.1, 1.3.2 Info and relationships, sequence | Landmarks, headings, grids with rows and cells, tables in dialogs; the Tab walk follows the regions in order | Pass (axe, keyboard walk) |
| 1.4.1 Use of color | Every status has an icon and text; every container shows its POD code in the bay grid | Pass (NFR-12) |
| 1.4.3, 1.4.11 Contrast | Token test and axe; control borders are the 1.4.11 exception (D9) | Pass |
| 1.4.4, 1.4.10, 1.4.12 Resize, reflow, text spacing | The app supports 1280 × 720 and up (SRS); reflow to 320 px is not a target of a desktop planning tool | Not tested below 1280 px: out of scope by the SRS |
| 1.4.13 Content on hover or focus | Tooltips show on hover and focus, stay while hovered, close with Esc | Pass (M4, M6b tests) |
| 2.1.1, 2.1.2 Keyboard, no trap | Keyboard walk, AT-03 with no pointer, dialogs | Pass |
| 2.2.1 Timing | Toasts stay while hovered or focused; nothing important is only in a toast | Pass |
| 2.3.1 Flashes | Nothing flashes; looping animations run once with reduced motion | Pass |
| 2.4.3, 2.4.7, 2.4.11 Focus order, visible, not obscured | Keyboard walk checks a ring at each stop; the conflict alert and toasts sit bottom centre, away from the focused control | Pass after the fixes above |
| 2.5.7 Dragging | Every drag has a click and keyboard path (pick up, place) | Pass (AT-03) |
| 2.5.8 Target size | 24 px test on both routes | Pass after the fixes above |
| 3.2.x Predictable | No change of context on focus or input | Pass (review) |
| 3.3.1, 3.3.2, 3.3.3 Errors, labels, suggestions | Field errors in words next to the field (New plan, Return), import reasons per row | Pass (M6 tests) |
| 4.1.2, 4.1.3 Name, role, value; status messages | axe; slot descriptions polite, refusals assertive | Pass by test. A screen reader listening check needs a person (NFR-14) |

Screen reader check, for a person (NFR-14): with VoiceOver on Safari and NVDA on Firefox, open 042W, Tab to the bay grid, move with the arrows (each slot is read once, politely), press Enter on 18-04 deck and Enter on 18-06 deck (the refusal "Stack limit: 96.4 t of 90.0 t" is read at once), Tab to the 3D view (its text points to the bay grid).

### Performance: the profile and the three largest costs

`npm run profile <scenario>` samples the main thread with the V8 profiler (0.1 ms) in a visible Chromium; with `PROD=1` it runs the production code and maps each frame to its source through the source maps. `node tools/load-waterfall.mjs` times when each request and script starts and ends and when the 3D view is ready, as a median of several loads, optionally on fast 4G (165 ms, 9 Mbps, Chrome DevTools' Fast 4G) and as a first visit (`COLD=1`).

What the profiles showed: /bench is GPU-bound (5.65 s of orbiting uses about 300 ms of main thread); opening the workspace is mostly waiting (the mock API's 150 to 400 ms per request, then the 3D chunk); a command spent most of its time formatting numbers.

| Cost | Cause | Fix | Before | After |
| --- | --- | --- | --- | --- |
| 1. First visit: about 2 s before the app starts | The Google Fonts stylesheet is render-blocking, and the module script waits for it | The same IBM Plex files and unicode ranges (Latin, and Greek for Σ) are served with the app (`src/styles/fonts.css`, license in `public/fonts/OFL.txt`) | 3D view ready at 4,074 ms, first visit, fast 4G, median of 9 | 1,824 ms |
| 2. A command: `fmt1` was the largest self time | `toLocaleString` with options builds a new formatter on every call; a command prints hundreds of weights | One `Intl.NumberFormat`, made once (same output, property test) | 20 moves and 20 undos: 940 to 984 ms on the production code (3 runs); 463 ms of `fmt1` self time on the dev server | 706 to 726 ms; `fmt1` gone from the top 20 |
| 3. Opening a plan: two waits in a row | The vessel request waited for the load list as well as the plan; the 3D chunk started only after the data rendered | The vessel is requested when the plan arrives; the 3D chunk loads with the data (only with WebGL 2) | 4,074 ms first visit, fast 4G, median of 9 | 3,902 ms (measured before the font fix) |

Not changed, measured: the workspace's own start-up is about 280 ms of script on the production code (React, three.js, the scene); per command the domain work is about 3 ms (`applyCommand`, the stability sums, slot key parsing, bay occupancy), React about 2 ms. Two changes were tried and taken out because Lighthouse showed no gain: rendering before the mock API starts, and the plans list in the main chunk (FCP 1.7 to 1.6 s, LCP 1.9 to 2.2 s, simulated).

### Test reliability: the causes

The M6b notes put the flaky starts down to other programs loading the machine. M7 found the causes in the project:

| Cause | Fix |
| --- | --- |
| The end-to-end tests ran on the Vite dev server, which compiles each module on its first request. Four workers opening the workspace on a cold server took over 60 s | Playwright builds once (`vite build --mode e2e`) and serves it with `vite preview`. Test hooks are on in dev and in that build only (`TEST_HOOKS`); the production build has none. The suite runs in 2.3 minutes instead of 11 |
| Tracing every test (DOM snapshots at each step, with axe scans and the bay grid) made one test take 15 minutes | No trace; a screenshot on failure |
| The footer was 64.9 px in a 63 px row. The workspace clipped it, but could still be scrolled by 2 px, and a focus did that before some screenshots (5 failures in 6 under load) | The footer clips its own overflow; a test checks nothing overflows the workspace at the three sizes |
| Fixed waits before screenshots and scans | `settle()`: no finite animation running and the 3D scene has drawn no frame for 3 browser frames (a dev frame counter); the toast test uses the page clock |
| The reduced motion control counted frames, which depends on the machine's speed | It measures how long the 3D view keeps drawing |

There are no retries. After the fixes: 3 full runs in a row on three engines, 127 tests each, 1 failure in the first (the frame count above), then 42 of 42 motion and axe tests with 6 workers.

### Found by running the tests on the production build

The production CSS minifier writes `rgba()` tokens as 8-digit hex (`--g-edge: #0e172673`), and the scene's color parser read 6 digits: container edges and the waterline were opaque in the shipped app, in both themes. The parser now reads every hex form and `rgb()` with spaces. Dev serves the CSS unminified, so no test had seen it.

### Reliability

The 3D view fails safe in each way a test can make it fail: no WebGL (AT-08), a renderer that throws while it starts, a lost context (`e2e/reliability.spec.ts`), and an import that fails (`Viewport3D.test.tsx`; requests for scripts go through the mock API's service worker, which `page.route` cannot see). Each time the fallback says "3D view unavailable" and a keyboard placement and Validate still work. Unsaved work survives a reload and a tab closed with no unload handler. Every failed request has a message with Retry (M6).

### Memory (NFR-08)

200 keyboard moves and 200 undos, heap read through the DevTools protocol after a forced garbage collection. From cold the heap grows 44% (11.13 to 16.07 MB); a heap snapshot diff shows 3.6 MB of it is optimized code that V8 keeps after the first round. A second identical round grows 2.23% (16.07 to 16.42 MB), which is the activity log and the redo list, both kept by design. The test warms up with one round and measures the next.

### CI and deploy

`.github/workflows/ci.yml` runs four jobs on every push: lint, types, unit tests with both coverage thresholds; end to end with axe on Chromium (every test) and AT-01 to AT-10 on Firefox and WebKit; bundle size; Lighthouse on the plans route. Screenshot comparisons are skipped in CI because the baselines are per machine.

`vercel.json` builds with `npm run build`, serves `dist`, sends every route that is not a file to `index.html`, caches hashed assets for a year and never caches `mockServiceWorker.js`. Preview deployments for every branch come from Vercel's Git integration once the repository is imported in Vercel. Not deployed: the Vercel CLI on this machine has no valid login (`vercel whoami`: "The specified token is not valid").

### Decisions (Oct 8, 2026)

| ID | Topic | Decision |
| --- | --- | --- |
| D15 | Which "fast 4G" NFR-07 means | Lighthouse's own desktop profile (40 ms, 10 Mbps), decided by the owner. `lighthouserc.json` uses it and CI fails under a performance score of 90 or an LCP of 2.5 s. Result: 1.00, LCP 0.7 s. The Chrome DevTools Fast 4G numbers (165 ms: 0.84, LCP 1.9 s) stay in the measurements for reference |
| D16 | Fonts | Served with the app instead of from Google Fonts (the pre-build review said "Fonts load from Google Fonts, as in the design"). Same files, nothing looks different. Kept (owner left it to me) |
| D17 | Ghost button hover | `--hover` instead of `--accentbg`, for contrast; the design has no hover fill. Kept (owner left it to me) |
| M6b | A plan in review is read only; the strip says "This plan is in review and read only until it is returned or approved." | Kept as built, from designs 10 and 11 (owner left it to me) |

### Gate result

Every NFR has a measured result or a written reason (docs/TRACEABILITY.md: 88 of 91 rows done). The three that are not done:

- NFR-01, frame rate on a mid-range laptop with integrated graphics: not measured, no such machine here. On the M2 Pro the GPU takes 1.19 ms per frame. To measure: `npm run build && npm run bench:3d` on that laptop.
- NFR-09 and NFR-14: the screen reader check needs a person; the steps are above.

### Not done in M7

- The Vercel deploy and the per-branch previews (needs a Vercel login, or importing the repository in the Vercel dashboard).
- CI has not run on GitHub yet: the workflow is committed but not pushed.
- NFR-01 on target hardware, the screen reader check.

### M7 measurements

All on a MacBook Pro Mac14,9, Apple M2 Pro, 32 GB, macOS 26.6.2, Node 25.9.0.

| Date | What | Result | Browser |
| --- | --- | --- | --- |
| Oct 8, 2026 | NFR-01 `/bench`, 10,000 containers, 10 s, 1440 × 754 at 2x | 120.0 fps (display refresh cap), frame p95 9.3 ms, GPU 1.19 ms, CPU 0.23 ms per frame, 10 draw calls, 120,144 triangles | Chrome for Testing 153.0.8010.12, ANGLE Metal, visible window |
| Oct 8, 2026 | NFR-02 `npm run bench:pickup`, 20 runs each | from the list: median 12.5 ms, worst 19.3 ms; from a slot: 10.2, 17.4; drag: 10.1, 21.5 (input to the frame after the marks) | Chrome for Testing 153 |
| Oct 8, 2026 | NFR-03 rule check after one command, 10,000 containers | mean 1.638 ms, p99 2.346 ms, max 4.030 ms; full validation mean 15.1 ms | Node 25.9.0, Vitest 5.0.3 |
| Oct 8, 2026 | A command on the production code, 20 moves and 20 undos (`PROD=1 npm run profile commands`), 3 runs | before the formatter fix 940, 984, 947 ms; after 726, 706, 711 ms | Chrome for Testing 153 |
| Oct 8, 2026 | NFR-04 full validation in the worker, 5 runs | round trip 17.2 to 25.6 ms, worker 9.1 to 16.5 ms, no long task; seeded plan 7 violations | Chrome for Testing 153, end-to-end build |
| Oct 8, 2026 | NFR-06 `npm run measure:js` | plans route app 136.2 kB gzip, mock API 156.1, total 292.3: pass; 3D chunk 262.9 kB | Chrome for Testing 153 |
| Oct 8, 2026 | NFR-07 Lighthouse 12.6.1 on /plans, 3 runs, desktop, 1280 × 720, simulated 165 ms and 9 Mbps | performance 0.84, FCP 1.7 s, LCP 1.9 s, Speed Index 1.7 s, TBT 0 ms, CLS 0.001; accessibility 1.00, best practices 1.00 | Google Chrome 155.0.8059.39 |
| Oct 8, 2026 | NFR-07 the same with 40 ms and 10 Mbps (D15, the profile CI uses), 3 runs | performance 1.00, FCP 0.5 s, LCP 0.7 s, TBT 0 ms, CLS 0.001; accessibility 1.00, best practices 1.00 | Google Chrome 155.0.8059.39 |
| Oct 8, 2026 | Workspace load, 3D view ready, first visit, fast 4G (`COLD=1 NETWORK=fast4g`), median of 9 | before the fixes 4,074 ms; vessel and 3D chunk in parallel 3,902 ms; fonts with the app 1,824 ms | Chrome for Testing 153 |
| Oct 8, 2026 | Workspace load, returning visit, no throttling, median of 15 | 1,145 ms before, 1,112 and 1,150 ms after (within the mock API's random delay) | Chrome for Testing 153 |
| Oct 8, 2026 | NFR-08 heap, 200 commands and 200 undos | cold 11.13 to 16.07 MB (44%, 3.6 MB optimized code); after warm-up 16.07 to 16.42 MB (2.23%) | Chrome for Testing 153 |
| Oct 8, 2026 | NFR-20 `npm run check:secrets` on `dist` | 19 files, no finding | Node 25.9.0 |
| Oct 8, 2026 | NFR-23 coverage | whole app 74.21% of lines (3,443 of 4,639), statements 73.44%, branches 70.33%, functions 72.72%; domain 99.40% (988 of 994) | Vitest 5.0.3, V8 |
| Oct 8, 2026 | Tests | 569 unit and component tests; 127 end-to-end tests (Chromium 101, Firefox 13, WebKit 13) in 2.3 min with 4 workers, 3 full runs | Playwright 1.63: Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6 |

## Measurements

| Date | What | Result | Machine | Runtime |
| --- | --- | --- | --- | --- |
| Oct 7, 2026 | Prototype full re-check (`computeViolations`, seeded plan, mean of 50 runs) | 2.2 ms (SRS says about 5 ms) | MacBook Pro Mac14,9, Apple M2 Pro, 32 GB | Node 25.9.0 |
| Oct 7, 2026 | Prototype valid target search across all bays (`validTargets`, mean of 10 runs) | 13.7 ms (SRS says about 30 ms) | MacBook Pro Mac14,9, Apple M2 Pro, 32 GB | Node 25.9.0 |
| Oct 7, 2026 | Token contrast: dark `--text3` on surface / raised | 5.56:1 / 5.01:1 | Calculated (WCAG formula) | |
| Oct 7, 2026 | Token contrast: light `--warn`, `--ok`, `--err`, `--accent` on bg | 4.91, 4.75, 4.97, 4.56:1 | Calculated | |
| Oct 7, 2026 | Focus ring #3B9EFF on light bg; `--border2` on surface | 2.46:1; 1.71:1 | Calculated | |
