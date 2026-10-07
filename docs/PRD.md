# Stowline PRD v1.0

Oct 7, 2026 · @ami

## Summary

Stowline is a web app that lets a vessel planner place containers on a ship in 3D and catch rule violations at the moment of placement. It is for planners at shipping lines and terminals who plan a port call under time pressure.

Version 1 covers one full business process: receive a load list, plan the ship, validate, review, approve and hand the plan to the terminal. It is a portfolio product that runs on realistic sample data, so the whole process can be shown without a real backend.

| Item | Value |
| --- | --- |
| Product | Stowline, a 3D container stowage planner |
| Platform | Desktop web app, designed for 1440 x 900 and 1920 x 1080 |
| Sample vessel | MV Nusantara Pioneer, 8,500 TEU, voyage 042W |
| Sample port call | Singapore (SGSIN): 1,240 containers to load, 312 already planned |
| Port rotation | Jakarta, Singapore, Colombo, Jebel Ali, Rotterdam, Hamburg |
| Basis | Design screens 01 to 08 (workspace, drag, bay view, violations, stability, playback, plans, components) |
| Related document | Stowline SRS v1.0 |

## Problem

A planner must place thousands of containers under hard rules, and most mistakes are found late, when they are expensive to fix.

| What goes wrong | Why it costs |
| --- | --- |
| Overstow: a box for an early port sits under a box for a later port | Extra crane moves (restows) at the early port and a longer port stay |
| A stack is heavier than its limit | Safety risk for ship and cargo, and the vessel can reject the plan |
| A reefer sits in a slot with no power plug | The cargo can spoil |
| Dangerous goods sit too close to an incompatible class | Safety and compliance risk |
| Weight is badly spread along or across the ship | Poor trim, list or stability, and replanning at the last minute |

Three things make these mistakes easy to miss:

- A 2D bay plan shows one bay at a time, so problems that cross bays or ports are hard to see.
- Rule checks often run as a separate step after planning, not while the planner works.
- The effect of one move on stability is not visible until the whole plan is calculated.

These points come from domain research, not from interviews with working planners. Validation with a planner is an open item (see Risks).

## Goals and non-goals

Version 1 has six goals, in priority order.

1. Catch every rule violation at the moment of placement, before the plan is saved.
2. Show the whole ship at a glance in 3D and one bay in detail in 2D, always in sync.
3. Keep an expert fast: dense layout, a keyboard path for every action, undo for every change.
4. Make stability visible while planning, not after.
5. Give a clear handoff with three states: Draft, In review, Approved.
6. Meet WCAG 2.2 AA, with a keyboard and screen reader path for everything the 3D view does.

Not in version 1:

- A certified loading computer. Stability numbers are simplified estimates for demonstration.
- An automatic stowage optimizer. The app suggests a fix for one violation. It does not plan the ship.
- A live EDI connection (BAPLIE, COPRAR, MOVINS). Import and export use JSON files.
- A real backend. A mock API in the browser plays the server.
- Crane sequencing, lashing calculation and line-of-sight checks.
- Tablet and phone layouts.

## Users and roles

The vessel planner is the primary user. Three other roles read or approve the plan.

| Role | Goal | Can do in Stowline |
| --- | --- | --- |
| Vessel planner | Finish a safe plan before the terminal cut-off | Create and edit plans, place containers, validate, save, send for review |
| Senior planner | Approve only plans that are safe and cheap to work | Open any plan, approve it, or return it to Draft with a comment |
| Terminal planner | Know where every container goes before loading starts | View and export approved plans |
| Chief officer | Confirm the ship stays stable and within strength limits | View stability and violations, read only |

The demo has no login. A role switcher in the account menu changes what the user can do.

## End-to-end business process

One port call runs through twelve steps, from the load list to an approved plan in the hands of the terminal.

&#91;embedded content: stowage planning process · 3 roles, 2 decisions\]

The app checks the rules on every move, so an error loops back to the planner at once. The senior planner can still return a plan to Draft, and approval is blocked while any error remains.

