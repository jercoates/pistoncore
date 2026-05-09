# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 34 complete (S1-7 session 3 done — else_ifs, time condition fix, PyScript spec; reference folder audit clean; GAP-S28-4 updated)
**Authority:** CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files

---

## The Goal Before Everything Else

**Get to a clean round-trip on a simple piston:**
wizard writes JSON → backend saves it → compiler reads it → frontend renders it correctly

Once that works on even one simple piston, the seams between frontend, backend,
and compiler are locked and trusted. From that point on, each part can be worked
on in isolation — a wizard session only needs wizard files, a compiler session only
needs compiler files. Right now everything is tangled because the seams are not stable.

Do not work on wizard polish, compiler features, or UI improvements until
the round-trip works. Everything below is ordered toward that goal.

---

## How to Use This File

- **STAGE 1** — Structural fixes. Nothing works correctly until these are done.
- **STAGE 2** — Connect the seams. Frontend ↔ Backend ↔ Compiler all talking correctly.
- **STAGE 3** — Round-trip verified. Work can now split into focused modules.
- **STAGE 4** — Features. Only after Stage 3 is solid.
- **DEFERRED** — Known, not yet unblocked or not v1 scope.
- **DONE** — Completed and verified.

One task per session. Do not combine tasks.
Do not start a task without reading its listed spec files first.
Upload only the files needed for that task — nothing extra.

---

## STAGE 1 — Structural Fixes (Do In Order)

These are the foundation. Nothing built on top of them is trustworthy until they are done.

---

### S1-2a: Flat Statements Array — wizard.js Only ✅ DONE (Session 26)
**What was done:**
- Fixed type name mismatches between picker card `type` values and `_handleStatementType`
  dispatch. All 6 broken aliases now route correctly:
  `if_block`→if, `timer`→every, `do_block`→do, `for_loop`→for,
  `while_loop`→while, `repeat_loop`→repeat.
- Expanded all skeleton statement objects to include every required field per
  STATEMENT_TYPES.md. Previously most skeletons were bare `{ type, id }` only.
- Fixed `every` field name: `unit` → `interval_unit`. Added `statements:[]`,
  `at_minute`, `at_time`, `only_on_days/dom/months`.
- Fixed `repeat` skeleton: added `condition_operator:'and'` and common fields.
- Fixed `for_each` skeleton: added common fields.
- Skeleton factory moved to `_sk()` function called at dispatch time — ensures
  `_newId()` is called fresh on each invocation, not at parse time.

**Findings for S1-2b (editor.js):**
- `_commitCondition` and `_commitConditionAndMore` were already writing `then:[]`,
  `else:[]`, `else_ifs:[]` as empty arrays — flat-compatible. No structural change
  needed in commit logic for the flat model itself.
- Bugs B and C (pending_if_id / block-id conflict and _buildConditionNode not
  returning _blockId) are S1-2b scope as spec'd — confirmed present, not touched here.
- `_commitConditionAndMore` re-creates the if node with the same `ifBlockId` on
  every "Add more" click — this means multiple calls insert duplicate nodes with
  the same ID. Fix in S1-2b when `Editor.insertStatement` gains proper update-vs-insert
  logic.

**Testable:** Wizard now produces JSON where all statement types have correct field
names and complete schemas. Control flow nodes have `then`, `else`, `statements`
as empty ID arrays — never containing embedded statement objects. Verified by
inspecting piston JSON after wizard save. editor.js and compiler.py will be broken
until S1-2b and S1-2c complete — expected.

---

### S1-2b: Flat Statements Array — editor.js Only ✅ DONE (Session 27)
**What was done:**
- Rewrote `_actionLines` to accept `(childIds, stmtMap, depth, ...)`. Resolves
  child IDs via flat map lookup. No nested object recursion anywhere.
- Added all previously missing statement types: `for`, `switch`, `every`,
  `on_event`, `wait_for_state`, `break`. Unknown type renders visible error
  placeholder: `⚠ Unknown statement type: {type} — {id}`.
- `_findNode(stmtMap, id)` — flat lookup. `_buildStmtMap()` helper added.
- `_findAnyNode(id)` — searches triggers/conditions/variables then stmtMap.
  Replaces `_flattenActions` at all call sites. `_flattenActions` removed.
- `_removeNode(id)` — flat removal + cleans all parent child-ID lists.
- `_insertAfter(targetId, newNode)` — flat insert + injects ID into parent child list.
- `_highestStmtId` — flat walk, no recursion.
- `insertStatement` — update-vs-insert rule, Bug A fix for `if_condition` routing.
- `save()` — piston_text generated from render functions, preserved on failure.
- wizard.js Bug A fix: `_commitConditionAndMore` stamps `_blockId` on condition
  nodes when context is `if_condition`.
- Both files pass Node.js syntax check.

**Render-back verification table — to be completed by Jeremy during testing:**

| Statement type | Renders? | Clickable? | Wizard pre-populated? | Save updates? |
|---|---|---|---|---|
| action | | | | |
| if (then / else_if / else) | | | | |
| while | | | | |
| repeat | | | | |
| for | | | | |
| for_each | | | | |
| do | | | | |
| switch | | | | |
| set_variable | | | | |
| wait (duration) | | | | |
| wait (until) | | | | |
| wait_for_state | | | | |
| log_message | | | | |
| call_piston | | | | |
| exit | | | | |
| on_event | | | | |
| break | | | | |
| every | | | | |

**Note:** S1-2b is code-complete. Marking done pending render-back verification above.
If any row fails, fix before marking S1-2c started.

---

### S1-2c: Flat Statements Array — compiler.py Only ✅ DONE (Session 28)
**What was done:**
- `stmt_map` built once at top of `_compile_sequence` from `piston['statements']`.
- All control-flow methods (`_compile_if_block`, `_compile_repeat_block`,
  `_compile_while_block`, `_compile_for_each_block`, `_compile_for_loop`,
  `_compile_do_block`, `_compile_switch_block`) accept `stmt_map` param and
  pass it through all recursive calls.
- ID strings resolved to statement objects inside `_compile_sequence`. Embedded-object
  fallback handles top-level call.
- `tasks` inside action nodes confirmed as embedded objects — deliberate exception
  to flat model (GAP-S28-1 — needs spec documentation).
- `__main__` test block updated to Section 18 flat-format piston JSON.
- Section 18 verification: pending Jeremy's test run against real templates.

**Gaps found:**
- GAP-S28-1: PISTON_FORMAT.md and STATEMENT_TYPES.md should document `tasks`
  as deliberate embedded-object exception to the flat model rule. Spec-only fix.

---

### S1-3: Backend Audit ✅ DONE (Session 29)
**What was done:** Full written audit of api.py and main.py. No code written.
18 gaps documented. All assigned to S1-4 or later sessions.
See "Gaps Found Session 29" section below for full detail.

---

### S1-4: main.py / api.py Backend Cleanup ✅ DONE (Session 30)
**What was done:**
- GAP-S29-1,2,3,4: `_compile()` rewritten — fat context dict, `compile_piston(context)`,
  CompilerResult unpacked via `.automation_yaml`, `.script_yaml`, `.warnings`, `.errors`
- GAP-S29-5: `_send_to_companion()` removed. Deploy returns compile result + TODO S1-5.
- GAP-S29-6: BASE_URL injected into index.html at serve time. Reads from
  `PISTONCORE_BASE_URL` env var, falls back to `localhost:7777`.
