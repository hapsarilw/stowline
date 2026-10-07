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

## Measurements

| Date | What | Result | Machine | Runtime |
| --- | --- | --- | --- | --- |
| Oct 7, 2026 | Prototype full re-check (`computeViolations`, seeded plan, mean of 50 runs) | 2.2 ms (SRS says about 5 ms) | MacBook Pro Mac14,9, Apple M2 Pro, 32 GB | Node 25.9.0 |
| Oct 7, 2026 | Prototype valid target search across all bays (`validTargets`, mean of 10 runs) | 13.7 ms (SRS says about 30 ms) | MacBook Pro Mac14,9, Apple M2 Pro, 32 GB | Node 25.9.0 |
| Oct 7, 2026 | Token contrast: dark `--text3` on surface / raised | 5.56:1 / 5.01:1 | Calculated (WCAG formula) | |
| Oct 7, 2026 | Token contrast: light `--warn`, `--ok`, `--err`, `--accent` on bg | 4.91, 4.75, 4.97, 4.56:1 | Calculated | |
| Oct 7, 2026 | Focus ring #3B9EFF on light bg; `--border2` on surface | 2.46:1; 1.71:1 | Calculated | |
