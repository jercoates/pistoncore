# PistonCore — Session 54 Findings
**Date:** May 2026
**Status:** To be merged into TASKS.md and spec files next session
**Purpose:** Capture everything discovered this session before context is lost.

---

## What Was Agreed This Session

### The Device Data Model — Final Decision

Entity IDs belong in the piston JSON directly. Friendly names belong alongside
for display only. The compiler reads entity IDs directly. No role-name indirection.

**Condition node — what it should look like:**
```json
{
  "id": "cond_001",
  "is_trigger": false,
  "role": "Front Door",
  "entity_ids": ["binary_sensor.front_door"],
  "attribute": "contact",
  "attribute_type": "binary",
  "device_class": "door",
  "aggregation": "any",
  "operator": "changes to",
  "display_value": "Open",
  "compiled_value": "on",
  "duration": null,
  "duration_unit": null,
  "interaction": "any",
  "group_operator": "and"
}
```

**Action node — what it should look like:**
```json
{
  "id": "stmt_001",
  "type": "action",
  "role": "Driveway Light",
  "entity_ids": ["light.driveway_main", "light.garage"],
  "tasks": [
    {
      "id": "task_001",
      "command": "turn_on",
      "domain": "light",
      "ha_service": "light.turn_on",
      "parameters": { "brightness_pct": 75 }
    }
  ],
  "description": null,
  "disabled": false
}
```

**Key points:**
- `role` = human label shown in the editor (e.g. "Front Door", "Driveway Light")
- `entity_ids` = real HA entity IDs — compiler reads these directly
- `device_map` at the piston wrapper level is ELIMINATED
- For multi-device: entity_ids is an array with all selected IDs
- For single device: entity_ids is a single-element array

---

## device_map — Eliminate It

`device_map` was a role→entityID lookup table at the piston wrapper level.
It was never populated by the wizard (that was a bug). It added indirection
with no benefit. Remove it from:

- PISTON_FORMAT.md — remove device_map section entirely
- COMPILER_SPEC.md — remove all device_map[] lookup references
- compiler.py — read entity_ids directly from condition/action nodes
- wizard-condition.js — write entity_ids to condition node, not device_map
- wizard-action.js — write entity_ids to action node, not device_map
- editor.js — registerDeviceRole() no longer needed, remove it

---

## Live HA Validation on Compile

When the compiler runs, the backend checks every entity_id in every condition
and action node against live HA. If any entity_id is not found in HA:

- Compiler returns a clear error: which entity_id, which statement, which piston
- User fixes it in the editor (pick replacement device)
- User recompiles
- No silent failures

This is the "notify on device change" behavior Jeremy wants.

The backend already fetches entity states in context_builder.py (entity_states dict).
The validation just needs to check each entity_id against that dict.

---

## Spec Files That Need Rewriting

### PISTON_FORMAT.md
- Remove device_map section
- Add entity_ids field to condition object schema
- Add entity_ids and role fields to action node schema
- Update the wrapper field reference table
- Update the hand-written example piston

### COMPILER_SPEC.md
- Section 8: compiler reads entity_ids directly from nodes — no device_map lookup
- Section 9.3: trigger compilation reads entity_ids from condition node directly
- Section 10.2: action compilation reads entity_ids from action node directly
- Section 11: condition compilation reads entity_ids directly
- Section 13: add MISSING_ENTITY compiler error — entity_id not found in HA
- Section 18: update hand-written verification example
- Remove all device_map[] references throughout

### WIZARD_SPEC.md
- Section "Condition Object — Final Output" (line 659): add entity_ids field
- Add action node output schema (currently missing entirely)
- Document that wizard writes entity_ids at commit time
- Document that role is the display label stored alongside entity_ids

### MISSING_SPECS.md
- Add Item 17: Action node output schema — MISSING
  (WIZARD_SPEC.md documents condition output but never documents action output schema)
- Add Item 18: Device change detection and compile-time validation — MISSING
  (No spec defines what happens when entity_id is not found in HA at compile time)

---

## Wizard Code — What Still Needs Fixing

These were partially fixed this session but need verification after spec is corrected.

### wizard-condition.js
- _loadCapsIntoSelect: FIXED — now calls API.getCapabilities correctly,
  handles multiple entity IDs, merges caps, falls back to DOMAIN_CAPS
- _buildConditionNode: FIXED — writes flat format with entity_ids
  BUT: needs to write entity_ids not call registerDeviceRole (which goes away)
- attr change handler: FIXED — captures device_class from option data-class

### wizard-action.js
- _saveDeviceCmd: needs entity_ids in action node directly, role as display label
  Current state: stores role name in devices[], calls registerDeviceRole
  Needed state: stores entity_ids in entity_ids[], role in role field, no registerDeviceRole
- Device picker reset on fresh open: FIXED (stale sel state)
- Demo device _renderCmdParams: FIXED

### editor.js
- _condLine: FIXED — handles flat format, null value_to fixed
- registerDeviceRole: remove once device_map is gone
- Action renderer: reads role field for display — needs update when action node format changes

