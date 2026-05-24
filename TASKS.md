# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 56 complete (D-S1) — DESIGN.md v1.2: Architecture Pivot section
added, device_map references marked superseded, fat compiler context corrected,
has_missing_devices retired, MISSING_SPECS.md Item 21 added.
Next: W-S8 (wizard coding)
**Authority:** CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files

---

## The Goal Before Everything Else

**Get to a clean round-trip on a simple piston:**
wizard writes JSON → backend saves it → compiler reads it → frontend renders it correctly

The wizard split is done and deployed. Editor scroll is fixed. Vertical structure lines
are in. The remaining blockers before a meaningful smoke test are: globals system
(G-1 done, G-2 done, G-2b done, G-3/G-4 still needed),
insertStatement scoping bug (GAP-S52-1 — CRITICAL),
and role mapping verification.

---

## How to Use This File

- **STAGE W** — Wizard and editor polish. Active work zone.
- **STAGE G** — Globals system. G-1, G-2, G-2b complete. G-3 is next.
- **STAGE 1** — Structural fixes. Mostly complete.
- **STAGE 2** — Connect the seams. Deferred until after smoke test passes.
- **STAGE 3** — Round-trip verified. Work can now split into focused modules.
- **STAGE 4** — Features. Only after Stage 3 is solid.
- **DEFERRED** — Known, not yet unblocked or not v1 scope.
- **DONE** — Completed and verified.

One task per session. Do not combine tasks.
Do not start a task without reading its listed spec files first.
Upload only the files needed for that task — nothing extra.
**Do not write any file until all necessary files for that task have been read.**

**Gap Assignment Rule — Non-Negotiable:**
Every gap created at the end of a session must be assigned to the most logical
future session before the session closes. Never leave a gap unassigned.

---

## STAGE W — Wizard and Editor Polish

### W-S7b: Wizard Stabilization — insertStatement Scoping Fix ✅ (Session 53)

**GAP-S52-1 FIXED in editor.js:**
- insertStatement condition path no longer falls through to statement insertion
- When target block not found by _findNode, now tries _replaceCondition (edit case)
- If still not found, bails with console.warn + user notice — never inserts condition as statement
- _replaceCondition() added: replaces condition by id in any conditions/until_conditions array in tree
- _removeConditionNode() added to deleteStatement: deletes conditions inside blocks (GAP-S53-1 fix)
- registerDeviceRole(roleName, entityIds) added to Editor public API (device_map population)

**Still open from W-S7b — moved to W-S8:**
- GAP-S52-2: Action wizard stale sel state
- GAP-S52-3: Add task button wrong behavior
- GAP-S52-4: Shallow copy on open() for complex edit nodes
- Wire registerDeviceRole calls in wizard-condition.js and wizard-action.js
- GAP-S53-1 through GAP-S53-5 (see below)

---

### D-S1: DESIGN.md — Architecture Pivot Update ✅ (Session 56)

**Completed — see DESIGN.md v1.2.**

Changes made:
- Architecture Pivot section added at top of document (what changed, which sections superseded, where to find current specs)
- Sections 6.1, 6.2, 6.3, 6.4, 6.5, 15.6 marked ⚠ SUPERSEDED with redirects to PISTON_FORMAT.md v2.1 / COMPILER_SPEC.md v1.2
- Fat compiler context object (Section 14) — device_map field removed, now matches COMPILER_SPEC.md v1.2 Section 7
- has_missing_devices flag retired (documented in Architecture Pivot section)
- Core philosophy and write-a-piston.md spec references updated
- Session 55 and Session 56 entries added to Development Log
- MISSING_SPECS.md Item 21 (Snapshot import flow) — add this when MISSING_SPECS.md is next updated

**Gaps resolved by this session:**
- GAP-S55-1: DESIGN.md stale → CLOSED
- GAP-S55-2: Fat compiler context device_map field → CLOSED
- GAP-S55-4: has_missing_devices flag status → CLOSED (retired)

**Still open:**
- GAP-S55-3 → MISSING_SPECS.md Item 21: Snapshot import flow needs redesign spec (add to MISSING_SPECS.md in next convenient session)

---



