# PistonCore — Code Disconnect Findings

**Date:** May 29, 2026
**Files reviewed:** `editor.js` (1,397 lines), `wizard-core.js` (831 lines)
**Scope:** Compare actual code behavior against specs, find spec ↔ code disconnects.
**Found:** 7 disconnects, 2 of them serious enough to address before B-1.

---

## Critical — fix before B-1 (compiler rewrite)

### 1. `_piston.triggers / .conditions / .restrictions` are top-level arrays the spec doesn't document

**Where:** editor.js lines 1157-1170 (`insertStatement`), 1279-1282 (`deleteStatement`), 1016-1018 (`_deleteSelected`), 1374-1376 (`_reResolveVariableUses`).

The frontend code treats `_piston.triggers`, `_piston.conditions`, `_piston.restrictions`, and `_piston.variables` as top-level arrays on the piston wrapper. These are read, written, and patched in many places.

**PISTON_FORMAT.md v2.1 only lists `variables` and `statements` in the wrapper field reference** (lines 56-72). FRONTEND_SPEC.md *does* show "TRIGGERS / CONDITIONS / ACTIONS" sections in the editor layout (lines 422-428), but PISTON_FORMAT.md is silent on whether they're top-level fields on the wrapper or come from somewhere else.

**Why this is serious:** B-1 will write the compiler against PISTON_FORMAT.md. If the compiler is written assuming triggers live as `is_trigger: true` condition nodes inside if-block `conditions[]` arrays (which is what the COMPILER_SPEC.md examples show — see Section 9.3 line 411-413: "Triggers are condition objects in the statements array where `is_trigger: true`. The compiler recursively walks the nested statement tree and collects all condition objects marked as triggers..."), then the compiler will not find any triggers in pistons the frontend has saved — because the frontend stores triggers in `_piston.triggers`, not inside if-blocks.

**This is a fundamental disagreement between three sources:**
- **COMPILER_SPEC.md**: triggers are condition nodes with `is_trigger:true` in the nested tree
- **Frontend code**: triggers are objects in `_piston.triggers` (top-level array)
- **PISTON_FORMAT.md**: silent — neither field is in the wrapper schema

**Action for D-S5b:** Decide which model is correct, then make all three sources match. Best guess at the right answer:
- The frontend's top-level arrays are correct (they match the editor's TRIGGERS/CONDITIONS/RESTRICTIONS section layout).
- PISTON_FORMAT.md must add `triggers`, `conditions`, `restrictions` fields to the wrapper schema with their condition-object types.
- COMPILER_SPEC.md Section 9.3 must update to say "the compiler reads `_piston.triggers` directly — these are condition nodes marked `is_trigger: true`." (Not from walking the statement tree.)
- The "trigger via if-block-with-trigger-conditions" pattern from COMPILER_SPEC.md is either dead text or describes a different scenario (e.g. wait_for_trigger inside script body).

**Do NOT start B-1 until this is reconciled.** A compiler written against the current COMPILER_SPEC will find no triggers in real pistons.

---

### 2. `_normalizePiston` silently drops malformed nodes — directly violates the "never silently lose data" rule

**Where:** editor.js lines 96-114.

The CLAUDE_SESSION_PROMPT.md (now updated) and audit finding #1 require: *"Malformed nodes (missing required fields, unknown type, future logic_version) render as a clearly-flagged placeholder row that preserves the node and lets the user repair or delete it. The editor must never silently lose data."*

Current code:
```javascript
function checkNodes(nodes) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (!n || typeof n !== 'object' || !n.id || !n.type) {
      console.warn('PistonCore: removing malformed statement node at index', i, n);
      nodes.splice(i, 1);  // ← silently drops the node
      continue;
    }
    ...
  }
}
```

A node missing `id` or `type` is `splice`d out. Only a `console.warn` is fired. The user's save will then write the piston back to disk *without that node*. Permanent silent data loss.

**This is a bug, not a spec gap.** The corrupt-handling spec in FRONTEND_SPEC.md (line 917) was already saying "render placeholder, do not crash or skip rendering siblings." The implementation does skip — it removes the node entirely.

**Fix:**
- Don't splice the node out. Leave it in `_piston.statements` exactly as-is.
- Mark it (e.g. add a `_render_as_unknown: true` flag, or just check `!n.type` at render time) so the renderer shows the `⚠ Unknown statement [stmt_id] — edit to repair` placeholder.
- Bumping the version check (line 83-94, which `throw`s on future versions) is correct behavior — that's intentional refusal, not silent loss.

**Priority:** Fix in W-S10 wrap-up or D-S5b. Quick fix. High-impact bug.

---

## Medium — fix soon, but won't break B-1

### 3. `_deepReId` doesn't recurse into `until_conditions`

