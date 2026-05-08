# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 28 complete (S1-2c and S1-7 session 1 done)
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

### S1-3: main.py Backend Audit (Audit Only, No Fixes Yet)
**Why third:** Before fixing anything in the backend, get a complete picture of
what is wrong. Fixing one thing at a time without the full list leads to
partial fixes and missed gaps.
**Spec ref:** DESIGN.md Sections 4, 15, 24, 26
**Upload:** main.py, api.py, DESIGN.md, FRONTEND_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
**What to audit for:**
- BASE_URL injection missing (critical — breaks addon ingress)
- Companion stubs still present in deploy endpoint (must remove)
- Any piston_text parsing (must remove — not a v1 format)
- Statement JSON field names in save/validation logic (may still use old names)
- device_map handling — must store/return list format per PISTON_FORMAT.md
- Snapshot export — does it strip entity IDs correctly?
- Role mapping on import — is it implemented at all?
- WebSocket `/ws` endpoint — confirmed absent by external review, must be added
- duplicate/import API methods — missing, frontend calls them and gets errors

**Output:** A written audit list of every gap found. No code written this session.

---

### S1-4: main.py / api.py Backend Cleanup
**Why fourth:** Remove dead code and stubs before adding anything new. Clean slate
makes the HA write implementation in S1-5 easier to reason about.
**Spec ref:** DESIGN.md Sections 4, 24, 26
**Upload:** main.py, api.py, backend/README.md, DESIGN.md, FRONTEND_SPEC.md, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
**Fix in this order:**
1. Remove `_send_to_companion()` stub function from api.py entirely
2. Remove all companion references from api.py comments and docstrings
3. Remove companion references from backend/README.md
4. Remove any piston_text parsing
5. Fix statement field names in save/validation logic
6. Fix device_map handling — must store/return list format per PISTON_FORMAT.md
7. Add BASE_URL injection at page serve time
8. Add `/ws` WebSocket endpoint (basic — exists, stays connected, no logic yet)
9. Add duplicate/import API stubs that return a clean not-yet-implemented error
   instead of crashing the frontend
10. **(Gap E)** Add central logging config at startup in main.py (level, format,
    output). Low effort, high value for debugging.

**Output:** Backend with no dead companion code, no piston_text references,
correct field names, and no crashing on known frontend calls.

---

### S1-5: HA Direct Write — Deploy Implementation
**Why fifth:** This is what the companion stub was supposed to do. Now we implement
it correctly using direct REST API calls from ha_client.py.
**Depends on:** S1-2c complete AND S1-7 session 1 complete AND GAP-S28-3 resolved.
- GAP-S28-3: `automation.yaml.j2` and `script.yaml.j2` templates must be verified
  to use `piston_id` (not `slug`) for entity IDs and filenames. Fix templates before
  starting this task or deployed files will have wrong entity IDs.
**Spec ref:** DESIGN.md Sections 22, 13, 16
**Upload:** ha_client.py, api.py, DESIGN.md, COMPILER_SPEC.md, automation.yaml.j2,
script.yaml.j2, CLAUDE_SESSION_PROMPT.md, TASKS.md
**What gets built:**
- Deploy endpoint calls compiler → gets YAML strings back
- Writes automation YAML to `<ha_config>/automations/pistoncore/pistoncore_{uuid}.yaml`
- Writes script YAML to `<ha_config>/scripts/pistoncore/pistoncore_{uuid}.yaml`
- Calls `POST /api/services/automation/reload` via HA REST
- Calls `POST /api/services/script/reload` via HA REST
- Catches reload failure — returns error to frontend, old version stays active
- File write uses token from config.json (Docker) or SUPERVISOR_TOKEN (addon)
- Every written file includes the signature header (DESIGN.md Section 13)

**Sequence:**
1. Compile piston → YAML strings in memory
2. yamllint check on strings before writing
3. Write files to HA config directories
4. Call reload endpoints
5. Return success or structured error per DESIGN.md Section 18

**Output:** A piston that actually deploys to HA. This is the first real end-to-end
deploy. Test it against a real HA instance before marking done.

---

### S1-7: Compiler Bug Fixes — Session 1 of 2 ✅ DONE (Session 28)