- GAP-S29-7: `/ws` WebSocket stub added — accepts and holds connections.
- GAP-S29-8,9: Duplicate/import/export stubs added returning 501.
- GAP-S29-10: `_validate_device_map()` added — coerces bare strings, rejects invalid.
- GAP-S29-12: `_migrate_piston()` pass-through hook added in `get_piston()`.
- GAP-S29-13: Compiler call wrapped in `except Exception` — catches TemplateError.
- GAP-S29-15: Fragile heuristic comment added to `_mark_pistons_stale_for_global()`.
- GAP-S29-16: piston_text never-parsed comment added to create and update.
- GAP-S29-17: Compile-on-save removed from `update_piston()` — violates DESIGN.md S18.
- Gap E: Central `logging.basicConfig()` added to main.py.
- GAP-S30-2 (found and fixed same session): `result.messages` → `result.warnings`.
  Dead `except CompilerError` block removed — compiler never re-raises it.
- GAP-S30-5,6,7 (found and fixed same session): companion ref in docstring, unused
  imports, inline uuid import — all cleaned.

**Not done — carried forward:**
- GAP-S29-11: Pydantic model — deferred
- GAP-S29-14: slugify to utils.py ✅ DONE Session 31
- GAP-S29-18: MISSING_SPECS.md pass — do at start of S1-5
- backend/README.md companion cleanup — do at start of S1-5

**Also done this session — GAP-S28-3 resolved:**
- `automation_yaml.j2`: `script.pistoncore_{{ slug }}` → `script.pistoncore_{{ piston_id }}`
- `script_yaml.j2`: `pistoncore_{{ slug }}:` → `pistoncore_{{ piston_id }}:`
- S1-5 is now unblocked.

---

### S1-5: HA Direct Write — Deploy Implementation ✅ DONE (Session 31)

**What was done:**

- DESIGN.md Section 19: First-run configuration.yaml setup exception documented.
- storage.py: `ha_config_path` and `ha_restart_required` added to `load_config()` defaults.
- main.py: `_setup_ha_config()` startup hook — appends PistonCore include directives
  to `configuration.yaml` if missing, creates pistoncore output subdirectories,
  sets `ha_restart_required: True` if lines were added. Runs via FastAPI lifespan.
- ha_client.py: `call_service(domain, service, service_data)` added — WebSocket
  service call for automation.reload, script.reload.
- api.py: Full deploy endpoint implementation — compile, ha_restart_required check,
  hash mismatch detection (force=True override), file write to ha_config_path,
  automation.reload + script.reload via ha_client, mark piston deployed, clear
  ha_restart_required on first successful script deploy.
- api.py: `_check_hash_mismatch(path)` helper — reads pc_hash from file header,
  recomputes body hash, returns True if manually edited.
- api.py: `delete_piston()` — now removes compiled HA files (safety check for
  PistonCore signature), calls reload after removal. Best-effort.
- automation_yaml.j2: GAP-S30-8 — standardized to `{{ piston_id }}` throughout.
- backend/README.md: Companion references removed, first-run warning added,
  deploy documentation updated to reflect actual implementation.

**Gaps found this session:**
- GAP-S31-1: get_all_slugs() circular import risk — see gaps section below
- GAP-S31-2: _setup_ha_config() errors not surfaced to UI — fits S4-0
- GAP-S31-3: PyScript deploy not implemented — fits S1-7 session 2
- GAP-S31-5: ha_config_path has no UI — blocked by Settings page spec
- GAP-S31-6: endpoints.json write_automation ref is dead — low priority cleanup

**Test before marking fully verified:**
Deploy a simple (native script) piston to real HA via Samba mount.
Verify automation and script files appear in HA config dir.
Verify automation appears in HA automations list after reload.

---

### S1-6: Fat Compiler Context Assembly ✅ DONE (Session 32)

**What was done:**
- context_builder.py created. build_compiler_context(piston) fully implemented.
- ha_client.py: get_all_states(), get_services_for_domains(), get_areas(),
  get_ha_version() (reads from auth_ok WebSocket handshake) added.
- api.py: stub context dict replaced with context_builder call.
  _get_app_version() removed (dead code). CONTEXT_BUILD_ERROR handling added.
- MISSING_SPECS.md Item 13 closed.

---

### S1-8: Template Compliance Pass ✅ DONE (Session 33)

**What was done:**
Audit found every control-flow compiler method was emitting HA YAML inline in
Python — violating the core template architecture. All methods now route through
Jinja2 templates. Zero inline HA YAML in Python after this session.

- 15 new snippet templates created: if_block, repeat_until, while_loop,
  for_each, for_loop, switch_block, do_block, parallel_block, set_variable,
  set_global, set_global_boolean, call_piston, control_piston,
  condition_and, condition_or.
- _strip_leading_dash() deleted. _compile_single_condition() now returns full
  block including "- " always. Bug 4/5 fixed at root.
- AI-UPDATE-GUIDE.md updated with all new templates.

**Note on existing templates:** Uploaded template files had naming format
`condition_time_yaml.j2` instead of `condition_time.yaml.j2`. All pre-existing
snippet templates must be renamed on disk: replace `_yaml.j2` with `.yaml.j2`.
```bash
cd /path/to/snippets && for f in *_yaml.j2; do mv "$f" "${f/_yaml.j2/.yaml.j2}"; done
```

---

### S1-7: Compiler Bug Fixes — Session 2 ✅ PARTIAL DONE (Session 33)

**Bugs fixed this session:**
- Bug 8 ✅ Full template-condition compiler. _compile_numeric_condition() and
  _compile_state_condition() added. Routes through condition_template.yaml.j2.
- Bug 9 ✅ Aggregation (any/all) handled via Jinja2 any()/all() expressions.
- Bug 10 ✅ is_trigger conditions filtered before if-block condition compile.
- Bug 12 ✅ continue_on_error at branch sequence level in parallel_block.yaml.j2.
- Bug 13/15 ✅ Verified: switch and do pass _append_completion_event=False.
- Bug 16 ✅ for_loop uses repeat.index/index0 substitution via template.
- Bug 17 ✅ $sunrise/$sunset use as_datetime() so offset arithmetic works.
- Bug 18 ✅ $currentEventDevice resolves to trigger.entity_id in native context.
- Bug 20 ✅ File signature headers verified correct in templates.
- Bug 21 ✅ Hash computation verified done in Session 31 api.py.
- Bug 25 ✅ PyScript dispatch branch — returns PYSCRIPT_NOT_IMPLEMENTED.
- MISSING_SPECS.md Item 14 ✅ _compile_time_condition() built, routes through
  condition_time.yaml.j2.

**Bugs deferred to future sessions:**
- Bug 26 (ThreadPoolExecutor connection leaks) → S2-1
- Bug 27 (get_services caches per entity not domain) → S2-1
- Bug 28 (_field_type entity_id selector) → S2-2

**Still outstanding (S1-7 session 3) — DONE Session 34:**
- GAP-S28-2 / GAP-S33-1: else_ifs compiled ✅
- GAP-S33-2: condition_and/or template indentation needs real-world testing (deferred to S3-2)
- GAP-S33-3: _compile_time_condition "is" operator fixed ✅
- PyScript template design (GAP-S28-5/MISSING_SPECS Item 16) — written ✅ (PYSCRIPT_COMPILER_SPEC.md Section 4.1)

**S1-7 session 3 files changed:**
- compiler.py: _compile_if_block (else_ifs), _compile_time_condition ("is" operator)
- snippets/if_block.yaml.j2: added elif block support
- snippets/condition_time.yaml.j2: added exact_time_warning comment variable
- PYSCRIPT_COMPILER_SPEC.md: Section 4.1 added
- MISSING_SPECS.md: Item 16 closed

**Next: S2-0**

---

## STAGE 2 — Connect the Seams

Once Stage 1 is done, the individual pieces are correct in isolation.
Stage 2 wires them together and verifies they talk to each other correctly.

---

