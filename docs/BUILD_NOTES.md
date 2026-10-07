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

## Measurements

| Date | What | Result | Machine | Runtime |
| --- | --- | --- | --- | --- |
| Oct 7, 2026 | Prototype full re-check (`computeViolations`, seeded plan, mean of 50 runs) | 2.2 ms (SRS says about 5 ms) | MacBook Pro Mac14,9, Apple M2 Pro, 32 GB | Node 25.9.0 |
| Oct 7, 2026 | Prototype valid target search across all bays (`validTargets`, mean of 10 runs) | 13.7 ms (SRS says about 30 ms) | MacBook Pro Mac14,9, Apple M2 Pro, 32 GB | Node 25.9.0 |
| Oct 7, 2026 | Token contrast: dark `--text3` on surface / raised | 5.56:1 / 5.01:1 | Calculated (WCAG formula) | |
| Oct 7, 2026 | Token contrast: light `--warn`, `--ok`, `--err`, `--accent` on bg | 4.91, 4.75, 4.97, 4.56:1 | Calculated | |
| Oct 7, 2026 | Focus ring #3B9EFF on light bg; `--border2` on surface | 2.46:1; 1.71:1 | Calculated | |