**What was done:** See Session 28 entry in DONE section below.

**Outstanding before fully closed:**
- GAP-S28-3: Verify `automation.yaml.j2` and `script.yaml.j2` use `piston_id`
  not `slug` for entity IDs/filenames. Fix templates if wrong. **Blocks S1-5.**
- GAP-S28-4: 6 test pistons in `tests/pistons/` not yet created. Required before
  this task is fully done. Can be done standalone or at start of S1-3 session.

---

### S1-6: Fat Compiler Context Assembly (After S1-5)

**Why:** The compiler receives a fat context object (COMPILER_SPEC.md Section 7)
containing entity states, services, HA version, globals, and more. Nothing
currently builds this object. S1-5 deploy works with a stub context — this
replaces the stub with real data from HA.
**Do after:** S1-5 complete and tested against real HA.
**Spec ref:** COMPILER_SPEC.md Section 7, DESIGN.md Section 4
**Upload:** api.py, ha_client.py, COMPILER_SPEC.md, DESIGN.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

**Note:** Write the fat context spec first in this session (no code), then
implement. See MISSING_SPECS.md Item 13.

**What gets built:**
A `build_compiler_context(piston, ha_client)` function that:
1. Reads piston JSON (pass through)
2. Calls `GET /api/states` via HAClient → builds `entity_states` dict
3. Calls `GET /api/services` via HAClient for domains in piston device_map → builds `services` dict
4. Calls `GET /api/` via HAClient → reads `version` field → `ha_version`
5. Reads `globals.json` from userdata volume → builds `global_variables` array
6. Reads piston `variables` array → `piston_variables` (pass through)
7. Calls `GET /api/states` filtered for `zone.*` entities → `zones`
8. Calls area registry endpoint → `areas`
9. Assembles into fat context object and returns it

**Failure handling:**
- Entity states fetch fails → abort deploy, return error to frontend
- Services fetch fails → degrade gracefully, compiler warns on unknown services
- HA version fetch fails → use `"unknown"`, compiler proceeds with warnings
- globals.json missing → treat as empty list, not an error

**Where this code lives:** New function in ha_client.py or new context_builder.py.
Not in api.py — api.py calls it.

**Output:** `compile_piston()` receives a real fat context object on every deploy.
No more stub context. Compiler warnings about missing entity data are now meaningful.

---

### S1-7: Compiler Bug Fixes — Session 2 of 2 (After S1-6)

**Do after:** S1-6 complete (real context assembly in place).
**Spec ref:** COMPILER_SPEC.md Section 11. PISTON_FORMAT.md. STATEMENT_TYPES.md.
**Note:** Read MISSING_SPECS.md Item 14 (Time Condition Compiler Path) before
starting Bug 8. That spec must be written before the template-condition compiler
is coded. Write it in this session if not already done.
**Upload:** compiler.py, COMPILER_SPEC.md, PISTON_FORMAT.md, STATEMENT_TYPES.md,
PYSCRIPT_COMPILER_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

**REQUIRED DESIGN DECISION BEFORE CODING — PyScript templates (GAP-S28-5):**
PyScript has occasional API changes (decorator names, `task.unique()` syntax,
`service.call()` signature, `state_trigger` argument format). The native YAML
compiler uses Jinja2 templates for exactly this reason. The PyScript compiler
must make the same decision before being coded.

Decision to make at start of this session:
- **Option A:** Use Jinja2 templates for PyScript boilerplate — same customize
  volume pattern as native YAML. Templates: `pyscript_state_trigger.j2`,
  `pyscript_service_call.j2`, `pyscript_task_unique.j2`,
  `pyscript_completion_event.j2`, `pyscript_time_trigger.j2`. Body logic
  (if/while/for/set_variable) remains Python string generation — templates
  are only for the structural boilerplate that PyScript changes version to version.
- **Option B:** Pure Python string generation throughout. Accept that PyScript
  API changes require compiler.py edits.

Recommended: Option A. The boilerplate lines are small, self-contained, and
appear in predictable places — exactly the right fit for templates. Body logic
stays as Python string generation because indentation is semantic.