---

## Backend — compiler.py Changes Needed

Log as a gap in TASKS.md — backend task, separate session.

1. Remove device_map lookup throughout
2. Read entity_ids directly from condition nodes (cond.entity_ids)
3. Read entity_ids directly from action nodes (node.entity_ids)
4. On compile: validate every entity_id against context["entity_states"]
   - If missing: CompilerMessage(level="error", code="MISSING_ENTITY",
     message="Entity '{entity_id}' not found in Home Assistant.
     It may have been removed or renamed. Update this piston and recompile.")
5. context_builder.py already fetches entity_states — validation just needs
   to check against that dict

---

## Files Changed This Session (Deploy These)

All three were updated multiple times. Final versions in outputs/:
- editor.js — _condLine flat format fix, null value_to fix, _replaceCondition,
  _removeConditionNode, registerDeviceRole (temporary — remove after device_map gone)
- wizard-condition.js — _loadCapsIntoSelect real API, _buildConditionNode flat format
- wizard-action.js — stale sel fix, demo _renderCmdParams fix, _saveDeviceCmd partial fix

WARNING: wizard-action.js _saveDeviceCmd still stores role in devices[] per old spec.
After spec rewrite, update it to store entity_ids in entity_ids[] and role in role field.

---

## Session Order for Next Sessions

1. SPEC SESSION: Rewrite PISTON_FORMAT.md and COMPILER_SPEC.md with new device model.
   Update WIZARD_SPEC.md condition and action output schemas.
   Update MISSING_SPECS.md with items 17 and 18.
   Update TASKS.md with backend gap.
   NO CODE this session.

2. WIZARD SESSION: Update wizard-action.js _saveDeviceCmd to match new spec.
   Remove registerDeviceRole from editor.js.
   Verify wizard-condition.js entity_ids output matches new spec.

3. BACKEND SESSION: Update compiler.py to read entity_ids directly,
   add MISSING_ENTITY validation, remove device_map lookup.
   Upload: compiler.py, context_builder.py, COMPILER_SPEC.md, TASKS.md

4. SMOKE TEST: Build one real piston with real Hubitat devices in HA.
   Trigger → condition → action. Save → compile → check output.

---

## Grok Review Notes — Post Session 54

These came in after the session. Incorporate into spec rewrite and TASKS.md.

### Architecture — Confirmed Good
- Nested tree model is correct long-term choice
- Separation of concerns is clean
- Globals system solid (Device/Devices compile-time expansion)
- Fat context object for compiler (no HA calls from compiler itself) — correct
- Auto target selection via target-boundary.json — keep it

### Grok Recommendations to Act On

**1. Entity Resolution Layer in backend (before compile)**
Add a resolve_entities() step early in compile_piston() that:
- Confirms all entity_ids in condition and action nodes exist in HA
- Warns on unavailable/removed entities
- Validates entity is in the right domain for the operation
This is what SESSION_54_FINDINGS.md already called MISSING_ENTITY validation.
Grok confirms the approach. Add to backend session task.

**2. Split validation into two passes**
- Fast Pre-Check: on every wizard step (immediate feedback while building)
- Deep Compile Check: on save/deploy (full validation)
Currently only doing deep check. Fast pre-check is a future improvement.
Log as a gap — not blocking v1 but good for UX.

**3. Statement compiler — plugin/registry pattern**
Right now compiler is one big function with many elif branches.
As statement types grow this becomes painful.
Recommendation: registry of statement handlers.
Not blocking now — log as S4-16 or later architectural improvement.

**4. Error context in nested blocks**
When compile fails in a deeply nested block, error should include
the full statement path: if_001 → else_if_002 → action_003.
Currently errors may only report the leaf statement id.
Log as a compiler improvement gap.

**5. Two-layer template approach**
Instead of pure Jinja2 string templates:
- Low-level statement compilers output clean Python dicts
- Final YAML serializer converts dicts to YAML
Produces cleaner output, easier to maintain.
This is an architectural improvement — not blocking v1.
Log as future compiler refactor.

**6. Expand unit tests against golden sample pistons**
SAMPLE_PISTONS.md already lists 4 candidate pistons.
All 4 together exercise every compiler pattern.
If all 4 compile and deploy correctly → compiler is solid for v1.
This is already planned in MISSING_SPECS.md Item 11.

### What Grok Confirmed Is Already Correct
- Direct entity_ids on nodes (what we decided this session) ✓
- Fat context object ✓
- Jinja2 templates for output targets ✓
- Auto compile target selection ✓

### Gaps to Add to MISSING_SPECS.md
- Item 19: Fast Pre-Check validation (wizard-step feedback) — MISSING
- Item 20: Statement compiler registry pattern — future architectural spec

### Gaps to Add to TASKS.md
- Backend: resolve_entities() step in compile_piston() — same session as
  entity_ids direct read (already planned in backend session)
- S4-16: Statement compiler registry refactor — after v1
- S4-16: Full statement path in compiler error messages — after v1