### S2-0: Storage Architecture Spec + SQLite Setup
**Why before other Stage 2 work:** Device tracking (S2-2) and run logging (S4-9)
both need the database to exist. Define the schema first, create the DB on startup,
then everything that needs it has a stable foundation.
**Spec ref:** MISSING_SPECS.md item 7, DESIGN.md Section 26
**This is a two-part session:**

Part 1 — Write the storage architecture spec (no code):
- Define full SQLite schema: run_log, run_events, device_state_cache, compile_index
- Define retention policy for logs
- Define migration strategy for future schema changes

Part 2 — Implement SQLite setup (code):
- Create `/pistoncore-userdata/pistoncore.db` on first launch if not present
- Create all four tables with correct indexes
- Add DB connection to backend startup
- Seed device_state_cache from current HA entity list on first connect

**Upload:** main.py, storage.py (if exists), DESIGN.md, MISSING_SPECS.md, PISTON_FORMAT.md, STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
**Before starting Part 1:** Quick spec pass to close floating spec-only gaps:
- GAP-S28-1: Add note to PISTON_FORMAT.md and STATEMENT_TYPES.md that `tasks` inside
  action nodes are embedded objects — deliberate exception to flat model rule.
- GAP-S27-1: Confirm tasks decision is documented (same fix as above).
Then proceed to Part 1 (storage spec) and Part 2 (SQLite code).
**Output:** Working SQLite DB created on startup, all tables present, ready for
device tracking and logging to write into.

---

### S2-1: HAClient Abstraction + HA API Externalization
**Spec ref:** DESIGN.md Sections 4, 15
**Upload:** ha_client.py, main.py, DESIGN.md, COMPILER_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
**What gets built:**
- `HAClient(auth_mode, token=None)` class
- Supervisor mode: reads `SUPERVISOR_TOKEN` env var
- Token mode: reads from `config.json` on volume
- All existing HA calls routed through HAClient — nothing calls HA directly anymore
- Externalize all HA REST endpoint URLs to `pistoncore-customize/ha_api/ha_YYYY.x/endpoints.json`
- No hardcoded HA URLs anywhere in Python after this session

---

### S2-2: device_map_meta — Wire Into Backend and Wizard
**Spec ref:** PISTON_FORMAT.md (device_map_meta), DESIGN.md Section 15.6
**Upload:** wizard.js, api.py, PISTON_FORMAT.md, DESIGN.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
**What gets wired:**
- Wizard sets `device_map_meta` cardinality when a device role is created (single vs multi)
- Backend schema validation accepts and stores `device_map_meta`
- Snapshot export preserves `device_map_meta` (cardinality needed for role mapping on import)

---

### S2-3: Snapshot Export — Backend Implementation
**Spec ref:** DESIGN.md Sections 6.2, 6.5
**Upload:** api.py, PISTON_FORMAT.md, DESIGN.md, FRONTEND_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
**What gets built:**
- Export endpoint strips entity IDs from device_map (empty arrays)
- Preserves device_map_meta
- Clears piston ID for reassignment on import
- Returns valid Snapshot JSON per PISTON_FORMAT.md

---

### S2-4: Import Role Mapping Flow — Frontend + Backend
**Spec ref:** DESIGN.md Section 6.3, FRONTEND_SPEC.md (Import Dialog)
**Upload:** import dialog JS, api.py, PISTON_FORMAT.md, DESIGN.md, FRONTEND_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
**What gets built:**
- Import dialog detects empty device_map arrays → shows role mapping step
- One device picker per role, same component used throughout wizard
- Backend populates device_map and assigns new piston ID on import completion
- Role mapping step skipped entirely if device_map is already populated (Backup import)

---

### S2-5: HA Version Detection — Display and Template Selection
**Note:** `get_ha_version()` was already built in S1-6 (reads from auth_ok WebSocket
handshake). What remains is wiring the stored version into the UI and template
selection — that's settings page work, not seam-connecting work. Moved to Stage 4.
**See:** S4-0 settings page spec, which must be written first.

---

## STAGE 3 — Round-Trip Verification

**This is the milestone.** When this session is done, the seams are locked and
work can split into focused single-file modules.

### S3-1: Smoke Test — Full Round-Trip on One Simple Piston
**This is a testing session, not a coding session.**
Build the simplest possible piston in the wizard:
- One trigger (time-based or device state change)
- One action (turn on a light)

Verify each step passes:
1. Wizard writes correct flat JSON ✓
2. Editor renders it correctly from that JSON ✓
3. Backend saves and returns it without corrupting any fields ✓
4. Compiler reads it and produces valid HA YAML ✓
5. Test Compile preview shows the YAML without errors ✓
6. Deploy writes to HA and reload succeeds ✓

**If any step fails:** That step becomes a new Stage 1 or Stage 2 task. Fix it and re-run.
**When all six steps pass:** Stage 3 is done. The seams are locked.

---

### S3-2: Deferred Validation Testing (After S3-1 Passes)

**This is a testing session, not a coding session.**
Work through the deferred validation items against real HA. Without this, S3-1
passes on paper but real users hit edge cases that were known risks and never tested.

- **D-1** — What does HA actually do when an automation references a missing entity?
  Test: create automation referencing a known entity, rename/remove it, reload.
  Does HA error and disable it, or fail silently? Trigger vs condition vs action
  entity — behavior the same? Results inform the S4-2 hard-flag implementation.
- **D-5** — Sunrise/sunset negative offset edge cases (e.g., "$sunrise - 2 hours"
  when sunrise is 6am = 4am, piston runs at 11pm). Test against real HA sun entity.
- **D-6** — Numeric trigger unknown/unavailable state behavior. Test with real sensors.
- **D-7** — Long-running piston timeouts. Test complex pistons with long waits.

Results go in HA_LIMITATIONS.md. Mark each D-item done as tested.

---

## STAGE 4 — Features (Only After Stage 3 Complete)

Once the round-trip works, each session below only needs its own listed files.
No need to load everything every time.

**Before starting any Stage 4 task, check MISSING_SPECS.md.** If the spec for
that feature is listed as missing, write the spec first — then code.

### S4-0: Write Missing Specs (as needed, before dependent tasks)
These spec-writing sessions should happen just before the task that needs them —
not all at once. Each is a dedicated spec-only session, no code written.

- **Error states inventory** → write BEFORE any Stage 4 UI work begins — affects every UI page. See MISSING_SPECS.md Item 5.
- **WebSocket message protocol** → write before S4-9 (run status reporting). See MISSING_SPECS.md Item 2.
- **Settings page frontend spec** → write before settings page is built. See MISSING_SPECS.md Item 3.
- **Piston list folder management** → write before folder management is built. See MISSING_SPECS.md Item 4.
- **write-a-piston.md content** → write before S4-10 (Snapshot import via AI) — **BLOCKS S4-10**. See MISSING_SPECS.md Item 15.
- **PyScript compiler spec** → DONE (Session 24) — PYSCRIPT_COMPILER_SPEC.md complete
- **Test strategy** → write before v1 ships. See MISSING_SPECS.md Item 6.

See MISSING_SPECS.md for full detail on what each spec must cover.

---

### S4-1: PyScript Detection and Setup Prompt
**Spec ref:** DESIGN.md Section 3.2
**Files needed:** ha_client.py, frontend PyScript indicator JS
**Important:** Re-read PYSCRIPT_COMPILER_SPEC.md at the start of this session.
It was written in Session 24 — by the time S4-1 is reached, the native compiler
may have evolved. Verify the PyScript spec is still aligned before coding.

### S4-2: Missing Device Handler
**Depends on:** S2-2 wired, D-1 HA behavior validated first
**Spec ref:** DESIGN.md Section 15.6, HA_LIMITATIONS.md Section 9
**Note:** Do not implement hard-flag logic until D-1 is tested.

