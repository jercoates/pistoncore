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

## Project Status — Session 51 Complete

### What Was Done in Session 51 (Bug fixes)

**Multiple wizard and CSS fixes:**

- `app.js`: Removed duplicate GlobalsDrawer stub (was declared in both app.js and globals.js — crashed on load).
- `globals.js`: Fixed drawer closing immediately on open — changed outside-click from `click` to `mousedown`. Device picker changed from checkbox inputs to WebCoRE row-click-toggles-checkmark pattern. `_selectedDevices` module-level Set added; `_readDeviceSelection` reads from Set.
- `wizard-variable.js`: Device picker changed to WebCoRE row-click-toggles-checkmark pattern. Three-section list: physical devices, local variables, global variables.
- `style.css`: Full globals drawer CSS added (was missing entirely from deployed file). `wiz-stmt-cards` added as grid alias for `wiz-card-grid` (statement card grid was rendering as vertical list). `wiz-varinit-dev-row` checkbox rules replaced with `wiz-dev-check` checkmark rules. `wiz-block-warning` added (amber warning box).
- `wizard-core.js`: repeat/do/on_event/break edit was calling `close()` immediately — replaced with simple edit screen showing description and Delete button.
- `wizard-statement.js`: do_block, on_event, while_loop, repeat_loop now show a confirm screen with description, warning (while/repeat), and "Add a statement" button that inserts the block and reopens the wizard scoped inside it.

**Gap opened:**
- GAP-S51-1 → W-S7b: `_goBlockConfirm` uses close()+setTimeout+Wizard.open() causing visible dump-out when entering block. Fix: set WizardCore.context/extra and call `_goStatementTypePicker()` directly.

---

### Priority for next session (GAP-S51-1):

Fix `_goBlockConfirm` in `wizard-statement.js` — no close/reopen cycle.
Set `WizardCore.context` and `WizardCore.extra` to point inside the new block,
then call `_goStatementTypePicker()` directly without closing.

Upload for next session:
wizard-statement.js, wizard-core.js, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### What Was Done in Session 50 (G-2b)

**Globals drawer CSS + wizard-variable.js device multi-select fix:**

- `style.css`: Full CSS block added for all globals drawer classes — list rows,
  form fields, name-wrap with @ prefix, device picker panel, checkboxes,
  SelectAll/DeselectAll buttons, summary text, loading/error/empty states.
  All using dark theme vars — teal accents, var(--bg-raised), var(--border-subtle).
  GAP-G2-1 closed.

- `wizard-variable.js`: `_goVarInitDevicePicker` rebuilt as a proper multi-select
  with three sections: Physical devices / Local variables / Global variables.
  Checkboxes throughout. SelectAll/DeselectAll operate on physical devices only.
  Confirm button commits selection. Back button discards.
  `WizardCore.sel.initial_device_ids` (array) replaces `initial_device_id` /
  `initial_device_label` everywhere in the file.
  `_varInitSubHtml` for device type shows count ("3 devices selected").
  `save()` writes `initial_value` as the array.
  Globals fetched via `API.getGlobals()` and cached on `WizardCore.globalsData`.
  Both devices and globals fetched in parallel via `Promise.all` if not cached.
  GAP-G2-2 closed.

**Gaps opened:**
- GAP-S50-1 → S3-1: compiler does not handle device initial_value entries that
  are `@global_name` vs `local_var_name` vs `domain.entity` — needs disambiguation

---

### Priority order for next session (G-3 — Import globals):

**GAP-S46-4: Imported globals dump into piston variables instead of globals store**

When a piston snapshot is imported, any globals referenced in it need to land in
the globals store (`globals.json`), not in the piston's own variable define block.

Upload for next session:
api.py, list.js, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## What Was Done in Session 49 (G-2)

**GlobalsDrawer frontend — globals.js (new), api.js, api.py, storage.py, index.html:**

- `globals.js`: GlobalsDrawer object with open()/close(). Fetches GET /globals on open.
  List view shows all globals: name, type, value summary, description, edit/delete buttons.
  Add/Edit form: type selector, @ name field, type-appropriate value input, description.
  Device type uses full multi-select picker: searchable list, checkboxes per device,
  SelectAll/DeselectAll buttons. Stores array of entity_id strings.
  Wires both #btn-globals (global header) and drawer close button.
  Closes on outside click.

- `api.js`: createGlobal fixed — was `{ display_name, type }`, now `{ name, var_type, value, description }`.
  updateGlobal(id, fields) added — calls PUT /globals/{id}.

- `api.py`: device global value defaults to `[]` not `""` on create.
  Docstrings updated: value is `str | list[str]` for device type.

- `storage.py`: load_globals() docstring updated — value: `str | list[str]`.

- `index.html`: globals.js script tag added after api.js.

---

## What Was Done in Session 48 (G-1)

**Globals backend — api.py + storage.py:**

Schema locked: `{ id, name, var_type, value, description }`
- `var_type` values: `text | number | boolean | datetime | device`
- Device globals: `value` holds list of entity_id strings, baked in at compile time.
- Non-device globals: backed by HA input_* helpers with prefix `pistoncore_global_`.

---

## What Was Done in Session 47 (W-S7)

Vertical structure lines — editor.js + style.css.
bOpen/bClose wrappers, div.doc-block-body[data-indent=N], CSS ::before teal line.
--block-left set via requestAnimationFrame after render. All block types covered.
GAP-S47-1 opened → S4-16.

---

## What Was Done in Session 46 (W-S6)

editor.js: scroll fix, device variable = value suppression, aggregation 'Any of' fix.
wizard.js split into 6 files: wizard-core.js, wizard-statement.js, wizard-condition.js,
wizard-loops.js, wizard-action.js, wizard-variable.js.
GAP-S46-1 CLOSED. index.html updated.

---

## What Was Done in Session 44 (W-S5)

editor.js and wizard.js — rendering and wizard pre-fill fixes.
GAP-S40-1 and GAP-S40-2 CLOSED. GAP-S44-1 → W-S8.

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

## Globals System — Locked Decisions (Sessions 48-50)

**Schema:** `{ id, name, var_type, value, description }`
**var_type options:** `text | number | boolean | datetime | device`
**Storage:** separate `globals.json` in `/pistoncore-userdata/`
**Device globals:** value is a LIST of entity_id strings — one global can group many
  devices (e.g. @Smoke_Detectors = 6 devices). Baked in at compile time as literal
  entity IDs. Compiler expands the list into trigger decorators and service calls.
  Pistons flagged stale when device global's value changes.
**Non-device globals:** backed by HA input_* helpers, prefix `pistoncore_global_`.
  Read via `state.get("input_text.pistoncore_global_name")`.
**`@variable` syntax** — how globals are referenced in piston display text and
  in the wizard. Editor already renders this. Wizard wiring comes in G-4.
**Device initial_value in piston variables:** stored as array of strings.
  Entries prefixed with `@` are global device vars. Plain names are local device vars.
  `domain.entity` format are physical entity IDs. Compiler disambiguation → GAP-S50-1.
**WizardCore.globalsData** — globals cached here after first fetch in device picker.
  Same pattern as WizardCore.deviceData.

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
add a new bug you are wrong.  it needs the corner hook on the if and end to create the space

10:01 PM
You're right — WebCoRE uses corner hooks, not a straight line. The line turns at the opening keyword and hooks again at the closing keyword, creating a visual bracket that groups the block. That's actually useful, not just decoration.

Log it for next session — CSS and possibly minor editor.js changes to add the hook elements at open/close points.