**Where:** editor.js line 1003.

```javascript
(node.conditions || []).forEach(c => { if (c.id) c.id = _nextStmtId(); });
(node.tasks      || []).forEach(t => { if (t.id) t.id = _nextStmtId(); });
```

`conditions` and `tasks` get new IDs, but `until_conditions` (used by `repeat` blocks per STATEMENT_TYPES.md Section 8 and PISTON_FORMAT.md) doesn't. Result: if a user copies a `repeat` block and pastes it, the pasted block's `until_conditions` carry the original IDs. If anything in the editor keys off condition IDs, you'll see strange behavior with two copies pretending to share until-conditions.

**Fix:** Add one line:
```javascript
(node.until_conditions || []).forEach(c => { if (c.id) c.id = _nextStmtId(); });
```

Also missing: `else_ifs[].conditions` IDs aren't regenerated (only `else_ifs[].id` and `else_ifs[].statements`). If you copy an if-block with else-ifs, the else-if condition IDs are stale.

```javascript
(node.else_ifs || []).forEach(eib => {
  if (eib.id) eib.id = _nextStmtId();
  (eib.conditions || []).forEach(c => { if (c.id) c.id = _nextStmtId(); });
  (eib.statements || []).forEach(n => _deepReId(n));
});
```

**Priority:** W-S10 wrap-up alongside GAP-S58-2 (copy/paste/duplicate statements).

---

### 4. `Editor.getDeviceMap()` is exported as a public method — should be removed

**Where:** editor.js line 1385.

```javascript
return {
  load,
  save,
  insertStatement,
  deleteStatement,
  getPistonVariables: () => (_piston?.variables || []),
  getDeviceMap: () => (_piston?.device_map || {}),  // ← dead export
  updateConditionOperator(blockId, operator) {...},
};
```

The spec says `device_map` is eliminated (logic_version 2). This accessor returns whatever's on `_piston.device_map` (probably empty object for new pistons, but might still contain stale data on legacy pistons that haven't been migrated). Exporting it suggests to callers it's still a thing.

**Check:** grep the codebase for `Editor.getDeviceMap` or `getDeviceMap(`. If nothing calls it, delete the line. If something calls it, that caller is also using stale logic_version-1 thinking and needs to be reviewed.

**Priority:** D-S5b sweep. Stale comments and dead code cleanup is in CLAUDE_SESSION_PROMPT.md as a required practice.

---

### 5. `_route` for `for_each` reads legacy `list_role` field

**Where:** wizard-core.js lines 672-676.

```javascript
if (t === 'for_each') {
  _sel.variable  = _editNode.variable || '$device';
  _sel.list_role = _editNode.list_role || '';  // ← legacy field
  _goForEachPicker();
  return;
}
```

PYSCRIPT_COMPILER_SPEC.md GAP 3 says: *"`list_role` was confirmed as the field name in Session 24, but was eliminated in Session 57. `for_each` now uses `role` (display label) + `entity_ids` (array, same as action and condition nodes)."*

If a for_each node is committed today (using `role` + `entity_ids` per current spec), then opened for edit, `_route` reads `_editNode.list_role` (undefined) and sets `_sel.list_role = ''`. The for_each picker won't pre-fill with the existing selection — it'll look empty.

This will only show up the first time you try to edit a for_each loop that was committed with the current schema. It might already be broken and not noticed yet because nobody's tested it end-to-end.

**Fix:** Mirror the action/condition `_route` pattern:
```javascript
if (t === 'for_each') {
  _sel.variable = _editNode.variable || '$device';
  const nodeTokens = (_editNode.role_tokens || []).filter(Boolean);
  const nodeIds    = (_editNode.entity_ids  || []).filter(id => id && !id.startsWith('__'));
  _sel.tokens = nodeTokens.length ? nodeTokens : (nodeIds.length ? nodeIds : []);
  _sel.device_label = _editNode.role || '';
  _goForEachPicker();
  return;
}
```

But verify against `_goForEachPicker()` in wizard-loops.js — make sure it reads `_sel.tokens` and `_sel.device_label` and not `_sel.list_role`.

**Priority:** W-S10 or D-S5b. Could already be a latent GAP-S?-? — add to the gap tracker.

---

## Subtle — note in D-S5b, won't break anything immediately

### 6. `_sel` is initialized as a deep clone of editNode — legacy fields persist through edit round-trips

**Where:** wizard-core.js line 515.

```javascript
_sel = editNode ? JSON.parse(JSON.stringify(editNode)) : {};
```

Then `_route` overlays specific fields onto `_sel`. The fields `_route` doesn't touch carry forward from the editNode unchanged.

