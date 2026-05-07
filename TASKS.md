# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 24 complete / Session 25 not started
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

### S1-2a: Flat Statements Array — wizard.js Only
**Why split:** Attempting wizard.js, editor.js, and compiler.py in one session
risks all three files ending in an inconsistent half-done state. Each sub-task
is bounded, independently testable, and safe to end a session on.
**Do this session:** wizard.js only. Do not touch editor.js or compiler.py.
**Spec ref:** PISTON_FORMAT.md (statements section), DESIGN.md Section 6.1
**Upload:** wizard.js, PISTON_FORMAT.md, STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
  write a flat statement object with empty child ID arrays (`then: []`, `else: []`,
  `statements: []`) and push it to the top-level statements array
- `_newId()` already generates correct 8-char hex IDs — no change needed
- When wizard creates an `if` block, it writes the if node flat; child statements
  added later go into the flat array and their IDs get added to `then`/`else`
- When wizard creates `do`, `for`, `while`, `repeat`, `for_each` — same pattern:
  flat node, empty child ID arrays, no nested objects
- `_commitConditionAndMore` and the `if` path in `_handleStatementType` must
  write the if node with `then: []` not `then: [conditionNode]`

**Testable output:** Wizard produces JSON where `statements` is a flat array.
Control flow nodes have `then`, `else`, `statements` as empty arrays or ID arrays —
never containing embedded statement objects. Can be verified by inspecting the
piston JSON after wizard saves.

**Note:** editor.js and compiler.py will be broken after this — the round-trip
won't work until S1-2b and S1-2c are done. That is expected and acceptable.

---

### S1-2b: Flat Statements Array — editor.js Only
**Do after S1-2a is committed.**
**Do this session:** editor.js only. Do not touch wizard.js or compiler.py.
**Spec ref:** PISTON_FORMAT.md (statements section), DESIGN.md Section 6.1
**Upload:** editor.js, PISTON_FORMAT.md, STATEMENT_TYPES.md, FRONTEND_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
**What must change:**
- Build a statement lookup map from the flat `statements` array at render time:
  `const stmtMap = Object.fromEntries(piston.statements.map(s => [s.id, s]))`
- `_actionLines` receives the flat array + lookup map. Resolves child IDs by
  looking up in the map rather than recursing into nested arrays
- `_findNode` rebuilt to look up by ID in the flat map — no more recursion
  into `n.then`, `n.else`, `n.statements`
- `_removeNode` removes by ID from the flat array — no more recursive search
- `_insertAfter` inserts into the flat array after finding the target by ID,
  then adds the new ID to the parent's child array
- `insertStatement` for nested contexts (adding inside `if.then`, `do.statements`
  etc.) pushes to flat array AND adds the new ID to the parent's child ID list
- `_flattenActions` no longer needed — replaced by flat array lookup

**Testable output:** Editor correctly renders a hand-written flat-format piston JSON.
Write one by hand (use the PISTON_FORMAT.md complete example), load it, verify
it displays correctly. Add a statement via wizard, verify it appears in the right place.

**Render-back verification required before marking done:**
Every statement type must pass the full backward round-trip — renders, clickable,
wizard opens pre-populated, save updates JSON correctly. Use this table:

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

If any row has a blank — fix it before marking S1-2b done. Silent fall-through in
`_actionLines` must render a visible error placeholder: `⚠ Unknown statement type: {type} — {id}`

**Also fix in this session — wizard pre-population bugs (A/B/C):**
- **Bug A — `insertStatement` doesn't handle `if_condition` context:** When wizard calls
  `insertStatement('if_condition', node, {'block-id': id})`, falls through to top-level
  array. Fix: add `if_condition` routing in `insertStatement` to find the block by ID
  and push to `block.conditions`.
- **Bug B — Two mechanisms for block-id conflict:** `_extra['block-id']` and
  `_sel.pending_if_id` both track which if block a condition belongs to. Pick one —
  `_extra['block-id']` is correct per spec. Remove `_sel.pending_if_id` entirely.