| # | Step | Who | What Stowline does | Screen |
| --- | --- | --- | --- | --- |
| 1 | Open the port call | Vessel planner | Lists voyages with ETD, progress, violations and status | Plans list |
| 2 | Load the arrival condition | Stowline | Shows the containers already on board from earlier ports | Workspace |
| 3 | Import the load list | Vessel planner | Adds the containers to load at this port and checks each row | Load list |
| 4 | Place containers | Vessel planner | Marks valid, warning and invalid slots with the reason before the drop | 3D view, Bay view |
| 5 | Check the rules | Stowline | Re-checks the plan on every move and lists the violations | Violations panel |
| 6 | Fix violations | Vessel planner | Show moves the camera to the problem. Apply fix makes the suggested move | Violations panel |
| 7 | Check stability | Vessel planner | Compares GM, trim, list, drafts, bending moment and shear force with limits | Stability strip and drawer |
| 8 | Play the port rotation | Vessel planner | Shows what leaves at each port and how many restows it needs | Port playback |
| 9 | Save and send for review | Vessel planner | Saves a new version and sets the status to In review | Top bar |
| 10 | Review | Senior planner | Approves, or returns the plan to Draft with a comment | Plans list, Workspace |
| 11 | Hand over | Terminal planner | Exports the approved plan. The plan is locked | Plans list |
| 12 | Sail | Stowline | The departure condition becomes the arrival condition at the next port | Next port call |

## Features and user stories

Version 1 has 17 features: 12 Must, 4 Should and 1 Could. Each one maps to requirements in the SRS.

| ID | Feature | User story | Priority | Accepted when |
| --- | --- | --- | --- | --- |
| F-01 | Plans list | As a planner I see every port call with ETD, progress, violations and status, so I know what to work on first | Must | I can filter by status, by my plans and by violations, search, sort by ETD, and preview a plan before opening it |
| F-02 | Workspace | As a planner I work on one screen with the load list, the ship, the bay, the details and stability | Must | The layout works at 1440 x 900 and 1920 x 1080, and both side panels collapse |
| F-03 | Load list | As a planner I find the containers I want to place next | Must | I can search, filter by POD, type, reefer, DG and unplanned, sort, and select several rows. 1,240 rows scroll smoothly |
| F-04 | 3D ship view | As a planner I see the whole ship and spot problems that cross bays | Must | I can orbit, zoom, use camera presets, color by POD, weight, type or violations, make the hull transparent, show one POD only, hover for details and click to inspect |
| F-05 | Bay view | As a planner I work in one bay with exact slot detail | Must | The cross section shows rows, tiers, the hatch line, stack weights against limits, plug slots and every cell state |
| F-06 | Place and move | As a planner I place a container by drag, by click or by keyboard | Must | Before I drop, valid, warning and invalid slots are marked with the reason. An invalid drop returns the container |
| F-07 | Rule checks and violations | As a planner I see every violation with its reason and a suggested fix | Must | Six rules run on every move. Show focuses the 3D view on the containers involved. Apply fix resolves the violation |
| F-08 | Inspector | As a planner I see all facts about one container and its slot | Must | It shows type, weight, ports, flags, stack weight against the limit, the result of each rule, and the actions Unplace, Lock and Swap |
| F-09 | Stability | As a planner I see GM, trim, list and hull strength while I plan | Must | The strip is always visible and previews the change during a drag. The drawer shows the strength chart, drafts and gauges |
| F-10 | Port playback | As a planner I see what leaves the ship at each port | Should | A timeline has one stop per port with the discharge count and restow moves. Play steps through the ports |
| F-11 | Undo and redo | As a planner I can reverse any change | Must | Every change can be undone and redone with the keyboard, and each result message offers Undo |
| F-12 | Save and versions | As a planner I never lose work and never overwrite a colleague | Must | Save creates a new version. If a colleague saved first, my save is refused and my moves are kept for review |
| F-13 | Review and approval | As a senior planner I approve only plans without errors | Should | Status moves between Draft, In review and Approved. Approve is disabled while any error remains |
| F-14 | Import load list | As a planner I bring in the terminal's load list | Should | A JSON file is checked row by row, and rejected rows are listed with the reason |
| F-15 | Export approved plan | As a terminal planner I take the approved plan into my own system | Could | An approved plan downloads as a JSON file |
| F-16 | Light and dark theme | As a planner I choose the theme that fits my room | Should | Both themes keep text contrast at 4.5:1 or better, and POD colors stay the same |
| F-17 | Accessibility | As a planner who does not use a mouse I can do the same work | Must | The full flow from load list to save works with the keyboard and a screen reader, and motion respects the reduced motion setting |

