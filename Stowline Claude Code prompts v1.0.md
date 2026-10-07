# Stowline Claude Code prompts v1.0

Oct 7, 2026 · @ami

## Prompts and models

There are 11 prompts. Use Opus 5.5 for the five hard ones and for the review, and Sonnet 5.5 for the five routine ones.

| # | Prompt | Model | Switch with | Effort | Why this model | Claude Code time | Complexity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Kickoff and plan | Opus 5.5 | /model opus | high | It reads three large sources and must find where they disagree | 0.5 h | Medium |
| 1 | M0 Foundation | Sonnet 5.5 | /model sonnet | medium | Standard project setup and a direct port of the data generator | 1 h | Low |
| 2 | M1 Rule engine | Opus 5.5 | /model opus | high | Correctness matters most here: six rules, command inverses, property tests | 1.5 h | Medium |
| 3 | M2 Workspace panels | Sonnet 5.5 | /model sonnet | medium | A lot of UI, fully specified by the design files | 2.5 h | Medium |
| 4 | M3 3D view | Opus 5.5 | /model opus | high | Performance work with instancing and picking, where a wrong design is costly to undo | 2.5 h | High |
| 5 | M4 Placement | Opus 5.5 | /model opus | high | One state machine across pointer, keyboard and 3D, plus undo | 2.5 h | High |
| 6 | M5 Violations, stability, playback | Sonnet 5.5 | /model sonnet | medium | Panels and charts on top of logic that M1 already tested | 2 h | Medium |
| 7 | M6 Plans and workflow | Sonnet 5.5 | /model sonnet | medium | Common patterns: list, mock API, save flow, roles | 2 h | Medium |
| 8 | M7 Quality | Opus 5.5 | /model opus | high | Profiling, an accessibility audit and flaky tests need root-cause reasoning | 2.5 h | High |
| 9 | M8 Case study | Sonnet 5.5 | /model sonnet | medium | Writing from facts that are already recorded | 1 h | Low |
| R | Milestone review | Opus 5.5 | /model opus | high | A fresh session that did not write the code finds more | 0.25 h each time | Low |

Three options if you want to change the mix:

- Fable 5.1 is the most capable model in Claude Code. If your plan includes it, use it for prompts 4 and 5 with /model fable.
- The alias opusplan uses Opus in plan mode and Sonnet for the code. It fits the Sonnet prompts when you want a stronger plan first.
- Haiku 4.5 is enough for small chores such as a rename or a copy change. No prompt in this list needs it.

