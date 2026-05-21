# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 49 complete — G-2 globals frontend done, GAP-G2-2 added → G-2b
**Authority:** CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files

---

## The Goal Before Everything Else

**Get to a clean round-trip on a simple piston:**
wizard writes JSON → backend saves it → compiler reads it → frontend renders it correctly

The wizard split is done and deployed. Editor scroll is fixed. Vertical structure lines
are in. The remaining blockers before a meaningful smoke test are: globals system
(G-1 done, G-2 done, G-2b CSS + device multi-select fix needed, G-3/G-4 still needed)
and role mapping verification.

---

## How to Use This File

- **STAGE W** — Wizard and editor polish. Active work zone.
- **STAGE G** — Globals system. G-1 and G-2 complete. G-2b is next.
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

### W-S7b: Wizard Stabilization + Debug Logging (deferred — G-2b takes priority)

**What this is:** Null-safety and defensive coding pass on the split wizard files.

**Tasks:**
- Null safety pass on _buildConditionNode, _commitCondition, device picker flows,
  _loadCapsIntoSelect
- Verify imported piston condition edit round-trip works end-to-end
- Add console.log at start of all _go* functions for debug tracing
- Fix obvious bugs found during review — no new features

**Upload for this session:**
wizard-core.js, wizard-condition.js, wizard-action.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, STATEMENT_TYPES.md, PISTON_FORMAT.md,
CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### W-S8: Role Mapping Verification + Wizard Smoke Test

**Step 1 — GAP-S45-4 — Role mapping end-to-end**
**Step 2 — Basic wizard smoke test**
**Step 3 — GAP-S44-1 (if time):** Group condition editing
**Step 4 — GAP-S46-5 (if time):** Add file picker to import modal in list.js

**Upload for this session:**
wizard-core.js, wizard-condition.js, wizard-action.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, editor.js, list.js,
CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## STAGE G — Globals System

### G-1: Backend — Globals Storage + API Endpoints ✅ (Session 48)

---

### G-2: Frontend — GlobalsDrawer Implementation ✅ (Session 49)

globals.js created. api.js fixed. api.py + storage.py updated.
index.html updated. Multi-select device picker built.
GAP-G2-1 opened → G-2b. GAP-G2-2 opened → G-2b.

---

### G-2b: CSS + Device Multi-Select Fix ← NEXT SESSION

**Two things in one session — both are blockers:**

**Part 1 — GAP-G2-1: CSS for GlobalsDrawer**
Add all CSS rules for globals drawer classes to style.css:
- `.globals-row`, `.globals-row-main`, `.globals-row-name`, `.globals-row-type`
- `.globals-row-desc`, `.globals-row-actions`, `.globals-row-edit`, `.globals-row-delete`
- `.globals-value`, `.globals-value-entity`, `.globals-value-none`
- `.globals-empty`, `.globals-error`, `.globals-add-bar`
- `.globals-form`, `.globals-form-title`, `.globals-form-row`, `.globals-label`
- `.globals-name-wrap`, `.globals-at`, `.globals-input`, `.globals-select`
- `.globals-optional`, `.globals-form-error`, `.globals-form-actions`
- `.globals-loading-inline`
- `.gf-device-picker`, `.gf-device-summary`, `.gf-device-panel`
- `.gf-device-filter`, `.gf-device-sel-actions`, `.gf-sel-all`, `.gf-sel-none`
- `.gf-device-list`, `.gf-device-row`, `.gf-device-row.selected`
- `.gf-device-cb`, `.gf-device-name`, `.gf-device-id`, `.gf-device-empty`

**Part 2 — GAP-G2-2: wizard-variable.js device picker is single-select only**
`_goVarInitDevicePicker` currently picks one device and immediately closes.
Device variables in the define block must support multiple devices — same as globals.

Fix:
- Replace single-click-to-select in `_goVarInitDevicePicker` with the same
  multi-select pattern used in globals.js: checkboxes, SelectAll/DeselectAll,
  searchable list, confirm button to commit selection.
- `initial_value` for device type must store a list of entity IDs, not a single string.
- `initial_device_id` and `initial_device_label` on WizardCore.sel replaced by
  `initial_device_ids` (array of entity_id strings).
- `_varInitSubHtml` for type 'device' must show count of selected devices,
  not a single device label.
- `save()` in _goVariablePicker must write `initial_value` as the array.

Read globals.js before writing wizard-variable.js — the multi-select pattern
is already implemented there and must be matched exactly.

**Upload for this session:**
style.css, globals.js, wizard-variable.js, CLAUDE_SESSION_PROMPT.md, TASKS.md

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
Only attempt once W-S8 passes and globals G-1/G-2/G-2b are complete.

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

### Session 49 — G-2 complete: GlobalsDrawer frontend ✅
globals.js: GlobalsDrawer with open/close, list render, add/edit/delete form,
multi-select device picker (checkboxes, SelectAll/DeselectAll, searchable).
api.js: createGlobal fixed to { name, var_type, value, description }; updateGlobal added.
api.py: device value documented as list[str], default [] for device type on create.
storage.py: load_globals() docstring updated — value: str | list[str].
index.html: globals.js script tag added after api.js.
GAP-G2-1 opened → G-2b. GAP-G2-2 opened → G-2b.

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

### GAP-G2-1 → G-2b: globals drawer has no CSS rules — will look unstyled
### GAP-G2-2 → G-2b: wizard-variable.js device picker is single-select only; initial_value must store list
### GAP-S28-4 → S3-1: 6 test pistons in tests/pistons/ not yet created
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
### GAP-S30-3 → S4-16: Double config load per compile call
