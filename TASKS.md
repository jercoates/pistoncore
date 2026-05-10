# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 36 complete (S-NESTED Session B — editor.js nested tree migration)
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

### S-NESTED: Nested Tree Migration ← CURRENT PRIORITY

**Root cause of all editor render reliability concerns.**
The flat ID-reference model (S1-2a/b/c) was replaced with a nested tree model
where control flow nodes own their children directly. No ID references between
statements. No lookup map. No orphaned nodes possible.

**Session A — Spec + compiler.py ✅ DONE (Session 35)**
- PISTON_FORMAT.md rewritten to nested tree model. piston_text removed.
- DESIGN.md Section 6 updated.
- STATEMENT_TYPES.md child array field descriptions updated.
- COMPILER_SPEC.md Sections 9.3 and 10.2 updated.
- compiler.py: _compile_sequence accepts objects directly, stmt_map removed,
  all control-flow methods updated, _collect_triggers recurses nested tree.

**Session B — editor.js ✅ DONE (Session 36)**
- _actionLines: accepts object arrays directly, stmtMap gone from signature and
  all 13 recursive calls.
- _renderDocument: passes p.statements objects directly, stmtMap build removed.
- _findNode: recursive tree walk replaces flat map lookup. Signature changed to
  _findNode(id, nodes) — called as _findNode(id) to search from root.
- _buildStmtMap: deleted.
- _findAnyNode: updated call site to new _findNode.
- _removeNode: recursive tree splice replaces flat ID filter.
- _insertAfter: finds owning array in tree, splices there.
- _replaceNode: new helper — replaces node in-place anywhere in tree.
- insertStatement: uses _replaceNode for update-in-place; if_condition uses
  _findNode; strips _blockId before storing.
- for renderer: node.from/to/variable → node.start/end/counter_variable (GAP-S27-4).
- switch renderer: node.variable/role → node.expression; node.default_statements
  → node.default.
- wait_for_state renderer: renders conditions array + timeout as multi-line block.
- GAP-S27-2: else branch renders only when node.else.length > 0.
- piston_text generation removed from save().
- _normalizePiston: added on load — checks logic_version/ui_version against
  supported max (throws on future version), removes malformed nodes recursively.

**Session C — wizard.js audit + S3-1 round-trip test ← NEXT**
Upload: wizard.js, editor.js, PISTON_FORMAT.md, STATEMENT_TYPES.md, TASKS.md,
CLAUDE_SESSION_PROMPT.md

What changes:
- Verify all wizard commit functions produce correct nested output
- Skeleton objects write empty arrays — confirm they work with nested render
- GAP-S36-1: Replace _blockId stamp mechanism with proper channel (see gaps below)
- GAP-S36-2: Deep re-ID on paste/duplicate (see gaps below)
- GAP-S27-4: for loop field names — verify wizard skeleton matches corrected renderer
  (wizard already writes start/end/step/counter_variable — confirm and close gap)
- Build one real piston, verify all six round-trip steps pass

---

### S1-2a: Flat Statements Array — wizard.js ✅ DONE (Session 26)
**Note:** The type name fixes, field name fixes, and skeleton completeness work from
this session are all still valid and carry forward to the nested model. The flat/nested
distinction only affects how children are stored — the individual statement objects
and their fields are unchanged.

---

### S1-2b: Flat Statements Array — editor.js ⚠ SUPERSEDED by S-NESTED Session B ✅ DONE (Session 36)
The flat model implementation is replaced by the nested tree implementation.

**Render-back verification table — to be completed during S-NESTED Session C:**

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

---

### S1-2c: Flat Statements Array — compiler.py ⚠ SUPERSEDED by S-NESTED Session A ✅ DONE (Session 35)
The flat model implementation has been replaced by the nested tree implementation.
compiler.py now accepts child statement objects directly — no stmt_map, no ID resolution.

---

### S1-3: Backend Audit ✅ DONE (Session 29)
**What was done:** Full written audit of api.py and main.py. No code written.
18 gaps documented. All assigned to S1-4 or later sessions.

---

### S1-4: main.py / api.py Backend Cleanup ✅ DONE (Session 30)

---

### S1-5: HA Direct Write — Deploy Implementation ✅ DONE (Session 31)

---

### S1-6: Fat Compiler Context Assembly ✅ DONE (Session 32)

---

### S1-7: Compiler Bug Fixes — Sessions 1-3 ✅ DONE (Sessions 28, 33, 34)

**Still open:**
- GAP-S34-1: _compile_single_condition has no warnings param. Low priority.
- GAP-S33-2: condition_and/or template indentation needs real-world testing → S3-2.
- Bug 26 (ThreadPoolExecutor) → S2-1
- Bug 27 (get_services cache per entity) → S2-1
- Bug 28 (_field_type entity_id selector) → S2-2

