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
actions, same outcomes. If the piston announced which door opened in WebCoRE,
it must announce which door opened in HA.

**The tiebreaker for compiler decisions:** does it produce the right behavior in HA?
**The tiebreaker for UI/wizard decisions:** does it match what WebCoRE users expect?

---

## How to Start Every Session

1. Read this file completely before saying anything
2. Ask Jeremy to upload the relevant spec files and code files for what we're working on today
3. Read every uploaded file before writing any code or making any spec changes
4. Show proposed changes as text first — get approval before writing to files
5. Never remove existing spec content without explicit approval
6. Never write code that conflicts with the specs — specs are the authority

---

## Project Status — Session 30 Complete

### What Was Done in Session 30

**S1-4: main.py / api.py backend cleanup. GAP-S28-3 template fix. COMPLETE.**

**api.py changes:**
- GAP-S29-1,2,3,4: `_compile()` rewritten — fat context dict, correct
  `known_piston_ids` key, single `compile_piston(context)` call, `CompilerResult`
  unpacked correctly via `.automation_yaml`, `.script_yaml`, `.warnings`, `.errors`
- GAP-S29-5: `_send_to_companion()` removed entirely. Deploy endpoint returns
  compile result with `deployed: False` and TODO S1-5 note. All companion
  references in docstrings cleaned.
- GAP-S29-10: `_validate_device_map()` helper added — coerces bare strings to
  single-item lists, rejects anything else with 422. Called on create and update.
- GAP-S29-12: `_migrate_piston()` pass-through hook added, called in
  `get_piston()` before version check.
- GAP-S29-13: Compiler call wrapped in `except Exception` — catches Jinja2
  TemplateError and any other unexpected failure. Returns structured error, never 500.
- GAP-S29-15: Fragile heuristic comment added to `_mark_pistons_stale_for_global()`.
- GAP-S29-16: `piston_text` never-parsed comment added to create and update.
- GAP-S29-17: Compile-on-save removed from `update_piston()` — violates
  DESIGN.md Section 18. Save is now always fast.
- GAP-S29-8,9: Duplicate/import/export stub endpoints added returning 501.
- GAP-S30-2: `result.messages` → `result.warnings` (crash fix). Dead
  `except CompilerError` block removed — compiler never re-raises it.
- GAP-S30-5: Companion reference removed from `delete_piston` docstring.
- GAP-S30-6: Unused `BaseModel`, `Any`, `CompilerError` imports removed.
- GAP-S30-7: `import uuid` moved from inside function body to top-level.

**main.py changes:**
- Gap E: Central `logging.basicConfig()` added at startup.
- GAP-S29-6: `serve_index()` injects `window.PISTONCORE_BASE_URL` into `<head>`.
  Reads from `PISTONCORE_BASE_URL` env var — set in docker-compose for Unraid
  deployments (e.g. `http://192.168.1.10:7777`). Falls back to `localhost:7777`.
- GAP-S29-7: `/ws` WebSocket stub added — accepts connections, stays open,
  logs connect, discards messages. Full impl in S2-x.

**Template fixes (GAP-S28-3 — resolved):**
- `automation_yaml.j2` line 12: `script.pistoncore_{{ slug }}` →
  `script.pistoncore_{{ piston_id }}`
- `script_yaml.j2` line 5: `pistoncore_{{ slug }}:` →
  `pistoncore_{{ piston_id }}:`
- S1-5 is now unblocked.

**Gaps found Session 30 — new:**
- GAP-S30-3: `_get_compiler()` and `_get_app_version()` both call
  `storage.load_config()` — double disk read per compile. Low priority.
- GAP-S30-8: `automation_yaml.j2` uses both `{{ piston.id }}` (line 4) and
  `{{ piston_id }}` (line 12) for the same value. Inconsistent template style.
  Cosmetic — standardize to `{{ piston_id }}` throughout both templates.

**Not done this session — carried forward:**
- GAP-S29-11: Pydantic validation model — deferred, non-trivial
- GAP-S29-14: Move `slugify` to utils.py — requires compiler.py in scope
- GAP-S29-18: MISSING_SPECS.md pass — do at start of S1-5
- backend/README.md companion reference cleanup — minor, do in S1-5

### What Was Done in Session 29

**S1-3: Backend audit of api.py and main.py. No code written.**