### S4-3: Orphan Cleanup — Queue and Retry
**Spec ref:** DESIGN.md Section 16
**Files needed:** api.py

### S4-4: Compiler Template System — Jinja2 Scaffolding
**Depends on:** S1-1 COMPILER_SPEC.md updated, S1-2 flat array done
**Spec ref:** DESIGN.md Sections 9, 14
**Files needed:** compiler.py, template folder structure

### S4-5: Pre-Save Validation Pipeline
**Spec ref:** DESIGN.md Section 18
**Files needed:** compiler.py, api.py, validation-rules JSON

### S4-6: File Signature and Hash System
**Depends on:** Compiler producing output
**Spec ref:** DESIGN.md Section 13
**Files needed:** compiler.py

### S4-7: Test Compile / Preview Mode
**Depends on:** Compiler working
**Spec ref:** DESIGN.md Section 17
**Files needed:** api.py, status page JS

### S4-8: Global Variables — Stale Piston Tracking
**Spec ref:** DESIGN.md Section 7.1
**Files needed:** api.py, globals_index.json logic
**What gets built:**
- Stale piston tracking when Device/Devices global changes
- globals_index.json maintained on every successful compile
- Banner on piston list when affected pistons need redeployment
- Replace string-scan heuristic in `_mark_pistons_stale_for_global()` with proper
  walk of statements/variables/conditions arrays (GAP-S29-15)

### S4-9: Run Status Reporting — WebSocket Events
**Spec ref:** DESIGN.md Section 21
**Files needed:** main.py WebSocket handler, status page JS

### S4-10: Snapshot Import — AI Prompt Files
**Depends on:** S2-4 import flow tested end-to-end with real round-trip
**Spec ref:** DESIGN.md Section 31, AI_PROMPT_SPEC.md
**Do not write until:** Import tested, role mapping working, round-trip clean.
**Blocker:** write-a-piston.md must be complete before this task starts. It is
currently a stub. See MISSING_SPECS.md Item 15 for tracking.

### S4-12: target-boundary.json — Add Missing PyScript-Forcing Patterns
**Spec ref:** MISSING_SPECS.md item 9 (resolved Session 24), DESIGN.md Section 3.1,
PYSCRIPT_COMPILER_SPEC.md Section 1.1
**Files needed:** target-boundary.json, COMPILER_SPEC.md
**What gets added:**
- `repeat_until_state` — repeat/until with live entity state condition
- `current_event_device` — use of $currentEventDevice system variable
- `dynamic_attribute_access` — reading attribute from a loop variable
- `loop_string_accumulation` — string building across loop iterations
**Note:** The last three require content analysis detection (not just type checking).
Detection logic must be written as part of this task — see PYSCRIPT_COMPILER_SPEC.md
Section 1.1 detection note.
**Also:** Day-of-week time conditions and multi-role OR triggers must be
fully compiled (not just warnings) — update COMPILER_SPEC.md accordingly.

---

### S4-13: Sample Piston Library — Write Snapshot JSON
**Depends on:** S2-4 import flow tested, S3-1 round-trip passing
**Spec ref:** SAMPLE_PISTONS.md
**Files needed:** samples/ folder (new), api.py (new /api/samples endpoints)
**What gets built:**
- Snapshot JSON for all four sample pistons (Low Battery, Door Chime, CO Alert, Water Leak)
- `/api/samples` endpoint returning list
- `/api/samples/{name}` endpoint returning Snapshot JSON
- "Sample Pistons" tab in Import dialog
- These four pistons also serve as the primary compiler test suite

### S4-11: AI-REVIEW-PROMPT.md — Update
**Spec ref:** DESIGN.md Section 31
**Files needed:** AI-REVIEW-PROMPT.md only

### S4-14: Best Practices Documentation
**Spec ref:** MISSING_SPECS.md item 12
**Files needed:** New BEST_PRACTICES.md, README.md
**What gets written:**
- Globals for cross-piston device management
- Define block for single-piston device references
- Role names vs hardcoded devices in logic
- In-app tooltip/ghost text copy for define block and globals

### S4-15: Operational Hardening
**Spec ref:** DESIGN.md Section 26
**Files needed:** main.py, docker-entrypoint.sh, ha_client.py, storage.py, README.md
**What gets done:**
- **(Gap A)** Cache slug list in `get_all_slugs()`, invalidate on save — currently
  instantiates Compiler on every call for every piston, will degrade with scale.
- **(Gap C)** Document recommended uvicorn worker config in README and Docker run
  command. Single-process default is not production-grade.
- **(Gap D)** Add startup validation in `docker-entrypoint.sh`: check required dirs
  and files exist before starting FastAPI, fail loudly with a clear message if not.
  Prevents silent partial-initialization on first run.
- **(Gap F)** Add security section to README covering: volume security, least-privilege
  HA token scopes, token rotation, risks of exposing port 7777 publicly without auth.
- **(Gap G)** Tighten `_scan_globals` regex in compiler.py to avoid false-positives
  on email addresses and Twitter-style @handles in string literals.

---

## DEFERRED — Blocked on External Validation or Not v1 Scope

### D-1: HA Missing Entity Behavior — Must Test Before Coding
**Blocks:** S4-2 missing device hard-flag logic
**What to test:** Create a test automation referencing a known entity. Remove/rename it.
Reload. Does HA error and disable the automation? Skip silently? Behave differently
for trigger vs condition vs action? Error surfaced or silent?
**Results go in HA_LIMITATIONS.md Section 9.**

### D-2: Which-Interaction Step — Evaluate Feasibility First
**What to do:** Validate PyScript context tracking (`context.id`, `context.parent_id`)
in a real sandbox before building the wizard step.

### D-3: settings / end settings Block Contents
**What to do:** Research WebCoRE behavior. Define contents before implementing.

### D-4: Timer Statement — Evaluate Before Including
**What to do:** Evaluate overlap with HA scheduler. Decide if it belongs in v1.

### D-5: Sunrise/Sunset Negative Offset Edge Cases
**What to do:** Test in real HA before compiler handles these.

### D-6: Numeric Trigger Unknown State Behavior
**What to do:** Test in real HA before shipping numeric trigger compilation.

### D-7: Long-Running Piston Timeouts
**Status:** Known risk. Test before v1 release. No fix defined yet.

---

## DONE — Completed Sessions

### Session 30 — S1-4: main.py / api.py Backend Cleanup ✅ + GAP-S28-3 Template Fix ✅
api.py: `_compile()` rewritten with fat context dict and correct CompilerResult unpack.
Compile-on-save removed from `update_piston()` — violates DESIGN.md Section 18.
`_send_to_companion()` stub removed; all companion references cleaned from docstrings.
`_validate_device_map()` helper added — coerces/rejects invalid device_map values.
`_migrate_piston()` pass-through hook added in `get_piston()`.
Compiler call wrapped in `except Exception` — catches Jinja2 TemplateError.
Duplicate/import/export 501 stub endpoints added.
Unused imports removed; uuid import moved to top-level.
Fragile heuristic comment added to `_mark_pistons_stale_for_global()`.
piston_text never-parsed comments added to create and update.
GAP-S30-2 found and fixed same session: `result.messages` → `result.warnings`;
dead `except CompilerError` block removed.
main.py: central logging config added. BASE_URL injected at page serve time,
reads from `PISTONCORE_BASE_URL` env var. `/ws` WebSocket stub added.
Templates: `automation_yaml.j2` and `script_yaml.j2` fixed — slug → piston_id
for entity IDs and script key. GAP-S28-3 resolved. S1-5 unblocked.
Not done: GAP-S29-11 (Pydantic), S29-14 (slugify), S29-18 (MISSING_SPECS pass),
backend/README.md cleanup.

