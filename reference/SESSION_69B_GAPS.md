# GAP entries from Session 69b code review — paste into TASKS.md

These are CODE fixes (not spec). No code was touched this session. The specs were
reconciled to Path A (code is authoritative) and v1/device_map fully retired. These
gaps are what the code needs to do to match the now-corrected specs.

---

## CRITICAL — blocks B-1 (compiler rewrite) and clean round-trip

### GAP-S69-1 — Whole-piston load is fine, but v1 pistons must be rejected, not half-migrated
Decision made Session 69b: logic_version 1 is retired. There is no v1→v2 migration.
All sandbox pistons regenerated fresh as v2.
- On load, reject any piston without `logic_version: 2` with a clear message.
- Remove any lazy per-node migration code that upgrades only edited nodes (this produced
  mixed-format files — see the 7b468be7.json artifact: two v1 device_map blocks + one v2
  block in the same file).
- Delete all existing v1 pistons from the sandbox userdata. Start fresh.

### GAP-S69-2 — Editing certain nodes errors out / fails to update (BLOCKER)
Observed: some nodes cannot be edited/migrated — the edit fails. In 7b468be7.json this
produced a duplicate `cond_00000002` in a new empty if-block (`stmt_48a120b9`), suggesting
an edit partially succeeded and created a new node instead of updating in place.
- Root cause unknown — needs the actual error (console/Network) when editing a v1-style
  `role`-only condition (no entity_ids, no role_tokens).
- Hypothesis: the wizard edit-route tries to hydrate `sel.tokens` from `role_tokens` or
  `entity_ids`, finds neither on old nodes, and throws.
- Once v1 pistons are gone (GAP-S69-1), this may stop reproducing — but verify the edit
  path is robust when a node is missing expected fields (should show a repair placeholder,
  per the render invariant, not throw).
- **Needs:** error message + wizard edit-route code + condition-builder code next session.

---

## HIGH — fix in W-S10 wrap-up

### GAP-S69-3 — `_normalizePiston` silently drops malformed nodes (CODE_FINDINGS #2)
editor.js ~96-114: a node missing `id` or `type` is `splice`d out with only a console.warn.
This violates the render invariant ("never silently drop nodes — render a flagged
placeholder instead"). Fix: do not splice; leave the node in place and flag it so the
renderer shows `⚠ Unknown statement [id] — edit to repair`. The future-version `throw`
is correct and stays.

---

## MEDIUM

### GAP-S69-4 — `_deepReId` misses `until_conditions` and `else_ifs[].conditions` (CODE_FINDINGS #3)
editor.js ~1003. Copy/paste/duplicate of a `repeat` block leaves `until_conditions` IDs
stale; copying an if-block leaves `else_ifs[].conditions` IDs stale. Add re-id for both.
Bundle with GAP-S58-2 (copy/paste/duplicate).

### GAP-S69-5 — for_each writes `list_role`, no resolved `entity_ids` (CODE_FINDINGS #5, corrected)
wizard-loops.js ~131-145: for_each commit writes `list_role` + `role_tokens` and explicitly
does NOT resolve entity_ids ("resolved at compile time by the compiler"). This contradicts
the universal rule confirmed Session 69b: the wizard resolves and writes entity_ids, the
compiler never resolves. Fix: for_each commit must resolve `_sel.fe_tokens` to entity_ids
via the same path as actions/conditions and write `entity_ids` on the node. Keep
`role_tokens` for re-resolution. Drop `list_role` (or keep only as display `role`).
STATEMENT_TYPES.md and PISTON_FORMAT.md already specify the correct shape.

### GAP-S69-6 — `Editor.getDeviceMap()` dead export (CODE_FINDINGS #4)
editor.js ~1385. `device_map` is retired. grep for callers of `getDeviceMap`. If none,
delete the export. If any, that caller is using v1 thinking and needs review.

---

## SUBTLE — document/cleanup

### GAP-S69-7 — `_sel` deep-clones editNode; legacy fields persist through edits (CODE_FINDINGS #6)
wizard-core.js ~515: `_sel = JSON.parse(JSON.stringify(editNode))`. Fields `_route`
doesn't overwrite carry forward unchanged, so legacy fields (e.g. `list_role`, `devices`,
old `device_map` refs) survive a round-trip. Long-term fix: build the commit output node
from scratch using only spec-defined fields for that node type — don't pass `_sel` through.
PISTON_FORMAT.md Field Lifecycle Rules already notes which fields are written/read/stripped.

### GAP-S69-8 — `_groupDevices` "shortest friendly_name wins" heuristic undocumented (CODE_FINDINGS #7)
wizard-core.js ~211-214. Group label = shortest friendly_name in the device group. Works
for most cases, non-deterministic for equal-length names. Either document it in WIZARD_SPEC
or improve it to prefer the friendly_name matching `primary_entity_id` (already
domain-priority-sorted). Low priority.

---

## HIGH — the core device-data bug (Session 69c)