**Step 0 — wizard-action.js _saveDeviceCmd rewrite (REQUIRED FIRST)**
Update `_saveDeviceCmd` to write the new action node format:
- `role` = friendly label string
- `entity_ids` = array of real HA entity IDs
- Remove any call to `registerDeviceRole` (goes away with device_map)
- `ha_service` = `domain + "." + command`
See WIZARD_SPEC.md v2.0 Screen W-6 Action Node JSON output for exact schema.

**Step 1 — Remove registerDeviceRole from editor.js**
Once wizard-action.js is updated, `registerDeviceRole()` is dead code. Remove it.

**Step 2 — Verify wizard-condition.js entity_ids output matches new spec**
Confirm `_buildConditionNode` writes `role` + `entity_ids` (not just role name).
Reference: WIZARD_SPEC.md v2.0 Screen W-4 Condition JSON output.

**Step 3 — GAP-S45-4 — Role mapping end-to-end smoke test**
Build one real piston with real HA devices. Verify entity_ids populated on all nodes.

**Step 4 — GAP-S44-1 (if time):** Group condition editing

**Upload for this session:**
wizard-core.js, wizard-condition.js, wizard-action.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, editor.js, list.js,
WIZARD_SPEC.md, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### B-1: Backend — compiler.py Entity IDs Direct Read + MISSING_ENTITY Validation

**This is a backend-only session. No frontend changes.**

**What to implement:**
1. Remove all `device_map` lookup from `compiler.py`
2. Read `entity_ids` directly from condition nodes (everywhere `role` was used for lookup)
3. Read `entity_ids` directly from action nodes (everywhere `devices[]` was used for lookup)
4. Implement `resolve_entities()` per COMPILER_SPEC.md v1.2 Section 8
5. Add `MISSING_ENTITY` compiler error per COMPILER_SPEC.md v1.2 Section 13
6. Add entity validation as Stage 2 in pre-deploy pipeline per Section 15

**Reference:** COMPILER_SPEC.md v1.2 Sections 8, 9.3, 10.2, 11, 13, 15
PISTON_FORMAT.md v2.1 Condition Object Schema and Action Node Schema

**Upload for this session:**
compiler.py, context_builder.py, COMPILER_SPEC.md, PISTON_FORMAT.md,
CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### G-1: Backend — Globals Storage + API Endpoints ✅ (Session 48)

---

### G-2: Frontend — GlobalsDrawer Implementation ✅ (Session 49)

---

### G-2b: CSS + Device Multi-Select Fix ✅ (Session 50)

---

### G-3: Import — Globals Land in the Right Place (GAP-S46-4)

**Upload for this session:**
api.py, list.js, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### G-4: Editor + Wizard — Wire Globals Throughout

**Upload for this session:**
wizard-core.js, wizard-condition.js, wizard-action.js, editor.js,
CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## STAGE 1 — Structural Fixes (Mostly Complete)

### S1-1 through S1-8: Complete ✅

---

## STAGE 2 — Connect the Seams (Deferred until smoke test passes)

### S2-2: api.py + error_logger.py Gaps
### S2-3: Snapshot Export (GAP-S43-4)
### S2-4: Complete ✅

---

## STAGE 3 — Round-Trip Verification

### S3-1: Smoke Test — Full Round-Trip on One Simple Piston
Only attempt once W-S7b and W-S8 pass and globals G-1/G-2/G-2b are complete.

### S3-2: Deferred Validation Testing (After S3-1 Passes)

---

## STAGE 4 — Features (Only After Stage 3 Complete)

### S4-16: Operational Hardening
- **(Gap A)** Cache slug list in `get_all_slugs()`
- **(Gap C)** Document recommended uvicorn worker config
- **(Gap D)** Add startup validation in `docker-entrypoint.sh`
- **(Gap F)** Security section in README
- **(Gap G)** Tighten `_scan_globals` regex
- **GAP-S30-3** Double config load per compile call
- **GAP-S34-1** _compile_single_condition has no warnings param
- **GAP-S45-1** set_variable wizard doesn't normalize $ prefix (cosmetic)
- **GAP-S47-1** Structure line --block-left position needs fine-tuning (cosmetic)

### S4-17: HA Connection Reliability (after S4-9)

---

## DEFERRED

### D-1 through D-9: See previous TASKS.md entries (unchanged)

---

## DONE — Completed Sessions