## Business rules

Seventeen rules define what the product allows. Limits are the values of the sample vessel.

| ID | Rule | Result if broken |
| --- | --- | --- |
| BR-01 | A slot is addressed as bay, row and tier (BBRRTT). 20ft containers use odd bay numbers and 40ft containers use even bay numbers | Slot does not exist |
| BR-02 | A container goes only into an empty slot that has a container directly below it, or is the lowest tier of its stack | Drop refused |
| BR-03 | Only the top container of a stack can be picked up, moved or unplaced | Action disabled |
| BR-04 | A locked container cannot be moved, unplaced or swapped until it is unlocked | Action disabled |
| BR-05 | Stack weight stays within the limit: 90.0 t on deck and 210.0 t in the hold | Error |
| BR-06 | A reefer sits only in a slot with a power plug | Error |
| BR-07 | Incompatible dangerous goods classes do not sit next to each other | Error |
| BR-08 | A container for an earlier port does not sit under a container for a later port | Error, with the number of restow moves |
| BR-09 | A 20ft container does not sit on a 40ft container. A 40ft sits on 20ft containers only when both halves below are filled | Error |
| BR-10 | A container is not more than 10.0 t heavier than the one below it | Warning |
| BR-11 | A drop that would cause an error is refused. A drop that causes only a warning is allowed | Container returns to where it came from |
| BR-12 | Stability stays in limits: GM at least 1.20 m, trim within 1.50 m, list under 2.0 degrees, bending moment and shear force at 100% or less | Gauge shows Limit |
| BR-13 | A caution shows before a limit is reached: GM under 1.40 m, trim above 1.00 m, list above 0.3 degrees, bending moment or shear force above 85% | Gauge shows Check |
| BR-14 | A plan is Draft, In review or Approved. It cannot be approved while any error remains. Warnings do not block approval | Approve disabled |
| BR-15 | An approved plan is locked. A change after approval starts a new Draft version | Edit refused |
| BR-16 | Every save has a version number. A save based on an old version is refused and the planner's moves are kept | Conflict message |
| BR-17 | A container loaded at an earlier port can be moved at this port, but the move counts as a restow | Restow count for the port call goes up |

## Success metrics

The demo is judged on six build targets that can be measured today. Three business metrics would be tracked in a real rollout.

| Build target | Target | How it is measured |
| --- | --- | --- |
| Rule coverage | All 6 rule types are flagged before save | Unit tests on the rule engine |
| Placement feedback | Under 100 ms from hover to valid or invalid mark | Performance test in the browser |
| 3D frame rate | 55 fps or more with 10,000 containers on a mid-range laptop | Benchmark scene with a larger test vessel |
| Keyboard flow | Load list to saved plan with no mouse | End-to-end test |
| Accessibility | No critical issues in automated checks, and the WCAG 2.2 AA checklist passes | axe scan and manual review |
| First load | Plans list is usable in under 2.5 s on a fast 4G profile | Lighthouse |

| Business metric | Direction | Baseline |
| --- | --- | --- |
| Restow moves per port call | Down | Not measured yet |
| Violations found after approval | Zero | Not measured yet |
| Time from load list to approved plan | Down | Not measured yet |

## Release plan