- **Bug C — `_buildConditionNode` doesn't pass `_blockId` back:** Add `_blockId:
  _extra?.['block-id'] || null` to the returned condition object so `insertStatement`
  can route correctly.

**Also add piston_text field generation:**
Generate `piston_text` on every save using the same render functions as the editor.
Only generate if all statements render successfully — if any render fails, preserve
the previous `piston_text` value unchanged. See PISTON_FORMAT.md warning block.

---

### S1-2c: Flat Statements Array — compiler.py Only
**Do after S1-2b is committed.**
**Do this session:** compiler.py only. Do not touch wizard.js or editor.js.
**Spec ref:** PISTON_FORMAT.md (statements section), COMPILER_SPEC.md Section 10.2
**Upload:** compiler.py, PISTON_FORMAT.md, STATEMENT_TYPES.md, COMPILER_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
**What must change:**
- Build a statement lookup map at the start of `_compile_sequence`:
  `stmt_map = {s['id']: s for s in piston['statements']}`
- Pass `stmt_map` into every recursive compile call
- `_compile_if_block`: resolve `then` and `else` by looking up IDs in stmt_map,
  not by reading nested objects from the statement itself
- `_compile_repeat_block`, `_compile_while_block`, `_compile_for_each_block`,
  `_compile_for_loop`, `_compile_do_block`: same pattern — resolve `statements`
  child IDs via stmt_map
- `_compile_switch_block`: resolve `cases[].statements` IDs via stmt_map

**Testable output:** Run the compiler's `__main__` test block against a flat-format
piston JSON. Verify it produces correct YAML output matching COMPILER_SPEC.md
Section 18 hand-verification example.

**Verification required before marking done:** After S1-2c is complete, run the
compiler against the exact Section 18 piston JSON in COMPILER_SPEC.md and verify
the output matches the hand-verification example exactly. This is the proof that
the flat-array refactor is correct end-to-end. Do not mark S1-2c done until this
passes.

**After S1-2c:** The flat-array refactor is complete. Proceed to S1-7 session 1
(compiler bug fixes — must happen before S1-5 writes anything to HA).

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
**Depends on:** S1-2c complete AND S1-7 session 1 complete — compiler must produce
correct YAML (flat array done) AND triggers must compile correctly (S1-7 session 1)
before deploy is meaningful. Writing empty-trigger automations to real HA is
counterproductive. Do not start S1-5 until both are done.
**Spec ref:** DESIGN.md Sections 22, 13, 16
**Upload:** ha_client.py, api.py, DESIGN.md, COMPILER_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
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

### S1-7: Compiler Bug Fixes — Session 1 of 2 (Before S1-5)

**Why before S1-5:** Tier 1 bugs mean every compiled automation has an empty
triggers list and will never fire. Condition indentation is malformed YAML that
HA will reject on reload. Writing this output to a real HA instance before fixing
these bugs wastes testing time and gives false confidence. Fix Tier 1 first, then
S1-5 deploys something that actually works.
**Do after:** S1-2c complete and Section 18 verification passed.
**Spec ref:** COMPILER_SPEC.md Sections 9.3, 10.2, 11. DESIGN.md Section 13.
**Upload:** compiler.py, COMPILER_SPEC.md, PISTON_FORMAT.md, STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

**Build compiler test piston suite first (before any bug fixing):**
Add 6 hand-written flat-format piston JSON files to `tests/pistons/`:
- `test_conditions.json` — every condition operator
- `test_waits.json` — every wait variant (duration, until, wait_for_state)
- `test_parallel.json` — parallel + with-block + multi-device role
- `test_nested.json` — deeply nested if/while/repeat
- `test_foreach.json` — for_each with dynamic attribute access
- `test_chicken_lights.json` — the chicken-lights piston
All six must compile to valid HA YAML before S1-7 session 1 is marked done.
These are the compiler test suite — keep them. They prove the compiler as new
bugs are fixed and new features added.

**Fix in this session (Tier 1 — HA will reject output):**
1. **Bug 1 — Triggers never populated (CRITICAL):** Compiler reads
   `piston.get("triggers", [])` — field doesn't exist in spec. Walk the
   `statements` array, find condition objects with `is_trigger: true`, compile
   those as triggers. Nothing else matters until this is fixed.
2. **Bug 2 — Triggers missing required `id:` field:** Every trigger template
   must emit an `id:` field per COMPILER_SPEC Section 9.3. Breaks `choose:` blocks
   and HA trace system.
3. **Bug 3 — wait_until missing timeout:** Compiler does not emit `timeout:` or
   `continue_on_timeout:`. Default 1 hour with CompilerWarning when user provides
   none. (See HA_LIMITATIONS.md — moved from "already handled" this session.)
4. **Bug 4 — if-block condition indentation malformed:** `_compile_if_block` produces
   `- - condition: state`. Return condition body without leading `-`; let parent
   prepend correctly. Fix for `if`, `repeat`, `while`, `until` all at once.
5. **Bug 5 — AND/OR recursive condition indentation malformed:** Same root cause as
   Bug 4. Fix together with Bug 4.
6. **Bug 6 — for_each body doesn't use per-iteration entity:** Text substitution
   only works if body contains literal `{{ var_name }}`. Entity IDs are baked from
   device_map — substitution does nothing. Fix per-iteration entity binding.
7. **Bug 7 — with_block only acts on first device:** Compiler picks `devices[0]`
   then `entity_id_list[0]`. Multi-device roles only act on the first entity.
   Compile for each entity in the role.

**Also fix in this session (quick wins while in the compiler):**
- **Bug 11 — Boolean state quoting not enforced:** Enforce quoting in
  `_compile_single_condition`, not just templates.
- **Bug 13 — call_piston uses slug not UUID:** Change
  `script.pistoncore_{target_slug}` → `script.pistoncore_{target_piston_id}`.
- **Bug 14 — Filename generation is slug-based:** Filenames must be
  `pistoncore_{uuid}.yaml`.
- **Bug 19 — Yes/No global write malformed YAML indentation:** Fix `default:`
  block indent level in `choose:` output.
- **Bug 22 — compile_piston signature doesn't match spec:** Align to
  `def compile_piston(context: dict) -> CompilerResult`.
- **Bug 23 — CompilerError messages lack code field:** Add SCREAMING_SNAKE_CASE
  codes (NO_TRIGGERS, UNMAPPED_ROLE, etc.).
- **Bug 24 — No validation that piston has triggers:** Emit `NO_TRIGGERS`
  CompilerError for empty triggers list.

**Output:** All 6 test pistons compile to valid HA YAML with correct triggers,
correct indentation, and no slug references. **Then proceed to S1-5.**

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
**Upload:** compiler.py, COMPILER_SPEC.md, PISTON_FORMAT.md, STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

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