### Session 29 — S1-3: Backend Audit ✅
api.py and main.py audited. No code written. 18 gaps documented:
- GAP-S29-1: `_compile()` calls old 5-param compiler signature — crash on any compile
- GAP-S29-2: `known_piston_slugs` not renamed to `known_piston_ids` in api.py
- GAP-S29-3: `storage.get_all_slugs()` likely returns slugs not UUIDs — wrong data to compiler
- GAP-S29-4: CompilerResult tuple unpack broken — crash on any compile
- GAP-S29-5: Companion stub still present — deploy always returns success:false
- GAP-S29-6: BASE_URL injection missing from page serve — addon ingress broken
- GAP-S29-7: `/ws` WebSocket endpoint absent — run log panel dead
- GAP-S29-8: Duplicate/import endpoints missing — frontend gets 404
- GAP-S29-9: Snapshot export endpoint missing — frontend gets 404
- GAP-S29-10: device_map values not validated as arrays — data corruption risk
- GAP-S29-11: No Pydantic validation on piston save — any garbage accepted
- GAP-S29-12: Schema migration hook missing — future upgrades have no landing place
- GAP-S29-13: Jinja2 template errors uncaught → unhandled 500
- GAP-S29-14: `slugify` in Compiler class, should be in utils.py
- GAP-S29-15: `_mark_pistons_stale_for_global()` uses fragile string scan heuristic
- GAP-S29-16: `piston_text` never-parse rule undocumented in code
- GAP-S29-17: Compile-on-save behavior — check DESIGN.md Section 18 for intent
- GAP-S29-18: MISSING_SPECS.md may be stale — quick pass needed at start of S1-4
All 18 gaps assigned to S1-4 (most) or later sessions (S4-8 for GAP-S29-15).

### Session 28 — S1-2c + S1-7 Session 1: compiler.py Flat Array + Tier 1 Bug Fixes ✅
compiler.py only (plus 3 Jinja templates).
S1-2c: stmt_map built at top of `_compile_sequence`. All control-flow methods
accept and pass stmt_map. ID strings resolved to objects inside _compile_sequence.
Embedded-object fallback handles top-level call. tasks in action nodes confirmed
as embedded objects — deliberate exception to flat model (GAP-S28-1, needs spec doc).
S1-7 session 1: Bug 1 — `_collect_triggers()` walks statements for `is_trigger:true`.
Bug 2 — `_inject_trigger_id()` inserts id: as line 2 of trigger template output.
Bug 3 — wait_until emits timeout (3600s default) and continue_on_timeout; template
updated. Bug 4/5 — `_compile_single_condition` returns body without leading "- ";
`_strip_leading_dash()` helper added; callers prepend "- " where needed.
Bug 6 — for_each injects sentinel device_map override before compiling body.
Bug 7 — _compile_with_block iterates all entities; multi produces parallel block
with continue_on_error at branch level per spec. Bug 11 — `_quote_state()` quotes
boolean state values in condition output. Bug 13/14 — UUID used everywhere;
`known_piston_slugs` renamed `known_piston_ids`; `piston_id` passed explicitly
to render templates. Bug 19 — Yes/No global write indentation fixed. Bug 22 —
`compile_piston(context: dict) -> CompilerResult`; fat context dict per Section 7.
Bug 23 — `CompilerMessage` and `CompilerResult` dataclasses; `CompilerError` gains
code and context fields. Bug 24 — NO_TRIGGERS CompilerError on empty trigger list.
Templates: `trigger_homeassistant_yaml.j2` created; `trigger_event_yaml.j2` and
`wait_until_yaml.j2` updated. `__main__` test block updated to new API.
Open: GAP-S28-3 ✅ DONE Session 30 (templates fixed — slug → piston_id).
GAP-S28-4 (6 test pistons in tests/pistons/ not yet created).

### Session 27 — S1-2b: editor.js Flat Statements Array ✅
editor.js only (plus one Bug A fix in wizard.js).
Rewrote `_actionLines` to accept `(childIds, stmtMap, depth, ...)` — flat ID
lookup, no nested object recursion. Added all previously missing statement types:
`for`, `switch`, `every`, `on_event`, `wait_for_state`, `break`. Unknown type
renders visible error placeholder. `_findNode` replaced with flat map lookup +
`_buildStmtMap()` helper. `_flattenActions` removed — replaced by `_findAnyNode(id)`
which searches triggers/conditions/variables then stmtMap. `_removeNode` and
`_insertAfter` both rewritten for flat model — remove/insert in flat array and
clean/update all parent child-ID lists. `_highestStmtId` flat walk. `insertStatement`
gains update-vs-insert rule and Bug A `if_condition` routing via `_blockId`.
`save()` generates `piston_text` from render functions, preserves on failure.
wizard.js: `_commitConditionAndMore` stamps `_blockId` on bare condition nodes
when context is `if_condition` (Bug A fix).
Render-back verification table to be completed by Jeremy during testing.
Also fixed in same session: `_nextStmtId` now produces `stmt_` + 8-char lowercase
hex (was sequential counter `stmt_001` — wrong format per spec). `_highestStmtId`
simplified since it no longer drives ID generation.

### Session 26 — S1-2a: wizard.js Flat Statements Array ✅
wizard.js only. No changes to editor.js or compiler.py.
Fixed 6 broken type-name aliases in `_handleStatementType` — if_block, timer,
do_block, for_loop, while_loop, repeat_loop were all silently falling through
and doing nothing when their picker cards were clicked.
Expanded all skeleton statement objects to complete STATEMENT_TYPES.md schemas.
Fixed `every` field name `unit` → `interval_unit`; added `statements:[]` and
optional scheduling fields. Fixed `repeat` missing `condition_operator`.
Fixed `for_each` missing common fields. Moved skeleton construction to factory
function `_sk()` called at dispatch time so `_newId()` is always fresh.
Confirmed: `_commitCondition`/`_commitConditionAndMore` were already writing flat-
compatible output (empty `then:[]`, `else:[]` arrays). Bugs B and C deferred to
S1-2b as spec'd. Duplicate-node risk in `_commitConditionAndMore` noted — fix in
S1-2b when editor gains update-vs-insert logic.

### Session 25 — Spec and Task Updates ✅
STATEMENT_TYPES.md Section 16 header confirmed present (was already fixed — no change needed).
TASKS.md: all Stage 1 and 2 Upload lines updated with required spec files.
S1-7 (Compiler Bug Fixes — 2 sessions), S1-6 (Fat Compiler Context Assembly),
S3-2 (Deferred Validation Testing), S4-15 (Operational Hardening) added.
S1-7 session 1 correctly placed before S1-5 — Bug 1 (triggers) must be fixed
before writing anything to HA. S4-0 reordered — Error States Inventory first.
S4-10 blocker note added. Gap A–G from Grok review incorporated.
MISSING_SPECS.md: Items 13, 14, 15 added.
PISTON_FORMAT.md: piston_text field added with warning block, "Two Formats" intro
corrected to reference Snapshot JSON, "What This Format Is Not" updated.
HA_LIMITATIONS.md: Three items moved from "already handled" to "known gaps":
state value quoting (Bug 11), wait_for_trigger timeout (Bug 3), parallel branch
continue_on_error (Bug 12).
DESIGN.md: duplicate Section 32 heading fixed.

### S1-1: COMPILER_SPEC.md — Rewrite ✅
Completed during Session 22 update work. Companion references removed, schema_version
replaced with logic_version/ui_version, target-boundary.json specced in Section 3,
fat compiler context object in Section 7, statement field names aligned.
Minor fix applied post-review: one-click convert button removed from Section 2 —
complexity indicator is read-only per DESIGN.md Section 3.1.

