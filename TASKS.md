# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 40 complete (W-S1 through W-S4 — wizard + editor bug fixes)
**Authority:** CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files

---

## The Goal Before Everything Else

**Get to a clean round-trip on a simple piston:**
wizard writes JSON → backend saves it → compiler reads it → frontend renders it correctly

The wizard bugs have been fixed. Next step is to deploy and run the smoke test (S3-1).
If the smoke test passes, Stage 2 backend work can resume.

---

## How to Use This File

- **STAGE W** — Wizard rebuild. Core bugs fixed. Smoke test next.
- **STAGE 1** — Structural fixes. Mostly complete.
- **STAGE 2** — Connect the seams. Deferred until after smoke test passes.
- **STAGE 3** — Round-trip verified. Work can now split into focused modules.
- **STAGE 4** — Features. Only after Stage 3 is solid.
- **DEFERRED** — Known, not yet unblocked or not v1 scope.
- **DONE** — Completed and verified.

One task per session. Do not combine tasks.
Do not start a task without reading its listed spec files first.
Upload only the files needed for that task — nothing extra.

---

## STAGE W — Wizard Rebuild

### W-0: Wizard Rebuild Spec ✅ DONE (Session 40)
WIZARD_REBUILD_SPEC.md written. Covers every dialog, every field, every JSON output,
every device picker rule, complete flow for minimum viable piston, and 7 bugs in
fix order. In the repo.

---

### W-S1 through W-S4: Wizard + Editor Bug Fixes ✅ DONE (Session 40)

All 7 bugs from the spec fixed in one session:

**Bug 1 — Condition subject format** ✅
`_buildConditionNode()` now writes `subject` object that editor reads.
Conditions will render in the editor for the first time.

**Bug 2 — Statement inserted at wrong level** ✅
editor.js `insertStatement()` now handles `meta.blockId` + `meta.branch`.
Statements inside `if.then` land inside `if.then` not at top level.
All statement types (timer, repeat, for_each, skeletons) pass meta through.

**Bug 3 — Piston variables missing from device picker** ✅
All pickers now call `Editor.getPistonVariables()` filtered to `var_type === 'device'`
and show them under "Piston variables" section.

**Bug 4 — Wrong/duplicate HA entities** ✅
`ALLOWED_DOMAINS` constant + `_filterDevices()` helper added.
Domain filter and deduplication applied to all three device pickers:
`_renderActDevList`, `_renderDevPanelList`, `_renderVarInitDevList`.

**Bug 5 — `ha_service` wrong** ✅
`_saveDeviceCmd()` now writes `domain + '.' + command` (e.g. `light.turn_on`).

**Bug 6 — AND/OR between conditions** ✅
AND/OR selector now appears in condition builder when context is `if_condition`.
Written to `group_operator` on the condition node.

**Bug 7 — Delete not working** ✅
`_deleteEditNode()` already correct — wired properly. Confirmed not broken.

**Additional fixes in same session:**
- `_goForEachPicker()` — proper variable dropdown filtered to device-type piston vars
- `_renderVarInitDevList()` — domain filter + dedup added
- All section labels standardized to "Piston variables"

---

### W-S5: Smoke Test — Full Round-Trip on One Simple Piston ← NEXT SESSION

**What this is:** Deploy the fixed files and test the minimum viable piston flow.

**The 14-step test (from WIZARD_REBUILD_SPEC.md):**
1. Open editor on new piston
2. Click `· add a new statement` → W-1 opens
3. Click "Add an if block" → W-3 opens
4. Click "Add a condition" → W-4 opens
5. Select a physical device → attribute populates → select attribute
6. Select an operator → value field appears → enter a value
7. Click "Add" → if node inserted with condition inside it → editor re-renders
8. Inside the `then` block, click `· add a new statement` → W-1 opens
9. Click "Add an action" → W-5 opens
10. Piston device variables appear in the list (from define block)
11. Select a device → click "Next →" → W-6 opens with "With... {device}"
12. Select a command → click "Add" → action node inserted inside if.then
13. Editor re-renders showing complete piston
14. Save succeeds

**Also verify:**
- No duplicate or wrong-domain entities in any picker
- Piston variables from define block appear in action picker
- Conditions render correctly in the editor (not blank)
- AND/OR works when adding a second condition
- Saved piston JSON is valid nested tree (check in browser devtools or backend log)

**If any step fails:** Document exactly which step and what happened.
Do not start fixing things mid-smoke-test — finish the test first, then fix.

