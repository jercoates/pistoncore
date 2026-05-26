# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 63 — W-S8 complete. Device picker rebuilt: group by HA
device_id, one row per physical device, friendly names in editor and globals drawer,
piston variable + global resolution to entity_ids at click time. Several gaps closed,
several new ones logged. Next: W-S9 (remaining picker gaps + domain priority fix).
**Authority:** CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files
**Completed sessions:** See TASKS_HISTORY.md

---

## The Goal Before Everything Else

**Get to a clean round-trip on a simple piston:**
wizard writes JSON → backend saves it → compiler reads it → frontend renders it correctly

Blocking the round-trip: W-S9 picker gaps, B-1 backend compiler update, G-3 globals import.

---

## How to Use This File

- **STAGE D** — Spec-only sessions.
- **STAGE W** — Wizard and editor coding.
- **STAGE G** — Globals system.
- **STAGE B** — Backend coding.
- **STAGE 2/3/4** — Connect seams, round-trip, features.
- **DEFERRED** — Known, not yet unblocked or not v1 scope.

One task per session. Do not combine tasks.
Do not start a task without reading its listed spec files first.
Upload only the files needed for that task — nothing extra.
**Do not write any file until all necessary files for that task have been read.**
**Do not write code without permission.**
**Always upload DESIGN.md for wizard/editor sessions — device model decisions live there.**

**Gap Assignment Rule — Non-Negotiable:**
Every gap created at the end of a session must be assigned to the most logical
future session before the session closes. Never leave a gap unassigned.

---

## STAGE D — Spec Sessions

### D-S3: Post-Audit Cleanup ✅ (Session 58)
### D-S4: Remaining Spec Completion ✅ (Sessions 59–60)
See TASKS_HISTORY.md for details.

---

## STAGE W — Wizard and Editor Coding

### W-S8: Wizard Coding ✅ (Session 63)

Completed:
- Step 0: `_saveDeviceCmd` rewrite — entity_ids + role on action node
- Step 1: `registerDeviceRole` removed from editor.js
- Step 2: `_buildConditionNode` verified — writes role + entity_ids
- Step 3: Globals wired into all device pickers
- Steps 4-5: All W-S8 gaps fixed (GAP-S52-2/3/4, GAP-S53-3/4/5, GAP-S44-1)
- Device picker rebuilt: group by HA device_id, one row per physical device
- Piston variables + globals resolve to entity_ids at picker click time
- Friendly names stored on variable nodes (initial_device_names) and rendered in editor
- Globals drawer shows friendly device names instead of entity count
- Search fixed: filters on display label + primary_entity_id only
- Variable type pre-fill fixed on edit (Dynamic → Device bug)
- globals.js device list height increased, scrollable

---

### W-S9: Remaining Picker Gaps

**Upload for W-S9:**
wizard-core.js, wizard-action.js, wizard-condition.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, editor.js, globals.js,
DESIGN.md, WIZARD_SPEC.md, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

**Steps (in order):**

1. **Fix domain priority in `_groupDevices`** (GAP-S63-1)
   `binary_sensor` must rank above `switch` — motion sensors were being stored
   as `switch.*` instead of `binary_sensor.*`. Priority order:
   light > switch > cover > fan > climate > lock > media_player >
   input_boolean > input_number > input_select > automation >
   binary_sensor > sensor > person > device_tracker > alarm_control_panel
   → Move binary_sensor above sensor but BELOW the controllable domains.
   Actually binary_sensor should come AFTER switch since binary_sensors are
   read-only. The real fix: for SENSORS (binary_sensor, sensor) that share a
   device_id with a controllable domain (light, switch, etc.), the controllable
   entity is primary. For standalone binary_sensors with no controllable sibling,
   binary_sensor IS primary. The current priority list handles this correctly
   for standalone sensors — the bug is that `switch` appears before `binary_sensor`
   which is correct. The real problem is a UniFi camera motion sensor appearing
   as `switch.*` at all — check if that device has a `switch.*` entity grouped
   with it and why. Do not change priority list without re-reading DESIGN.md first.

2. **Fix `_actDevSelectAll` for pistonvars/globals** (GAP-S63-2)
   Currently pushes raw variable names into sel.devices when Select All is used.
   Must resolve pistonvar/global rows to entity_ids same as individual click handler.

3. **Fix condition picker multi-select** (GAP-S63-3, pre-existing GAP-S44-2)
   Condition device panel click handler replaces sel.devices on every click.
   Should accumulate like the action picker — multi-device conditions with
   aggregation require multiple entity_ids in sel.devices.

4. **Spec gaps to document this session** (GAP-S63-4)
   The following rules were implemented in code this session but are NOT yet
   in WIZARD_SPEC.md, PISTON_FORMAT.md, or DESIGN.md:
   - Device grouping by device_id rule
   - primary_entity_id selection by domain priority
   - initial_device_names field on variable nodes (display only, compiler ignores)
   - Piston variable + global resolution to entity_ids at wizard click time
   - _filterGrouped rule: search on label + primary_entity_id only
   These must be written into specs before B-1 starts.

5. **for_each loop device picker** (GAP-S63-5)
   wizard-loops.js `_goForEachPicker` still uses old text input for device list.
   Must be replaced with the same grouped device picker used by action/condition.