### Session 23 — TASKS.md Created ✅
All work organized into Stage 1–4. S1-1 marked done. Companion stub identified
in api.py. S1-5 HA direct write added as a task.

### Session 24 — compiler.py Field Alignment + Spec Work ✅
compiler.py: all field names aligned to PISTON_FORMAT.md/COMPILER_SPEC.md/STATEMENT_TYPES.md.
New `_resolve_operand()` helper added.
PYSCRIPT_COMPILER_SPEC.md: written, all 6 gaps resolved, status READY TO CODE.
COMPILER_SPEC.md Section 7: global_variables array structure defined.
STATEMENT_TYPES.md Section 10: on_event fully specced with blocking wait limitation.
Full spec cleanup: piston_text references, stale COMPILER_SPEC warning, actions→statements
field name, MISSING_SPECS items 1 and 9 closed.

### Session 21 — Field Name Alignment Pass ✅
All old type names and field names replaced in wizard.js, editor.js, status.js,
compiler.py, api.js. Spec-correct names throughout.

### Session 22 — Share Format Decision ✅
piston_text retired as v1 share/AI format. Snapshot JSON is now the single
share/AI/community format. AI_PROMPT_SPEC.md created. DESIGN.md Sections 6.2–6.7
rewritten. FRONTEND_SPEC.md import dialog updated. Session prompt updated.

### Sessions 1–20 — See DESIGN.md Section 33 (Development Log) ✅

---

## Gaps Found Session 30

### GAP-S30-3: Double config load per compile call
**Found during:** S1-4 gap review
**Problem:** `_compile()` calls `_get_compiler()` (which calls `storage.load_config()`)
and separately calls `_get_app_version()` (which also calls `storage.load_config()`).
Two disk reads for the same data on every compile.
**What needs to happen:** Load config once in `_compile()` and pass values directly
to `_get_compiler()` and read `app_version` from it. Low priority — no correctness
impact, just unnecessary disk I/O.
**Fits in:** S1-5 or any session that touches api.py.

### GAP-S30-8: automation_yaml.j2 uses both piston.id and piston_id for same value
**Found during:** S1-4 gap review after fixing GAP-S28-3
**Problem:** Line 4 uses `pistoncore_{{ piston.id }}` (via piston object dict),
line 12 uses `pistoncore_{{ piston_id }}` (via explicitly passed var). Both resolve
to the same value so output is correct, but inconsistent template style. Stable
entity IDs should always come from the explicit `piston_id` var, not `piston.id`,
in case the compiler ever needs to differentiate them.
**What needs to happen:** Standardize line 4 in automation_yaml.j2 to use
`{{ piston_id }}` instead of `{{ piston.id }}`. Cosmetic only.
**Fits in:** S1-5 (templates will be open anyway).

---

## Gaps Found Session 29 — Assigned to S1-4

**Resolved in Session 30:** GAP-S29-1, S29-2, S29-3, S29-4, S29-5, S29-6, S29-7,
S29-8, S29-9, S29-10, S29-12, S29-13, S29-15, S29-16, S29-17.
**Still open:** GAP-S29-11 (Pydantic model), S29-14 (slugify to utils.py),
S29-18 (MISSING_SPECS.md pass — do at start of S1-5).

### GAP-S29-1: `_compile()` calls old 5-param compiler signature ✅ DONE S30
**Found during:** S1-3 backend audit
**Problem:** `_compile()` calls `compiler.compile_piston(piston=..., device_map=...,
globals_store=..., app_version=..., known_piston_slugs=...)`. Bug 22 in Session 28
changed the compiler to accept a single fat context dict. This crashes on any compile.
**What needs to happen:** Rebuild `_compile()` to assemble the fat context dict and
call `compile_piston(context)`. Unpack from CompilerResult fields.
**Fits in:** S1-4.

### GAP-S29-2: `known_piston_slugs` not renamed in api.py
**Found during:** S1-3 backend audit
**Problem:** `_compile()` passes `known_piston_slugs=known_slugs`. Bug 13 renamed
this to `known_piston_ids` in the compiler. Part of the same fix as GAP-S29-1.
**Fits in:** S1-4.

### GAP-S29-3: `storage.get_all_slugs()` likely returns slugs not UUIDs
**Found during:** S1-3 backend audit
**Problem:** After Bug 13, the compiler's `known_piston_ids` must be UUIDs.
If `get_all_slugs()` returns slugs, `call_piston` UUID validation always fails.
**What needs to happen:** Replace with a function that returns UUIDs. Verify what
`get_all_slugs()` actually returns and rename or fix accordingly.
**Fits in:** S1-4.

### GAP-S29-4: CompilerResult tuple unpack broken
**Found during:** S1-3 backend audit
**Problem:** `auto_yaml, script_yaml, warnings, errors = compiler.compile_piston(...)`
crashes — Bug 23 changed the return to a CompilerResult dataclass, not a tuple.
**What needs to happen:** Unpack from CompilerResult fields. Also update the
`success: len(errors) == 0` check — errors are now CompilerMessage objects.
**Fits in:** S1-4.

### GAP-S29-5: Companion stub still present
**Found during:** S1-3 backend audit
**Problem:** `_send_to_companion()` always returns `success: False`. Deploy endpoint
calls it. Deploy can never succeed.
**What needs to happen:** Remove stub entirely. Replace deploy endpoint logic
with direct HA file write (S1-5). For S1-4, stub removed and deploy returns
clean not-yet-implemented response.
**Fits in:** S1-4 (remove), S1-5 (real implementation).

### GAP-S29-6: BASE_URL injection missing
**Found during:** S1-3 backend audit
**Problem:** `serve_index()` returns bare FileResponse with no BASE_URL injection.
Frontend must hardcode localhost:7777. Addon ingress mode broken.
**What needs to happen:** Inject BASE_URL into HTML on page serve (script tag or
meta tag). Value from env var or config.
**Fits in:** S1-4.

### GAP-S29-7: `/ws` WebSocket endpoint absent
**Found during:** S1-3 backend audit
**Problem:** No WebSocket endpoint exists. Frontend run log listeners connect to nothing.
**What needs to happen:** Add basic `/ws` stub — accepts connections, stays open,
no message logic. Real protocol in S4-9 after MISSING_SPECS.md Item 2 is written.
**Fits in:** S1-4 (stub), S4-9 (real).

### GAP-S29-8: Duplicate/import endpoints missing
**Found during:** S1-3 backend audit
**Problem:** No `POST /pistons/{id}/duplicate` or `POST /pistons/import`. Frontend
calls these and gets 404s.
**What needs to happen:** Add 501 stubs for both. Real implementation in S2-3/S2-4.
**Fits in:** S1-4 (stubs), S2-3/S2-4 (real).

### GAP-S29-9: Snapshot export endpoint missing
**Found during:** S1-3 backend audit
**Problem:** No export endpoint. Frontend export button hits a 404.
**What needs to happen:** Add 501 stub. Real implementation in S2-3.
**Fits in:** S1-4 (stub), S2-3 (real).

### GAP-S29-10: device_map values not validated as arrays
**Found during:** S1-3 backend audit
**Problem:** `device_map` initialized as `{}`. No validation that values are arrays.
Client sending a scalar gets it stored and returned as a scalar — breaks compiler.
**What needs to happen:** On save, validate every device_map value is a list.
Coerce scalar to `[value]` or reject with 422.
**Fits in:** S1-4.

### GAP-S29-11: No Pydantic validation on piston save
**Found during:** S1-3 backend audit (also Grok review)
**Problem:** create/update accept any dict. No type or value validation.
**What needs to happen:** Add thin Pydantic model — name is string, mode is
enum, logic_version/ui_version are ints, statements is list, device_map values
are lists. Full pipeline in S4-5.
**Fits in:** S1-4 (thin model), S4-5 (full pipeline).