**Upload for this session:**
WIZARD_REBUILD_SPEC.md, wizard.js, editor.js, PISTON_FORMAT.md,
STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### W-S6+: Remaining Wizard Areas (after smoke test passes)

To be scoped after S3-1 passes. Known remaining gaps from WIZARD_REBUILD_SPEC.md:

- For loop detail screen (start/end/step fields, counter variable dropdown)
- Switch detail screen (expression operand)
- Every/timer detail screen (full time options — days of week, months, etc.)
- Globals in device pickers (deferred until global variable creation implemented)
- Drag and drop reordering in editor (safe to add after smoke test — editor.js only,
  uses existing `_removeNode` + `_insertAfter`, no JSON format changes)

---

## STAGE 1 — Structural Fixes (Mostly Complete)

### S-NESTED: Nested Tree Migration ✅ DONE (Sessions 35-37)
### S1-2a: Flat Statements Array — wizard.js ✅ DONE (Session 26)
### S1-2b: Flat Statements Array — editor.js ✅ DONE (Session 36)
### S1-2c: Flat Statements Array — compiler.py ✅ DONE (Session 35)
### S1-3: Backend Audit ✅ DONE (Session 29)
### S1-4: main.py / api.py Backend Cleanup ✅ DONE (Session 30)
### S1-5: HA Direct Write — Deploy Implementation ✅ DONE (Session 31)
### S1-6: Fat Compiler Context Assembly ✅ DONE (Session 32)
### S1-7: Compiler Bug Fixes ✅ DONE (Sessions 28, 33, 34)

**Still open — assigned to later sessions:**
- GAP-S34-1: _compile_single_condition has no warnings param → S4-15
- GAP-S33-2: condition_and/or template indentation needs real-world testing → S3-2
- Bug 28 (_field_type entity_id selector) → S2-2 (deferred until after wizard)

### S1-8: Template Compliance Pass ✅ DONE (Session 33)

---

## STAGE 2 — Connect the Seams (DEFERRED until smoke test passes)

All Stage 2 tasks are deferred until after S3-1 passes.

### S2-0: Storage Architecture Spec + SQLite Setup ✅ DONE (Session 38)
### S2-1: HAClient Abstraction ✅ DONE (Session 39)

### S2-2: device_map_meta — Wire Into Backend and Wizard
**DEFERRED until after smoke test.**
**Upload:** wizard.js, api.py, PISTON_FORMAT.md, DESIGN.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

**Open gaps to resolve this session when reached:**
- GAP-S39-1: Update import in api.py and compiler.py from `import ha_client` to
  `from ha_client import ha_client`. Audit all call sites in both files.
- GAP-S38-1: Add /api/logs route to api.py while api.py is open.
- Bug 28: _field_type entity_id selector fix — api.py is in scope.

### S2-3: Snapshot Export — Backend Implementation
**DEFERRED until after smoke test.**

### S2-4: Import Role Mapping Flow — Frontend + Backend
**DEFERRED until after smoke test.**

### S2-5: HA Version Detection — Display and Template Selection
**DEFERRED — moved to Stage 4.**

---

## STAGE 3 — Round-Trip Verification

### S3-1: Smoke Test — Full Round-Trip on One Simple Piston
See W-S5 above — same test. Once W-S5 passes, mark S3-1 done.

### S3-2: Deferred Validation Testing (After S3-1 Passes)
**DEFERRED.**
- GAP-S33-2 — condition_and/or template indentation
- D-1, D-5, D-6, D-7 — HA behavior edge cases

---

## STAGE 4 — Features (Only After Stage 3 Complete)

### S4-0: Write Missing Specs (as needed)
### S4-1: PyScript Detection and Setup Prompt
### S4-2: Missing Device Handler (depends on D-1 validated)
### S4-3: Orphan Cleanup — Queue and Retry
### S4-4: Compiler Template System — Jinja2 Scaffolding
### S4-5: Pre-Save Validation Pipeline
### S4-6: File Signature and Hash System
### S4-7: Test Compile / Preview Mode
### S4-8: Global Variables — Stale Piston Tracking
### S4-9: Run Status Reporting — WebSocket Events
### S4-10: Snapshot Import — AI Prompt Files
### S4-11: AI-REVIEW-PROMPT.md — Update
### S4-12: target-boundary.json — Add Missing PyScript-Forcing Patterns
### S4-13: Sample Piston Library — Write Snapshot JSON
### S4-14: Best Practices Documentation
### S4-15: Drag and Drop Reordering (editor.js only — safe to add any time after S3-1)