Write the template design into PYSCRIPT_COMPILER_SPEC.md (new Section 4.1)
before writing any PyScript compiler code. Then create the template files.

**Fix in this session (Tier 2 — output looks valid but behaves wrong):**
8. **Bug 8 — Conditions compiled as state blocks, spec says template:** Build
   full template-condition compiler per COMPILER_SPEC Section 11. Conditions must
   compile to Jinja2 `condition: template` / `value_template:`. Cannot express
   aggregation, `is any of`, `is between`, or combined and/or without this.
9. **Bug 9 — Aggregation silently dropped:** `aggregation` field never read.
   "Any of {Doors} is open" compiles as "first mapped door is open." Fix using
   Jinja2 `any()`/`all()` template expressions.
10. **Bug 10 — is_trigger not filtered in condition compilation:** Trigger conditions
    must not appear in `if:` blocks. Filter on `is_trigger: true` in condition
    compiler path.
11. **Bug 12 — Parallel branch missing continue_on_error at sequence level:** Emit
    `continue_on_error: true` at the branch sequence level. (See HA_LIMITATIONS.md
    — moved from "already handled" this session.)
12. **Bug 15 — Completion event in switch/do branches (verify first):** Verify
    `_compile_switch_block` and `_compile_do_block` pass
    `_append_completion_event=False` in recursive calls. Fix only if broken.
13. **Bug 16 — for_loop variable substitution is fragile text-replace:** Replace
    text-replace with proper template variable binding.
14. **Bug 17 — $sunrise/$sunset offset uses string not datetime:** Change to
    `as_datetime(state_attr('sun.sun', 'next_rising'))` pattern.
15. **Bug 18 — $currentEventDevice resolution is context-dependent:** Must resolve
    differently by context:
    - Inside a native automation action triggered by a state trigger → `{{ trigger.entity_id }}`
    - Inside a PyScript on_event handler → `var_name` from kwargs
    - Outside any trigger context in a native compile → CompilerError
    Do not blanket-error for all native compiles — valid native automations can
    reference `trigger.entity_id`.
16. **Bug 25 — No PyScript dispatch:** Add branch on `compile_target` in
    `compile_piston`. Stub is acceptable but the branch must exist.
17. **Bug 26 — ThreadPoolExecutor per call causes connection leaks** (ha_client.py):
    Refactor to await-able from FastAPI handler directly.
18. **Bug 27 — get_services caches per entity not per domain:** Cache per-domain.
    `get_services("light.a")` and `get_services("light.b")` should share one fetch.
19. **Bug 28 — _field_type doesn't handle entity_id selector:** Fix wizard UX for
    service fields that select an entity.
20. **Bug 20 — File signature header (verify):** Confirm templates emit correct
    format per COMPILER_SPEC Section 6.
21. **Bug 21 — Hash not computed:** Add `hashlib.sha256()` against compiled output
    in backend (api.py, not compiler.py).

**Output:** All 6 test pistons from S1-7 session 1 still pass. Time conditions,
aggregation, and multi-device with-blocks all compile correctly. **Then proceed
to S2-0.**

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

**Upload:** main.py, storage.py (if exists), DESIGN.md, MISSING_SPECS.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
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

### S2-5: HA Version Detection — Wire In
**Spec ref:** DESIGN.md Section 9
**Upload:** ha_client.py, main.py, DESIGN.md, COMPILER_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
**What gets built:**
- On every HA connect, call `GET /api/` and store detected HA version
- Display in settings/status area
- Version stored for compiler template selection
- Re-checked on every reconnect

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
Open: GAP-S28-3 (verify automation/script templates use piston_id — blocks S1-5),
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
**Blocks:** S1-2c if compiler assumes wrong model. Verify before or during S1-2c.

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
**Fits in:** A small editor.js fix once the decision is made. Can be done in S1-2c
session as a side fix or its own mini-session.

### GAP-S27-3: switch case.statements — IDs or embedded objects?
**Found during:** S1-2b editor.js rewrite
**Problem:** The switch renderer assumes `case.statements` is an array of flat IDs
(consistent with the flat model). But the S1-2a wizard skeleton for switch was not
verified — if it writes embedded objects instead of IDs, the switch renderer will
produce nothing.
**What needs to happen:** Check wizard.js `_handleStatementType` switch skeleton.
Confirm `case.statements` is written as `[]` (empty ID array, flat model) not as
`[{...}]` (embedded). Fix wizard if wrong. Verify during render-back testing.
**Fits in:** Render-back verification pass for S1-2b. Fix wizard.js if needed.