### GAP-S29-12: Schema migration hook missing
**Found during:** S1-3 backend audit (also Grok review)
**Problem:** `get_piston()` rejects future versions but has no migration path for
when PistonCore is newer than the stored piston. Future schema changes have nowhere
to land without this hook.
**What needs to happen:** Add `_migrate_piston(piston)` called in `get_piston()`
before returning. Pass-through now; real logic added when versions increment.
**Fits in:** S1-4 (hook), future sessions (migration logic).

### GAP-S29-13: Jinja2 template errors uncaught
**Found during:** S1-3 backend audit (also Grok review)
**Problem:** Template render failure propagates as unhandled 500. No useful detail
to frontend.
**What needs to happen:** Wrap compiler call in try/except for Jinja2 TemplateError.
Return structured error with template name and context.
**Fits in:** S1-4.

### GAP-S29-14: `slugify` in Compiler class, not utils.py ✅ CLOSED Session 31
**Found during:** S1-3 backend audit (also Grok review)
**Closed:** utils.py created in Session 31. `slugify()` moved there.
`compiler.py` now has a thin wrapper delegating to `utils.slugify()`.
`storage.py` `get_all_slugs()` imports directly from utils — no Compiler needed.

### GAP-S29-15: `_mark_pistons_stale_for_global()` uses string scan heuristic
**Found during:** S1-3 backend audit
**Problem:** `if global_id in str(piston)` — false positives if global ID appears
in any string field. Does not walk the actual reference structure.
**What needs to happen:** S1-4: add comment flagging as known fragile heuristic.
S4-8: replace with proper walk of statements/variables/conditions arrays.
**Fits in:** S1-4 (comment), S4-8 (fix).

### GAP-S29-16: piston_text never-parse rule undocumented in code
**Found during:** S1-3 backend audit
**Problem:** The "never parse piston_text" rule exists in specs but not as a code
comment. Future developer could add a parse path without realizing it's prohibited.
**What needs to happen:** Add explicit comment in create/update piston handlers.
**Fits in:** S1-4.

### GAP-S29-17: Compile-on-save behavior — verify against spec
**Found during:** S1-3 backend audit
**Problem:** `update_piston()` runs a full compile on every save. May be slow or
unintentionally block save response. Need to confirm DESIGN.md Section 18 intent.
**What needs to happen:** Check DESIGN.md Section 18. If compile errors should
never block save success, confirm current behavior matches (it appears to — compile
result is supplementary). If spec says something different, fix it.
**Fits in:** S1-4 (confirm or fix).

### GAP-S29-18: MISSING_SPECS.md may be stale
**Found during:** S1-3 backend audit
**Problem:** Some items may have been resolved in recent sessions and not marked done.
**What needs to happen:** Quick 5-minute pass at start of S1-4 — check each item
against actual spec files and mark resolved ones done.
**Fits in:** S1-4 (housekeeping before coding starts).

---

## Gaps Found Session 27 — Needs Spec Clarification or Separate Session

### GAP-S27-1: action node tasks — embedded objects or flat IDs?
**Found during:** S1-2b editor.js rewrite
**Problem:** The flat model spec says control-flow child statements are referenced
by ID. But `action` node `tasks` are currently embedded objects (not flat-referenced).
The editor renders them as embedded. The compiler will need to know definitively
which model tasks use. If tasks ever move to flat IDs, both editor and compiler
break.
**What needs to happen:** PISTON_FORMAT.md and STATEMENT_TYPES.md must explicitly
state whether `tasks` inside an `action` node are embedded objects (not flat) or
flat-referenced by ID. Whichever is decided, add a note calling it out as a
deliberate exception (or non-exception) to the flat model rule.
**Fits in:** Start of S2-0 spec pass — resolve the decision, add one line to PISTON_FORMAT.md and STATEMENT_TYPES.md. No code needed.

### GAP-S27-2: else empty array always renders else branch
**Found during:** S1-2b editor.js rewrite
**Problem:** After S1-2a, the wizard always writes `else: []` on new if blocks.
The editor renders the `else` branch whenever `node.else !== undefined && node.else !== null`.
An empty array satisfies that check — so every new if block will show an else ghost
insertion point even if the user never added one. This is a behavior change; the old
code only showed else when the user explicitly added it.
**What needs to happen:** Decide: should else render when `else: []` (empty but
present) or only when `else` has at least one child ID? Update editor.js render
check and wizard.js skeleton accordingly. Document the decision.
**Fits in:** S3-1 render-back testing — decide and fix editor.js at that point.

### GAP-S27-3: switch case.statements — IDs or embedded objects?
**Found during:** S1-2b editor.js rewrite
**Problem:** The switch renderer assumes `case.statements` is an array of flat IDs
(consistent with the flat model). But the S1-2a wizard skeleton for switch was not
verified — if it writes embedded objects instead of IDs, the switch renderer will
produce nothing.
**What needs to happen:** Check wizard.js `_handleStatementType` switch skeleton.
Confirm `case.statements` is written as `[]` (empty ID array, flat model) not as
`[{...}]` (embedded). Fix wizard if wrong. Verify during render-back testing.
**Fits in:** S3-1 render-back testing — catch and fix wizard.js at that point.

### GAP-S27-4: for loop field names — verify wizard skeleton matches renderer
**Found during:** S1-2b editor.js rewrite
**Problem:** The `for` renderer expects `node.variable`, `node.from`, `node.to`,
`node.step`. The S1-2a wizard skeleton for `for` was not verified to use those
exact field names.
**What needs to happen:** Check wizard.js `_handleStatementType` for the `for`
skeleton. Confirm field names match. Fix wizard.js if wrong. Verify during
render-back testing.
**Fits in:** S3-1 render-back testing — catch and fix wizard.js at that point.

---

## Gaps Found Session 28 — Needs Action

### GAP-S28-1: tasks embedded vs flat — needs spec documentation
**Found during:** S1-2c compiler.py flat array refactor
**Problem:** `tasks` inside action nodes are embedded objects, not flat ID references.
This is correct behavior — `action` is not a control-flow type. But neither
PISTON_FORMAT.md nor STATEMENT_TYPES.md explicitly calls this out as a deliberate
exception to the flat model rule, which could confuse future maintainers.
**What needs to happen:** Add a note to PISTON_FORMAT.md and STATEMENT_TYPES.md
explicitly stating that `tasks` inside action nodes are embedded objects and this
is intentional — not an oversight.
**Fits in:** Start of S2-0 — spec-only, no code, fits the spec-writing part of that session.

### GAP-S28-2: else_ifs on if blocks not compiled
**Found during:** S1-7 session 1 compiler bug fixes
**Problem:** The `else_ifs` field is defined in PISTON_FORMAT.md and written by
wizard.js but `_compile_if_block` currently ignores it entirely.
**What needs to happen:** Implement `else_ifs` compilation in `_compile_if_block`.
Each else_if is a condition + then branch, compiled to an additional `elif:` block
in HA's choose structure. See COMPILER_SPEC for the expected output.
**Fits in:** S1-7 session 2.

### GAP-S28-3: automation.yaml.j2 and script.yaml.j2 may use slug not piston_id ✅ DONE S30
**Fixed in Session 30:** Both templates updated — slug → piston_id for entity IDs
and filenames. S1-5 is unblocked.