---

### S1-8: Template Compliance Pass ✅ DONE (Session 33)

All compiler methods route through Jinja2 templates. Zero inline HA YAML in Python.
15 new snippet templates created. AI-UPDATE-GUIDE.md updated.

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

**Upload:** main.py, storage.py (if exists), DESIGN.md, MISSING_SPECS.md,
PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
**Output:** Working SQLite DB created on startup, all tables present.

---

### S2-1: HAClient Abstraction + HA API Externalization
**Spec ref:** DESIGN.md Sections 4, 15
**Upload:** ha_client.py, main.py, DESIGN.md, COMPILER_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
**What gets built:**
- `HAClient(auth_mode, token=None)` class
- Supervisor mode: reads `SUPERVISOR_TOKEN` env var
- Token mode: reads from `config.json` on volume
- All existing HA calls routed through HAClient
- Externalize all HA REST endpoint URLs to `pistoncore-customize/ha_api/ha_YYYY.x/endpoints.json`
- Bug 26 (ThreadPoolExecutor connection leaks) fixed here
- Bug 27 (get_services caches per entity not domain) fixed here

---

### S2-2: device_map_meta — Wire Into Backend and Wizard
**Spec ref:** PISTON_FORMAT.md (device_map_meta), DESIGN.md Section 15.6
**Upload:** wizard.js, api.py, PISTON_FORMAT.md, DESIGN.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
**What gets wired:**
- Wizard sets `device_map_meta` cardinality when a device role is created
- Backend schema validation accepts and stores `device_map_meta`
- Snapshot export preserves `device_map_meta`
- Bug 28 (_field_type entity_id selector) fixed here

---

### S2-3: Snapshot Export — Backend Implementation
**Spec ref:** DESIGN.md Sections 6.2, 6.5
**Upload:** api.py, PISTON_FORMAT.md, DESIGN.md, FRONTEND_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### S2-4: Import Role Mapping Flow — Frontend + Backend
**Spec ref:** DESIGN.md Section 6.3, FRONTEND_SPEC.md (Import Dialog)
**Upload:** import dialog JS, api.py, PISTON_FORMAT.md, DESIGN.md, FRONTEND_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### S2-5: HA Version Detection — Display and Template Selection
**Note:** `get_ha_version()` already built in S1-6. What remains is wiring the stored
version into the UI and template selection — settings page work. Moved to Stage 4.

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
1. Wizard writes correct nested JSON ✓
2. Editor renders it correctly from that JSON ✓
3. Backend saves and returns it without corrupting any fields ✓
4. Compiler reads it and produces valid HA YAML ✓
5. Test Compile preview shows the YAML without errors ✓
6. Deploy writes to HA and reload succeeds ✓

**If any step fails:** That step becomes a new Stage 1 or Stage 2 task. Fix it and re-run.
**When all six steps pass:** Stage 3 is done. The seams are locked.
**Also complete:** The render-back verification table from S1-2b during this session.

---

### S3-2: Deferred Validation Testing (After S3-1 Passes)

**This is a testing session, not a coding session.**
- **D-1** — HA missing entity behavior test
- **D-5** — Sunrise/sunset negative offset edge cases
- **D-6** — Numeric trigger unknown/unavailable state behavior
- **D-7** — Long-running piston timeouts
- **GAP-S33-2** — condition_and/or template indentation in nested cases

Results go in HA_LIMITATIONS.md.

---

## STAGE 4 — Features (Only After Stage 3 Complete)

Once the round-trip works, each session below only needs its own listed files.

**Before starting any Stage 4 task, check MISSING_SPECS.md.** If the spec for
that feature is listed as missing, write the spec first — then code.

### S4-0: Write Missing Specs (as needed, before dependent tasks)
- **Error states inventory** → write BEFORE any Stage 4 UI work begins
- **WebSocket message protocol** → write before S4-9
- **Settings page frontend spec** → write before settings page is built
- **Piston list folder management** → write before folder management is built
- **write-a-piston.md content** → write before S4-10 — **BLOCKS S4-10**
- **PyScript compiler spec** → DONE (Session 24)
- **Test strategy** → write before v1 ships

