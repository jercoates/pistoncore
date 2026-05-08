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

## Project Status — Session 28 Complete

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
- GAP-S28-3: `automation.yaml.j2` and `script.yaml.j2` templates may still use
  `slug` for entity IDs instead of `piston_id`. Must verify and fix before S1-5
  or deployed files will have wrong entity IDs. **Blocks S1-5.**
- GAP-S28-4: 6 test pistons in `tests/pistons/` not yet created. Required before
  S1-7 session 1 can be marked fully done per TASKS.md.

---

## What Was Done in Session 27

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

**Findings for S1-2c (compiler.py):**
- No new findings. S1-2c scope is unchanged per TASKS.md.

## What Was Done in Session 26

**S1-2a: wizard.js flat statements array. No changes to editor.js or compiler.py.**

- Fixed 6 broken type-name aliases in `_handleStatementType` — `if_block`, `timer`,
  `do_block`, `for_loop`, `while_loop`, `repeat_loop` were silently falling through
  and doing nothing when picker cards were clicked.
- Expanded all skeleton statement objects to complete schemas per STATEMENT_TYPES.md.
  Previously most were bare `{ type, id }` only.
- Fixed `every` field name `unit` → `interval_unit`. Added `statements:[]` and
  optional scheduling fields (`at_minute`, `at_time`, `only_on_days/dom/months`).
- Fixed `repeat` skeleton: added `condition_operator:'and'` and common fields.
- Fixed `for_each` skeleton: added common fields.
- Moved skeleton construction to factory function `_sk()` called at dispatch time
  so `_newId()` is always fresh per invocation.
- Confirmed `_commitCondition` / `_commitConditionAndMore` were already writing
  flat-compatible output (`then:[]`, `else:[]`, `else_ifs:[]`). No structural
  change needed there for the flat model.
- Bugs B and C (pending_if_id / block-id conflict, _buildConditionNode not returning
  _blockId) confirmed present — deferred to S1-2b as spec'd.
- Duplicate-node risk in `_commitConditionAndMore` noted — same `ifBlockId` reused
  on every "Add more" click. Fix in S1-2b when editor gains update-vs-insert logic.
- TASKS.md updated: S1-2a marked done, findings documented for S1-2b, Session 26
  added to DONE.

**TASKS.md — major updates:**
- All Stage 1 and 2 Upload lines updated to include required spec files plus
  CLAUDE_SESSION_PROMPT.md and TASKS.md on every task
- S1-7 Compiler Bug Fixes added as two sessions:
  - Session 1 (before S1-5): Fix Tier 1 bugs — triggers never populated, condition
    indentation malformed, with_block only acts on first device, for_each body
    doesn't use per-iteration entity, slug vs UUID, boolean state quoting,
    compile_piston signature alignment, CompilerError code fields, NO_TRIGGERS
    validation. Also: build 6-piston test suite in tests/pistons/.
  - Session 2 (after S1-6): Fix Tier 2 bugs — template condition compiler, aggregation,
    is_trigger filtering, parallel branch continue_on_error, $currentEventDevice
    context-aware resolution, PyScript dispatch stub, ha_client.py connection leaks,
    services cache per-domain, hash computation.
- S1-6 Fat Compiler Context Assembly added between S1-5 and S1-7 session 2
- S1-5 dependency updated — now requires S1-7 session 1 complete, not just S1-2c
- S1-2b expanded — full render-back verification table for all 18 statement types,
  wizard pre-population bugs A/B/C added to fix list, piston_text generation added
- S1-2c — Section 18 verification required before marking done
- S3-2 Deferred Validation Testing added after S3-1
- S4-15 Operational Hardening added (Gap A/C/D/F/G from Grok review)
- Gap B (.dockerignore) added to Minor/Cosmetic
- S4-0 reordered — Error States Inventory is now first
- S4-10 write-a-piston.md blocker explicitly noted
- Session 25 added to DONE

**MISSING_SPECS.md — three items added:**
- Item 13: Fat Compiler Context Assembly (blocks S1-6)
- Item 14: Time Condition Compiler Path (blocks S1-7 session 2 / Bug 8)
- Item 15: write-a-piston.md prompt content (blocks S4-10)

**PISTON_FORMAT.md — updated:**
- "Two Formats" intro corrected — Snapshot JSON is the share format, not piston_text
- piston_text field added to wrapper table with full warning block
- "Fail loudly on render failure" rule added — if editor fails to render any
  statement, piston_text is NOT regenerated; previous value preserved
- "What This Format Is Not" section updated

**HA_LIMITATIONS.md — three items corrected:**
- State value quoting (Bug 11), wait_for_trigger timeout (Bug 3), parallel branch
  continue_on_error (Bug 12) moved from "already handled" to "known gaps"
- These were incorrectly marked as handled. They are not implemented. Fix in S1-7.