The hours are estimates, the same ones as in the PRD release plan. Which models you can pick, and how much you can use them, depends on your plan. Source for the commands: [Claude Code model configuration](https://code.claude.com/docs/en/model-config).

## Setup

Do these four steps once, before prompt 0.

1. Create a repo with two folders: docs/ and design/.
2. Export the PRD and the SRS as Markdown and save them as docs/PRD.md and docs/SRS.md.
3. Copy the eight design files into design/ with their original names.
4. Save the text in the next section as CLAUDE.md in the repo root. Claude Code reads this file at the start of every session, so the prompts can stay short.

Then repeat this loop for each prompt:

1. Start a new Claude Code session, so the context is clean.
2. Set the model and effort from the table, for example /model opus and then /effort high.
3. Paste the prompt. Prompt 0 runs in plan mode.
4. When the milestone report arrives, run the review prompt in another new session.
5. Fix what the review found, check the gate, then tag the commit (m0, m1 and so on).

## CLAUDE.md

This file holds the rules that apply to every milestone. It is not a prompt, so it needs no model.

```text
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
(M0 fills this in: dev, build, lint, typecheck, test, e2e, bench.)
```

## Prompts 0 to 2

### Prompt 0: Kickoff and plan

Model: Opus 5.5, effort high, in plan mode. No code is written in this step.

```text
Do not write code yet.

Read CLAUDE.md, docs/PRD.md, docs/SRS.md and every file in design/ except support.js.

Then give me:
1. A summary of the product in 10 lines, so I can see you understood it.
2. Every conflict or gap you found between the PRD, the SRS and the prototype, with file and line.
3. A check of the SRS section "From prototype to production". Confirm each of the 14 changes against the prototype code, and tell me if you find more.
4. The folder structure you propose and the list of dependencies with versions.
5. The main risks in M3 (3D view) and M4 (placement), and how you will reduce them.

After I approve, save the result as docs/BUILD_NOTES.md and create docs/TRACEABILITY.md with one row per FR and NFR, all with status "not started".
```

### Prompt 1: M0 Foundation

Model: Sonnet 5.5, effort medium. About 1 hour.

```text
Milestone M0, Foundation. Follow CLAUDE.md and docs/BUILD_NOTES.md.

Build:
1. A Vite, React and TypeScript strict project with ESLint, Prettier, Vitest, Playwright and a GitHub Actions workflow that runs lint, type check and unit tests.
2. The design tokens from THEMES in design/workspace-vm.js as CSS variables for dark and light, wired into Tailwind. IBM Plex Sans and IBM Plex Mono with tabular figures.
3. The domain types from the SRS section "Data model" in src/domain.
4. Vessel geometry in src/domain, ported from design/stowline-data.js: bays, rows, tiers, slot keys, slot positions and plugs. Add the fore and aft half model for 20ft containers.
5. The seeded sample generator, ported from createPlan and createLoadList. Change it so the load list has 1,240 rows and 312 of them are planned. Do not move, reweigh or re-route any container that createPlan puts on board. Reach 312 by marking more of the existing deck containers as loaded at Singapore. Keep the scripted stacks and the named containers.
6. The ESLint rule that blocks React, three and DOM imports in src/domain.
7. Fill in the Commands section of CLAUDE.md.

Tests:
- Geometry: 22 bays, 4,292 forty-foot slots, 404 plug slots.
- The generator is deterministic.
- Counts: 2,740 containers on board, 1,240 load list rows, 312 planned.

Gate: lint, type check and tests pass in CI.
Report and stop.
```

### Prompt 2: M1 Rule engine

Model: Opus 5.5, effort high. About 1.5 hours.

```text
Milestone M1, Rule engine. Follow CLAUDE.md.

Read the SRS sections "Rule specifications" and "Stability model". Read computeViolations, checkPlace, validTargets, suggestFix and stabDelta in design/stowline-data.js.

Build in src/domain:
1. Rules R1 to R6 as pure functions, with the dangerous goods neighbour check across bays.
2. The placement check, in the order the SRS gives.
3. Commands (place, move, unplace, swap, lock, unlock) with apply and inverse. A command that creates a new error is refused.
4. Incremental validation: given a plan and the stacks a command touched, return the new list of violations.
5. Fix suggestions for all six rules. Search every bay. Return "no fix" with a reason when none exists.
6. The stability model as one pure function of plan and vessel. Calibrate the base values from the seeded plan. Add the strength curves from FR-54.
7. A Web Worker with Comlink that runs full validation.

Write these tests first:
- Golden fixture: the seeded plan gives exactly the 7 violations in the SRS.
- The boundary values in the SRS section "Test plan and acceptance".
- Property tests with fast-check: a command followed by its inverse returns the same plan, and the incremental result equals full validation after any random sequence of valid commands.
- Stability: the seeded plan reads GM 1.84, trim 0.62, list 0.4, drafts 12.10 and 12.72, bending moment 78, shear force 64.
- Benchmark with 10,000 containers: record the time for one incremental check and for full validation.

Gate: all tests pass, domain line coverage is 90% or more, NFR-03 and NFR-04 are measured and written to docs/BUILD_NOTES.md.
Report and stop.
```

## Prompts 3 to 5

### Prompt 3: M2 Workspace panels

Model: Sonnet 5.5, effort medium. About 2.5 hours.

```text
Milestone M2, Workspace panels. Follow CLAUDE.md.

Reference for layout, states and copy: design/Stowline Workspace.dc.html, design/Stowline Components.dc.html and buildVM in design/workspace-vm.js.

There is no 3D and no drag in this milestone. The center shows the bay view and a placeholder where the 3D view will go.

Build:
1. The plan store and the view store.
2. The workspace route and shell: grid layout, side panels that collapse to a 40 px rail, center tabs 3D, Bay and Split with a resizable split (FR-06 to FR-08).
3. TopBar (FR-09), BayNavigator (FR-10) and the theme switch (FR-11).
4. LoadList with search, filters, sort, multi-select, footer totals and virtual rows (FR-12 to FR-16).
5. BayView with every cell state, stack totals, the hatch line and bay stepping (FR-26 to FR-30).
6. Inspector, read only for now (FR-46, FR-47).
7. StabilityStrip (FR-50).
8. The shared pieces from the components sheet: buttons, tabs, chips, badges, tooltip, toast.

Tests:
- Component tests for the cell states, the load list filters and sort, and the gauges.
- Playwright screenshots of the workspace at 1440 x 900 and 1920 x 1080 in both themes.

Gate: the screens match designs 01 and 03 side by side, and axe reports no critical or serious finding.
Report and stop.
```

### Prompt 4: M3 3D view

Model: Opus 5.5, effort high. About 2.5 hours. Fable 5.1 is an option here.

```text
Milestone M3, 3D view. Follow CLAUDE.md, above all the section "3D view".

Read design/stow3d.js for the hull sections, camera presets, color scales, focus dimming, bay gap and lift behavior. Read syncRenderer in design/workspace-vm.js for what the view receives from the app.

Before you write code, tell me in 10 lines how you will structure the scene and how you will keep pointer moves from re-rendering React. Then build in src/features/viewport3d:
1. A lazy loaded Viewport3D with the loading skeleton and an error boundary (FR-24, FR-25).
2. Hull, deck, deckhouse and waterline from the section table.
3. Containers as instanced meshes with a color per instance, and the four color modes with their legend (FR-18, FR-20).
4. Orbit, pan, zoom and the five camera presets with a 600 ms move (FR-19).
5. Hull transparency and "show only this POD" (FR-21).
6. Hover tooltip and click to select through instanceId, in sync with the bay view and the Inspector (FR-22).
7. The bay gap and bay label (FR-23), and a focus mode that dims every container outside a given set (needed later for FR-43).
8. A /bench route with a generated 10,000 container vessel that shows fps, draw calls and frame time.

Tests:
- Unit tests for slot to matrix mapping and for color mapping.
- Playwright: a click in the 3D view selects the same container in the bay view.
- Playwright with WebGL turned off (AT-08).

Gate: NFR-01 and NFR-05 are measured on /bench and written to docs/BUILD_NOTES.md with the machine and browser used. If a target is missed, say so and propose the next step. Do not hide it.
Report and stop.
```

### Prompt 5: M4 Placement

Model: Opus 5.5, effort high. About 2.5 hours. Fable 5.1 is an option here.

```text
Milestone M4, Placement. Follow CLAUDE.md.

Read mkCell, tryPlace, enter, moveFocus, cellClick and apply in design/workspace-vm.js, and the notes for screens 02 and 03 in design/Stowline.dc.html.

Before you write code, show me the states and transitions of the placement controller. Then build:
1. One placement controller with the states idle, holding (from the load list or from a slot) and over target. Pointer drag, click and keyboard all drive this one controller.
2. Drag from a load list row to a bay cell, and from a cell to another cell (FR-31, FR-33).
3. Target marks on the next free slot of each stack, with the reason on hover (FR-34). A refused drop returns the container, shakes the slot once and shows the reason (FR-35).
4. Keyboard: Enter on a load list row picks up and moves focus to the grid (FR-17). Arrow keys, Enter and Esc in the grid (FR-36). Live region text (FR-37).
5. The ghost in the 3D view, and a drop on a 3D target in the selected bay (FR-38, FR-32).
6. The stability preview while holding (FR-51) and the count to the new value after a command (FR-52).
7. Inspector actions Unplace, Lock and Swap (FR-48), restow recording (FR-49) and the queue of selected rows (FR-39).
8. Command history with undo, redo and messages that offer Undo (FR-57), plus the activity log (FR-58).
9. Reduced motion for every animation above (FR-66).

Tests:
- Unit tests for the controller: every state and every transition.
- Playwright: AT-02, AT-03 without the save step, the undo part of AT-04, and AT-09.

Gate: the keyboard-only test passes and NFR-02 is measured.
Report and stop.
```

## Prompts 6 to 9

### Prompt 6: M5 Violations, stability and playback

Model: Sonnet 5.5, effort medium. About 2 hours.

```text
Milestone M5, Violations, stability drawer and port playback. Follow CLAUDE.md.

Reference: the notes for screens 04, 05 and 06 in design/Stowline.dc.html, and the Violations, Drawer charts and Playback parts of buildVM in design/workspace-vm.js.

Build:
1. ViolationsPanel: groups for errors and warnings, the severity filter, rows with the containers involved, Show, Apply fix, the "no fix" state, and the behavior for new and resolved violations (FR-40, FR-42 to FR-45). The Validate button runs full validation in the worker (FR-41).
2. StabilityDrawer: the strength chart with the 85% and 100% lines and a band for the selected bay, the draft diagram, the gauges and the hydrostatics table (FR-53, FR-54).
3. PortTimeline and playback: one stop per port with the discharge count and restows, the lift animation inside the 3D frame loop, play and pause (FR-55, FR-56).

Use the domain functions from M1. Do not put rule or stability logic in components.

Tests:
- Playwright: AT-04 and AT-07.
- Component tests for the panel and for the chart paths.

Gate: the screens match designs 04, 05 and 06.
Report and stop.
```

### Prompt 7: M6 Plans and workflow

Model: Sonnet 5.5, effort medium. About 2 hours.

```text
Milestone M6, Plans and workflow. Follow CLAUDE.md.

Reference: design/Stowline Plans.dc.html and the SRS section "Interfaces".

Build:
1. MSW handlers for the ten endpoints, with IndexedDB storage and a delay of 150 to 400 ms. Seed them with the 12 voyages from the design. Add a developer switch that makes the next save return 409.
2. A typed API client. Every failed request shows a message with Retry (NFR-18).
3. The plans list route with filters, search, sort and the preview panel (FR-01 to FR-05). Leave out the Vessels, Port rotations and Rule library tabs.
4. Save with the base version, the conflict flow, and local persistence of unsaved commands (FR-59 to FR-61).
5. A role switcher in the account menu. Send for review, Approve, Return with a comment, and Revise. Approved plans are read only (FR-62, FR-63).
6. Import load list from a JSON file, with the row checks and a report of rejected rows (FR-64). Export of an approved plan (FR-65). The button label is "Import load list".

Tests:
- Playwright: AT-01, AT-03 in full, AT-05, AT-06 and AT-10.
- One Playwright test that runs steps 1 to 11 of the PRD section "End-to-end business process" in order.

Gate: the business process test passes.
Report and stop.
```

### Prompt 8: M7 Quality

Model: Opus 5.5, effort high. About 2.5 hours.

```text
Milestone M7, Quality. Follow CLAUDE.md. Add no new feature.

Do:
1. Accessibility audit against NFR-09 to NFR-15: axe on both routes and both themes, a keyboard walk through every function, focus order, target sizes, and a contrast test on the tokens. Fix what you find and list each fix.
2. Performance against NFR-01 to NFR-08: profile /bench and the workspace, fix the three largest costs, add the bundle size check and Lighthouse CI.
3. Run all ten acceptance scenarios on Chromium, Firefox and WebKit in CI. Remove flaky behavior at its cause, not with retries or fixed waits.
4. Reliability: the error boundary on the 3D view, forced API errors, and a reload with unsaved work (NFR-16 to NFR-18).
5. Coverage: domain 90% of lines or more, whole app 70% or more.
6. Deploy to Vercel with a preview for each branch.

Update docs/TRACEABILITY.md so every FR and NFR has a status and a test. Record every measured number in docs/BUILD_NOTES.md with the machine and browser.

Gate: every NFR has a measured result, or a written reason why it missed its target.
Report and stop.
```

### Prompt 9: M8 Case study

Model: Sonnet 5.5, effort medium. About 1 hour.

```text
Milestone M8, Case study. Follow CLAUDE.md.

Write for two readers: a recruiter with five minutes and a senior engineer with twenty.

Write README.md with these parts:
1. A one-line pitch, the live link, and a screenshot or short recording of placing a container.
2. The problem and the business process from the PRD in under 150 words, with a process diagram.
3. What I built, as a feature list tied to FR ids.
4. An architecture diagram, and the five decisions that mattered. For each one, name the alternative I rejected and why: instanced rendering, the command history, incremental rule checks with a worker, one placement controller for pointer and keyboard, and the bay grid as the accessible equivalent of the 3D view.
5. Measured results from docs/BUILD_NOTES.md. Use measured numbers only.
6. Known limits, from the PRD section "Risks, assumptions and limits".
7. How to run, test and benchmark.
8. A five minute demo script that follows process steps 1 to 11.

Also write docs/ARCHITECTURE.md: the data flow of one move, from pointer event to rendered frame.

Use plain English. No marketing words. No claim that the code does not back up.

Gate: I can follow the demo script on the live site without help.
Report and stop.
```

## Review prompt

Model: Opus 5.5, effort high. Run it in a new session after each milestone, so the reviewer has not seen the code being written. Fill in the milestone and the previous tag before you paste. For M0 there is no previous tag, so ask it to review the whole repo.

```text
You are reviewing one milestone of Stowline. You did not write this code. Do not change any file.

Milestone: M_
Diff to review: git diff <previous tag>..HEAD

Read CLAUDE.md, the parts of docs/SRS.md that this milestone covers, and the diff.

Report, most serious first:
1. Requirements in scope for this milestone that are missing or only partly done, by FR or NFR id.
2. Bugs, each with the input that triggers it.
3. Breaks of the rules in CLAUDE.md.
4. Tests that would still pass if the code were wrong.
5. Accessibility problems.

For each finding give the file, the line and the smallest fix. If a category has no finding, say so. Do not praise the code.
```

Paste the findings into the session that built the milestone, or into a new one with the same model, and ask it to fix them one by one.