### S4-1: PyScript Detection and Setup Prompt
### S4-2: Missing Device Handler (depends on D-1 validated)
### S4-3: Orphan Cleanup — Queue and Retry
### S4-4: Compiler Template System — Jinja2 Scaffolding
### S4-5: Pre-Save Validation Pipeline
### S4-6: File Signature and Hash System
### S4-7: Test Compile / Preview Mode
### S4-8: Global Variables — Stale Piston Tracking
### S4-9: Run Status Reporting — WebSocket Events
### S4-10: Snapshot Import — AI Prompt Files (blocked on write-a-piston.md)
### S4-11: AI-REVIEW-PROMPT.md — Update
### S4-12: target-boundary.json — Add Missing PyScript-Forcing Patterns
### S4-13: Sample Piston Library — Write Snapshot JSON
### S4-14: Best Practices Documentation

### S4-15: Operational Hardening
- **(Gap A)** Cache slug list in `get_all_slugs()`
- **(Gap C)** Document recommended uvicorn worker config
- **(Gap D)** Add startup validation in `docker-entrypoint.sh`
- **(Gap F)** Security section in README
- **(Gap G)** Tighten `_scan_globals` regex
- GAP-S30-3: Double config load per compile. Low priority.
- GAP-S31-6: endpoints.json dead reference. Low priority.
- **Grok Docker security findings (Session 34):**
  - Run as non-root user in Dockerfile (high priority before v1)
  - config.json permissions check at startup
  - HEALTHCHECK in Dockerfile/compose
  - Resource limits in compose example
  - Security headers middleware
- **Grok template findings (Session 34):**
  - Whitespace control in snippets ({%- ... -%})
  - template_info.json metadata file (fits S4-4)
- **Grok _setup_ha_config atomic write (Session 34):**
  - Write to tempfile first, then replace — prevents corruption on mid-write failure
- **GAP-S31-2:** _setup_ha_config() errors not surfaced to UI → fits S4-0

---

## DEFERRED — Blocked on External Validation or Not v1 Scope

### D-1: HA Missing Entity Behavior — Must Test Before Coding
**Blocks:** S4-2 missing device hard-flag logic

### D-2: Which-Interaction Step — Evaluate Feasibility First

### D-3: settings / end settings Block Contents

### D-4: Timer Statement — Evaluate Before Including

### D-5: Sunrise/Sunset Negative Offset Edge Cases

### D-6: Numeric Trigger Unknown State Behavior

### D-7: Long-Running Piston Timeouts

---

## DONE — Completed Sessions

### Session 36 — S-NESTED Session B: editor.js Nested Tree Migration ✅
All statement tree operations rewritten for nested object tree.
No flat statements array. No stmtMap. No ID references between statements.

editor.js changes:
- _actionLines: object arrays in, stmtMap gone from signature and all recursive calls.
- _renderDocument: p.statements objects passed directly.
- _findNode: recursive tree walk, called as _findNode(id) from root.
- _buildStmtMap: deleted.
- _findAnyNode: updated to new _findNode.
- _removeNode: recursive tree splice.
- _insertAfter: finds owning array in tree and splices there.
- _replaceNode: new helper, in-place replacement anywhere in tree.
- insertStatement: _replaceNode for update-in-place; _findNode for if_condition;
  strips _blockId before storing.
- for renderer: corrected to start/end/counter_variable (GAP-S27-4 fixed).
- switch renderer: expression operand, node.default (not default_statements).
- wait_for_state: multi-line block with conditions array and timeout.
- GAP-S27-2: else renders only when node.else.length > 0.
- piston_text generation removed from save().
- _normalizePiston: version check + malformed node removal on load.

wizard.js: no changes this session. _blockId mechanism still needed and
correct — cleanup deferred to Session C (GAP-S36-1).

New gaps opened: GAP-S36-1, GAP-S36-2, GAP-S36-3.
Gaps resolved: GAP-S27-2, GAP-S27-4.

### Session 35 — S-NESTED Session A: Nested Tree Spec + compiler.py ✅
Root cause of editor render reliability identified: flat ID-reference model.
Decision: migrate to nested tree. Children are embedded objects, not ID references.

Spec files updated: PISTON_FORMAT.md (v2.0), STATEMENT_TYPES.md (v2.0),
COMPILER_SPEC.md (v1.1), DESIGN.md Section 6, CLAUDE_SESSION_PROMPT.md, TASKS.md.
piston_text field removed from PISTON_FORMAT.md entirely.

compiler.py updated:
- _compile_sequence accepts list of statement objects directly. stmt_map removed.
- stmt_map parameter removed from all control-flow methods.
- _collect_triggers recurses into nested children.
- compile_piston: stmt_map build removed, _compile_sequence called with raw statements.

Tasks superseded:
- S1-2b (editor.js flat array) → SUPERSEDED by S-NESTED Session B ✅ DONE Session 36
- S1-2c (compiler.py flat array) → SUPERSEDED (this session)
- GAP-S28-1/GAP-S27-1 (tasks embedded exception) → RESOLVED (universal rule now)
- GAP-S27-3 (switch case.statements model) → RESOLVED
- Bug A / _blockId hack → routing now handled by _findNode; cleanup in Session C

