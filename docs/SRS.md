# Stowline SRS v1.0

Oct 7, 2026 · @ami

## Introduction

This document says what the Stowline front end must do, in numbered requirements that can be built and tested. It turns the 17 features of the PRD into 66 functional and 25 non-functional requirements.

In scope: the single-page web app, its rule engine, its 3D view and a mock API that runs in the browser. Out of scope: a real server, real EDI messages and certified stability calculation.

Conventions used here:

- "Shall" marks a requirement. FR is functional, NFR is non-functional.
- Priority is M (Must), S (Should) or C (Could), the same as in the PRD.
- Weights are in tonnes, lengths in metres, angles in degrees.

| Reference | Used for |
| --- | --- |
| Stowline PRD v1.0 | Features F-01 to F-17, business rules BR-01 to BR-17, the business process |
| Design files: Stowline Workspace, Stowline Plans, Stowline Components | Layout, tokens, component states, motion notes |
| Prototype scripts: stowline-data.js, workspace-vm.js, stow3d.js | Sample data, rule logic and interaction behavior to port |
| [ISO 9711-1:1990, bay plan system](https://genorma.com/en/standards/iso-9711-1-1990) | Bay, row and tier numbering |
| ISO 6346 | Container number format, and size and type codes |
| IMDG Code | Dangerous goods classes |
| WCAG 2.2, level AA | Accessibility |
| UN/EDIFACT BAPLIE | Reference for a later import and export format |

## System overview

Stowline is a single-page app in five layers, and the rule engine has no dependency on React or on the 3D view.

&#91;embedded content: front-end architecture · 5 layers\]

A drag, a click and a key press all end as the same command. The plan store sends only the changed stacks to the rule engine and renders what comes back.

| Concern | Choice | Reason |
| --- | --- | --- |
| Language and UI | TypeScript in strict mode, React | Types protect the domain model |
| Build | Vite | Fast builds and a separate chunk for the 3D view |
| 3D | three.js with React Three Fiber and drei | Instanced meshes draw thousands of containers in a few draw calls |
| State | Zustand | Small stores that the render loop can read without re-rendering React |
| Long lists | TanStack Virtual | 1,240 load list rows stay smooth |
| Styling | Tailwind CSS, with the design tokens as CSS variables | One token set for the dark and light themes |
| Background work | Web Worker with Comlink | Validation stays off the main thread |
| Routing | React Router | Plans list and workspace as separate routes |
| Mock server | Mock Service Worker | The same HTTP contract a real API would have |
| Tests | Vitest, React Testing Library, Playwright, axe | Unit, component, end-to-end and accessibility checks |
| Delivery | GitHub Actions and Vercel | Checks on every push and a preview for every branch |

Supported environment: the latest two versions of Chrome, Edge, Firefox and Safari on desktop, at 1280 x 720 or larger. The 3D view needs WebGL 2. Without it the bay view carries every action.

## From prototype to production

The design files already contain working logic, so the build is a port with 14 known changes, not a rewrite from zero. I ran the prototype's rule engine on its own sample plan: it holds 2,740 containers and returns exactly 7 violations, 6 errors and 1 warning.

| Area | In the design prototype | In the production build |
| --- | --- | --- |
| 3D view | A 2D canvas that sorts and paints every box on each frame, and picks by polygon test | A React Three Fiber scene with instanced meshes, picked by instance id |
| State | One state object. Each undo step stores a full copy of the plan | Typed stores and a command history that stores each command and its inverse |
| Rule checks | Re-checks every container after each move | Checks only the stacks a command touched. Full validation runs in a Web Worker |
| Slot model | One container per 40ft slot, so a 20ft takes a whole slot | Each 40ft slot has a fore half and an aft half, so two 20ft containers fit |
| Sample data | The load list has 148 rows while the header says 1,240. 253 containers are marked as loaded at Singapore while the header says 312 | The generator produces 1,240 load list rows with 312 planned, and every counter is computed from data |
| Fix suggestions | 5 of the 7 sample violations get a fix. Reefer power and 20ft on 40ft show "Review manually" | The search covers every bay. When no slot fits, the row says why and offers Unplace |
| Swap and Apply fix | Applied without a rule check | Every command passes the same placement check |
| Containers already on board | Any top container can be moved freely | A move of a container loaded at an earlier port is recorded as a restow |
| Overstow count | Counts every container above the blocked one | Counts only the containers above that go to a later port |
| Dangerous goods neighbours | Same bay only: left, right, above, below | Also the same row and tier in the next bay forward and aft |
| Stability | Adds a change per move to fixed start values. The strength curves never change | Recalculated from the whole plan after each command. The strength curves respond to weight per bay |
| Keyboard | The bay grid has arrow keys, Enter and Esc. A load list row can only be ticked | A load list row can be picked up with the keyboard and placed in the grid |
| Save, Validate, review | Show a message only | Call the mock API with a version check and a status workflow |
| Plans list | Open plan, Send for review, New plan and Import are not wired. Vessels, Port rotations and Rule library lead nowhere | Wired to routes and the API. The three unused tabs are left out of version 1, and the import label reads "Import load list" |

Measured on the prototype logic in a Node test run: a full re-check takes about 5 ms and a search for valid targets across all bays takes about 30 ms. Both grow with ship size, which is why the production build checks by stack and moves full validation off the main thread.

## Data model

The domain has ten entities, and a plan is the only one that changes while the planner works.

| Entity | Key fields | Notes |
| --- | --- | --- |
| Vessel | id, name, imo, teu, bays, limits, hydrostatics | The sample vessel has 22 forty-foot bays, numbered 02 to 86 in steps of 4, and 4,292 forty-foot slots |
| Bay | bay, index, x, deckRows, holdRows, deckTiers, holdTiers | Deck tiers 82 to 92, hold tiers 02 to 16. Forward bays are narrower and shallower |
| Slot | bay, row, tier, half, hasPlug | Key BBRRTT. A slot exists only where the bay geometry has it. 404 slots have a reefer plug |
| Container | id, type, isoCode, lengthFt, weightT, pol, pod, reeferSetPointC, imdgClass | Types 20GP, 40GP, 40HC, RF, TK, OT. Weight is VGM in tonnes |
| Placement | containerId, slotKey, half, locked, origin | half is fore, aft or both. origin is onboard or thisCall |
| Plan | id, vesselId, voyage, port, etd, status, version, placements, plannerId, restowCount | status is draft, in\_review or approved |
| LoadListItem | container, plannedSlotKey | plannedSlotKey is empty until the container is placed |
| Violation | id, rule, severity, slotKeys, message, data | The id is stable for the same rule and slot, so the UI can tell new from resolved |
| Command | kind, payload, inverse | kind is place, move, unplace, swap, lock or unlock |
| StabilityResult | gm, trim, list, draftFwd, draftAft, bmPct, sfPct, bmCurve, sfCurve | Derived from the plan. Never stored |

Coordinates: x runs along the ship and is positive toward the bow, y is positive to port, and z is height above the keel, all in metres.

```ts
type SlotKey = string; // 'BBRRTT', for example '180486'
type RuleId = 'stack' | 'reefer' | 'dg' | 'overstow' | 'twenty' | 'heavy';

interface Container {
  id: string;                 // 'NSPU 482913 5'
  type: '20GP' | '40GP' | '40HC' | 'RF' | 'TK' | 'OT';
  lengthFt: 20 | 40;
  weightT: number;
  pol: string;                // UN/LOCODE, 'SGSIN'
  pod: string;
  reeferSetPointC?: number;
  imdgClass?: string;         // '3', '5.1'
}

interface Placement {
  containerId: string;
  slotKey: SlotKey;
  half: 'fore' | 'aft' | 'both';
  locked: boolean;
  origin: 'onboard' | 'thisCall';
}

interface Violation {
  id: string;                 // 'stack:18-4-D'
  rule: RuleId;
  severity: 'error' | 'warning';
  slotKeys: SlotKey[];
  message: string;
  data?: { restows?: number; overT?: number; port?: string };
}

type Command =
  | { kind: 'place'; containerId: string; to: SlotKey }
  | { kind: 'move'; from: SlotKey; to: SlotKey }
  | { kind: 'unplace'; from: SlotKey }
  | { kind: 'swap'; a: SlotKey; b: SlotKey }
  | { kind: 'lock' | 'unlock'; at: SlotKey };
```

## Functional requirements

The 66 functional requirements are grouped by module. Priority is M (Must), S (Should) or C (Could).

### Plans list

| ID | Requirement | Priority | PRD |
| --- | --- | --- | --- |
| FR-01 | The plans list shall show one row per port call with vessel, voyage, port, ETD, progress, violation counts, status, planner and last update | M | F-01 |
| FR-02 | The user shall filter rows by status, by "Assigned to me" and by "Has violations", search by vessel, voyage or port, and sort by ETD | M | F-01 |
| FR-03 | Selecting a row shall open a preview with bay fill, stability, open violations by rule and recent activity | S | F-01 |
| FR-04 | "Open plan" shall load the plan into the workspace at its own URL | M | F-01 |
| FR-05 | "New plan" shall create a Draft plan for a chosen vessel, voyage and port from that vessel's arrival condition | S | F-01 |

### Workspace shell

| ID | Requirement | Priority | PRD |
| --- | --- | --- | --- |
| FR-06 | The workspace shall show the top bar, load list, center view, details panel, bay navigator and stability strip on one screen at 1440 x 900 and 1920 x 1080, with side panels fixed at 320 px | M | F-02 |
| FR-07 | Each side panel shall collapse to a 40 px rail and expand again | M | F-02 |
| FR-08 | The center view shall switch between 3D, Bay and Split, and in Split the user shall resize the two parts | M | F-02 |
| FR-09 | The top bar shall show vessel and voyage, the port rotation with the current port marked, plan status, planned count, and Undo, Redo, Validate and Save | M | F-02 |
| FR-10 | The bay navigator shall show deck and hold fill per bay, mark bays with violations, and jump to a bay on click | M | F-02 |
| FR-11 | The user shall switch between the dark and light theme, and the choice shall persist | S | F-16 |

### Load list

| ID | Requirement | Priority | PRD |
| --- | --- | --- | --- |
| FR-12 | The load list shall show container ID, type, weight, POD and flags for reefer and dangerous goods, in 32 px rows | M | F-03 |
| FR-13 | The user shall search, filter by POD, type, reefer, DG and unplanned only, and sort by any column | M | F-03 |
| FR-14 | The list shall render only the visible rows, so 1,240 rows scroll without dropped frames | M | F-03 |
| FR-15 | The user shall select several rows, and the footer shall show the selected count and total weight | M | F-03 |
| FR-16 | Selecting a planned row shall select its container in the 3D view and the bay view | S | F-03 |
| FR-17 | With a row focused, Enter shall pick up that container and move focus to the bay grid | M | F-06, F-17 |

### 3D view

| ID | Requirement | Priority | PRD |
| --- | --- | --- | --- |
| FR-18 | The 3D view shall draw the hull, the deckhouse and every placed container at its slot position, using instanced meshes | M | F-04 |
| FR-19 | The user shall orbit, pan and zoom, and choose the camera presets Iso, Port, Starboard, Top and Bow, with a 600 ms camera move | M | F-04 |
| FR-20 | The user shall color containers by POD, weight, type or violation status, with a legend for the active mode | M | F-04 |
| FR-21 | The user shall toggle hull transparency and show only the containers for one POD | M | F-04 |
| FR-22 | Hover shall show a tooltip with ID, slot, type, weight and POD. Click shall select the container and open the Inspector | M | F-04 |
| FR-23 | The view shall open a gap at the selected bay in 400 ms and label the bay | S | F-04 |
| FR-24 | When WebGL 2 is not available, the view shall show a message and a button that opens the bay view | M | F-04, F-17 |
| FR-25 | While the 3D code loads, the view shall show the loading skeleton from the design | S | F-04 |

### Bay view

| ID | Requirement | Priority | PRD |
| --- | --- | --- | --- |
| FR-26 | The bay view shall draw the cross section of the selected bay with row numbers, tier numbers, Port and Starboard labels and the hatch cover line | M | F-05 |
| FR-27 | Each cell shall show one of these states: empty, plug, occupied, selected, focused, valid target, valid with warning, invalid target, locked, has violation, picked-up origin | M | F-05 |
| FR-28 | In the full bay view each occupied cell shall show the last 4 digits of the ID, the POD code and the weight. In Split the cells shall use the compact form | M | F-05 |
| FR-29 | Under each stack the view shall show the total weight and a bar against the stack limit | M | F-05 |
| FR-30 | Previous and next controls shall step through the bays | M | F-05 |

### Placement

| ID | Requirement | Priority | PRD |
| --- | --- | --- | --- |
| FR-31 | A container shall be placed by dragging its load list row onto a bay cell | M | F-06 |
| FR-32 | During a drag the 3D view shall show the next free slot of each stack in the selected bay as a target, and a drop on a target shall place the container | S | F-06 |
| FR-33 | A placed container at the top of its stack shall be moved by dragging its cell to another cell | M | F-06 |
| FR-34 | While a container is held, each next free slot shall be marked valid, valid with warning or invalid, and the hovered slot shall show the reason | M | F-06 |
| FR-35 | A drop on an invalid slot shall be refused: the container returns in 220 ms, the slot shakes once and a message gives the reason | M | F-06 |
| FR-36 | In the bay grid, arrow keys shall move focus between slots, Enter shall pick up or place, and Esc shall cancel | M | F-06, F-17 |
| FR-37 | A live region shall announce the focused slot, its container and the rule result | M | F-17 |
| FR-38 | The 3D view shall show a ghost of the held container at the target slot, green when valid and red when invalid | M | F-06 |
| FR-39 | When several load list rows are selected, placing one shall pick up the next selected row | S | F-06 |

### Rules and violations

| ID | Requirement | Priority | PRD |
| --- | --- | --- | --- |
| FR-40 | The rule engine shall evaluate rules R1 to R6 after every command, on the stacks that the command changed | M | F-07 |
| FR-41 | Validate shall run all rules on the whole plan in a Web Worker and report the number of errors and warnings | M | F-07 |
| FR-42 | The violations panel shall group violations into errors and warnings, filter by severity, and show the rule, message, slot and containers for each | M | F-07 |
| FR-43 | Show shall select the violation, move the camera to its bay and dim every container that is not involved | M | F-07 |
| FR-44 | Each violation shall show a suggested fix when one exists, and Apply fix shall run it as one command. When none exists, the row shall say so | M | F-07 |
| FR-45 | A new violation shall slide in over 160 ms and be announced. A resolved violation shall produce a message with Undo | M | F-07 |

### Inspector

| ID | Requirement | Priority | PRD |
| --- | --- | --- | --- |
| FR-46 | The Inspector shall show the selected container's ID, type, ISO code, weight, POL, POD, reefer set point, DG class and status, and its slot as bay, row and tier | M | F-08 |
| FR-47 | The Inspector shall show the stack weight against its limit and the result of each rule: pass, warning, error or not applicable | M | F-08 |
| FR-48 | Unplace shall return the container to the load list, Lock and Unlock shall toggle the lock, and Swap shall exchange two placed containers. Each action is disabled when BR-03 or BR-04 forbids it | M | F-08 |
| FR-49 | A move of a container that was loaded at an earlier port shall be recorded as a restow and counted in the plan | S | F-08 |

### Stability

| ID | Requirement | Priority | PRD |
| --- | --- | --- | --- |
| FR-50 | The stability strip shall always show GM, trim, list and bending moment with shear force, each with the state OK, Check or Limit | M | F-09 |
| FR-51 | While a container is held over a slot, the strip shall preview the change in GM, trim and list | M | F-09 |
| FR-52 | After a command, the numbers shall count to the new value in 300 ms | S | F-09 |
| FR-53 | The stability drawer shall show the bending moment and shear force curves with the 85% and 100% lines, the drafts forward, mid and aft, gauges for GM, trim and list, and the hydrostatic values | M | F-09 |
| FR-54 | The strength curves shall change with the weight per bay | S | F-09 |

### Port playback

| ID | Requirement | Priority | PRD |
| --- | --- | --- | --- |
| FR-55 | The port timeline shall show one stop per port with the number of containers discharged and the restow moves | S | F-10 |
| FR-56 | Selecting a stop shall hide the containers already discharged and lift the containers for that port, 20 ms apart, deck before hold. Play shall step through the ports | S | F-10 |

### History

| ID | Requirement | Priority | PRD |
| --- | --- | --- | --- |
| FR-57 | Place, move, unplace, swap, lock and apply fix shall each be one command with an inverse. Undo shall use Ctrl or Cmd + Z, and redo shall add Shift | M | F-11 |
| FR-58 | Each command shall add an entry to the plan's activity log | S | F-11 |

### Save, versions and review

| ID | Requirement | Priority | PRD |
| --- | --- | --- | --- |
| FR-59 | Save shall send the plan with its base version. On success the version rises by one | M | F-12 |
| FR-60 | If the server holds a newer version, Save shall be refused, the local commands shall be kept, and the user shall choose to review the changes or retry | M | F-12 |
| FR-61 | Unsaved commands shall be kept in the browser and restored after a reload | S | F-12 |
| FR-62 | "Send for review" shall set the status to In review. Approve shall be enabled only for the senior planner role and only with zero errors. Return shall set the status to Draft and require a comment | S | F-13 |
| FR-63 | An approved plan shall be read only. "Revise" shall create a new Draft version | S | F-13 |

### Import, export and motion

| ID | Requirement | Priority | PRD |
| --- | --- | --- | --- |
| FR-64 | "Import load list" shall read a JSON file, check each row (ID format, type, weight range, POD in the rotation) and list the rejected rows with the reason | S | F-14 |
| FR-65 | Export shall download an approved plan as JSON in the same schema | C | F-15 |
| FR-66 | With reduced motion set, every animation shall be replaced by an instant change or a 100 ms fade | M | F-17 |

## Rule specifications

Six rules run in the rule engine: five give an error and one gives a warning. Each rule is a pure function of the plan and the vessel.

| Rule | Severity | Violated when | Message format | Suggested fix |
| --- | --- | --- | --- | --- |
| R1 Stack weight | Error | The weights in one stack add up to more than the limit: 90.0 t on deck, 210.0 t in the hold | Stack 18-04 deck: 96.4 t of 90.0 t limit | Move the top container to the nearest valid slot, same bay first |
| R2 Reefer power | Error | A reefer sits in a slot without a plug | Reefer NSPU 220417 3 at 220610 has no plug | Move it to the nearest valid slot with a plug |
| R3 DG segregation | Error | Two containers with incompatible classes are neighbours: left, right, above, below, or the same row and tier in the next bay | IMDG 3 next to IMDG 5.1 in bay 14 | Move one of the two to a valid deck slot at least two bays away |
| R4 Overstow | Error | A container has one or more containers above it that go to a later port. Restows = the number of those containers | Colombo box under Rotterdam box at 100382, 2 restow moves | Reorder the stack so later ports sit lower, as one command |
| R5 20ft and 40ft | Error | A 20ft sits directly on a 40ft, or a 40ft sits on 20ft containers and one half below is empty | 20ft NSPU 318204 6 at 290284 sits on 40ft stack in bay 30 | Move it to a valid slot on a 20ft stack or on the lowest tier |
| R6 Heavy over light | Warning | A container is more than 10.0 t heavier than the one directly below | Heavy over light at 460612: 30.2 t above 8.4 t | Swap the two containers |

A fix is offered only when the command creates no new error. Violations sort errors first, then in rule order R1 to R6.

### Placement check

The placement check answers one question: can this container go into this slot? It runs in this order and stops at the first structural failure.

1. The slot exists in the bay geometry.
2. The slot is empty, apart from the container being moved.
3. The slot is the lowest tier of its stack, or the slot directly below is filled.
4. Rules R1 to R5 are tested on the stack as it would be after the drop. Any failure makes the slot invalid, and the first failure is the reason shown.
5. Rule R6 is tested. A failure makes the slot valid with a warning.

The result holds: target yes or no, valid yes or no, the list of errors, the list of warnings, the new stack weight and the limit.

### Sample segregation table

The sample uses four incompatible pairs. This is demonstration data, not the IMDG segregation table.

| Class | Must not sit next to |
| --- | --- |
| 3 Flammable liquids | 5.1, 2.1, 1.4 |
| 5.1 Oxidizing substances | 3, 2.1 |
| 2.1 Flammable gases | 3, 5.1 |
| 1.4 Explosives | 3 |

### Golden fixture

The seeded sample plan shall always give these 7 violations. This is the main regression test for the rule engine.

| # | Rule | Slot | Detail |
| --- | --- | --- | --- |
| 1 | R1 Stack weight | 180488 | Stack 18-04 deck at 96.4 t of 90.0 t |
| 2 | R2 Reefer power | 220610 | NSPU 220417 3 has no plug |
| 3 | R3 DG segregation | 140284 and 140484 | IMDG 3 next to IMDG 5.1 |
| 4 | R4 Overstow | 100382 | Colombo under Rotterdam, 2 restows |
| 5 | R4 Overstow | 420882 | Jebel Ali under Hamburg, 1 restow |
| 6 | R5 20ft and 40ft | 290284 | NSPU 318204 6 on a 40ft stack in bay 30 |
| 7 | R6 Heavy over light | 460612 | 30.2 t above 8.4 t |

## Stability model

Stability is a simplified estimate, recalculated from the whole plan after every command, so undo and redo can never drift. It is not a loading computer.

For each placed container i with weight w, position x along the ship, y across it and z above the keel:

```latex
\begin{aligned}
\Delta &= \Delta_0 + \sum_i w_i \\
KG &= \frac{\Delta_0\,KG_0 + \sum_i w_i z_i}{\Delta} \\
GM &= KM - KG \\
\text{trim} &= \text{trim}_0 + \frac{\sum_i w_i\,(LCF - x_i)}{100 \cdot MTC} \\
\text{list} &= \arctan\!\left(\frac{M_0 + \sum_i w_i y_i}{\Delta \cdot GM}\right) \\
T_{mean} &= T_{ref} + \frac{\Delta - \Delta_{ref}}{100 \cdot TPC} \\
T_{fwd} &= T_{mean} - \tfrac{1}{2}\,\text{trim}, \qquad T_{aft} = T_{mean} + \tfrac{1}{2}\,\text{trim}
\end{aligned}
```

Trim is positive by the stern and list is positive to port. The four base values (displacement, KG, trim and heeling moment without containers) are solved once from the seeded plan, so that plan reads exactly the reference values below.

| Constant | Value | Source |
| --- | --- | --- |
| Reference displacement | 98,420 t | Prototype |
| KM | 17.46 m | Prototype |
| Reference KG | 15.62 m | Prototype |
| MTC, moment to change trim | 1,150 t m per cm | Prototype |
| LCF, from the middle of the cargo length | 4.0 m aft | Prototype |
| Reference mean draft | 12.41 m | Prototype |
| Summer draft | 14.50 m | Prototype |
| TPC, tonnes per cm of sinkage | 125 t per cm | Assumed from the hull size |
| Shear force limit | 15,000 t | Assumed |
| Bending moment limit | 550,000 t m | Assumed |

The seeded plan shall read: GM 1.84 m, trim 0.62 m by the stern, list 0.4 degrees to port, draft forward 12.10 m, draft aft 12.72 m, bending moment 78% and shear force 64%.

| Value | Check | Limit |
| --- | --- | --- |
| GM | Under 1.40 m | Under 1.20 m |
| Trim, either direction | Over 1.00 m | Over 1.50 m |
| List, either side | Over 0.3 degrees | 2.0 degrees or more |
| Bending moment, shear force | Over 85% | Over 100% |

### Strength curves

The reference curves have 61 stations along the ship and peak at 78% for bending moment and 64% for shear force. The production build adds the effect of the plan in four steps.

1. Take the change in weight per bay between the current plan and the seeded plan.
2. Balance that change with sinkage and trim, so the net force and the net moment are zero.
3. Integrate along the ship once for the change in shear force and twice for the change in bending moment.
4. Divide by the assumed limits and add the result to the reference curves.

### Drag preview

The preview during a drag is the difference between the model run on the plan with the candidate command and the model run on the current plan. It uses the same function as the committed result.

## Interfaces

The app talks to ten HTTP endpoints. In version 1 a mock in the browser answers them, with the same contract a real server would have.

| Method and path | Purpose | Success | Errors |
| --- | --- | --- | --- |
| GET /api/plans | List port calls. Query: status, q, mine, hasViolations, sort | 200, plan summaries |  |
| POST /api/plans | Create a Draft plan | 201, plan | 422 invalid input |
| GET /api/plans/:id | Load one plan with placements and version | 200, plan | 404 not found |
| PUT /api/plans/:id | Save. Body: baseVersion and the commands since that version | 200, new version | 409 newer version exists, 422 a command breaks a rule |
| POST /api/plans/:id/status | Change status. Body: to, comment | 200, plan | 403 role not allowed, 409 errors remain |
| GET /api/plans/:id/load-list | Containers to load at this port call | 200, load list items | 404 |
| POST /api/plans/:id/load-list/import | Import rows from a file | 200, accepted count and rejected rows with reasons | 422 file is not valid JSON |
| GET /api/plans/:id/activity | Activity log | 200, entries | 404 |
| GET /api/plans/:id/export | Download an approved plan | 200, JSON file | 409 plan is not approved |
| GET /api/vessels/:id | Geometry, limits and hydrostatics | 200, vessel | 404 |

Every error response has the same shape: a code, a message for the user and optional details. A 409 on save also returns the current version, who saved it and when.

Mock behavior:

- Mock Service Worker answers the requests with a delay of 150 to 400 ms.
- Plans are kept in IndexedDB, so saved work survives a reload.
- A developer switch forces the next save to return 409, so the conflict flow can be shown in a demo.

### Load list file

| Field | Type | Rule |
| --- | --- | --- |
| id | Text | 4 letters, 6 digits and 1 check digit, for example NSPU 482913 5. Unique in the file |
| type | Text | One of 20GP, 40GP, 40HC, RF, TK, OT |
| weightT | Number | Between 2.0 and 35.0 |
| pod | Text | A port later in the rotation than the current port |
| reeferSetPointC | Number | Required when type is RF |
| imdgClass | Text | Optional. A class from the segregation table, or another IMDG class |

Version 1 checks the format of the ID only. The sample IDs use a fictional owner prefix, so the ISO 6346 check digit is not verified.

## Non-functional requirements

The 25 non-functional requirements each have a target and a way to check it. Performance targets use a benchmark vessel with 10,000 containers, about four times the sample.

### Performance

| ID | Requirement | Target | Checked by |
| --- | --- | --- | --- |
| NFR-01 | Frame rate while orbiting the 3D view | 55 fps or more on a mid-range laptop with integrated graphics | Benchmark route with a frame counter |
| NFR-02 | Target marks after pick-up | Visible bay marked within 100 ms | Performance test |
| NFR-03 | Rule check after one command | Under 10 ms | Benchmark in Vitest |
| NFR-04 | Full validation in the worker | Under 200 ms, with no main thread task over 50 ms | Benchmark and a long task observer |
| NFR-05 | Draw calls for the ship scene | Under 50 | Renderer info in the benchmark |
| NFR-06 | JavaScript size | Plans route 200 kB gzip or less. 3D code in its own chunk, 350 kB gzip or less | Bundle size check in CI |
| NFR-07 | First load of the plans route | Largest Contentful Paint under 2.5 s on fast 4G, Lighthouse performance 90 or more | Lighthouse CI |
| NFR-08 | Memory | Heap grows less than 10% after 200 commands and 200 undos | Playwright memory test |

### Accessibility

| ID | Requirement | Target | Checked by |
| --- | --- | --- | --- |
| NFR-09 | Standard | WCAG 2.2 level AA, with no critical or serious findings | axe on both routes and both themes, plus a manual checklist |
| NFR-10 | Keyboard | Every function works without a pointer, with no focus trap and a logical order | End-to-end test with keyboard only |
| NFR-11 | Contrast | Text 4.5:1 or more, controls and focus ring 3:1 or more | Token contrast test |
| NFR-12 | Meaning without color | Every status has an icon and text. Every container shows its POD code | Component tests |
| NFR-13 | Target size | 24 x 24 px or more | Component tests |
| NFR-14 | Announcements | Slot descriptions are polite, refused drops are assertive. The 3D canvas has a text alternative that points to the bay grid | Screen reader check with NVDA and VoiceOver |
| NFR-15 | Motion | The reduced motion setting is honored everywhere | End-to-end test with the setting on |

### Reliability and security

| ID | Requirement | Target | Checked by |
| --- | --- | --- | --- |
| NFR-16 | Unsaved work | Survives a reload or a crash | End-to-end test |
| NFR-17 | 3D failure | An error in the 3D view does not break the workspace | Error boundary test |
| NFR-18 | Request failure | Every failed request shows a message with Retry | Tests with forced errors |
| NFR-19 | Imported files | Parsed as data only. Text from a file is shown as text, never as markup | Import tests with hostile input |
| NFR-20 | Secrets | None in the client bundle | Review |

### Maintainability and compatibility

| ID | Requirement | Target | Checked by |
| --- | --- | --- | --- |
| NFR-21 | Types | TypeScript strict mode, no "any" in the domain layer | Type check in CI |
| NFR-22 | Layering | The domain layer imports nothing from React, three.js or the DOM | Lint rule |
| NFR-23 | Test coverage | Domain 90% of lines or more, whole app 70% or more | Coverage report in CI |
| NFR-24 | Pipeline | Lint, type check, unit, end-to-end, axe and bundle size run on every push | GitHub Actions |
| NFR-25 | Browsers | Latest two versions of Chrome, Edge, Firefox and Safari at 1280 x 720 or larger | Playwright on three engines |

## Test plan and acceptance

Tests run at five levels, and version 1 is accepted when the ten scenarios below pass in CI.

| Level | Tool | Covers |
| --- | --- | --- |
| Unit | Vitest | Each rule at its boundary, the placement check order, fix suggestions, the stability model, slot geometry, the golden fixture |
| Property | Vitest with fast-check | Any command followed by its inverse returns the same plan. Incremental checks give the same violations as full validation |
| Component | React Testing Library | Cell states, load list filters and sort, Inspector actions, gauges, messages |
| End to end | Playwright | The ten acceptance scenarios, on Chromium, Firefox and WebKit |
| Quality | axe, Lighthouse CI, bundle size check | NFR-06, NFR-07 and NFR-09 |

Boundary values the unit tests shall cover:

- A deck stack at exactly 90.0 t passes, and 90.1 t fails.
- A container exactly 10.0 t heavier than the one below passes, and 10.1 t gives a warning.
- GM at exactly 1.20 m is not at Limit. List at exactly 2.0 degrees is at Limit.

| ID | Scenario | Expected result |
| --- | --- | --- |
| AT-01 | Open MV Nusantara Pioneer 042W from the plans list | The workspace shows 312 of 1,240 planned, 2,740 containers on board and 7 violations |
| AT-02 | Drag NSPU 551208 4 onto slot 180688 | The drop is refused with "Stack limit: 96.4 t of 90.0 t" and the load list is unchanged |
| AT-03 | With the keyboard only: pick up a load list row, place it in the bay grid, save | The container is placed, the planned count rises by 1 and the version rises by 1 |
| AT-04 | Apply the fix for the stack weight violation, then undo | Violations go from 7 to 6 and stack 18-04 reads 79.3 t. After undo there are 7 again |
| AT-05 | Force a version conflict, then save | A message shows who saved and when. The local commands are still in the history |
| AT-06 | Try to approve as planner, then as senior planner with errors, then after all errors are fixed | Not offered, then disabled, then the status becomes Approved and the plan is read only |
| AT-07 | Open port playback | The Colombo stop shows 2 restows and the Jebel Ali stop shows 1 |
| AT-08 | Load the workspace with WebGL turned off | A message offers the bay view, and placement still works there |
| AT-09 | Turn on reduced motion and place a container | No transition runs longer than 100 ms |
| AT-10 | Import a file with 10 rows, 3 of them invalid | 7 rows are accepted and 3 are listed with a reason each |

## Traceability

Every PRD feature maps to requirements, business rules and at least one test.

| PRD feature | Requirements | Business rules | Tests |
| --- | --- | --- | --- |
| F-01 Plans list | FR-01 to FR-05 | BR-14 | AT-01, component tests |
| F-02 Workspace | FR-06 to FR-10 |  | AT-01, component tests |
| F-03 Load list | FR-12 to FR-16 |  | Component tests, NFR-02 |
| F-04 3D ship view | FR-18 to FR-25 |  | AT-08, NFR-01, NFR-05 |
| F-05 Bay view | FR-26 to FR-30 | BR-01 | Component tests, geometry unit tests |
| F-06 Place and move | FR-17, FR-31 to FR-39 | BR-02, BR-03, BR-04, BR-11 | AT-02, AT-03 |
| F-07 Rule checks and violations | FR-40 to FR-45 | BR-05 to BR-10 | Golden fixture, rule unit tests, AT-04 |
| F-08 Inspector | FR-46 to FR-49 | BR-03, BR-04, BR-17 | Component tests |
| F-09 Stability | FR-50 to FR-54 | BR-12, BR-13 | Stability unit tests |
| F-10 Port playback | FR-55, FR-56 | BR-08 | AT-07 |
| F-11 Undo and redo | FR-57, FR-58 |  | Property tests, AT-04 |
| F-12 Save and versions | FR-59 to FR-61 | BR-16 | AT-05 |
| F-13 Review and approval | FR-62, FR-63 | BR-14, BR-15 | AT-06 |
| F-14 Import load list | FR-64 |  | AT-10 |
| F-15 Export approved plan | FR-65 | BR-15 | Unit test |
| F-16 Light and dark theme | FR-11 |  | NFR-11 contrast test |
| F-17 Accessibility | FR-17, FR-24, FR-36, FR-37, FR-66 |  | AT-03, AT-08, AT-09, NFR-09 to NFR-15 |