---

## STAGE G — Globals System

### G-1, G-2, G-2b ✅ (Sessions 48–50) — See TASKS_HISTORY.md

### G-3: Import — Globals Land in the Right Place (GAP-S46-4)

**Upload for G-3:**
api.py, list.js, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

### G-4: Editor + Wizard — Wire Globals Throughout

**Upload for G-4:**
wizard-core.js, wizard-condition.js, wizard-action.js, editor.js,
DESIGN.md, WIZARD_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## STAGE B — Backend Coding

### B-1: compiler.py Entity IDs Direct Read + MISSING_ENTITY Validation

**What to implement:**
1. Remove all `device_map` / `list_role` lookup from `compiler.py`
2. Read `entity_ids` directly from condition, action, and for_each nodes
3. Implement `resolve_entities()` per COMPILER_SPEC.md v1.3 Section 8
4. Add `MISSING_ENTITY` compiler error per COMPILER_SPEC.md v1.3 Section 13
5. Add entity validation as Stage 2 in pre-deploy pipeline per Section 15
6. Multi-entity triggers: pass entity_ids array directly (no expansion)
7. Multi-entity actions: pass entity_ids array directly (no expansion)
8. for_each: write entity_ids list inline in YAML (no lookup needed)

**Reference:** COMPILER_SPEC.md v1.3 Sections 8, 9.3, 10.2, 11, 13, 15
PISTON_FORMAT.md v2.1, STATEMENT_TYPES.md v2.1, SAMPLE_PISTONS.md

**Upload for B-1:**
compiler.py, context_builder.py, COMPILER_SPEC.md, PISTON_FORMAT.md,
STATEMENT_TYPES.md, SAMPLE_PISTONS.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## STAGE 2 — Connect the Seams (After round-trip works)

### S2-2: api.py + error_logger.py Gaps
### S2-3: Snapshot Export + Backup Export (GAP-S43-4 + MISSING_SPECS Item 27)

---

## STAGE 3 — Round-Trip Verification

### S3-1: Smoke Test — Full Round-Trip on One Simple Piston
Only attempt once W-S9, B-1, and G-3 are complete.

### S3-2: Deferred Validation Testing (After S3-1 Passes)

---

## STAGE 4 — Features (Only After Stage 3 Complete)

### S4-16: Operational Hardening
- GAP-S30-3, GAP-S34-1, GAP-S45-1, GAP-S47-1 (see previous entries)

### S4-17: HA Connection Reliability

---

## DEFERRED

### D-1 through D-9: See previous TASKS.md entries (unchanged)

---

## Open Gaps — All Assigned

### Session 63 gaps (new)

- **GAP-S63-1 → W-S9:** Domain priority / primary_entity_id wrong for some devices
  (e.g. UniFi motion sensor appearing as switch.*) — investigate before changing priority
- **GAP-S63-2 → W-S9:** `_actDevSelectAll` doesn't resolve pistonvars/globals to entity_ids
- **GAP-S63-3 → W-S9:** Condition picker single-select only — should accumulate like action picker
- **GAP-S63-4 → W-S9:** Device grouping model + initial_device_names + resolution rules
  not yet written into WIZARD_SPEC.md, PISTON_FORMAT.md, or DESIGN.md
- **GAP-S63-5 → W-S9:** for_each device picker still uses old text input (wizard-loops.js)

### Pre-session-63 coding gaps still open

- **GAP-S57-5 → G-4:** Global device edit redeploy prompt
- **GAP-S46-4 → G-3:** Imported globals land in piston variables instead of globals store
- **GAP-S46-5 → W-S9:** Import modal has no file picker — paste-only
- **GAP-S58-2 → W-S9 or dedicated session:** Copy/paste/duplicate statements
- **GAP-S58-3 → S2-3:** Piston backup trigger/download/restore
- **GAP-S50-1 → S3-1:** Compiler does not handle device initial_value disambiguation
- **GAP-S33-2 → S3-2:** condition_and/or template indentation needs real-world testing
- **GAP-S34-1 → S4-16:** _compile_single_condition has no warnings param
- **GAP-S38-1 → S2-2:** /api/logs route missing from api.py
- **GAP-S39-1 → S2-2:** ha_client import pattern wrong in api.py and compiler.py
- **GAP-S43-4 → S2-3:** Snapshot export not yet implemented
- **GAP-S30-3 → S4-16:** Double config load per compile call
- **GAP-S47-1 → S4-16:** Structure line position needs fine-tuning (cosmetic)
- **GAP-S45-1 → S4-16:** set_variable wizard doesn't normalize $ prefix (cosmetic)

### Spec gaps still open

- **MISSING_SPECS Item 11 (partial)** → post-S3-2: Production sample pistons
- **MISSING_SPECS Item 12** → post-S3-1: Write BEST_PRACTICES.md
- **MISSING_SPECS Item 15** → before S4-10: write-a-piston.md actual prompt content
- **MISSING_SPECS Item 25** → S4-17: HA entity state subscription vs polling
- **MISSING_SPECS Item 26** → W-S9 or dedicated session: Copy/paste/duplicate statements
- **MISSING_SPECS Item 27** → S2-3: Piston backup trigger/download/restore
