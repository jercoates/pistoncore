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

## Project Status — Session 45 Complete (W-S6 partial)

### What Was Done in Session 45

Session ran into credit limits and did not complete cleanly. The following
were completed and delivered:

**editor.js — 8 fixes delivered:**

1. `_friendlyCmd()` — new helper converts snake_case command to Title Case.
   `turn_on` → `Turn on`, `set_volume_level` → `Set volume level`.
   Strips domain prefix (`light.turn_on` → `Turn on`).
   Action task lines now render with friendly labels matching WebCoRE.

2. `log_message` — `log "..."` → `do Log message {"..."}` per STATEMENT_TYPES.md Section 16.

3. `wait` (duration) — `wait N unit` → `do Wait N unit` per Section 14.

4. `wait` (until) — `wait until` → `do Wait until` per Section 15.

5. `call_piston` — `execute piston` → `do Execute piston` per Section 17.

6. `cancel_pending_tasks` — `cancel all pending tasks` → `do Cancel all pending tasks` per Section 18.

7. Aggregation — `Any of` now always shown for device conditions.
   Previously suppressed when aggregation was `any`. WebCoRE always shows it.

8. `modified_at` fallback — header now reads `p.modified_at || p.updated_at`.
   Imported pistons use `modified_at`; editor-saved pistons may use `updated_at`.

9. Device variables in define block — `var_type === 'device'` variables never show
   `= value`. Device roles have no meaningful initial value to display.

**list.js — 1 fix delivered:**

10. `_isUnmapped()` helper — import role mapping dialog now fires for placeholder
    entity IDs (`__placeholder_<domain>__`) in addition to empty arrays.
    GAP-S43-1 CLOSED.

**wizard.js — PARTIALLY DELIVERED (session ran out):**

- `_goVariablePicker()` — `initial_value_type` pre-fill fix was written but
  the session faulted during delivery. Verify this landed correctly:
  Device variables created by api.py import have no `initial_value_type` set.
  Opening and saving them should NOT write back an initial value.
  The fix: only use stored `initial_value_type` if explicitly present on `_editNode`.

- Delete button on variable edit dialog — was to be added this session.
  Confirm it is present in the delivered wizard.js before testing.

**Condition brackets — NOT DONE. Wrong approach identified:**
The `{ }` text characters added to `_renderConditionBlock` this session are WRONG
and must be removed next session. WebCoRE uses CSS vertical sidebar lines (visual
block connectors like a code editor), NOT literal `{ }` characters in the text.
This is a CSS rendering feature, not text content. See the red-circled lines in
the WebCoRE screenshot — they are drawn borders on the left side of indented blocks.

**Scroll broken in editor — not investigated this session.**

**Compile/deploy path not yet testable:**
Device_map still has placeholder entity IDs after import. Role mapping dialog
must complete successfully AND save real entity IDs before any compile test works.
This path has not been verified end-to-end yet.

---

### Gaps from Session 45

**GAP-S45-1 → S4-16:** `set_variable` wizard does not normalize `$` prefix.
If user types `$varName` in the variable name field, editor renders `$$varName`.
Low priority. Fix in S4-16.

**GAP-S45-2 → W-S6 continuation:** Condition bracket rendering is wrong.
`{ }` text characters must be removed from `_renderConditionBlock`.
Replace with CSS vertical connector lines matching WebCoRE sidebar style.
This is a pure CSS/HTML rendering change in editor.js.

**GAP-S45-3 → W-S6 continuation:** Scroll broken in editor — not investigated.
Likely a CSS overflow issue on the editor-doc container. Investigate and fix.

**GAP-S45-4 → W-S6 continuation:** Compile/deploy test path not yet verified.
Role mapping flow must be tested end-to-end with a real piston before
any compile test is attempted. Add explicit task to TASKS.md.

---

### Priority order for next session (W-S6 continuation):

1. Verify wizard.js Delete button on variable edit dialog is present and working
2. Remove `{ }` text brackets from `_renderConditionBlock` (GAP-S45-2)
   Replace with CSS vertical sidebar connector lines matching WebCoRE
3. Fix scroll broken in editor (GAP-S45-3)
4. Verify role mapping flow end-to-end with kitchen_motion_test2.json (GAP-S45-4)
5. GAP-S44-1 — group condition editing (low priority, if time)

**Do not attempt smoke test. Rendering and role mapping must work first.**

Upload for next session:
editor.js, wizard.js, list.js, STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

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

Redirect the sesion: FIX THE LOCKING UP PROBLEM
The file size problem — the fix going forward is to split wizard.js into smaller files by dialog group. That's a one-session refactor that would make every future session faster and more reliable. Worth doing before the next round of fixes.