**DESIGN.md:**
- Duplicate Section 32 heading fixed (Standing Questions → 33, Dev Log → 34)
- Session 25 dev log entry added

**STATEMENT_TYPES.md:**
- Section 16 header confirmed present — was already fixed, no change needed

---

## What Still Needs to Be Done

All work is tracked in TASKS.md. Read that file at the start of every session.
This section is a brief summary only — TASKS.md is the authority.

**Overall goal:** Clean round-trip on one simple piston before any feature work.
wizard → JSON → backend → compiler → frontend renders → HA deploy succeeds.

### Stage 1 — Structural Fixes (current stage, do in order)

- **S1-2b:** Flat statements array — editor.js only. ✅ DONE (Session 27)
- **S1-2c:** Flat statements array — compiler.py only. ✅ DONE (Session 28)
- **S1-7 session 1:** Compiler bug fixes Tier 1. ✅ DONE (Session 28)
  - GAP-S28-3 blocks S1-5: verify automation.yaml.j2 and script.yaml.j2 use
    piston_id not slug for entity IDs. Fix templates before deploy.
  - GAP-S28-4: 6 test pistons in tests/pistons/ still needed.
- **S1-3:** Backend audit — no code, written gap list only. ← NEXT TASK
- **S1-4:** Backend cleanup — companion stub, BASE_URL, /ws endpoint, central logging.
- **S1-5:** HA direct write — depends on S1-2c AND S1-7 session 1 AND GAP-S28-3 resolved.
- **S1-6:** Fat compiler context assembly. Write spec in same session, then code.
  Lives in context_builder.py (not ha_client.py, not api.py).
- **S1-7 session 2:** Compiler bug fixes Tier 2 (after S1-6). Template conditions,
  aggregation, time conditions, PyScript dispatch stub. Also: else_ifs (GAP-S28-2).

### Stage 2 — Connect the Seams

HAClient abstraction, device_map_meta wiring, Snapshot export, import role
mapping flow, HA version detection. See TASKS.md for full detail.

### Stage 3 — Round-Trip Smoke Test

S3-1: One testing session — simple piston all the way through.
S3-2: Deferred validation testing — D-1, D-5, D-6, D-7 against real HA.

### Stage 4 — Features

Everything else. Each session needs only its own listed files. See TASKS.md.

---

## Key Design Decisions — Locked, Do Not Relitigate

- Compile target always compiler-owned, never user-controlled
- Wizard writes structured JSON only — never piston_text
- Editor renders from structured JSON only — never stores or reads display text
- piston_text is a TEMPORARY safety net only — stored at bottom of piston JSON,
  never parsed, never authoritative, remove after S3-1 testing
- piston_text is generated from the same render functions as the editor — not a
  parallel render path. If render fails for any statement, piston_text is NOT
  regenerated — previous value preserved. Fail loudly, not silently.
- Snapshot JSON is the single share/AI/community format — structured JSON
  with empty device_map arrays and role name placeholders
- AI prompts target Snapshot JSON output — no text parsing on import
- Device globals baked at compile time (no runtime lookup)
- Non-device globals as HA input helpers backed by UUID-based entity IDs
- Global variables use `@` prefix, piston variables use `$` prefix
- Frontend never calls HA directly — always through backend
- BASE_URL required on every connection — no hardcoded paths
- UUID-based file naming — never slug-based
- execute/end execute are rendering artifacts — not data nodes in JSON
- Single-device missing = hard flag, block redeploy (pending HA behavior validation)
- Multi-device missing = degrade gracefully on remaining devices
- wizard_context is retired — does not exist
- Condition object: flat format with `role` at top level (not nested subject object)
- device_map values are always arrays, even for single-device roles
- Statement IDs: `stmt_` + 8 char lowercase hex
- Statements array is FLAT per spec — child references by ID (S1-2 structural work)
- `on_event` compiles to blocking wait in PyScript — true async is not possible
  in HA. Wizard must warn users. See STATEMENT_TYPES.md Section 10.
- Fat compiler context assembly lives in context_builder.py — not ha_client.py,
  not api.py. api.py calls it.

---

## Known Code vs Spec Gaps (Post Session 28)

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
- GAP-S28-3: automation.yaml.j2 and script.yaml.j2 may still use `slug` for entity
  IDs. Must verify and fix before S1-5. **Blocks S1-5.**
- GAP-S28-4: 6 test pistons in tests/pistons/ not yet created. Required before
  S1-7 session 1 is fully done per TASKS.md.

**Backend cleanup (S1-4 — not yet done):**
- _send_to_companion() stub still in api.py — must be removed
- Companion references still in api.py comments and backend/README.md
- BASE_URL injection missing
- /ws WebSocket endpoint absent
- duplicate/import API methods missing — frontend calls crash

**Deploy (S1-5 — not yet implemented):**
- No real HA file write exists
- automation.reload and script.reload not yet called from deploy endpoint
- GAP-S28-3 must be resolved first

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
