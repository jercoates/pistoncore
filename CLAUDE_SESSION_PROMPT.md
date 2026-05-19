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

---

# File Editing Rule — Non-Negotiable

**Jeremy does not edit files manually. He will only add content to the top or bottom
of a file. Any change that requires editing the middle of a file must be delivered
as a complete replacement file. No diffs, no line-number instructions, no partial
patches. If it needs a middle edit, write the whole file.**

**Do not write any file until all necessary files for that task have been read first.
If a fix requires seeing file X, read file X before writing anything.**

---

# Wizard Priority Rule — Current Focus

**THE WIZARD IS THE CURRENT FOCUS. Everything else is deferred until every wizard
menu works correctly and matches WebCoRE's user-facing flow.**

**WebCoRE match rule (permanent):**
Match WebCoRE exactly for all dialog flow, field behavior, and data collection.
PistonCore improvements are fine for: globals accessible from anywhere (top bar),
debug/log screen, and main screen layout. Those are upgrades, not regressions.

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

## Project Status — Session 46 Complete

### What Was Done in Session 46

**editor.js — 3 fixes:**
- Scroll fixed: `flex:1;overflow-y:auto;min-height:0` added inline to `editor-doc` div. Confirmed working.
- Device variable `= value` suppression: define block skips `valueStr` when `var_type === 'device'`.
  This fix was documented in S45 but never landed in the file.
- Aggregation `Any of` always shown: `isDeviceSubj` check added so `Any of` always renders
  for device conditions. Non-device subjects still suppress it when aggregation is `any`.
- GAP-S45-2 confirmed already clean — no `{ }` text in _renderConditionBlock.

**wizard.js — split into 6 files (DEPLOYED and working):**
- wizard-core.js, wizard-statement.js, wizard-condition.js, wizard-loops.js,
  wizard-action.js, wizard-variable.js
- Shared state exposed via `window.WizardCore` with getter/setter properties
- Public API unchanged: `Wizard.open()` and `Wizard.close()`
- Delete button added to `_goVariablePicker` footer when `_editNode` is set (GAP-S46-1 CLOSED)

**index.html updated** — 6 new script tags replace the single wizard.js tag. Load order critical:
wizard-core.js first, then statement/condition/loops/action/variable.

**Globals situation assessed:**
- GlobalsDrawer.open() called from list.js but object does not exist
- No backend API endpoints for globals
- No globals storage
- Imported pistons with globals dump them into piston variables (GAP-S46-4)
- Full globals system is 4 sessions of work (G-1 through G-4 in TASKS.md)

**Priorities realigned for remainder of project:**
1. Vertical structure lines (W-S7) — biggest visual gap
2. Role mapping + wizard smoke test (W-S8)
3. Globals system end-to-end (G-1 → G-2 → G-3 → G-4)
4. Compile/deploy smoke test (S3-1) — only after globals and role mapping work

---

### Priority order for next session (W-S7):

1. Vertical structure lines in editor.js — CSS border-left connector lines on indented
   block containers matching WebCoRE sidebar style. Apply to all block types.
   Pure editor.js change, no backend needed.

Upload for next session:
editor.js, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## What Was Done in Session 44 (W-S5)

**editor.js and wizard.js — rendering and wizard pre-fill fixes.**

editor.js: `_condLine()` flat-field normalization (GAP-S43-3 CLOSED), group object guard,
`_subj()` null-safe, `if` renderer reverted to `then`/`else` (matches WebCoRE + spec).

wizard.js: `_condId()` helper added (cond_ prefix for condition IDs),
`_buildConditionNode()` uses it, `_route()` edit-condition pre-fill handles
flat-field imported conditions.

GAP-S40-1 and GAP-S40-2 verified CLOSED.
New gap: GAP-S44-1 (group editing) → W-S7.

---

## What Was Done in Session 43 (S2-4 — Import Role Mapping)

POST /pistons/import implemented (api.py). API.importPiston() added (api.js).
Import paste modal + "Rebuild piston items" role mapping dialog implemented in
list.js matching WebCoRE flow. Ignore skips to editor, Continue saves device_map.
api.py import endpoint creates device variable entries from device_map roles
(safety net — ensures define block is populated on import).
Gaps: GAP-S43-1 (CLOSED S45), GAP-S43-2 (partial), GAP-S43-3 (CLOSED S44),
GAP-S43-4 (S2-3), GAP-S43-5 (CLOSED S45).

---

## Nested Tree Model — Summary (Sessions 35-37)

The statements array is a nested tree. Control flow nodes own their children directly.
`then`, `else`, `statements`, `else_ifs`, and `cases` contain child statement objects.
No ID references between statements anywhere.

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

AI-generated pistons must use `__placeholder_<domain>__` for all entity IDs in
device_map (e.g. `"Kitchen Light": ["__placeholder_light__"]`). Never invent
real entity IDs. The import flow detects placeholders and fires the role mapping dialog.

---

## Build Target — Docker Now, Addon Last

**Current build target is Docker.** Addon packaging comes last.

---

## V1 Definition Rule

**If it is not explicitly deferred to v2 or v3 in the specs, it is v1.**

**`when true` / `when false` per-condition sub-blocks** — Deferred to v2.
These are per-condition action branches (TCP/TEP) visible in WebCoRE. Jeremy does
not use them. They add significant complexity. Do not implement in v1.

---

## Reference Folder

The repo contains a `reference/` folder with session handoff notes and captured
decisions. Move processed files there, don't delete them.

---

## Deploy Commands

```bash
cd /mnt/user/appdata/pistoncore-dev
git pull
docker build --no-cache -t pistoncore .
docker stop pistoncore && docker rm pistoncore
docker run -d \
  --name pistoncore \
  --restart unless-stopped \
  -p 7777:7777 \
  -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata \
  -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize \
  pistoncore
```

