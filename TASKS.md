# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 57 complete — full spec audit. DESIGN.md v1.3, STATEMENT_TYPES.md v2.1,
WIZARD_SPEC.md v2.1, COMPILER_SPEC.md v1.3, PYSCRIPT_COMPILER_SPEC.md v1.1, HA_LIMITATIONS.md,
MISSING_SPECS.md updated. for_each entity_ids locked. Startup sequence specced.
Snapshot import flow specced. Multi-entity HA behavior confirmed and documented.
Next: W-S8 (wizard coding) — upload list updated below.
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
GAP-S55-1, GAP-S55-2, GAP-S55-4 closed. GAP-S55-3 resolved in Session 57.

---

### D-S2: Full Spec Audit ✅ (Session 57)

**Completed — all spec files updated.**

- DESIGN.md → v1.3: Sections 8, 9.1, 9.2, 6.10, 6.11, 13, 16, 26, 32, 34 updated.
  Multi-entity HA native support confirmed and documented. Startup sequence fully specced.
  Snapshot import flow redesigned for logic_version 2. Orphan handling corrected (flag, never auto-delete).
  Unavailable ≠ missing distinction documented.
- STATEMENT_TYPES.md → v2.1: Action schema updated (role+entity_ids). for_each updated
  (list_role retired, entity_ids on node). Condition schema updated (entity_ids field added).
  on_event condition example updated.
- WIZARD_SPEC.md → v2.1: W-2-foreach specced with entity_ids. Globals picker section
  updated (no longer deferred). Multi-select behavior updated for globals.
- COMPILER_SPEC.md → v1.3: Trigger compilation uses entity_ids array (no expansion).
  Action compilation uses entity_ids array (no expansion). for_each reads entity_ids from node.
- PYSCRIPT_COMPILER_SPEC.md → v1.1: Section 5 rewritten (entity_ids on nodes, no device_map).
  All handlers updated. Verification example updated to logic_version 2.
- HA_LIMITATIONS.md: Multi-entity native support documented. Entity ID changes updated.
  Handled items list updated.
- MISSING_SPECS.md: Item 21 resolved. Items 22 and 23 added.

**Gaps opened this session — all assigned:**
- GAP-S57-1 → MISSING_SPECS Item 22: Piston variable `devices` type W-7 multi-select unspecced
- GAP-S57-2 → MISSING_SPECS Item 23: for_each with piston variable list source unspecced (v1 recommendation: inline only)
- GAP-S57-3 → Spec session before AI prompt work: AI_PROMPT_SPEC.md entirely written against old device_map model — must be rewritten before write-a-piston.md is written
- GAP-S57-4 → B-1 or before: MISSING_SPECS.md Items 7 and 8 reference device_map/device_map_meta terminology — update before storage/missing-device handler is coded

---

**Step 0 — wizard-action.js _saveDeviceCmd rewrite (REQUIRED FIRST)**
Update `_saveDeviceCmd` to write the new action node format:
- `role` = friendly label string
- `entity_ids` = array of real HA entity IDs
- Remove any call to `registerDeviceRole` (goes away with device_map)
- `ha_service` = `domain + "." + command`
See WIZARD_SPEC.md v2.1 Screen W-6 Action Node JSON output for exact schema.

**Step 1 — Remove registerDeviceRole from editor.js**
Once wizard-action.js is updated, `registerDeviceRole()` is dead code. Remove it.

**Step 2 — Verify wizard-condition.js entity_ids output matches new spec**
Confirm `_buildConditionNode` writes `role` + `entity_ids` (not just role name).
Reference: WIZARD_SPEC.md v2.1 Screen W-4 Condition JSON output.

**Step 3 — Wire globals into device picker**
WIZARD_SPEC.md v2.1 now defines how global Device/Devices variables appear in the
picker. wizard-core.js needs to load and display globals from the globals API in the
picker sections. Entity_ids resolved at commit time, written to node.

**Step 4 — GAP-S45-4 — Role mapping end-to-end smoke test**
Build one real piston with real HA devices. Verify entity_ids populated on all nodes.

**Step 5 — GAP-S44-1 (if time):** Group condition editing

**Upload for this session:**
wizard-core.js, wizard-condition.js, wizard-action.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, editor.js, list.js,
WIZARD_SPEC.md, PISTON_FORMAT.md, STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

**This is a backend-only session. No frontend changes.**

**What to implement:**
1. Remove all `device_map` / `list_role` lookup from `compiler.py`
2. Read `entity_ids` directly from condition nodes
3. Read `entity_ids` directly from action nodes
4. Read `entity_ids` directly from for_each nodes (list_role retired)
5. Implement `resolve_entities()` per COMPILER_SPEC.md v1.3 Section 8
6. Add `MISSING_ENTITY` compiler error per COMPILER_SPEC.md v1.3 Section 13
7. Add entity validation as Stage 2 in pre-deploy pipeline per Section 15
8. Multi-entity triggers: pass entity_ids array directly — do NOT expand per entity
9. Multi-entity actions: pass entity_ids array directly — do NOT emit one block per entity
10. for_each: write entity_ids list inline in YAML — no lookup needed

