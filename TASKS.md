# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 66 — Device variable capability intersection fixed.
_getPrimaryIdsForTokens added to wizard-core.js. _loadCapsIntoSelect and _goCommandPicker
now use primary_entity_id per physical device for intersection, not all sub-entity ids flat.
Two new gaps found: GAP-S66-1 (logic_version blocker in editor.js), GAP-S66-2
(_reResolveVariableUses deviceData guard). Next: D-S5 then W-S10 continued.
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

### W-S9: Remaining Picker Gaps ✅ (Session 64)

Completed:
- GAP-S63-2: _actDevSelectAll populates sel.tokens correctly
- GAP-S63-3: Condition picker accumulates multi-select via sel.tokens
- GAP-S63-6: Role label derived from token/label count not entity count
- GAP-S63-7: Capability intersection — _getFlatEntityIds + intersection in both
  _loadCapsIntoSelect (condition) and _goCommandPicker (action)
- sel.tokens introduced as authoritative selection tracker throughout wizard
- role_tokens written to every action/condition node at commit time
- role_tokens restored on edit for correct picker row highlighting
- Defensive hydration: nodes without role_tokens fall back to entity_ids as tokens
- device_label always derived from what user selected (friendly names/variable names)
- _reResolveVariableUses in editor.js: edits a device variable → all action/condition
  nodes referencing it by name in role_tokens have entity_ids re-resolved immediately
- Globals resolve exactly like local variables in _reResolveVariableUses
  (live pulled from _piston._globalsCache loaded at editor open time)
- wizard-variable.js: device picker button shows friendly names not entity count
- wizard-action.js: empty resolution → bail with error, no broken node written
- wizard-condition.js: empty resolution → clear caps picker with explanation

GAP-S63-1 (domain priority investigation) — deferred, not blocking anything.

Still open from W-S9:
- GAP-S63-4 → D-S5 (spec session): write the following into WIZARD_SPEC.md and PISTON_FORMAT.md:
    * sel.tokens as the authoritative selection tracker
    * role_tokens as a required field on all action and condition nodes
    * _getFlatEntityIds resolution order (entity_id → piston var → @global)
    * Device grouping by device_id, primary_entity_id by domain priority
    * initial_device_names field on variable nodes (display only, compiler ignores)
    * _filterGrouped: search on label + primary_entity_id only
    * _reResolveVariableUses contract: edit define → all uses update immediately
    * Globals in the editor resolve from _piston._globalsCache (loaded at editor open)
    * UI/data separation: role/device_label always friendly name, entity_ids always data
- GAP-S63-5 → W-S10 ✅: for_each grouped device picker implemented

---

### W-S10: for_each Device Picker + Editor Gaps (partially complete — Session 66)

Session 65 completed: ha_client.py caps fix, wizard-core.js _getCapsForDomain fix,
wizard-condition.js fallback chain fix, wizard-action.js physical row entity_ids fix,
globals.js same fix, WIZARD_SPEC.md v2.3 Device Variables section added.

Session 66 completed: _getPrimaryIdsForTokens added to wizard-core.js. Cap and service
intersection now uses one primary_entity_id per physical device (not all sub-entity ids).
Fixes capability picker showing only shared sub-entity caps instead of shared device caps
for device variables.

Session 66 also completed: editor.js logic_version fix (GAP-S66-1), deviceData null
guard in _reResolveVariableUses (GAP-S66-2), for_each grouped device picker (GAP-S63-5).

Still open for W-S10:
- GAP-S64-2: Old-format piston picker state wrong — debug first, then fix
- GAP-S46-5: Import modal has no file picker
- GAP-S58-2: Copy/paste/duplicate statements

**Upload for W-S10 continued:**
wizard-loops.js, wizard-core.js, wizard-action.js, wizard-condition.js,
wizard-variable.js, wizard-statement.js, editor.js, globals.js,
DESIGN.md, WIZARD_SPEC.md, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### D-S5: Spec Update — W-S9 Rules

**Upload for D-S5:**
WIZARD_SPEC.md, PISTON_FORMAT.md, DESIGN.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

**Steps:**
Write all GAP-S63-4 items into specs — see W-S9 completed section above for full list.
Must be done before B-1.

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

### Session 63 gaps

- **GAP-S63-1 → deferred:** Domain priority investigation — not blocking anything
- **GAP-S63-2 → W-S9 ✅**
- **GAP-S63-3 → W-S9 ✅**
- **GAP-S63-4 → D-S5:** Spec update — role_tokens, sel.tokens, _getFlatEntityIds,
  device grouping, initial_device_names, _reResolveVariableUses contract,
  globals cache model, UI/data separation rule
- **GAP-S63-5 → W-S10 ✅:** for_each grouped device picker implemented
- **GAP-S63-6 → W-S9 ✅**
- **GAP-S63-7 → W-S9 ✅**

### Session 66 gaps (new)

- **GAP-S66-1 → W-S10 ✅:** editor.js SUPPORTED_LOGIC_VERSION fixed to 2
- **GAP-S66-2 → W-S10 ✅:** _reResolveVariableUses null deviceData guard added

### Session 64 gaps (new)

- **GAP-S64-1 → D-S5:** role_tokens must be documented as a required field in
  PISTON_FORMAT.md — compiler must ignore it, editor must preserve it on save

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