Note: always use `--no-cache` on the build step or browser cache will serve old JS.

---

## Template Rule — Non-Negotiable

**ALL HA YAML syntax must go through Jinja2 templates in the customize volume.**
Never emit HA YAML structure as Python inline strings in compiler methods.

---

## Code Review Requirement — Every Coding Session

After writing or modifying any code, before ending the session, Claude must:

1. Review all changed functions for gaps between what the code does and what the spec requires.
2. Review all call sites of changed functions for broken callers not yet updated.
3. Check for any implicit assumptions in the new code not confirmed by the spec.
4. For each gap found: fix it now if it fits the current session scope, or add
   it to TASKS.md as a named gap entry (GAP-SXX-N format).
5. Report all gaps found (fixed or deferred) before closing the session.

**Gap Assignment Rule — Non-Negotiable:**
Every gap must be assigned to the most logical future session before this session
closes. Assign to the right one — wrong assignment forces unnecessary file loading.

This is not optional. A session that produces code without a gap review is incomplete.

---

## Communication Style

Jeremy works two jobs and codes in limited sessions. He has no formal
programming background. Direct and concise. Plain language over technical
jargon. Show proposed changes as text before writing files. Humor is welcome.

When something is unclear, ask one question — not five.

Redirect the session: vertical structure lines in editor.js are the next priority (W-S7).
The wizard.js split is complete and deployed. Do not revisit it.
## Spec Debt — Address After W-S8

The following spec files are known outdated (per Grok audit May 2026).
Do not fix these during code sessions. Each needs its own dedicated doc session.

- FRONTEND_SPEC.md — HIGH. Wizard split, editor fixes, globals drawer status.
- WIZARD_SPEC.md — Mark as deprecated, WIZARD_REBUILD_SPEC.md supersedes it.
- COMPILER_SPEC.md — Backend is ahead of this doc. Needs a pass after S3-1.
- PROGRESS_TRACKER.md — Low effort. Just needs recent session entries added.
- write-a-piston.md — Still a placeholder. Must be written against nested tree model
  before AI prompt files can be used. See AI_PROMPT_SPEC.md for requirements.
  
  
  Important note from Grok
 # Grok Audit — Wizard Split Review (May 2026)

## Overall Assessment
Good progress — splitting was the right move. Code is now much more maintainable.
Current state: Functional but fragile / incomplete.

## What's Working Well
- Clean separation of concerns (core, condition, action, loops, variable, statement)
- wizard-core.js holds shared state and helpers solidly
- Routing and modal rendering logic looks stable
- Major flows (condition builder, action picker, variable) are present
- Flat-field condition handling for imports preserved

## Major Issues / Risks

**1. State Sharing is Dangerous**
All files directly mutate WizardCore.sel, WizardCore.context, etc.
Works for now but easy to break with race conditions or stale closures.

**2. Missing Coordination Between Files**
Functions like _goConditionBuilder(), _goActionDevicePicker(), _goVariablePicker()
are defined across files but called from wizard-core.js. If any file fails to load
or has a syntax error, the whole wizard dies silently with no indication of which
file caused the problem.

**3. Import / Edit Round-trip Still Weak**
Flat-field condition normalization exists but looks incomplete in some paths.
kitchen_motion_test2.json likely still has rendering/editing issues because
_buildConditionNode and _commitCondition don't perfectly match what the editor
renderer expects.

**4. Globals & Device Mapping**
Globals barely started (just drawer stub). Role mapping on import is partially
there but fragile.

**5. Error Handling & Edge Cases**
Very little defensive coding (null checks, fallbacks). Large functions still exist
especially in condition and action files.

## Grok's Recommendation
Don't touch anything else yet. Stabilize what you have first.

## Quick Test Plan (do before next code session)
1. Create new simple piston → Add if block → Add condition with real device
2. Import kitchen_motion_test2.json → Does it render cleanly? Can you edit conditions?
3. Add action with real device → Does command picker work?
4. Try adding a variable
Document exactly what breaks or feels wrong.

---

## Prompt for Wizard Stabilization Session (use before W-S7)

Add this as a session between W-S7 (vertical lines) and W-S8 (smoke test):

```
Review the split wizard files (wizard-core.js, wizard-condition.js, wizard-action.js,
wizard-loops.js, wizard-statement.js, wizard-variable.js).

Current problems identified by code review:
- State sharing across files is risky — all files mutate WizardCore.sel directly
- Some flows don't fully support imported pistons (flat condition format)
- Missing robustness and null safety

Tasks:
1. Add null-safety and defensive coding in key functions:
   _buildConditionNode, _commitCondition, device picker flows, _loadCapsIntoSelect
2. Make sure editing an existing condition from an imported piston works correctly
   end-to-end (flat-field format → pre-fill → save → correct JSON output)
3. Add console.log statements at the start of all major _go* functions so we can
   trace the flow when things break
4. Fix any obvious bugs found during the review

Output the updated files that need changes plus a short summary of what was fixed.

Upload: wizard-core.js, wizard-condition.js, wizard-action.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, STATEMENT_TYPES.md, PISTON_FORMAT.md,
CLAUDE_SESSION_PROMPT.md, TASKS.md
```

---

## Notes for TASKS.md
Add a new task W-S7b (between vertical lines and smoke test):

**W-S7b: Wizard Stabilization + Debug Logging**
- Null safety pass on _buildConditionNode, _commitCondition, device picker flows
- Verify imported piston condition edit round-trip works end-to-end
- Add console.log at start of all _go* functions for debug tracing
- Fix obvious bugs found during review
- Do NOT add features — stabilize only