**Why this matters:** When the audit (and D-S5b) says you need a "Field Lifecycle Rules" section in PISTON_FORMAT.md, this is *exactly* the mechanism that lets stale fields persist forever. A legacy `list_role` field on an old for_each node will sit in `_sel`, survive the wizard, and get written back on commit because nothing explicitly cleared it.

Same for any other legacy field — `devices` array, `list_role`, `device_map` references in old condition nodes, etc.

**Fix (long-term, not urgent):** When the wizard commits, build the output node from scratch using only the fields the spec lists for that node type — don't `Object.assign({}, _sel, ...)`. Each commit should produce a clean object containing exactly the spec-defined fields.

**For now:** Document this in PISTON_FORMAT.md's Field Lifecycle Rules section (D-S5b item 1). Note that legacy fields can persist through edit round-trips and the commit code should be reviewed to enforce a clean output schema.

**Priority:** D-S5b. Architectural note, not a bug fix yet.

---

### 7. `_groupDevices` "shortest friendly_name wins" heuristic is undocumented

**Where:** wizard-core.js lines 211-214.

```javascript
const label = entities.reduce((shortest, d) =>
  d.friendly_name.length < shortest.length ? d.friendly_name : shortest,
  entities[0].friendly_name
);
```

The group label is the shortest friendly_name among entities in the device group. This works for most cases (e.g. "Outdoor Motion" vs "Outdoor Motion Battery" → "Outdoor Motion" wins).

**But the spec doesn't say this.** CLAUDE_SESSION_PROMPT.md and WIZARD_SPEC.md just describe the group-by-device_id rule and primary_entity_id selection. The display label rule is implicit.

**Edge case it doesn't handle:** A device where all friendly_names are similar length but none is the "obvious" display name. E.g., for a device with `light.front_door_porch` and `binary_sensor.front_door_motion` both with friendly_name "Front Door Porch" and "Front Door Motion" — equal length, picks whichever was first in the array (depends on HA's order). Not deterministic across sessions.

**Fix:** Either document the heuristic explicitly in CLAUDE_SESSION_PROMPT.md and WIZARD_SPEC.md, or improve it (e.g., prefer the friendly_name matching primary_entity_id, since that's already domain-priority-sorted). Latter is probably cleaner.

**Priority:** D-S5b sweep, or never. Not a real bug — just spec incompleteness.

---

## What I did NOT find

Genuinely good things — these match the specs cleanly:

- `_getFlatEntityIds` matches the documented resolution order (@→global, no-dot→piston var, has-dot→entity_id) cleanly.
- `_getGroupedEntityIdsForTokens` correctly returns arrays-per-group for the union-then-intersect cap lookup.
- `_groupDevices` matches the documented domain priority list exactly.
- `_reResolveVariableUses` correctly delegates to `_getFlatEntityIds` rather than reimplementing resolution.
- `insertStatement` correctly handles the four contexts (if_condition, task, branched insert, top-level) and replaces-vs-inserts based on existing IDs.
- The version check (`logic_version` / `ui_version`) in `_normalizePiston` correctly refuses to load future versions instead of silently corrupting.

The wizard-core resolution machinery (`_getFlatEntityIds`, `_getGroupedEntityIdsForTokens`, `_groupDevices`) is the most-audited and most-correct part of the codebase. It matches the spec because the spec was written from the code. That's a good sign — those guardrails worked.

---

## Summary by priority

| # | Finding | Severity | Action |
|---|---------|----------|--------|
| 1 | `_piston.triggers/conditions/restrictions` not in PISTON_FORMAT | **CRITICAL** | D-S5b — block B-1 until reconciled |
| 2 | `_normalizePiston` silently drops malformed nodes | **HIGH** | W-S10 wrap-up — quick fix |
| 3 | `_deepReId` misses `until_conditions` and `else_ifs[].conditions` | Medium | W-S10 with GAP-S58-2 |
| 4 | `Editor.getDeviceMap()` dead export | Medium | D-S5b cleanup |
| 5 | `_route` for `for_each` reads legacy `list_role` | Medium | W-S10 or D-S5b |
| 6 | `_sel` cloning lets legacy fields persist through edits | Subtle | Document in D-S5b Field Lifecycle Rules |
| 7 | `_groupDevices` display label heuristic undocumented | Subtle | D-S5b spec sweep |

**Most important takeaway:** Finding #1 means the spec rigidity wasn't just a style problem — it actively hid a fundamental disagreement between COMPILER_SPEC and the running frontend code about where triggers live. The audit caught this by accident (you asked me to look for disconnects). It would have blown up at B-1 / S3-1. Worth catching now.

Finding #2 is the kind of bug that doesn't manifest until a user has a real-world corruption (a bad save, a partial restore, an import bug) — and then their piston loses statements silently on every load. Worth fixing this week.

Everything else is normal cleanup that belongs in D-S5b or the W-S10 wrap-up.