### Session 56 — D-S1: DESIGN.md Architecture Pivot Update ✅
DESIGN.md → v1.2: Architecture Pivot section added at top. Sections 6.1, 6.2, 6.3, 6.4,
  6.5, 15.6 marked ⚠ SUPERSEDED. Fat compiler context corrected (device_map removed).
  has_missing_devices retired. Core philosophy and write-a-piston.md spec references updated.
  Dev log updated. GAP-S55-1, GAP-S55-2, GAP-S55-4 closed.

### Session 55 — Spec Rewrite: device_map eliminated, entity_ids on nodes ✅
PISTON_FORMAT.md → v2.1: device_map removed, entity_ids + role fields added to
  condition and action schemas. logic_version 2. Hand-written example updated.
COMPILER_SPEC.md → v1.2: Section 8 resolve_entities() added, Section 9.3 trigger
  compilation reads entity_ids directly, Section 10.2 action compilation reads entity_ids
  directly, Section 11 condition compilation reads entity_ids directly, Section 13
  MISSING_ENTITY error added, Section 15 entity validation added as Stage 2,
  Section 18 hand-written example updated. All device_map[] references removed.
WIZARD_SPEC.md → v2.0: Combined with WIZARD_REBUILD_SPEC.md (retired). Condition output
  schema updated with entity_ids field. Action node output schema documented (was missing).
  Wizard writes entity_ids at commit time. role is display label only. device_map eliminated.
MISSING_SPECS.md: Items 17 (action output schema — resolved), 18 (entity validation —
  resolved), 19 (fast pre-check — future), 20 (compiler registry — future) added.
TASKS.md: W-S8 upload list updated. B-1 backend compiler session added.

### Session 54 — wizard-condition.js, wizard-action.js, editor.js partial fixes ✅
wizard-statement.js: _goBlockConfirm no longer close/reopens — stays in modal,
scopes WizardCore.context/extra/stepStack directly (GAP-S51-1 closed).
if_block: after insert opens condition picker scoped to new block instead of closing.
on_event/while_loop: after insert opens condition picker instead of statement picker.
do_block/repeat_loop: after insert opens statement picker (unchanged, correct).
wizard-core.js: _deleteEditNode captures id and closes wizard BEFORE opening
App.confirm dialog — fixes confirm callback being nulled before firing.
app.js: Dialog.confirm button handler captures _onClose before close() so callback
fires correctly (cb = _onClose; close(); cb && cb(value)).
style.css: appended #wizard-modal { pointer-events: all; z-index: 900; } to fix
second CSS declaration overriding pointer-events and z-index.
GAP-S52-1 opened → W-S7b: insertStatement with meta.blockId inserts at root level.
GAP-S52-2 opened → W-S7b: action wizard device search/state issues after scoped flow.
GAP-S52-3 opened → W-S7b: Add task button not working in some flows.

### Session 50 — G-2b complete: Globals CSS + device multi-select ✅
### Session 49 — G-2 complete: GlobalsDrawer frontend ✅
### Session 48 — G-1 complete: Globals backend ✅
### Session 47 — W-S7 complete: Vertical structure lines ✅
### Session 46 — W-S6 complete + wizard.js split ✅
### Session 45 — W-S6 partial: Editor rendering audit ✅ (partial)
### Session 44 — W-S5: Editor Rendering Fixes ✅
### Session 43 — S2-4: Import Role Mapping Flow ✅
### Session 42 — W-S1 through W-S4: Wizard + Editor Bug Fixes ✅
### Session 40 — W-0: WIZARD_REBUILD_SPEC.md written ✅
### Session 39 — S2-1: HAClient Abstraction ✅
### Session 38 — S2-0: SQLite Error Logger ✅
### Session 37 — S-NESTED Session C: wizard.js audit + field name fixes ✅
### Session 36 — S-NESTED Session B: editor.js Nested Tree Migration ✅
### Session 35 — S-NESTED Session A: Nested Tree Spec + compiler.py ✅
### Sessions 1-34 — See DESIGN.md Section 33 (Development Log) ✅

---

## Open Gaps — All Assigned

### GAP-S55-1 → CLOSED (Session 56 / D-S1): DESIGN.md stale — contradicts entity_ids model
  Architecture Pivot section added. Superseded sections marked. DESIGN.md v1.2.

### GAP-S55-2 → CLOSED (Session 56 / D-S1): Fat compiler context object in DESIGN.md still shows device_map field
  Section 14 corrected. Now matches COMPILER_SPEC.md v1.2 Section 7.