### GAP-S69-9 — Nodes must store attribute-bearing entity IDs, not the whole device cluster
**CONFIRMED LIVE IN CODE (Session 69c) — this is the central device-data bug.**

**Root cause — single function:** `wizard-core.js` `_getFlatEntityIds(tokens)` (lines
~258-307). It is documented as "Returns ALL entity_ids for ALL sub-entities of every
selected device/variable," and its helper `_friendlyNameToEntityIds` returns
`group.entity_ids` — the entire device cluster. It takes only `tokens` and has **no
attribute parameter**, so it physically cannot select the attribute-bearing entity.

**Both commit paths call it and inherit the bug:**
- `wizard-condition.js` `_buildConditionNode` (~line 813): `entity_ids = _getFlatEntityIds(role_tokens)`.
  For an illuminance condition this writes all of `[battery, illuminance, motion, temperature]`.
  This is exactly the `stmt_48a120b9` symptom in the real saved file — NOT a stale file,
  current behavior.
- `wizard-action.js` `_saveDeviceCmd` (~line 724): `flatIds = _getFlatEntityIds(_sel.tokens)`.
  Writes the whole cluster onto e.g. a `light.turn_on` node. Less visibly broken (comment
  claims the capability intersection pre-filtered valid commands) but still wrong — sensor
  entities land on a light action node.

**The data to fix it already exists.** Each entity in `_deviceData` carries its
attribute/device_class — that is how the capability intersection in `_loadCapsIntoSelect`
already works. The matching logic exists; it just isn't applied at commit time.

**Fix:**
1. Make `_getFlatEntityIds(tokens, attribute)` attribute-aware (optional 2nd arg).
2. In `_friendlyNameToEntityIds`, when `attribute` is provided, return the ONE entity in
   the group whose capability matches that attribute (illuminance → the `*_illuminance`
   entity), not all of `group.entity_ids`. One per device.
3. `_buildConditionNode` passes the chosen `attribute`.
4. `_saveDeviceCmd` passes the command's domain/service so it resolves to the controllable
   entity (the `light.` entity for `light.turn_on`), not the device's sensors.
5. No attribute given (legacy/rare) → keep current "all entities" behavior as fallback.

**Companion bug (still open):** blank `display_value`/`compiled_value` in the real file
means the value capture didn't complete before commit on that node. Verify the value step
fires before the node is written. (Note: `_buildConditionNode` reads `wiz-val-1` live at
build time, so this may have been a partial/aborted edit — confirm with a fresh save.)

**Files:** wizard-core.js (the fix), wizard-condition.js + wizard-action.js (pass the
attribute/command). Single-function root cause — fixing `_getFlatEntityIds` fixes both paths.

### GAP-S69-10 — Device variables store device references, NEVER entity IDs
**STATUS: variable commit is ALREADY CORRECT (verified Session 69c).** wizard-variable.js
`save()` stores friendly names in `initial_value` for device variables and explicitly does
NOT store entity IDs (see its own comments: "initial_value IS the friendly names array",
"No entity_ids stored here"). This matches the locked spec. No change needed to the variable
commit itself.

**What remains:** ensure the RESOLUTION side (GAP-S69-9) and `_reResolveVariableUses` treat
the variable correctly:
- `_getFlatEntityIds` already resolves a piston-variable token by reading the variable's
  `initial_value` (friendly names) and converting to entity IDs live — correct, EXCEPT it
  returns the whole cluster instead of the attribute-bearing entity (that's GAP-S69-9).
- `_reResolveVariableUses` must re-resolve node `entity_ids` (never write IDs back to the
  variable) using the variable's current friendly-name list + the node's attribute. Verify
  it passes the attribute once GAP-S69-9 makes `_getFlatEntityIds` attribute-aware.

**Cosmetic note:** wizard-variable.js uses an internal var named `initial_device_ids` that
actually holds friendly names (confusing but harmless). The committed field is `initial_value`.
There is no separate `initial_device_names` field in the current code — display and data are
the same friendly-name array. The spec's `initial_device_names` is therefore optional/aspirational;
current code uses `initial_value` for both. Align the spec note to match (display reads
`initial_value` directly) OR add `initial_device_names` in code — pick one in the code session.

### GAP-S69-11 — for_each writes list_role + role_tokens but NO entity_ids (was CODE_FINDINGS #5)
**CONFIRMED LIVE.** wizard-loops.js for_each commit (~lines 131-143) writes `list_role` and
`role_tokens` and a comment "entity_ids will be resolved at compile time by the compiler via
the variable." It writes no `entity_ids`. This violates the locked rule: the wizard resolves
and writes entity_ids; the compiler never resolves. Fix: for_each commit must call the
attribute-aware `_getFlatEntityIds` (here the "attribute" is just the device list itself — a
for_each iterates devices, so it resolves to the primary controllable entity per device, or
all entities depending on loop intent — decide in code session) and write `entity_ids`. Keep
`role_tokens`. `list_role` can stay as the display label (= `role`) but is not a substitute
for `entity_ids`.
