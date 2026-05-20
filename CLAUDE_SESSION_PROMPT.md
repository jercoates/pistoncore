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

## Project Status — Session 47 Complete

### What Was Done in Session 47 (W-S7)

**Vertical structure lines — editor.js + style.css:**
- Added `bOpen(indentLevel)` / `bClose()` helpers in `_actionLines` that wrap each
  block's full content (including opening and closing keyword lines) in a
  `<div class="doc-block-body" data-indent="N">` wrapper.
- CSS `::before` pseudo-element on `.doc-block-body` draws a solid 2px teal vertical
  line (`rgba(56,200,200,0.4)`) running the full height of the wrapper.
- Left position set via `--block-left` CSS custom property, injected inline on each
  wrapper by a `requestAnimationFrame` callback after render. Measures actual
  `.doc-ln` width and `--doc-indent` pixel value dynamically — works at any zoom level.
- Applied to all block types: if/then/else, action/with, while, repeat, for, for each,
  every, do, switch/case/default, on_event.
- Nested blocks produce nested wrappers, each with their own line — side-by-side
  lines for nested blocks matching WebCoRE visual style.
- Lines are functional and recognizable. Fine-tuning of exact position deferred.
- style.css: `.doc-block-body` position:relative + `::before` rule added.
- No gaps introduced. Click handling, ghost points, line numbers all intact.

**Priorities for remainder of project:**
1. Globals system end-to-end (G-1 → G-2 → G-3 → G-4) ← NEXT
2. Role mapping + wizard smoke test (W-S8)
3. Compile/deploy smoke test (S3-1) — only after globals and role mapping work

---

### Priority order for next session (G-1 — Globals Backend):

**G-1: Backend — Globals Storage + API Endpoints**

Decisions to make at session start (discuss before coding):
- Storage: separate `globals.json` in userdata
- Schema: `{ id, name, var_type, value, description }`
- API endpoints: GET /globals, POST /globals, PUT /globals/{id}, DELETE /globals/{id}
- How compiled pistons reference globals (PyScript globals dict)

Upload for next session:
api.py, main.py, DESIGN.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## What Was Done in Session 46 (W-S6)

**editor.js — 3 fixes:**
- Scroll fixed: `flex:1;overflow-y:auto;min-height:0` added inline to `editor-doc` div.
- Device variable `= value` suppression: define block skips `valueStr` when `var_type === 'device'`.
- Aggregation `Any of` always shown for device conditions.
- GAP-S45-2 confirmed already clean.

**wizard.js — split into 6 files (DEPLOYED and working):**
- wizard-core.js, wizard-statement.js, wizard-condition.js, wizard-loops.js,
  wizard-action.js, wizard-variable.js
- Shared state via `window.WizardCore` getter/setter properties
- Delete button added to `_goVariablePicker` (GAP-S46-1 CLOSED)

**index.html updated** — 6 new script tags, load order: wizard-core.js first.

---

## What Was Done in Session 44 (W-S5)

editor.js and wizard.js — rendering and wizard pre-fill fixes.
editor.js: `_condLine()` flat-field normalization, group guard, `_subj()` null-safe.
wizard.js: `_condId()` helper, `_buildConditionNode()` uses it, edit-condition pre-fill.
GAP-S40-1 and GAP-S40-2 CLOSED. New gap: GAP-S44-1 → W-S8.

---

## What Was Done in Session 43 (S2-4 — Import Role Mapping)

POST /pistons/import implemented. Import paste modal + role mapping dialog in list.js.
GAP-S43-4 → S2-3. GAP-S46-4 → G-3.

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

---

## Placeholder / Role Mapping Rule

When writing snapshot JSON for import, use abstract role names as placeholder entity IDs
in device_map (e.g. `"Kitchen Light": ["__placeholder_light__"]`). Never invent
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

---

## Spec Debt — Address After W-S8

The following spec files are known outdated (per Grok audit May 2026).
Do not fix these during code sessions. Each needs its own dedicated doc session.

- FRONTEND_SPEC.md — HIGH. Wizard split, editor fixes, globals drawer status.
- WIZARD_SPEC.md — Mark as deprecated, WIZARD_REBUILD_SPEC.md supersedes it.
- COMPILER_SPEC.md — Backend is ahead of this doc. Needs a pass after S3-1.
- PROGRESS_TRACKER.md — Low effort. Just needs recent session entries added.
- write-a-piston.md — Still a placeholder. Must be written against nested tree model
  before AI prompt files can be used. See AI_PROMPT_SPEC.md for requirements.

---

## Grok Audit Note (May 2026)

Wizard split is good. Key risks identified:
- State sharing across files is risky — all files mutate WizardCore.sel directly
- Some flows don't fully support imported pistons (flat condition format)
- Missing robustness and null safety
- Globals barely started (just drawer stub)
- Role mapping on import partially there but fragile

Grok recommendation: stabilize before adding features.
W-S7b (wizard stabilization + debug logging) added to TASKS.md between W-S7 and W-S8.