### GAP-S55-3 → MISSING_SPECS.md Item 21: Snapshot import flow undefined under new model
  Old model: import populated device_map from role placeholders.
  New model: roles are on individual nodes — import flow needs redesign.
  What happens when a Snapshot is imported and entity_ids need to be mapped?
  Add to MISSING_SPECS.md as Item 21 and spec before S2-3 (Snapshot Export) is built.

### GAP-S55-4 → CLOSED (Session 56 / D-S1): has_missing_devices flag — status unclear
  Documented in Architecture Pivot section as retired. Remove from any code that reads/writes it.

### GAP-S55-5 → COMPILER_SPEC.md: for_each list_role resolution needs clarification
  COMPILER_SPEC.md Section 10.2 for_each example uses "list_role" but the explanation
  of how compiler resolves it from global_variables is buried. Add a clear note
  immediately after the for_each example explaining the lookup path.
  Fix in B-1 session when compiler.py is being updated — minor clarification only.


### GAP-S33-2 → S3-2: condition_and/or template indentation needs real-world testing
### GAP-S34-1 → S4-16: _compile_single_condition has no warnings param
### GAP-S38-1 → S2-2: /api/logs route missing from api.py
### GAP-S39-1 → S2-2: ha_client import pattern wrong in api.py and compiler.py
### GAP-S43-4 → S2-3: Snapshot export not yet implemented
### GAP-S44-1 → W-S8: Group condition editing not implemented
### GAP-S45-1 → S4-16: set_variable wizard doesn't normalize $ prefix (cosmetic)
### GAP-S45-4 → W-S8: Role mapping end-to-end not yet verified
### GAP-S46-4 → G-3: Imported globals dump into piston variables instead of globals store
### GAP-S46-5 → W-S8: Import modal has no file picker — paste-only
### GAP-S47-1 → S4-16: Structure line --block-left position needs fine-tuning
### GAP-S50-1 → S3-1: compiler does not handle device initial_value disambiguation
### GAP-S30-3 → S4-16: Double config load per compile call
### GAP-S51-1 → CLOSED (Session 52): _goBlockConfirm scopes wizard without close/reopen
### GAP-S52-1 → CLOSED (Session 53): insertStatement condition fallthrough fixed.
  _replaceCondition() and _removeConditionNode() added. registerDeviceRole() added to Editor API.
### GAP-S52-2 → W-S7b: Action wizard device search missing / stale sel state after
  scoped wizard flow. May be pre-existing or caused by sel reset in scoped context.
  Investigate with fresh piston before assuming regression.
### GAP-S52-3 → W-S7b: Add task button not working in some action wizard flows.
  May be pre-existing from wizard split. Needs editor.js + wizard-action.js review.
### GAP-S53-1 → W-S8: Deleting a condition inside a block fails silently
  FIXED in Session 53 — _removeConditionNode() added to deleteStatement path.
  Conditions inside if/while/repeat/on_event blocks can now be deleted.

### GAP-S53-2 → W-S8: Attribute dropdown empty for real devices
  wizard-condition.js _loadCapsIntoSelect calls API.getDeviceCapabilities — method
  does not exist in api.js (correct name: getCapabilities or getDevices).
  Falls back to DOMAIN_CAPS static map via domain prefix. Attribute dropdown
  only works for devices whose entity_id domain is in DOMAIN_CAPS.
  Fix: rename API call in _loadCapsIntoSelect, or add alias in api.js.

### GAP-S53-3 → W-S8: Condition edit not pre-filling / no Delete button
  if_condition + editNode routing may not be deploying pre-fill correctly.
  Needs verification with a real edit flow after S53 deploy.

### GAP-S53-4 → W-S8: "on/null" rendering in editor
  _condLine: value_to: null rendered as "and null". Need null check before
  appending val2. Fix in editor.js _condLine line ~563.

### GAP-S53-5 → W-S8: Switch case statements missing branch
  Ghost click inside switch cases passes no branch — deferred from S52.

### GAP-S52-4 → W-S7b: open() shallow copies editNode into _sel — complex nodes
  (conditions, actions, blocks with nested arrays) don't populate correctly for editing.
  _sel.devices, _sel.subject, _sel.tasks etc. often missing or wrong shape.
  Needs explicit field mapping per node type in _route() or a deep-copy utility.
  Identified by Grok scan of current codebase post-wizard-split.
