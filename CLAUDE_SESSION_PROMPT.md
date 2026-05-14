# PistonCore — Claude Session Prompt
**Project:** PistonCore — open-source WebCoRE-style visual automation builder for Home Assistant
**Repo:** github.com/jercoates/pistoncore
**Stack:** Python/FastAPI backend, Vanilla JS/HTML/CSS frontend, no framework
**Deploy:** Docker container (Unraid) — port 7777

---

# Core Mission — Read This First

PistonCore has two equally important goals that must never be confused:

**1. The editor and wizard must feel like WebCoRE.**
Users coming from WebCoRE on Hubitat must be able to move their pistons over
without major relearning. Same concepts, same terminology, same workflow, same
visual structure. If a WebCoRE user has to stop and think "how do I do this in
PistonCore," that's a failure. Match WebCoRE's UI and behavior exactly unless
there is a documented reason not to.

**2. The compiler output must produce the same end-result behavior in HA.**
PistonCore outputs PyScript (complex pistons) or native HA YAML (simple pistons).
The compiled output does not need to look like WebCoRE's Groovy code. It just
needs to do the same thing in practice — same triggers, same logic flow, same
actions, same outcomes.

**The tiebreaker for compiler decisions:** does it produce the right behavior in HA?
**The tiebreaker for UI/wizard decisions:** does it match what WebCoRE users expect?
---

# Non-Negotiable Requirement — Read Before Any Architecture Discussion

**The editor must render from JSON correctly 100% of the time, every time, without fail.**

This is the foundation the entire project rests on. Jeremy opens and edits pistons
constantly. If a piston ever renders incorrectly after an edit — missing statements,
wrong structure, orphaned nodes — the tool has failed at its core purpose.

This requirement overrides any argument about implementation convenience. It is why
the data model was migrated from flat ID references to a nested tree in Session 35.
Do not propose solutions that trade render reliability for implementation simplicity.
---

# Decision Stability Rule

Once a decision is made and documented in a spec, do not revisit or argue against it.

**Exception: if a prior decision breaks the end result the project exists to deliver.**

The nested tree migration in Session 35 is the model for this exception — the flat
model was a documented decision that turned out to break the non-negotiable requirement
above. The decision was correctly reversed.

If Claude finds itself arguing that a documented decision should stay even though it
breaks the non-negotiable requirement, that is wrong. The requirement wins.

If Claude finds itself arguing to revisit a decision for any other reason — preference,
elegance, theoretical correctness — that is wrong. The spec wins.

---

# File Editing Rule — Non-Negotiable

**Jeremy does not edit files manually. He will only add content to the top or bottom
of a file. Any change that requires editing the middle of a file must be delivered
as a complete replacement file. No diffs, no line-number instructions, no partial
patches. If it needs a middle edit, write the whole file.**

---

# Wizard Priority Rule — Current Focus

**THE WIZARD IS THE CURRENT FOCUS. Everything else is deferred until every wizard
menu works correctly and matches WebCoRE's user-facing flow.**

The smoke test (14-step minimum viable piston flow from WIZARD_REBUILD_SPEC.md)
must pass before any Stage 2 backend work resumes.

**WebCoRE match rule (permanent):**
Match WebCoRE exactly for all dialog flow, field behavior, and data collection —
the if/condition/action/task dialogs, the operand picker, the device selector, all of it.
PistonCore improvements are fine for: globals accessible from anywhere (top bar),
debug/log screen, and main screen layout. Those are upgrades, not regressions.
Do not accidentally revert intentional improvements.

**HA Limitations rule (permanent):**
Before adding any WebCoRE operator or feature to the wizard, check HA_LIMITATIONS.md.
XOR and "Followed by" group operators exist in WebCoRE but are NOT implementable in
native HA. Do not add them to the UI. AND and OR only for group operators.

---

## How to Start Every Session

1. Read this file completely before saying anything
2. Ask Jeremy to upload the relevant spec files and code files for what we're working on today
3. Read every uploaded file before writing any code or making any spec changes
4. Show proposed changes as text first — get approval before writing to files
5. Never remove existing spec content without explicit approval
6. Never write code that conflicts with the specs — specs are the authority
---