### Session 34 — S1-7 Session 3: else_ifs + time condition + PyScript spec ✅
### Session 33 — S1-8: Template Compliance + S1-7 Session 2 Bug Fixes ✅
### Session 32 — S1-6: Fat Compiler Context Assembly ✅
### Session 31 — S1-5: HA Direct Write ✅
### Session 30 — S1-4: main.py / api.py Backend Cleanup ✅ + GAP-S28-3 Template Fix ✅
### Session 29 — S1-3: Backend Audit ✅
### Session 28 — S1-2c: compiler.py Flat Array + S1-7 Session 1 Bug Fixes ✅
### Session 27 — S1-2b: editor.js Flat Array ✅ (superseded by S-NESTED Session B)
### Session 26 — S1-2a: wizard.js Flat Array ✅
### Sessions 21-25 — Spec work, field alignment, COMPILER_SPEC rewrite ✅
### Sessions 1-20 — See DESIGN.md Section 33 (Development Log) ✅

---

## Gaps Found Session 36 — Still Open

### GAP-S36-1: wizard.js _blockId mechanism — replace with proper channel
**Found during:** S-NESTED Session B — insertStatement if_condition branch
**Problem:** Wizard stamps `_blockId` on the condition node object in
`_commitConditionAndMore` as a side-channel to tell the editor which if-block to
route the condition to on subsequent "Add more" clicks. Editor strips _blockId
before storing. Works but is fragile — routing metadata riding on the data object.
**What needs to happen:** In Session C, replace _blockId stamp with a proper
mechanism. Option A: add a second argument to `insertStatement(context, data, meta)`
for routing metadata. Option B: wizard passes blockId via a module-level variable
that insertStatement reads. Both sides must be updated together.
**Fits in:** S-NESTED Session C

### GAP-S36-2: _pasteSelected does not deep re-ID nested children
**Found during:** S-NESTED Session B — _pasteSelected
**Problem:** `clone.id = _nextStmtId()` gives the pasted copy a new top-level ID,
but nested children (then/else/statements/cases etc.) retain their original IDs.
If the original statement is still in the piston, duplicate child IDs exist in the
tree. The compiler uses IDs as YAML aliases — duplicates will produce invalid YAML.
**What needs to happen:** Write a `_deepReId(node)` function that walks the cloned
tree recursively and assigns a fresh _nextStmtId() to every node at every level,
including task IDs, condition IDs, case IDs, and else_if IDs.
**Fits in:** S-NESTED Session C

### GAP-S36-3: wait renderer branches 'until' and 'state' are untested
**Found during:** S-NESTED Session B — wait renderer
**Problem:** `wait_type: "until"` and `wait_type: "state"` render branches exist
in the editor but there is no wizard UI for these wait types yet. The wizard only
produces `wait_type: "duration"`. The render code is written to match
STATEMENT_TYPES.md but cannot be tested until the wizard supports these types.
**What needs to happen:** When wizard gets wait support, verify these render
branches and add to the render-back verification table.
**Fits in:** S-NESTED Session C or S3-1 round-trip test

---

## Gaps Found Session 34 — Still Open

### GAP-S34-1: _compile_single_condition has no warnings param
Time "is" warning is YAML-comment only, not a CompilerMessage. Low priority. Fits S1-7 session 4.

### GAP-S33-2: condition_and/or template indentation in nested cases
Needs real-world testing to confirm correctness. Fits S3-2.

### GAP-S34 Grok Findings — New Items For TASKS.md

**ha_client.py — fits S2-1:**
- No retry logic on _ws_call — single failure is a hard user error. Add exponential backoff.
- No reconnect on stale WebSocket — connection silently fails after HA restart.
- No /api/ha/status endpoint — users see silent failures instead of "Reconnecting..."

**ha_client.py — medium term (Stage 4, after S4-9):**
- Persistent WebSocket manager with reconnect loop, jittered backoff, ping/pong keepalive.

---

## Gaps Found Session 28 — Status Updated

### GAP-S28-4: 6 test pistons in tests/pistons/ not yet created
Still open. Required before S1-7 session 1 can be marked fully done per TASKS.md.
Fits after S3-1 — test pistons must use the nested format.
**Note:** Any test pistons written must use nested tree JSON per PISTON_FORMAT.md v2.0.
Do not write flat ID-reference format test pistons.

---

## Gaps Found Session 30

### GAP-S30-3: Double config load per compile call
Low priority. Fits S4-15.