18 gaps documented. All assigned to S1-4 or later. The four most critical
(GAP-S29-1 through S29-4) mean the compile endpoint was completely broken —
`_compile()` called the old 5-param compiler signature, used the old
`known_piston_slugs` key, called `storage.get_all_slugs()` instead of a UUID
function, and tried to tuple-unpack a CompilerResult dataclass. All fixed in S1-4.

### What Was Done in Session 28

**S1-2c: compiler.py flat statements array. No changes to other files.**

- stmt_map built once at top of `_compile_sequence` from `piston['statements']`.
- All control-flow methods accept `stmt_map` param and pass it through recursively.
- ID strings resolved to statement objects inside `_compile_sequence`. Embedded-object
  fallback handles top-level call which passes dicts directly.
- `tasks` inside action nodes remain embedded objects — deliberate exception,
  `action` is not a control-flow type.
- `__main__` test block updated to Section 18 flat-format piston JSON.

**S1-7 session 1: Tier 1 compiler bug fixes. compiler.py and 3 templates.**

- Bug 1: `_collect_triggers()` walks statements array, finds `is_trigger:true`
  conditions. `_compile_triggers()` translates condition fields to template params.
  Old `piston["triggers"]` field removed entirely.
- Bug 2: `_inject_trigger_id()` inserts `id:` as line 2 of trigger template output.
  Fixes double-dash that resulted from old wrapping approach.
- Bug 3: `wait_until` now emits `timeout:` (default 3600s) and `continue_on_timeout:`.
  `wait_until_yaml.j2` updated.
- Bug 4/5: `_compile_single_condition` returns body without leading `- `.
  `_strip_leading_dash()` helper added. All callers prepend `- ` where needed.
  Fixes `- - condition: state` in if/while/repeat blocks.
- Bug 6: `_compile_for_each_block` injects sentinel `device_map` override
  (`collection_role → ["{{ repeat.item }}"]`) before compiling body. Text
  substitution approach removed.
- Bug 7: `_compile_with_block` iterates all entities in role. Multi-entity or
  multi-task compiles to parallel block with `continue_on_error` at branch level.
- Bug 11: Boolean state values quoted via `_quote_state()` in condition output.
- Bug 13: `call_piston` and `control_piston` use UUID not slug.
  `known_piston_slugs` renamed `known_piston_ids` throughout.
- Bug 14: `_render_automation` and `_render_script` pass `piston_id` explicitly.
  Templates must use `piston_id` for entity IDs/filenames, `slug` for `alias:` only.
- Bug 19: Yes/No global write `choose:`/`default:` indentation corrected.
- Bug 22: `compile_piston(context: dict) -> CompilerResult`. Fat context dict
  per COMPILER_SPEC Section 7. Old 5-param signature removed.
- Bug 23: `CompilerMessage` dataclass (level/code/message/context) and
  `CompilerResult` dataclass replace old `CompilerWarning` and tuple return.
  `CompilerError` gains `code` and `context` fields.
- Bug 24: `NO_TRIGGERS` CompilerError raised when no triggers collected and
  piston is not `manual_only` or `called_by_piston`.
- `trigger_homeassistant_yaml.j2` created. `trigger_event_yaml.j2` and
  `wait_until_yaml.j2` updated.
- `__main__` test block updated to fat context dict and CompilerResult API.

**Gaps found Session 28 — not yet resolved:**
- GAP-S28-1: `tasks` embedded vs flat — confirmed embedded is correct per spec.
  PISTON_FORMAT.md and STATEMENT_TYPES.md should explicitly document this as a
  deliberate exception to the flat model rule. Fits a spec-only pass.
- GAP-S28-2: `else_ifs` on if blocks not compiled. Pre-existing gap, deferred
  to S1-7 session 2.
- GAP-S28-4: 6 test pistons in `tests/pistons/` not yet created. Required before
  S1-7 session 1 can be marked fully done per TASKS.md.
- GAP-S28-5: PyScript compiler template decision not made. Native YAML compiler
  uses Jinja2 templates so HA syntax changes only need template edits. PyScript
  also has occasional API changes — this must be resolved before S1-7 session 2
  starts. **Blocks S1-7 session 2.** See TASKS.md S1-7 session 2 for the full
  decision spec. Upload PYSCRIPT_COMPILER_SPEC.md for that session.

### What Was Done in Session 27

**S1-2b: editor.js flat statements array. No changes to wizard.js (except one Bug A fix) or compiler.py.**

- Rewrote `_actionLines` to accept `(childIds, stmtMap, depth, ...)` — resolves
  child IDs via flat map lookup instead of recursing into nested objects.