## Project Status — Session 42 Complete

### What Was Done in Session 42

**editor.js and wizard.js — comprehensive bug fix pass.**

Both files delivered as complete replacements. Deploy both.

**editor.js — 10 bugs fixed:**

1. `then` → `when true` (if branch label — matches WebCoRE exactly)
2. `then` → `when true` inside each else_if branch
3. `else` was hidden behind `node.else.length > 0` guard → `when false` now always
   renders unconditionally with `node.else || []` as safe fallback. Fresh if blocks
   now immediately show both `when true` and `when false` with insertion points.
4. Added `· add a new condition` ghost link to else_if blocks — previously missing,
   you could not add conditions to an else_if
5. `on_event` renderer was using `node.event_name` (field that doesn't exist) →
   now iterates `node.conditions[]` with ⚡ bolts, matching STATEMENT_TYPES.md
6. Aggregation label never rendered — `deviceCount > 1` check used `c.devices`
   which never exists on condition nodes. Now shows aggregation whenever set to
   something other than `any`
7. `display_value` only — condition lines missed values for time/between operators.
   Now falls back `display_value` → `value` → `value_from`, and renders `value_to`
   for between operators
8. `insertStatement` for `else_if_statements` branch crashed silently — added
   `_findElseIf()` helper and dedicated branch handling
9. Clicking an `if` node opened condition editor with `conditions[0]` — now opens
   the statement picker targeting the `then` branch
10. `deleteStatement` was aliased to `_deleteSelected` which ignores its argument —
    wrote a real `deleteStatement(id)` function that takes the id directly

**editor.js — additional fixes found after full audit (Session 42 continued):**

11. Condition lines inside if/while/repeat/on_event blocks had no `id` — they were
    not clickable at all. Now every condition line in the statement tree is rendered
    as a `doc-stmt` with its id and a `parent-block` attribute pointing to its
    owning block.
12. `_findAnyNode` could not find condition nodes inside the statement tree —
    only top-level triggers/conditions were searchable. Added `_findCondition()`
    helper that recursively walks `conditions[]` and `until_conditions[]` inside
    every node. `_findAnyNode` now calls it as a final fallback.
13. Clicking a condition inside an if/while/etc block opened the wrong wizard screen
    and had no parent block context, so saving the edit created a new if block instead
    of updating the existing condition. `_handleDocClick` now reads `data-parent-block`
    from the element and passes it to `_openWizardForEdit`.
14. `_openWizardForEdit` for condition types now opens `if_condition` context with
    the parent `block-id` when the condition lives inside a block — so the wizard
    saves the edited condition back to the correct conditions array.
15. `while` and `repeat` blocks now render `· add a new condition` ghost links
    below their condition lines — previously only if blocks had this link.
16. Clicking the `if` keyword now opens the condition/group picker (to add a
    condition), not the statement type picker. This matches WebCoRE behavior.

**wizard.js — fixes in this session:**

1. Auto-selects first attribute when device is picked and immediately re-renders
   value widget — fixes the giant empty textarea bug when device + operator selected
   but attribute not yet chosen
2. Group builder: AND/OR only (XOR and "Followed by" removed — not implementable
   in HA per HA_LIMITATIONS.md)
3. Group builder: "Whole group negation" field added (Not negated / Negated)
4. Condition builder: `when true`/`when false` labels corrected throughout
5. `on_event` conditions rendered with ⚡ and `· add a new event condition` link
6. Aggregation rendering fixed
7. Condition value fallback chain fixed (display_value → value → value_from)
8. Time condition: `only_on_days` and `only_on_months` checkboxes written to JSON
9. Timer: full scheduling options (at_minute, at_time, days, months checkboxes)
10. Timer: unit re-renders the screen to show/hide at_minute / at_time fields correctly

**wizard.js — fixes from previous session (still in this file):**

- All edit paths fixed — clicking existing nodes opens correct screen for every type
- `_commitCondition`/`_commitConditionAndMore` logic bug fixed — adding condition
  to existing if block no longer creates a new if block
- `when true`/`when false` context preserved through else_if branch insertion
- `else_if_statements` branch routing added to `insertStatement`
- `deleteStatement(id)` called correctly from wizard delete
- Command picker: "Add" for new tasks, "Save" for edits; "Add more" button present
- Location picker: http_request, set_mode, raise_event param fields added
- Virtual/system/demo device sections always visible during action picker search
- "Which interaction" hidden by default, shows only when device selected
- Subject type switching shows correct sub-widget (Variable/Time/Date/Mode)
- `repeat` inserts directly — no fake "N times" count field (WebCoRE repeat has no count)
- `while` inserts node first then opens condition builder
- `switch` shows expression picker before inserting
- `for` shows start/end/step/counter screen before inserting
- `exit` shows value field screen before inserting
- Timer unit dropdown includes all units: ms/s/m/h/d/w/months/years

---

## Next Session Start Instructions

Upload these files:
`CLAUDE_SESSION_PROMPT.md, TASKS.md, WIZARD_REBUILD_SPEC.md, wizard.js, editor.js,
PISTON_FORMAT.md, STATEMENT_TYPES.md`

Then say this word for word:

"This is a wizard UI session. Read everything uploaded completely.
The wizard and editor have had a major bug fix pass in Session 42.
Deploy the new wizard.js and editor.js, build Docker, then run the 14-step
minimum viable piston flow from WIZARD_REBUILD_SPEC.md step by step.
Document exactly which step fails and what happens. Fix only that step.
Do not touch any other file. Do not touch the backend.
The goal is a passing smoke test. Nothing else matters until it passes."

DO NOT CODE UNTIL YOU HAVE RUN THE SMOKE TEST AND KNOW WHAT FAILS.

---

## Known Remaining Wizard Gaps (after Session 42)

Sourced directly from WebCoRE template files (webcore3.txt) — these are confirmed
missing by reading the actual WebCoRE source, not from screenshots or transcripts.

### CRITICAL — Blocks cannot be used without these:

- **GAP-WIZ-1: Switch has no case editor.**
  WebCoRE has `dialog-edit-case`: Case type (Single value / Range), value operand,
  second value operand for Range, footer: "Add a statement" (new) / "Save" (edit).
  PistonCore: you can add a switch block but cannot add any cases to it. The block
  is completely non-functional. This must be fixed before switch is usable.

### MISSING FIELDS — confirmed from WebCoRE templates:

- **GAP-WIZ-2: Condition builder — single device only.**
  WebCoRE operand template uses a multi-select for Physical device(s). A user who
  had "Any of {Front Door, Back Door, Side Door}" in WebCoRE cannot replicate it.
  PistonCore condition builder only picks one device at a time.

- **GAP-WIZ-3: Condition builder — Preset type missing.**
  WebCoRE operand template has type `s` = Preset: Sunrise / Noon / Sunset / Midnight.
  This is extremely common in automations ("happens daily at Sunset"). PistonCore
  has no Preset option in the subject type selector.

- **GAP-WIZ-4: Condition builder — time filter fields incomplete.**
  WebCoRE comparison template shows when subject is virtual "time":
    - "Only on these days of the week" ✓ present in PistonCore
    - "Only on these days of the month" (1-31 + last/second-last/third-last) MISSING
    - "Only on these weeks of the month" (1-5 + last/second-last/third-last) MISSING
    - "Only on these months of the year" ✓ present in PistonCore

- **GAP-WIZ-5: Timer — missing filter fields.**
  WebCoRE `dialog-edit-statement` for `every` type shows conditionally:
    - if ms/s: "Only during these minutes..." (multi-select 0-59) MISSING
    - if ms/s/m: "Only during these hours..." (multi-select 0-23) MISSING
    - if not w/n/y: "Only on these days of the week" ✓ present
    - if not n/y (no owm): "Only on these days of the month" (1-31 + ordinals) MISSING
    - if not n/y (no odm): "Only on these weeks of the month" (1-5 + ordinals) MISSING
    - if not y: "Only on these months of the year" ✓ present
    - if hours unit: "At this minute of the hour" (single select 0-59) ✓ present
    - if weekly unit: "On this day of the week" (single select) MISSING
    - if monthly/yearly unit: "On this day of the month" (two selects) MISSING
    - if yearly unit: "On this month of the year" (single select) MISSING

- **GAP-WIZ-6: Task command picker — "Only during these modes" missing.**
  WebCoRE `dialog-edit-task` has a "Only during these modes" multi-select after
  the command parameters. Lets users restrict a task to specific HA modes.
  PistonCore has no mode restriction field in the command picker.

- **GAP-WIZ-7: Variable picker — "Assignment type" missing.**
  WebCoRE `dialog-edit-variable` shows "Assignment type" (Dynamic / Constant)
  when an initial value is set and the type is not Device. PistonCore omits this.

- **GAP-WIZ-8: For loop — start/end/step are literal numbers only.**
  WebCoRE shows full operand widget (type selector) for start, end, and step —
  users can use variables or expressions, not just literal numbers. PistonCore
  uses plain number inputs.

- **GAP-WIZ-9: Exit — full operand widget missing.**
  WebCoRE `dialog-edit-statement` for `exit` shows a full operand widget for
  "New piston state" (type selector: Value / Variable / Expression / Argument).
  PistonCore shows a plain text input only.

- **GAP-WIZ-10: For each — "List of devices" is free-text, not an operand widget.**
  WebCoRE shows a full operand widget (Physical device / Variable / etc) for the
  device list. PistonCore has a free-text role name field. Acceptable for v1 since
  role names are what the compiler needs, but not a match for WebCoRE.

- **GAP-WIZ-11: Task picker — existing tasks not shown above/below insert point.**
  WebCoRE `dialog-edit-task` shows existing tasks on the action node above and
  below the current insert position, clickable to reorder. PistonCore shows only
  the current task being edited. No way to see or manage multiple tasks.

- **GAP-WIZ-12: PyScript-only statement warning missing.**
  STATEMENT_TYPES.md requires the wizard to display a clear warning when `on_event`,
  `break`, or `cancel_pending_tasks` is added, explaining the blocking/PyScript
  behavior. Not yet implemented.

### Priority order for next wizard session:
1. GAP-WIZ-1 (switch case editor) — blocks are non-functional without it
2. GAP-WIZ-3 (Preset type / Sunrise/Sunset) — extremely common use case
3. GAP-WIZ-2 (multi-device selection in conditions) — core WebCoRE workflow
4. GAP-WIZ-4 (time condition day/week filters) — needed for complete time conditions
5. GAP-WIZ-5 (timer filter fields) — needed for complete timer scheduling
6. GAP-WIZ-6 (task mode restriction) — important but not blocking
7. GAP-WIZ-7 through 12 — lower priority

---

## What Was Done in Session 40 (W-0 + W-S1 through W-S4)

**WIZARD_REBUILD_SPEC.md written.**
Complete spec of every wizard dialog, every field, every JSON output, every device
picker rule, complete 14-step minimum viable piston flow, and 7 bugs in fix order.
Written from WebCoRE source (webcore1.txt, webcore3.txt) against PISTON_FORMAT.md
and STATEMENT_TYPES.md. Now in the repo as authoritative wizard target.

All Stage 2 backend tasks (S2-2 through S2-4) remain deferred until smoke test passes.

---

## What Was Done in Session 39 (S2-1 — HAClient Abstraction)

**ha_client.py rewritten as HAClient class with module-level singleton.**
Auth mode auto-detected. reload_config() added. Bug 26 fixed. Bug 27 fixed.
endpoints.json externalization skipped (decision final).
GAP-S39-1 opened → assigned to S2-2 (deferred).

---

## What Was Done in Session 38 (S2-0 — SQLite Error Logger)

**error_logger.py created. main.py updated.**
GAP-S38-1 opened → assigned to S2-2 (deferred).

---

## What Was Done in Session 37 (S-NESTED Session C)

wizard.js audited and fixed. editor.js updated for GAP-S36-1 and GAP-S36-2.
wait field name fixed. GAP-S27-4 confirmed closed.

---

## What Was Done in Session 36 (S-NESTED Session B)

editor.js fully migrated to nested tree model. No flat statements array.
No stmtMap. No ID references between statements.

---

## Nested Tree Model — Summary (Sessions 35-37)

The statements array is a nested tree. Control flow nodes own their children directly.
`then`, `else`, `statements`, `else_ifs`, and `cases` contain child statement objects.
No ID references between statements anywhere.

---

## What Was Done in Sessions 32-34

S1-6: Fat compiler context assembly. COMPLETE.
S1-7 session 3: COMPLETE. else_ifs, time condition fix, PyScript spec.
S1-8: Template compliance pass. COMPLETE.

---

## Spec File Authority Order

When specs conflict, this is the resolution order:
1. DESIGN.md — philosophy and architecture decisions
2. PISTON_FORMAT.md — canonical data format
3. STATEMENT_TYPES.md — statement-level schemas and render output
4. COMPILER_SPEC.md — compiler behavior (current as of Session 35)
5. PYSCRIPT_COMPILER_SPEC.md — PyScript compiler (written Session 24 — current)
6. FRONTEND_SPEC.md — frontend behavior (current as of Session 24)
7. WIZARD_REBUILD_SPEC.md — wizard rebuild target (written Session 40 — supersedes WIZARD_SPEC.md)
8. HA_LIMITATIONS.md — known HA gotchas — CHECK THIS BEFORE ADDING ANY OPERATOR OR FEATURE
9. AI_PROMPT_SPEC.md — AI prompt file requirements

**WIZARD_REBUILD_SPEC.md supersedes WIZARD_SPEC.md for all wizard behavior.**

---

## AI Prompt File Format Rule — Non-Negotiable

The AI prompt files must be written against the **nested tree model only**.
Any AI generating flat ID-reference JSON will produce pistons that break the editor.

---

## Build Target — Docker Now, Addon Last

**Current build target is Docker.** Addon packaging comes last.

---

## V1 Definition Rule

**If it is not explicitly deferred to v2 or v3 in the specs, it is v1.**

---

## Reference Folder

The repo contains a `reference/` folder with session handoff notes and captured
decisions. Move processed files there, don't delete them.

---

## Reference Documents

- **TASKS.md** — what to work on and in what order (always upload this)
- **WIZARD_REBUILD_SPEC.md** — authoritative wizard target (always upload for wizard sessions)
- **MISSING_SPECS.md** — specs that must be written before certain tasks can be coded

---

```bash
cd /mnt/user/appdata/pistoncore-dev
git pull
docker build -t pistoncore .
docker stop pistoncore && docker rm pistoncore
docker run -d \
  --name pistoncore \
  --restart unless-stopped \
  -p 7777:7777 \
  -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata \
  -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize \
  pistoncore
```

**PISTONCORE_BASE_URL env var:** Set this in docker-compose.yml to your Unraid
server IP so the frontend can reach the backend from other machines on the LAN.
Example: `PISTONCORE_BASE_URL=http://192.168.1.10:7777`

---

## Template Rule — Non-Negotiable

**ALL HA YAML syntax must go through Jinja2 templates in the customize volume.**
Never emit HA YAML structure as Python inline strings in compiler methods.

---

## Code Review Requirement — Every Coding Session

After writing or modifying any code, before ending the session, Claude must:

1. Review all changed functions for gaps between what the code does and what the
   spec requires.
2. Review all call sites of changed functions for broken callers not yet updated.
3. Check for any implicit assumptions in the new code not confirmed by the spec.
4. For each gap found: fix it now if it fits the current session scope, or add
   it to TASKS.md as a named gap entry (GAP-SXX-N format).
5. Report all gaps found (fixed or deferred) before closing the session.

**Gap Assignment Rule — Non-Negotiable:**
Every gap must be assigned to the most logical future session before this session
closes. A gap assigned to the wrong session forces unnecessary file loading and
context switching. Assign to the right one.

This is not optional. A session that produces code without a gap review is incomplete.

---

## Communication Style

Jeremy works two jobs and codes in limited sessions. He has no formal
programming background. Direct and concise. Plain language over technical
jargon. Show proposed changes as text before writing files. Humor is welcome.

When something is unclear, ask one question — not five.
