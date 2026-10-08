# Stowline

A 3D container stowage planner. Front-end portfolio project, one developer.

## Source of truth
- docs/SRS.md decides. docs/PRD.md explains why. If they disagree, stop and ask.
- design/ is the approved prototype. Port its logic. Do not copy its structure.
  - Stowline Workspace.dc.html, Stowline Plans.dc.html, Stowline Components.dc.html: layout, tokens, states, ARIA labels, copy.
  - Stowline.dc.html: notes for screens 01 to 08 and motion timings.
  - stowline-data.js: sample data generator and rule engine.
  - workspace-vm.js: interaction logic and theme tokens.
  - stow3d.js: 2D canvas stand-in for the 3D view (hull sections, camera presets, color scales).
  - support.js: the design tool's runtime. Ignore it.
- Keep every visible number, label and color as designed, unless the SRS section "From prototype to production" says otherwise.
- The seeded plan must always give the 7 violations in the SRS section "Golden fixture".
- Generated container IDs use the NSPU prefix only.

## Stack
React 19, TypeScript strict, Vite, React Router, Zustand, three.js with React Three Fiber v9 and drei v10, TanStack Virtual, Tailwind CSS with the design tokens as CSS variables, Comlink, Mock Service Worker with IndexedDB, Vitest, fast-check, React Testing Library, Playwright, axe, GitHub Actions. Ask before adding any other dependency.

## Architecture
- src/domain: pure TypeScript. No imports from React, three or the DOM.
- src/state: Zustand plan store and view store.
- src/features/<name>: plans, load-list, bay-view, viewport3d, inspector, violations, stability, playback.
- src/api: typed client and MSW handlers.
- Drag, click and keyboard end in the same command. Every command passes the placement check and has an inverse.
- After a command, re-check only the changed stacks. Full validation runs in the worker.
- Component names: TopBar, LoadList, Viewport3D, BayView, BayNavigator, StabilityStrip, Inspector, ViolationsPanel, StabilityDrawer, PortTimeline.

## 3D view
- One InstancedMesh per container size. Update only the instances that changed.
- Pick with the raycaster and instanceId. No React re-render on pointer move.
- Render on demand. Animate inside the frame loop, not with React state.
- Lazy load the 3D code. Fall back to the bay view when WebGL 2 is missing or the scene throws.

## Decisions from screens 09 to 16
Decided by the owner in M8 (Oct 8, 2026). They change the design where they say so.

1. Roles: Vessel planner and Senior planner can edit. Terminal planner and Chief officer are read only.
2. Statuses: a Draft can be edited. In review is locked for every role. Approved is locked, and Revise starts a new Draft version. Who may do what follows the status × role table in design/Stowline M6.dc.html ("Preview buttons").
3. Approve is blocked while errors remain. It stays focusable and gives its reason: "6 errors remain. Return the plan to fix them." This replaces the design's "6 errors remain: fix them to approve".
4. A plan in review is read only: "This plan is in review and read only until it is returned or approved." Sending for review is allowed with errors.
5. Below 1600 px the port rotation is compact: the current port, the next port and a "+N" menu.
6. A 409 on save carries the current version, who saved it, when, and the commands saved since your base version. The design's sample server changes are examples only.
7. The export is JSON, named like 042W-SGSIN-v15.json. It replaces the design's BAPLIE .edi file.
8. A plan with no vessel geometry cannot be opened.

Every change asks the one gate, `canEdit` in src/domain/workflow/permissions.ts, through src/state/edit-gate.ts. Components hold no role or status check.

## Accessibility
- Everything the 3D view does also works in the bay grid with the keyboard.
- A status always has an icon and text.
- Respect prefers-reduced-motion everywhere.

## Workflow
- One milestone per session. The scope is in the prompt. The gate is in the PRD section "Release plan".
- Write domain tests first. Run lint, type check and tests before you report.
- Small commits with conventional messages that name the FR ids.
- Keep docs/TRACEABILITY.md current: one row per FR and NFR, with status and the test that covers it.
- Put measured numbers in docs/BUILD_NOTES.md with the machine and browser.
- End every milestone with a report: what was built, FR and NFR ids done, what is not done, gate result. Then stop and wait.

## Never
- Add features that are not in the SRS.
- Change tokens, copy or sample numbers without asking.
- Use `any`, or put domain logic in components.
- Report a number you did not measure.
- Use real company names or logos.

## Commands
Node 24 (see .nvmrc). Install with `npm ci`.

- `npm run dev`: Vite dev server.
- `npm run build`: type check, then production build to dist/.
- `npm run lint`: ESLint, then a Prettier check. `npm run format` fixes formatting.
- `npm run typecheck`: the app (tsconfig.json), then src/domain alone with no DOM types (tsconfig.domain.json).
- `npm test`: Vitest unit tests (`src/**/*.test.ts`, `tools/**/*.test.ts`).
- `npm run test:coverage`: the same with coverage. Fails under 70% of lines in the whole app or 90% in src/domain.
- `npm run e2e`: Playwright, Chromium. Run `npx playwright install chromium` once first. Screenshot baselines are per machine: refresh with `npx playwright test e2e/screenshots.spec.ts --update-snapshots`.
- `npm run bench:3d`: after `npm run build`, measures `/bench` (10,000 containers) in a visible Chromium on the real GPU. Headless Chromium draws WebGL in software: never use its frame rate.
- `npm run bench`: Vitest benchmarks (`src/**/*.bench.ts`) with the verbose reporter, which prints the table. In Vitest 5 a benchmark is a `test` that takes `{ bench }`.

CI (.github/workflows/ci.yml) runs lint, typecheck and test:coverage on every push.