### GAP-S27-4: for loop field names — verify wizard skeleton matches renderer
**Found during:** S1-2b editor.js rewrite
**Problem:** The `for` renderer expects `node.variable`, `node.from`, `node.to`,
`node.step`. The S1-2a wizard skeleton for `for` was not verified to use those
exact field names.
**What needs to happen:** Check wizard.js `_handleStatementType` for the `for`
skeleton. Confirm field names match. Fix wizard.js if wrong. Verify during
render-back testing.
**Fits in:** Render-back verification pass for S1-2b. Fix wizard.js if needed.

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
**Fits in:** Spec-only mini-session or rides along with another spec-touch session.

### GAP-S28-2: else_ifs on if blocks not compiled
**Found during:** S1-7 session 1 compiler bug fixes
**Problem:** The `else_ifs` field is defined in PISTON_FORMAT.md and written by
wizard.js but `_compile_if_block` currently ignores it entirely.
**What needs to happen:** Implement `else_ifs` compilation in `_compile_if_block`.
Each else_if is a condition + then branch, compiled to an additional `elif:` block
in HA's choose structure. See COMPILER_SPEC for the expected output.
**Fits in:** S1-7 session 2.

### GAP-S28-3: automation.yaml.j2 and script.yaml.j2 may use slug not piston_id ⚠ BLOCKS S1-5
**Found during:** S1-7 session 1 — Bug 14 fix
**Problem:** The compiler now passes both `piston_id` and `slug` to the render
templates. But the templates themselves may still use `slug` where they should
use `piston_id` — for `id: pistoncore_{x}`, `script.pistoncore_{x}`, and
filenames. If so, deployed files will have slug-based entity IDs that break on
piston rename.
**What needs to happen:** Upload `automation.yaml.j2` and `script.yaml.j2` and
verify they use `piston_id` for all stable identifiers and `slug` only for `alias:`.
Fix if wrong. Do this before S1-5.
**Fits in:** Start of S1-5 session — upload templates alongside ha_client.py and api.py.

### GAP-S28-5: PyScript compiler template decision not made ⚠ BLOCKS S1-7 SESSION 2
**Found during:** Post-session review of PYSCRIPT_COMPILER_SPEC.md
**Problem:** The native YAML compiler uses Jinja2 templates so HA YAML syntax
changes only require template edits, not compiler code changes. PyScript also has
occasional API changes (decorator names, `task.unique()` syntax, `service.call()`
signature, `state_trigger` argument format). The PyScript compiler spec was written
assuming pure Python string generation throughout — this decision was never explicitly
made and was never compared against the template approach used for native YAML.
Coding the PyScript compiler without resolving this will either lock in the wrong
approach or require a rewrite when the first PyScript API change hits.
**What needs to happen:** At the start of S1-7 session 2, make the explicit design
decision and document it in PYSCRIPT_COMPILER_SPEC.md Section 4.1 before any
PyScript compiler code is written. Recommended: Jinja2 templates for structural
boilerplate (decorators, service calls, task.unique, completion event), pure Python
string generation for body logic (if/while/for/set_variable) where indentation
is semantic and templates would be painful.
**Fits in:** First thing in S1-7 session 2. Upload PYSCRIPT_COMPILER_SPEC.md
alongside the other files for that session.
**Found during:** S1-7 session 1 — TASKS.md required them before marking done
**Problem:** The 6 compiler test piston JSON files were not created this session.
They are needed to prove the compiler produces correct output as bugs are fixed.
**What needs to happen:** Create the 6 flat-format piston JSON files in tests/pistons/:
`test_conditions.json`, `test_waits.json`, `test_parallel.json`, `test_nested.json`,
`test_foreach.json`, `test_chicken_lights.json`.
**Fits in:** Can be done standalone (small session, JSON only) or at the start of
the S1-3 backend audit session since that session writes no code.

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