The build runs in nine milestones, about 17.5 hours of Claude Code time and 11.5 hours of my own review. The hours are estimates.

| Milestone | What ships | Gate to pass | Claude Code | My review | Complexity |
| --- | --- | --- | --- | --- | --- |
| M0 Foundation | Project setup, design tokens, typed domain model, sample data generator | Lint, type check and data tests pass | 1 h | 0.5 h | Low |
| M1 Rule engine | Six rules, placement check, fix suggestions, stability estimate, Web Worker | Unit tests cover every rule and every limit | 1.5 h | 1 h | Medium |
| M2 Workspace panels | Top bar, load list, bay view, inspector, bay navigator, stability strip | Screens match designs 01 and 03 | 2.5 h | 1.5 h | Medium |
| M3 3D view | Instanced ship scene, picking, camera presets, color modes | 55 fps with 10,000 containers | 2.5 h | 1.5 h | High |
| M4 Placement | Drag across list, grid and 3D, keyboard path, undo and redo | Keyboard-only placement test passes | 2.5 h | 2 h | High |
| M5 Violations, stability, playback | Violations panel with fixes, stability drawer, port timeline | Screens match designs 04, 05 and 06 | 2 h | 1 h | Medium |
| M6 Plans and workflow | Plans list, save with versions, review and approval, mock API, import | Process steps 1 to 11 run end to end | 2 h | 1 h | Medium |
| M7 Quality | Accessibility pass, performance budget, end-to-end tests, CI, deploy | Every build target in Success metrics is met | 2.5 h | 2 h | High |
| M8 Case study | README, architecture notes, demo script | A recruiter can follow the demo in 5 minutes | 1 h | 1 h | Low |

## Risks, assumptions and limits

The largest limit is that the rules and the stability model are simplified, so Stowline is a demonstration and not a tool for real operations.

| Risk or limit | Effect | Response |
| --- | --- | --- |
| Dangerous goods segregation uses a small sample table, not the full IMDG Code | A real plan could pass here and fail on board | Say so in the app and the README. Keep the table as data so it can be replaced |
| Stability is a simplified estimate from fixed hydrostatic values | Numbers are not valid for a real ship | Label them as estimates. Keep the model behind one interface |
| No interviews with working planners yet | Features may miss real needs | Ask one planner for feedback after M6 and record the findings |
| 3D can be slow on weak graphics hardware | Low frame rate | Instanced rendering, lazy loading, and the bay view as a full fallback when WebGL is not available |
| Sample data only | No proof at the scale of the largest ships | A benchmark with a larger test vessel |
| One developer | Scope can slip | Must, Should and Could priorities. Should and Could wait if a milestone runs long |

Assumptions: one planner edits a plan at a time, the load list arrives as one file per port call, and all weights are verified gross mass in tonnes.

## Glossary

| Term | Meaning |
| --- | --- |
| TEU | Twenty-foot equivalent unit. One 40ft container counts as 2 TEU |
| Bay, row, tier | The three coordinates of a slot: position along the ship, across the ship, and height |
| Slot | One container position, written BBRRTT, for example 180486 |
| Stack | All slots with the same bay and row, on deck or in the hold |
| Hatch cover | The steel cover between the hold and the deck |
| POL, POD | Port of loading and port of discharge |
| Load list | The containers to load at this port call |
| VGM | Verified gross mass, the confirmed weight of a packed container |
| Reefer | A refrigerated container that needs a power plug |
| DG, IMDG | Dangerous goods, and the international code that classes them |
| Overstow | A container that blocks one below it that must leave earlier |
| Restow | An extra crane move to take a blocking container off and put it back |
| GM | Metacentric height, the main measure of how stable the ship is |
| Trim | The difference between the draft at the stern and at the bow |
| List | A sideways lean of the ship, in degrees |
| Draft | How deep the hull sits in the water |
| Bending moment, shear force | Loads on the hull along its length, shown as a percent of the allowed value |
| BAPLIE | The standard EDI message that carries a bay plan between ship, line and terminal |