### S4-16: Operational Hardening
- **(Gap A)** Cache slug list in `get_all_slugs()`
- **(Gap C)** Document recommended uvicorn worker config
- **(Gap D)** Add startup validation in `docker-entrypoint.sh`
- **(Gap F)** Security section in README
- **(Gap G)** Tighten `_scan_globals` regex
- **GAP-S30-3** Double config load per compile call
- **GAP-S34-1** _compile_single_condition has no warnings param

### S4-17: HA Connection Reliability (after S4-9)
- No retry logic on _ws_call
- No reconnect on stale WebSocket
- No /api/ha/status endpoint
- Persistent WebSocket manager with reconnect loop, jittered backoff, ping/pong keepalive

---

## DEFERRED — Blocked on External Validation or Not v1 Scope

### D-1: HA Missing Entity Behavior — Must Test Before Coding
### D-2: Which-Interaction Step — Evaluate Feasibility First
### D-3: settings / end settings Block Contents
### D-4: Timer Statement — Evaluate Before Including
### D-5: Sunrise/Sunset Negative Offset Edge Cases
### D-6: Numeric Trigger Unknown State Behavior
### D-7: Long-Running Piston Timeouts

### D-8: wait 'until' and 'state' wizard UI (GAP-S36-3)
wait_type "until" and "state" render branches exist in editor but wizard has no UI
for them yet. When wait wizard UI is built, verify render branches against STATEMENT_TYPES.md.

---

## DONE — Completed Sessions

### Session 40 — W-0 + W-S1 through W-S4: Wizard Rebuild Spec + Bug Fixes ✅
WIZARD_REBUILD_SPEC.md written from WebCoRE source.
wizard.js: condition subject format, AND/OR selector, device picker domain filter
+ dedup, piston variables in all pickers, ha_service fix, branch insertion meta,
for_each variable dropdown, all statement types pass block-id/branch through.
editor.js: insertStatement() branch insertion via meta.blockId + meta.branch.

### Session 39 — S2-1: HAClient Abstraction ✅
### Session 38 — S2-0: SQLite Error Logger ✅
### Session 37 — S-NESTED Session C: wizard.js audit + field name fixes ✅
### Session 36 — S-NESTED Session B: editor.js Nested Tree Migration ✅
### Session 35 — S-NESTED Session A: Nested Tree Spec + compiler.py ✅
### Session 34 — S1-7 Session 3: else_ifs + time condition + PyScript spec ✅
### Session 33 — S1-8: Template Compliance + S1-7 Session 2 Bug Fixes ✅
### Session 32 — S1-6: Fat Compiler Context Assembly ✅
### Session 31 — S1-5: HA Direct Write ✅
### Session 30 — S1-4: main.py / api.py Backend Cleanup ✅
### Session 29 — S1-3: Backend Audit ✅
### Session 28 — S1-2c: compiler.py Flat Array + S1-7 Session 1 Bug Fixes ✅
### Session 27 — S1-2b: editor.js Flat Array ✅ (superseded by S-NESTED Session B)
### Session 26 — S1-2a: wizard.js Flat Array ✅
### Sessions 21-25 — Spec work, field alignment, COMPILER_SPEC rewrite ✅
### Sessions 1-20 — See DESIGN.md Section 33 (Development Log) ✅

---

## Unassigned Gaps

### GAP-S28-4: 6 test pistons in tests/pistons/ not yet created
Fits after S3-1. Must use nested tree JSON per PISTON_FORMAT.md v2.0.

### GAP-S40-1: _route() checks wrong type for log statement edit
`_route()` in wizard.js checks `_editNode.type === 'log'` to re-open a log statement
for editing, but `_saveLocationCmd` writes `type:'log_message'`. Clicking an existing
log statement will not open the edit dialog correctly.
Fix: change `'log'` to `'log_message'` in the `_route()` type check.
Assign to W-S6 or first session that has wizard.js open.

### GAP-S40-2: Task IDs in _saveLocationCmd use stmt_ prefix instead of task_
Lines 1453 and 1460 in wizard.js call `_newId()` for task IDs inside action nodes
written by `_saveLocationCmd`. `_newId()` generates `stmt_` prefix IDs. PISTON_FORMAT.md
requires task IDs to use `task_` prefix (e.g. `task_a3f8c2d1`).
Fix: use a `_newTaskId()` helper or inline `'task_' + ...` for task IDs in these two places.
Also check `_saveDeviceCmd` — already fixed in Session 40 to use `task_` prefix inline.
Assign to W-S6 or first session that has wizard.js open.