### GAP-S28-5: PyScript compiler template decision not made ✅ DONE Session 34
**Found during:** Post-session review of PYSCRIPT_COMPILER_SPEC.md
**Problem:** The native YAML compiler uses Jinja2 templates so HA YAML syntax
changes only require template edits, not compiler code changes. PyScript also has
occasional API changes (decorator names, `task.unique()` syntax, `service.call()`
signature, `state_trigger` argument format). The PyScript compiler spec was written
assuming pure Python string generation throughout — this decision was never explicitly
made and was never compared against the template approach used for native YAML.
Coding the PyScript compiler without resolving this will either lock in the wrong
approach or require a rewrite when the first PyScript API change hits.
**What needs to happen:** ✅ Done Session 34 — Section 4.1 added to PYSCRIPT_COMPILER_SPEC.md.
Hybrid approach: Jinja2 templates for 5 boilerplate patterns, pure Python string
generation for body logic. MISSING_SPECS.md Item 16 closed.

### GAP-S28-4: 6 test pistons in tests/pistons/ not yet created
**Found during:** S1-7 session 1 — TASKS.md required them before marking done
**Problem:** The 6 compiler test piston JSON files were not created this session.
They are needed to prove the compiler produces correct output as bugs are fixed.
**What needs to happen:** Create the 6 flat-format piston JSON files in tests/pistons/:
`test_conditions.json`, `test_waits.json`, `test_parallel.json`, `test_nested.json`,
`test_foreach.json`, `test_chicken_lights.json`.
**Blocked until:** S3-1 passes. The wizard must produce real piston output before
hand-written test JSON is meaningful — without a working reference the test files
could just encode the same bugs. Do this between S3-1 and S3-2.
**Fits in:** After S3-1 passes, before S3-2 deferred validation testing.

---

## Gaps Found Session 31

### GAP-S31-1: get_all_slugs() in storage.py — circular import risk ✅ CLOSED Session 31
**Found during:** S1-5 code review
**Closed:** utils.py created. `slugify()` moved from Compiler class to utils.py.
`storage.py` `get_all_slugs()` now imports from utils. `compiler.py` `slugify()`
method is now a thin wrapper delegating to `utils.slugify()`. No circular import
possible — utils.py has no PistonCore imports.

### GAP-S31-2: _setup_ha_config() errors not surfaced to UI
**Found during:** S1-5 implementation review
**Problem:** If `configuration.yaml` write fails (wrong path, read-only mount, Samba
not connected), `_setup_ha_config()` logs a warning but the user sees nothing in the
PistonCore UI. They will be confused when deploy fails with no clear explanation.
**What needs to happen:** Add a startup status endpoint (`GET /startup-status`) that
returns whether setup succeeded, what was done, and any errors. Frontend reads this
on load and shows a banner if setup failed or ha_restart_required is True.
**Fits in:** S4-0 error states inventory — do when frontend error state work starts.

### GAP-S31-3: PyScript deploy path not implemented
**Found during:** S1-5 implementation
**Problem:** `pyscript/pistoncore/` directory is created on startup, but the deploy
endpoint has no PyScript file write path or `pyscript.reload` service call.
**What needs to happen:** Add PyScript file write and `ha_client.call_service("pyscript", "reload")`
to deploy endpoint when compile_target is "pyscript".
**Fits in:** S1-7 session 2 — do when PyScript compiler is built and produces output.

### GAP-S31-5: ha_config_path has no UI
**Found during:** S1-5 implementation
**Problem:** User cannot set `ha_config_path` without directly editing config.json on
the Docker volume. No settings UI exists.
**What needs to happen:** Settings page must include a ha_config_path field with a
test button that checks if the path is reachable and configuration.yaml exists there.
**Fits in:** Settings page implementation — blocked by MISSING_SPECS.md Item 3.

### GAP-S31-6: endpoints.json references write_automation REST endpoint that doesn't exist
**Found during:** S1-5 research — confirmed HA REST API has no file write endpoint
**Problem:** DESIGN.md Section 15 and the customize volume `endpoints.json` reference
`write_automation` as a REST endpoint. This endpoint does not exist in HA. File writing
is done via direct filesystem access (ha_config_path), not via REST API.
**What needs to happen:** Remove `write_automation` from endpoints.json and from
DESIGN.md Section 15. Add notes explaining the filesystem approach. Cosmetic — does
not affect any running code since endpoints.json is not yet used by ha_client.py.
**Fits in:** A spec/customize volume cleanup pass. Low priority.

---

## Gaps Found Session 32

### GAP-S32-1: _get_app_version() dead code ✅ CLOSED Session 32
**Found during:** S1-6 code review
**Closed:** Removed from api.py same session. context_builder.py reads
app_version directly from storage.load_config().

---

## Gaps Found Session 33

### GAP-S33-1: else_ifs on if blocks not compiled ✅ DONE Session 34
**Found during:** S1-8 compiler rewrite / S1-7 bug fixes
**Problem:** _compile_if_block() handles then/else correctly but the else_ifs
array is completely ignored. A piston with "else if" branches compiled silently
drops those branches. This is GAP-S28-2 carried forward.
**What needs to happen:** Implement else_ifs compilation in _compile_if_block().
Each else_if is a condition + then branch. Compile to additional elif: blocks
in HA's if/then/else structure or nested if blocks. See COMPILER_SPEC Section 8.4.
**Fits in:** ✅ Done Session 34 — elif: block support added to _compile_if_block and if_block.yaml.j2.

### GAP-S33-2: condition_and/or template indentation needs real-world testing
**Found during:** S1-8 template rewrite
**Problem:** condition_and.yaml.j2 and condition_or.yaml.j2 receive pre-compiled
condition blocks and re-indent them using Jinja2 indent filter. Nested cases
(AND group inside OR group, etc.) have not been tested against real HA.
**What needs to happen:** Test with a piston that uses nested AND/OR condition
groups. Verify output YAML is correctly indented and HA accepts it.
**Fits in:** S3-2 deferred validation testing, or catch during S3-1 round-trip.

### GAP-S33-3: _compile_time_condition "is" operator aborts instead of warning ✅ DONE Session 34
**Fixed in:** Session 34 (S1-7 session 3).
Changed to compute a 1-second bracket (±1 second with midnight rollover) and render
condition_time.yaml.j2 with after/before. Warning surfaces as a YAML comment in the
compiled output. Does NOT emit a CompilerMessage — see GAP-S34-1.

---

## Gaps Found Session 34

### GAP-S34-1: _compile_single_condition has no access to warnings list ⚠ OPEN
**Found during:** GAP-S33-3 fix (time condition "is" operator)
**Problem:** _compile_single_condition() and _compile_time_condition() do not receive
the warnings list. The 1-second window warning for time "is" conditions surfaces only
as a YAML comment in compiled output — it does NOT appear as a CompilerMessage in
result.warnings and therefore won't show in the PistonCore UI.
**What needs to happen:** Add optional `warnings: list = None` parameter to
_compile_single_condition() and thread it through to _compile_time_condition() so
it can append a proper CompilerMessage. Update all callers that have warnings available.
**Fits in:** Whenever compiler.py is next opened after S3-1. Low priority — YAML comment is sufficient for beta use.

---

## Minor / Cosmetic (Do Anytime, Low Priority)

- **(Gap B)** Add `.dockerignore` to repo — Docker image likely includes screenshots,
  zip files, and dev artifacts. Bloats the image unnecessarily.
- AI-UPDATE-GUIDE.md files for each customize volume folder (DESIGN.md Section 31):
  `templates/`, `ha_api/`, `compiler/`, `validation-rules/`

---

## Session Start Checklist

Before writing any code:
1. Read CLAUDE_SESSION_PROMPT.md
2. Read TASKS.md (this file)
3. Find the next incomplete task in the current Stage
4. Read only the spec files listed for that task
5. Upload only the code files listed for that task
6. Propose changes as text — get approval before writing to files

Before ending any session:
1. Update CLAUDE_SESSION_PROMPT.md — what was done this session
2. Update TASKS.md — mark task done, note any new gaps discovered
3. Confirm which task is next so the next session starts without guessing