**Also in this session:**
- Update MISSING_SPECS.md Items 7 and 8 to remove device_map/device_map_meta language
  (GAP-S57-4)
- Clarify for_each list_role resolution note in COMPILER_SPEC.md (GAP-S55-5)

**Reference:** COMPILER_SPEC.md v1.3 Sections 8, 9.3, 10.2, 11, 13, 15
PISTON_FORMAT.md v2.1, STATEMENT_TYPES.md v2.1

**Upload for this session:**
compiler.py, context_builder.py, COMPILER_SPEC.md, PISTON_FORMAT.md,
STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

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

**Blocked by MISSING_SPECS.md Item 24** — global device edit redeploy prompt must
be specced before this session starts. Read Item 24 and resolve it first.

**Upload for this session:**
wizard-core.js, wizard-condition.js, wizard-action.js, editor.js,
WIZARD_SPEC.md, MISSING_SPECS.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

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

### Session 57 — D-S2: Full Spec Audit ✅
DESIGN.md → v1.3: startup sequence (Sections 9.1/9.2), multi-entity HA native support
  (Section 8), Snapshot format v2 (Section 6.10), import flow redesigned (Section 6.11),
  manual edit detection expanded (Section 13), orphan scan corrected—flag not delete
  (Sections 9.1/16), piston_index.json added (Section 26), open items updated (Section 32).
STATEMENT_TYPES.md → v2.1: action schema (role+entity_ids), for_each schema (entity_ids
  on node, list_role retired), condition schema (entity_ids field added), on_event updated.
WIZARD_SPEC.md → v2.1: W-2-foreach specced with entity_ids, globals picker specced
  (no longer deferred), multi-select behavior updated for globals.
COMPILER_SPEC.md → v1.3: trigger/action use entity_ids arrays (no expansion), for_each
  reads entity_ids from node directly.
PYSCRIPT_COMPILER_SPEC.md → v1.1: Section 5 rewritten (entity_ids on nodes), all
  handlers updated, verification example updated to logic_version 2.
HA_LIMITATIONS.md: multi-entity native support confirmed and documented, entity ID
  changes updated, handled items list updated.
MISSING_SPECS.md: Item 21 resolved, Items 22/23 added.
GAP-S55-3, GAP-S55-5 closed. GAP-S57-1 through GAP-S57-4 opened and assigned.

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
### GAP-S55-2 → CLOSED (Session 56 / D-S1): Fat compiler context object still shows device_map
### GAP-S55-3 → CLOSED (Session 57 / D-S2): Snapshot import flow — resolved in DESIGN.md Sections 6.10/6.11
### GAP-S55-4 → CLOSED (Session 56 / D-S1): has_missing_devices flag retired
### GAP-S55-5 → CLOSED (Session 57 / D-S2): for_each list_role — retired. entity_ids on node. COMPILER_SPEC.md v1.3 updated.

### GAP-S57-1 → CLOSED (Session 57): Piston variable `devices` type W-7 multi-select
  Resolved in WIZARD_SPEC.md v2.1 and PISTON_FORMAT.md v2.2.
  W-7 uses full multi-select device picker for `devices` type. default_value is
  `{ "role": "label", "entity_ids": [...] }` object, same pattern as action/condition nodes.

### GAP-S57-2 → CLOSED (Session 57): for_each with piston variable list source
  Decision: NOT supported in v1. for_each always requires inline entity_ids on the node.
  HA native script requires static list at compile time — runtime variable reference impossible.
  Documented in WIZARD_SPEC.md v2.1 W-7 and PISTON_FORMAT.md v2.2. V2 feature.

### GAP-S57-5 → MISSING_SPECS Item 24 + G-4: Global device edit redeploy prompt unspecced
  When a user saves changes to a Device/Devices global, PistonCore must prompt for
  permission to redeploy all pistons that baked that global's entity_ids at compile time.
  DESIGN.md Section 7.1 now has the core flow. Full UX spec (progress modal, banner,
  stale flag lifecycle) is in MISSING_SPECS.md Item 24 — must be resolved before G-4 is coded.

### GAP-S57-3 → AI prompt spec session (before S4-10): AI_PROMPT_SPEC.md stale
  Entire output format section references device_map/device_map_meta — wrong for
  logic_version 2. Must be rewritten before write-a-piston.md is written.
  Not blocking any current session. Block S4-10 until this is done.

### GAP-S57-4 → B-1: MISSING_SPECS.md Items 7 and 8 reference device_map terminology
  Item 7 (SQLite schema) says device_state_cache tracks device_map entities.
  Item 8 references device_map_meta cardinality. Both need updating before
  storage/missing-device handler is coded in B-1.

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
### GAP-S51-1 → CLOSED (Session 52)
### GAP-S52-1 → CLOSED (Session 53)
### GAP-S52-2 → W-S8: Action wizard device search missing / stale sel state
### GAP-S52-3 → W-S8: Add task button not working in some action wizard flows
### GAP-S53-1 → CLOSED (Session 53)

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