- Added all previously missing statement types: `for`, `switch`, `every`,
  `on_event`, `wait_for_state`, `break`. Unknown type now renders visible
  error placeholder instead of silently skipping.
- `_findNode(stmtMap, id)` — replaced recursive tree walker with flat map lookup.
- `_buildStmtMap()` — new helper, builds map from `_piston.statements`.
- `_findAnyNode(id)` — new helper, searches triggers/conditions/variables then
  stmtMap. Replaces `_flattenActions` + old `_findNode` combo at all call sites.
- `_removeNode(id)` — removes from flat array, cleans all parent child-ID lists
  including `else_ifs`, `cases`, `default_statements`.
- `_insertAfter(targetId, newNode)` — inserts into flat array AND injects new ID
  into whichever parent child-ID list contained the target.
- `_deleteSelected` — handles triggers/conditions/variables separately, then
  calls `_removeNode(id)` for statements.
- `_highestStmtId` — flat walk, no recursion.
- `insertStatement` — update-vs-insert rule (replace in-place if ID exists),
  Bug A routing for `if_condition` context using `statementData._blockId`.
- `save()` — generates `piston_text` via `_renderDocument` before API call,
  preserves previous value on render failure.
- `_flattenActions` removed — replaced by `_findAnyNode` and direct flat array use.
- wizard.js Bug A fix: `_commitConditionAndMore` now stamps `node._blockId` on
  bare condition nodes when context is `if_condition`, so editor routes them correctly.
- Both files pass Node.js syntax check.

---

## Known Code vs Spec Gaps (Post Session 30)

**Structural:**
- S1-2a (wizard.js) ✅ done Session 26
- S1-2b (editor.js) ✅ done Session 27
- S1-2c (compiler.py) ✅ done Session 28

**Compiler output bugs (S1-7 session 1 — ✅ done Session 28):**
- Bugs 1, 2, 3, 4/5, 6, 7, 11, 13, 14, 19, 22, 23, 24 — all fixed.

**Compiler output bugs (S1-7 session 2 — not yet started):**
- Bug 8: Conditions compile as state blocks, spec requires template conditions
- Bug 9: Aggregation silently dropped
- Bug 10: is_trigger not filtered in condition compilation
- Bug 12: Parallel branch continue_on_error not at sequence level
- Bug 17: $sunrise/$sunset offset uses string not datetime
- Bug 18: $currentEventDevice resolution is context-unaware
- Bug 25: No PyScript dispatch in compile_piston
- Bug 26/27/28: ha_client.py connection leaks, services cache, entity_id selector
- GAP-S28-2: else_ifs on if blocks not compiled

**Session 28 gaps — open:**
- GAP-S28-1: PISTON_FORMAT.md and STATEMENT_TYPES.md should explicitly document
  that `tasks` inside action nodes are embedded objects — deliberate exception to
  the flat model rule. Spec-only fix.
- GAP-S28-4: 6 test pistons in tests/pistons/ not yet created. Required before
  S1-7 session 1 is fully done per TASKS.md.
- GAP-S28-5: PyScript compiler template decision not made. **Blocks S1-7 session 2.**
  Must decide before coding PyScript compiler — see TASKS.md S1-7 session 2.

**Backend gaps — resolved in S1-4 (Session 30):**
- GAP-S29-1 through S29-4 ✅ _compile() fixed
- GAP-S29-5 ✅ companion stub removed
- GAP-S29-6 ✅ BASE_URL injection added
- GAP-S29-7 ✅ /ws WebSocket stub added
- GAP-S29-8,9 ✅ duplicate/import/export 501 stubs added
- GAP-S29-10 ✅ device_map validation added
- GAP-S29-12 ✅ _migrate_piston() hook added
- GAP-S29-13 ✅ TemplateError caught
- GAP-S29-15 ✅ fragile heuristic comment added
- GAP-S29-16 ✅ piston_text never-parsed comments added
- GAP-S29-17 ✅ compile-on-save removed

**Backend gaps — still open:**
- GAP-S29-11: No Pydantic validation on piston save — deferred
- GAP-S29-14: slugify not in utils.py — deferred, requires compiler.py in scope
- GAP-S29-18: MISSING_SPECS.md may be stale — do at start of S1-5
- GAP-S30-3: Double config load per compile (_get_compiler + _get_app_version).
  Low priority.
- GAP-S30-8: automation_yaml.j2 uses both piston.id and piston_id for same value.
  Cosmetic — standardize to piston_id throughout. Do in S1-5 when templates are open.
