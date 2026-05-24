# PistonCore — Task History

**Purpose:** Archive of completed sessions. Moved here from TASKS.md to keep the
active task file lean. Do not read this file during normal sessions — it is reference
only. If a historical decision needs to be traced, check DESIGN.md Section 34
(Development Log) first, then here.

---

## Completed Sessions (Newest First)

### Session 58 — D-S3: Post-Audit Cleanup ✅
FRONTEND_SPEC.md → v1.1: Import dialog updated (Snapshot vs Backup detection, role
  mapping dialog, skip behavior). Role label rendering (curly braces, @ prefix for
  globals). Aggregation display rules table (any/all/none → compiler → HA output).
  Inline validation feedback (⚠ icon, tooltip, conditions). Global variable visual
  distinction (@prefix in define block). Corrupt/invalid piston loading behavior.
  Copy/paste/duplicate spec summary. WebSocket protocol fully specced. Settings page
  layout specced. Clipboard API endpoints added.
WIZARD_SPEC.md → v2.2: Multi-device spec complete — role label generation (6 cases),
  mixed physical+global selection commit logic, aggregation commit table and
  normalization, edit pre-fill hydration rule, zero-devices validation.
DESIGN.md: Section 6.11 duplicate role name note confirmed (same role = same entity_ids
  on import — intentional). reference/README.md created.
MISSING_SPECS.md: Items 7/8 updated (device_map terminology replaced with entity_ids
  model). Items 22/23 resolved. Items 25/26/27 added.
GAP-S57-4, GAP-S57-6 through S57-17, GAP-S58-1/4/5/6 closed.
GAP-S58-2/3 opened and assigned.

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
GAP-S55-3, GAP-S55-5 closed. GAP-S57-1 through GAP-S57-8 opened.
GAP-S57-1/2 immediately resolved this session.

### Session 56 — D-S1: DESIGN.md Architecture Pivot Update ✅
DESIGN.md → v1.2: Architecture Pivot section added at top. Sections 6.1, 6.2, 6.3,
  6.4, 6.5, 15.6 marked SUPERSEDED. Fat compiler context corrected (device_map removed).
  has_missing_devices retired. Core philosophy and write-a-piston.md spec references
  updated. Dev log updated.
GAP-S55-1, GAP-S55-2, GAP-S55-4 closed.

### Session 55 — Spec Rewrite: device_map eliminated, entity_ids on nodes ✅
PISTON_FORMAT.md → v2.1: device_map removed, entity_ids + role fields added to
  condition and action schemas. logic_version 2. Hand-written example updated.
COMPILER_SPEC.md → v1.2: Section 8 resolve_entities() added, Section 9.3 trigger
  compilation reads entity_ids directly, Section 10.2 action compilation reads entity_ids
  directly, Section 11 condition compilation reads entity_ids directly, Section 13
  MISSING_ENTITY error added, Section 15 entity validation added as Stage 2,
  Section 18 hand-written example updated. All device_map[] references removed.
WIZARD_SPEC.md → v2.0: Combined with WIZARD_REBUILD_SPEC.md (retired). Condition output
  schema updated with entity_ids field. Action node output schema documented. Wizard
  writes entity_ids at commit time. role is display label only. device_map eliminated.
MISSING_SPECS.md: Items 17/18 resolved, Items 19/20 added.
TASKS.md: W-S8 upload list updated. B-1 backend compiler session added.

### Session 54 — wizard-condition.js, wizard-action.js, editor.js partial fixes ✅
wizard-statement.js: _goBlockConfirm no longer close/reopens — stays in modal.
if_block: after insert opens condition picker scoped to new block.
on_event/while_loop: after insert opens condition picker instead of statement picker.
wizard-core.js: _deleteEditNode captures id and closes wizard BEFORE opening confirm.
app.js: Dialog.confirm button handler captures _onClose before close().
style.css: #wizard-modal pointer-events and z-index fixed.
GAP-S52-1/2/3 opened → W-S7b.

### Session 53 — W-S7b: Wizard Stabilization — insertStatement Scoping Fix ✅
insertStatement condition path no longer falls through to statement insertion.
_replaceCondition() added to editor.js.
_removeConditionNode() added to deleteStatement.
registerDeviceRole(roleName, entityIds) added (now dead code — see W-S8 Step 1).
GAP-S53-1 through GAP-S53-5 opened → W-S8.

### Session 50 — G-2b: Globals CSS + device multi-select ✅
### Session 49 — G-2: GlobalsDrawer frontend ✅
### Session 48 — G-1: Globals backend storage + API endpoints ✅
### Session 47 — W-S7: Vertical structure lines ✅
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
### Sessions 1–34 — See DESIGN.md Section 34 (Development Log) ✅

---

*This file is append-only. Add new completed sessions at the top. Never edit past entries.*