- backend/README.md: companion references not yet cleaned. Do in S1-5.

**Template gaps — resolved in Session 30:**
- GAP-S28-3 ✅ automation_yaml.j2 and script_yaml.j2 fixed — slug → piston_id
  for entity IDs. S1-5 is now unblocked.

**Deploy (S1-5 — next task):**
- No real HA file write exists
- automation.reload and script.reload not yet called from deploy endpoint
- GAP-S28-3 resolved — S1-5 is unblocked

**Context assembly (S1-6 — not yet implemented):**
- No build_compiler_context() function exists
- Compiler receives stub context on every compile

**Wizard (deferred):**
- on_event wizard warning not yet implemented

---

## Spec File Authority Order

When specs conflict, this is the resolution order:
1. DESIGN.md — philosophy and architecture decisions
2. PISTON_FORMAT.md — canonical data format
3. STATEMENT_TYPES.md — statement-level schemas and render output
4. COMPILER_SPEC.md — compiler behavior (current as of Session 24)
5. PYSCRIPT_COMPILER_SPEC.md — PyScript compiler (written Session 24 — current)
6. FRONTEND_SPEC.md — frontend behavior (current as of Session 24)
7. WIZARD_SPEC.md — wizard behavior (current as of Session 24)
8. HA_LIMITATIONS.md — known HA gotchas
9. AI_PROMPT_SPEC.md — AI prompt file requirements

---

## Build Target — Docker Now, Addon Last

**Current build target is Docker.** All development and testing happens in Docker
on Unraid (port 7777). This is not a compromise — Docker is the right dev environment.

**Addon packaging comes last** — after Docker is solid and fully functional.
The addon and Docker share the same codebase. Packaging as an addon is a separate
step that happens at the end, not a parallel track. Do not write addon packaging
specs or code until Docker is complete.

The addon IS the end goal and primary product. Docker is how we get there cleanly.

---

## V1 Definition Rule

**If it is not explicitly deferred to v2 or v3 in the specs, it is v1.**

No separate v1 feature list needed. DESIGN.md Sections 28 and 29 define what is
in scope and what is deferred. Everything in scope is v1.

---

## Reference Folder

The repo contains a `reference/` folder with session handoff notes, external
design reviews, and captured decisions from past sessions.

**What goes in reference/:**
- SESSION_XX_HANDOFF.md files after they are processed
- External AI review files (e.g., AIReviews5-6-26.md)
- Any captured decision or context document that should be preserved but is not
  a living spec

**Policy — move, don't delete:**
After processing a handoff note or review file at the start of a session, move it
to `reference/` rather than deleting it. Nothing gets lost. The working root stays
clean.

**File naming:** Keep original filenames. Session handoff files use the pattern
`SESSION_XX_HANDOFF.md`. Review files keep whatever name they were given.

**Before starting any task that might have prior context:** Ask Jeremy if a relevant
reference file exists before proceeding.

---

## Reference Documents

In addition to the spec files, always check:
- **TASKS.md** — what to work on and in what order (always upload this)
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
Without it, BASE_URL defaults to localhost:7777 which only works when browser
and server are on the same machine.

---

## Code Review Requirement — Every Coding Session

**Standing rule from Jeremy:** All problems must be addressed as we go — either
fix it now if the fix fits the current session's file scope, or add it to TASKS.md
if it is better done later or needs a totally separate context. No problem gets
ignored or mentioned in passing without one of those two outcomes.

After writing or modifying any code, before ending the session, Claude must:

1. Review all changed functions for gaps between what the code does and what the
   spec requires — field names, model assumptions, missing cases, wrong signatures.
2. Review all call sites of changed functions for broken callers not yet updated.
3. Check for any implicit assumptions in the new code that are not confirmed by
   the spec or by inspecting the other files in context.
4. For each gap found:
   - If it is a small fix that fits the current session's file scope — fix it now.
   - If it requires a different file or separate context — add it to TASKS.md as
     a named gap entry (GAP-SXX-N format) with: what the problem is, where it was
     found, what needs to happen, and which session/task it fits into.
5. Report all gaps found (fixed or deferred) before closing the session.

This is not optional. A session that produces code without a gap review is incomplete.

---

## Communication Style

Jeremy works two jobs and codes in limited sessions. He has no formal
programming background. Direct and concise. Plain language over technical
jargon. Show proposed changes as text before writing files. Humor is welcome.

When something is unclear, ask one question — not five.
