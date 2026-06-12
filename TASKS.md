# PistonCore — TASKS.md

**Status:** Living document — single active task file. Update at the end of every session.
**Last Updated:** Session 74 — FULL FRONTEND CODE ↔ SPEC AUDIT (all 12 frontend JS files read
end-to-end against the specs and this gap list). Outcomes: (1) NEW HIGH gaps filed:
GAP-S74-1 (top-level trigger/condition/restriction commit/edit seam broken — the wizard
cannot write to the top-level arrays the compiler reads; new bundle W-S18) and GAP-S74-2
(action commit writes ALL entity_ids with no domain filter; task `domain` derived from
`finalIds[0]` can emit wrong ha_service). (2) Open gaps re-diagnosed from code:
GAP-S71-3 (import role-map keys off retired `device_map`), GAP-S73-1 (mechanism confirmed
with line numbers — verify-first step DONE), GAP-S71-2 (one missing `'devices'` map entry +
a wider plural blind spot, GAP-S74-3), GAP-S70-1 (verification answered: it IS a defect —
attribute-blind re-resolution), GAP-S69-2 (re-pointed at the current-format edit seam),
GAP-S69-4 (narrowed — conditions/tasks now covered in code). (3) New MED/LOW gaps:
GAP-S74-4 (Snapshot export is still v1 — strips nothing but device_map), GAP-S74-5
(time-condition shape: spec vs commit vs hydrate three-way mismatch), GAP-S74-6
(only_on_days 0–6 vs ISO 1–7), GAP-S74-7 (`list_role` alive on for_each, undocumented),
GAP-S74-8 (stale-comment cluster contradicting the load-bearing rule), GAP-S74-9 (small
render defects). (4) New spec-corrections bundle D-S5d capturing the Session 74 spec-file
audit (stale SAMPLE_PISTONS, PISTON_FORMAT minimal example, S3-1 checklist refs,
PENDING/COMPLETE contradiction sweep, FRONTEND_SPEC staleness, PROGRESS_TRACKER retirement).
Also VERIFIED GOOD in code: GAP-S72-1 fix coherent across all three files; `_globalsCache`
strip/restore; sel.tokens all-entity-ids guardrail; union-then-intersect incl. per-field
intersection; operator/command vocabularies match WITH_BLOCK_TASK_FRAMEWORK §5.

Prior: Session 73 — (1) Spec reconciliation: the task/with-block specs were
rewritten to match the CODE (the older specs had drifted behind in-code fixes). New
authoritative spec WITH_BLOCK_TASK_FRAMEWORK.md written; PISTON_FORMAT (2.4),
STATEMENT_TYPES (2.3), WIZARD_SPEC (2.7) reconciled. (2) GAP-S72-1 CODED (partial — see
W-S15): the with-block now stacks tasks instead of overwriting. Root cause was deeper than
filed — clicking a task line resolved to null (`_findAnyNode` doesn't search `tasks[]`), so
task EDIT was a dead path; `_route` always read `tasks[0]`; `_saveDeviceCmd` wrote
`tasks:[newTask]`. Fixed across editor.js (task-owner attr + click resolves to owning action
node, passes task-id), wizard-core.js (edit the clicked task, record edit_task_id), and
wizard-action.js (append/replace by id, preserve siblings, Add-more stacks into same block).
(3) New gap found: GAP-S73-1 — global editor can't remove a missing/failed HA device.
(4) Tonight's "No devices could be resolved" symptom traced to HA/Unraid updates breaking
the Sonos media_player entity feed (HA-side, not a PistonCore code bug); Jeremy switched
`@Speakers` to a ReSpeaker and it still won't pull — picker/resolution is a separate gap
(GAP-S73-2). NOTE: the GAP-S72-1 code is untestable end-to-end until the picker populates.

Prior context: Session 72 closed GAP-S71-1 (global resolution in action wizard — resolvers
now read `Editor.getGlobalsCache()`; `_globalsCache` no longer leaks into saved JSON).
Session 71 closed B-0 (backend v2). Session 70 closed W-S11 (first lossless round-trip).
Session 69 full spec reconciliation.

**Authority:** CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files
**Completed sessions and closed gaps:** See TASKS_HISTORY.md

---

## How to Use This File

- **One active task file.** All open gaps and fixes live here, grouped into session
  bundles so related bugs get fixed together instead of scattering across sessions.
- **Completed work moves to TASKS_HISTORY.md.** When a whole bundle or gap is fully done,
  move it out. Keep this file scannable.
- **Partial fixes stay here.** If a session fixes part of a gap, the done part goes to
  history; the open remainder stays in this file with a note.
- **Groups are stable; order flexes.** Jeremy fixes what's in front of him. When a new
  problem appears mid-session, log it into the right group and push the planned session
  back a slot. Don't reshuffle the groups — just reorder when they run.
- **New gaps:** assign every new gap to a group before the session closes. Never leave one
  unassigned. Format: `GAP-SXX-N`.

**Per-session discipline (from CLAUDE_SESSION_PROMPT.md):**
- Read all listed files before writing anything. Do not write code without permission.
- Show proposed changes as text for approval before writing files.
- Deliver complete file replacements, not diffs.
- Fix what the user can see first.
- At session end: move completed items to TASKS_HISTORY.md; roll partial fixes' remainders
  forward; log any new gaps into a group.

---

## The Goal Before Everything Else

**Clean round-trip on a simple piston:**
wizard writes JSON → backend saves it → compiler reads it → frontend renders it correctly →
deploy to HA → manual trigger fires.

### What "S3-1 passes" means — concrete checklist
S3-1 is not done until every item below verifies with one simple real piston (built fresh
in the wizard; SAMPLE_PISTONS.md is old-format until regenerated at D-S6 — see D-S5d):
1. Wizard builds the piston from scratch, no manual JSON edits — including its TRIGGER in
   the top-level `triggers` array (requires W-S18).
2. Save round-trips cleanly: close, reopen, every node renders identically. No "Unknown
   statement" placeholders, no missing nodes.
3. Edit one node (e.g. change a device). Save. Round-trip again. Identical except the change.
4. Compile target detected correctly as `native_script`.
5. Test Compile output matches YAML hand-verified at D-S6 against the final JSON
   (COMPILER_SPEC.md is FROZEN/STALE — do not use its current examples as the oracle),
   normalized whitespace.
6. Deploy succeeds, no HA reload errors.
7. Manual trigger fires; PISTONCORE_RUN_COMPLETE event received and surfaced.

All seven. Partial passes are gaps, not victories.

---

## ⭐ The Load-Bearing Rule (read before any wizard/editor/compiler work)

If this breaks, nothing works — the editor just shows pretty text that compiles to nothing.

- **Variables and globals store device NAMES (friendly names), never entity IDs.** The
  friendly name is the lookup key — it's how HA returns the device's entity IDs. A variable
  is a device list; entity IDs are pulled live from HA when used.
- **Nodes store entity IDs** — the attribute-bearing entity, one per device, for the chosen
  function. (Illuminance condition on 2 devices → 2 `*_illuminance` entity IDs. Not battery,
  not motion.)
- **Resolution happens at the node, at commit**, because the same variable can feed
  different attributes in different statements.
- **Only nodes hold entity IDs. Variables/globals never do. One rule, no exceptions.**

Authoritative: PISTON_FORMAT.md "⭐ THE LOAD-BEARING RULE". Diff anchor: REFERENCE_PISTON_V2.json.

---

# ACTIVE WORK — GROUPED INTO SESSION BUNDLES

Default order is top to bottom. Reorder as testing dictates; keep the groups intact.

---

## W-S15 — Action Wizard Fixes

**Files:** wizard-action.js, wizard-core.js, wizard-variable.js, editor.js,
WIZARD_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

- **SPEAK_ACTION_SPEC.md holds the TTS spec for editor + compiler.** GAP-S72-1 (the
multi-task with-block foundation) is done in code; Speak rides on it.

- **GAP-S71-1 ✅ CLOSED (Session 72):** Global resolution in action wizard fixed.
  `_getFlatEntityIds` and `_getGroupedEntityIdsForTokens` now read from
  `Editor.getGlobalsCache()` (loaded at editor-open time) instead of `_deviceData_globals`
  (which was never populated in the edit flow). `Editor.getGlobalsCache()` exposed on the
  Editor public API alongside `getPistonVariables()`. Also fixed `_globalsCache` leaking
  into saved piston JSON — editor.js restores the cache after backend response reassignment.
  Files changed: editor.js, wizard-core.js, wizard-action.js.

- **GAP-S72-1 (multi-task with-block — HIGH) — CODED Session 73, NEEDS VERIFY:**
  The with-block now stacks tasks instead of overwriting. The bug was deeper than filed:
  clicking a task line resolved to null (`_findAnyNode` doesn't search `tasks[]`) so task
  EDIT did nothing; `_route` always read `tasks[0]`; `_saveDeviceCmd` wrote `tasks:[newTask]`.
  Fix landed across three files (full replacements in Session 73 outputs):
  - **editor.js** — task line carries `task-owner` (parent action id); a task click resolves
    to the owning action node and passes the clicked `task-id` to the wizard.
  - **wizard-core.js** — `_route` edits the task matching `extra['task-id']` (not `tasks[0]`);
    records `_sel.edit_task_id`.
  - **wizard-action.js** — `_saveDeviceCmd` appends/replaces the task by id, preserves
    sibling tasks; "Add more" re-targets the same block so tasks stack.
  **Remainder still open (rolled forward):**
  - **GAP-S72-1b (UX, picker-adjacent):** "+ add a new task" on an EXISTING block forces a
    device re-pick (the add-task path has no `editNode`, so the device picker resets). The
    code is safe (CASE 1 appends to the existing block regardless), but the user shouldn't
    re-select devices the block already has. Fix = pre-fill the device picker from the block
    on `'task'`-context entry. Do this WITH the picker work (GAP-S73-2) — same code area.
  - **VERIFY:** untestable end-to-end until the picker populates (GAP-S73-2). Once resolution
    is healthy, confirm: add 2nd/3rd task stacks; edit middle task edits only it; delete one
    keeps the rest (delete path not yet built — see WITH_BLOCK_TASK_FRAMEWORK.md §3.3).

- **GAP-S73-2 (picker / device resolution — HIGH, NEW Session 73):** The action command
  picker shows "No devices could be resolved" even after switching `@Speakers` to a device
  that is NOT the broken Sonos (a ReSpeaker). Tonight's trigger was HA/Unraid updates
  breaking the Sonos `media_player` entity feed (HA-side), BUT the failure persisting after
  switching devices indicates a real resolution/picker bug, not only the missing entity.
  This is its OWN session, and must be debugged against a HEALTHY HA (entities flowing).
  Do NOT conflate with GAP-S72-1. Owns: `_goCommandPicker`, `_goActionDevicePicker`,
  `_getGroupedEntityIdsForTokens`, `_getFlatEntityIds`, globals/variable resolution, and the
  GAP-S72-1b device-picker pre-fill above. Files: wizard-action.js, wizard-core.js, editor.js.
  **Session 74 leads to check FIRST (found in code review, may explain it without live HA):**
  (a) GAP-S74-3 — both resolvers filter piston variables by `v.var_type === 'device'`
  EXACTLY (wizard-core.js ~301, ~361); a `devices`-plural variable resolves to NOTHING.
  (b) Friendly-name match requires the stored name to equal the COMPUTED group label
  (shortest friendly_name in the device_id group, wizard-core.js ~211) — an HA update that
  renames/adds/drops an entity in the group changes the label and silently breaks every
  stored reference to it. (c) Globals resolution reads `g.value || g.initial_value` and does
  not type-check — fine — but the global PICKER lists only `g.var_type === 'device'`
  (wizard-action.js ~96), so a global typed anything else disappears from the list entirely.

- **GAP-S74-2 (action commit violates the load-bearing rule — HIGH, NEW Session 74):**
  CLAUDE_SESSION_PROMPT claims W-S11 closed the attribute/domain-bearing resolution for
  "conditions/actions/for_each." TRUE for conditions (`_capEntityMap`), FALSE for actions:
  `_saveDeviceCmd` (wizard-action.js ~750–793) writes ALL resolved entity_ids to the node
  with no command/domain filter — its own comments contradict each other (~748 says
  "only ids whose domain can perform this service"; ~764 says "No domain filtering here";
  the code does the latter). Worse, the task's `domain` is derived from
  `finalIds[0].split('.')[0]` — order-dependent — so a multi-entity device (e.g. Sonos =
  media_player + battery sensor) can commit `domain:'sensor'`, `ha_service:'sensor.volume_set'`.
  Fix direction: filter committed entity_ids to entities whose domain supports the chosen
  service (the service-intersection step already knows this), and derive `domain` from the
  chosen service's owning domain, never from `finalIds[0]`. Also correct the
  CLAUDE_SESSION_PROMPT W-S11 claim to conditions-only (D-S5d item 1).
  Files: wizard-action.js, CLAUDE_SESSION_PROMPT.md.

- **GAP-S74-3 (`devices` plural var_type blind spot — MED, NEW Session 74):** The spec
  (PISTON_FORMAT variable table) documents `device`/`devices` as valid var_types; the code
  implements ONLY singular `'device'` in: both resolvers (wizard-core.js ~301, ~361), the
  action picker (wizard-action.js ~93–97), the for_each picker (wizard-loops.js ~57,
  ~184–186), and the re-resolve trigger (editor.js ~1196). A `devices`-typed variable
  (e.g. imported `Door_locks`) shows in no picker and resolves to nothing. DECISION NEEDED
  (Jeremy): either retire `devices` (spec edit + import normalization `devices`→`device`)
  or support it everywhere (change every filter to `['device','devices'].includes(...)`).
  Retiring is simpler and matches what the wizard writes. Subsumes the resolver half of
  GAP-S71-2 below. Files: wizard-core.js, wizard-action.js, wizard-loops.js, editor.js,
  wizard-variable.js, PISTON_FORMAT.md.

- **GAP-S71-2 (variable edit dialog — wrong type, MED) — DIAGNOSED Session 74:** editing a
  device variable with var_type `devices` opens with the type dropdown set to "Dynamic".
  Cause found: `VAR_TYPE_DISPLAY` (wizard-variable.js ~20–28) has `'device'` but no
  `'devices'` entry, so plural fails to normalize and the select falls back to the first
  option. One-line fix once the GAP-S74-3 decision is made (add the map entry, or normalize
  plural→singular on hydrate). File: wizard-variable.js.

- **GAP-S70-1 (`_reResolveVariableUses` — MOVED from DEFERRED, upgraded to DEFECT,
  Session 74):** Verification is done from code — it WILL violate the load-bearing rule.
  The function (editor.js ~1352–1402) re-resolves nodes via attribute-blind
  `_getFlatEntityIds(tokens)`, writing the ENTIRE entity cluster back onto condition nodes
  whose entity_ids were attribute-filtered at commit (silently undoing the W-S11 fix on
  every device-variable edit). Also: the documented `newEntityIds` parameter is never used
  in the body (stale signature), and the trigger (editor.js ~1196) only fires for
  `var_type === 'device'` (GAP-S74-3 again). Fix direction: re-resolve per-node using the
  node's own `attribute` (conditions) / task service domain (actions, after GAP-S74-2) —
  i.e. reuse the `_capEntityMap`-style attribute-bearing resolution, not the flat fallback.
  Files: editor.js, wizard-core.js.

- **GAP-S73-1 (global editor can't remove a missing device — HIGH structural) —
  VERIFY-FIRST DONE (Session 74), ready to code:** The GAP doc's live-match hypothesis is
  confirmed against globals.js, with the exact mechanism: (a) picker rows are rendered ONLY
  from live-resolved HA device groups (`_filteredDevices` → `_renderDeviceRows`,
  globals.js ~376–384), so a stored friendly name with no live match has no row to click
  off; (b) "Deselect All" deletes only VISIBLE devices from the selection set
  (`visible.forEach(d => selected.delete(d.friendly_name))`, ~292–297), so unresolvable
  entries survive it — exactly the observed "remove all did not work"; (c) bonus: the
  legacy entity_id→name conversion (~242–253) silently DROPS unresolvable entries from the
  selection while leaving them in the stored value, so old-format globals show a misleading
  count. Fix per GAP_global_editor_missing_device_removal.md: render stored-but-unresolvable
  entries as flagged removable rows ("⚠ <value> — not found in HA"); make Deselect All clear
  the entire selection set unconditionally, not just visible rows.
  Files: globals.js (primary).

- **GAP-S45-1 (cosmetic):** set_variable wizard doesn't normalize `$` prefix.

---

## ✅ SESSION 73 OUTPUT REVIEW — DONE (consolidation review)

The Session 73 outputs were reviewed against the conversation context and the CODE (source
of truth). Findings:
- **Code (editor.js / wizard-core.js / wizard-action.js):** GAP-S72-1 fix traced end-to-end
  and verified consistent across all three files (task-owner threading → edit-by-task-id →
  append/replace-by-id). Logically correct; still untestable end-to-end until the picker
  populates (GAP-S73-2). No code changes needed.
- **WITH_BLOCK_TASK_FRAMEWORK.md:** the task discriminator was mis-framed as an unresolved
  ASSUMED storage decision ("Claude invented it, override freely"). Corrected: the three-way
  WebCoRE picker category (all-devices / emulated / location) is the authoritative VISIBLE
  requirement (§5.2); the JSON representation is an internal coding-time choice, not Jeremy's
  call and not an open spec question. §2.3, §3.4, §6, §7 reframed accordingly.
- **WIZARD_SPEC.md W-6:** confirmed it references the framework for the model/bug rationale
  and does not restate a competing discriminator; one cross-reference tightened.
- **COMPILER_DECISIONS_HOLDING.md (NEW):** created to preserve the at-risk SPEAK/NOTIFY
  compiler decisions (Speak volume-as-separate-step, compile-time engine, cache default,
  SSML passthrough; Notify stable-target-ref + template-by-kind + service-registry fetch)
  before they're lost to the frozen compiler specs. Retire at D-S6.
- **GAP_global_editor_missing_device_removal.md:** fix direction is still a structural read,
  not yet confirmed against the global-editor code — verify before fixing (unchanged).

Spec files are now safe to treat as reference.
**Session 74 amendment:** the audit found two spec CLAIMS that are wrong against code and
must be downgraded (see W-S18 and GAP-S74-2): "triggers/conditions/restrictions confirmed
against editor.js" (render/delete side only — the wizard cannot write them) and "W-S11
closed for actions" (conditions only). Tracked in D-S5d.

---

## W-S18 — Top-Level Trigger / Condition / Restriction Seam  ← NEW (Session 74) — HIGH, BLOCKS S3-1

**The single biggest finding of the Session 74 code audit.** The spec model (PISTON_FORMAT
Trigger/Condition/Restriction Storage; compiler reads `_piston.triggers` directly) is only
HALF implemented: the editor RENDERS the top-level arrays and can DELETE from them, and
`insertStatement` HAS routing for them (editor.js ~1179–1187) — but the wizard can never
reach that routing. Until this is fixed, **no wizard-built piston can compile with any
triggers at all** (the compiler reads an array the wizard cannot populate).

- **GAP-S74-1 (HIGH — the seam):** Verified flow:
  1. The "only when" ghost passes context `'trigger_or_condition'` with NO block-id
     (editor.js ~286); the restrictions ghost passes `'restriction'` (~268).
  2. `_commitCondition` (wizard-condition.js ~769–792) routes ONLY `if_condition` and
     `trigger_or_condition`+blockId. Every other context falls into the else branch, which
     **wraps the condition in a brand-new `if` node and inserts it as a statement.** The
     if-node matches no array branch in `insertStatement` → lands in `_piston.statements`.
     Result: adding a trigger from the top-level section creates an if-block in the action
     tree, writes nothing to `_piston.triggers`, and doesn't even appear in the section it
     was added from.
  3. `insertStatement` has **no `'restriction'` branch at all** — nothing anywhere writes
     `_piston.restrictions`.
  4. **Edit is worse:** clicking a top-level trigger/condition opens context
     `'edit_condition'` (`_openWizardForEdit`, editor.js ~745); `_commitCondition`'s else
     branch wraps the EDITED condition in a NEW if-block with a NEW id → a duplicate
     appears in the action tree and the original array entry is never updated. This is the
     most likely real face of GAP-S69-2.
  **Fix direction (verify in session):** `_commitCondition` routes by context —
  `'trigger_or_condition'` (no blockId) → bare condition node to
  `insertStatement('trigger'|'condition', node)` by `is_trigger(op)`; `'restriction'` →
  new `insertStatement` restriction branch writing `_piston.restrictions`;
  `'edit_condition'` → replace-by-id in whichever top-level array holds the node (helper
  parallel to `_replaceCondition` for the three arrays). Do NOT wrap in an if-node for any
  of these. Keep the existing if_condition flow untouched (it is correct and verified).

- **GAP-S74-5 (MED — time-condition shape, same code area):** Three-way mismatch.
  Spec (PISTON_FORMAT Time Condition): `subject:"time"`, `value_from`/`value_to`, preset
  objects, ISO `only_on_days`. Code commit (`_buildConditionNode`, wizard-condition.js
  ~859–931): `role:'time'`, NO `subject` field, start value in `display_value`/
  `compiled_value`, end in `value_to`. Code hydrate (`_route`, wizard-core.js ~561–567)
  expects `subject` to be an OBJECT (`subject.type`, `subject.entity_id`) — a shape
  matching neither, so a spec-shaped time condition (imported alarm piston, SAMPLE_PISTONS)
  mis-hydrates as a device condition. Also `wiz-subj-time` input is collected but never
  written to the node (vestigial). DECISION: pick ONE shape (recommend: keep the code's
  flat shape, add `value_from`, update PISTON_FORMAT/STATEMENT_TYPES; delete the dead
  subject-object hydrate branch), then make commit + hydrate + spec agree.
  Files: wizard-condition.js, wizard-core.js, PISTON_FORMAT.md, STATEMENT_TYPES.md.

**Files:** wizard-condition.js, wizard-core.js, editor.js, PISTON_FORMAT.md,
STATEMENT_TYPES.md, DESIGN.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
**Ordering note:** can be coded before or after GAP-S73-2 — it does not need live HA to
fix or to verify (build a trigger, inspect the saved JSON). It DOES block S3-1 item 4–7.

---

## W-S17 — Must-Work Wizard Features Spec  ← SPEC PARTIALLY DONE (Session 73)

These are not nice-to-haves. They are core to real pistons. Walking the alarm piston
surfaced all of these as hard blockers.

**Session 73 update:** The with-block / task container is now specced authoritatively in
**WITH_BLOCK_TASK_FRAMEWORK.md** (the framework holds ALL WebCoRE task types; only Jeremy's
pistons' commands get implemented). PISTON_FORMAT/STATEMENT_TYPES/WIZARD_SPEC reconciled to
the code. The structure decision is made: a with-block is an `action` node + ordered
`tasks[]`; each task carries its picker category (device / location/virtual) as the
discriminator (the picker already knows it at selection time). GAP-S72-1 is also CODED
(see W-S15). The remaining W-S17 items below still need their wizard PATHS built.

### Multi-task with-blocks (GAP-S72-1) ✅ SPEC DONE + CODED (Session 73)
Specced in WITH_BLOCK_TASK_FRAMEWORK.md; coded in W-S15. Remaining: the per-task DELETE
path (framework spec §3.3) and the picker pre-fill (GAP-S72-1b). Verify once picker works.

### Wait (GAP-S72-2)
`wait` must be buildable as a first-class duration, including variable duration
(`Wait {integer_Lock_Confirm_Wait} seconds`). STATEMENT_TYPES §14 now flags wait-duration
as needing an operand (literal OR variable). Must work from the statement picker AND as an
in-block virtual task (framework spec §2.4 duality).
- JSON: `{ type: "wait", duration: {type:"variable", name:"$varname"}, duration_unit: "seconds" }`

### Volume set with variable (GAP-S72-3)
`volume_level` in HA is 0.0–1.0; WebCoRE used 0–100. Wizard must accept a variable as the
volume value (operand, per framework spec §5.3) and the compiler handles the 0–100 → 0.0–1.0
conversion (compiler concern, deferred to D-S6).

### TTS / Play media with composed message (GAP-S71-4 — carried forward)
Build a TTS / play_media action targeting a media_player global, composing spoken text from
literals + variables. See SPEAK_ACTION_SPEC.md (authoritative for the Speak task) — its
PROPOSED field names are now answerable against the reconciled PISTON_FORMAT task schema.

### Set variable with expression (GAP-S72-4)
Set variable nodes using string concatenation (`$DoorsOpen = $DoorsOpen + " " + $contact`)
must be buildable. JSON supports it (`value.type: "expression"`, STATEMENT_TYPES §13); the
wizard path doesn't exist. Also available as an in-block virtual task.

### Command picker rename-map (GAP-S73-3 — decision needs a home + a code home)
WITH_BLOCK_TASK_FRAMEWORK.md principle 6 says a NARROW set of commands gets a user-facing
rename in the picker (visible label ≠ WebCoRE name) because the WebCoRE name points to
something that doesn't exist for the HA user. Settled renames so far: "Set Hubitat Safety
Monitor status" → HA alarm action; "Send an IFTTT Maker event" → **"Webhook"**. **Open
question:** WHERE does this rename map live in code, and where in the spec is the
authoritative list? The picker is populated from the WebCoRE command list (framework §5);
nothing yet specifies a rename layer between that list and the displayed label. A coding
session must (a) decide the rename-map's home (likely a small lookup applied at picker render),
and (b) the authoritative rename list needs a spec home — Jeremy picks each replacement name,
not Claude (principle 6). Until then the map is two entries living only in principle 6.

**Files for these items:** WIZARD_SPEC.md, STATEMENT_TYPES.md, PISTON_FORMAT.md,
WITH_BLOCK_TASK_FRAMEWORK.md, SPEAK_ACTION_SPEC.md, wizard-action.js, wizard-statement.js,
wizard-loops.js, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## W-S12 — v1 Retirement + Load Safety

Clean-slate the storage so testing isn't polluted by half-migrated files.

**Files:** editor.js, wizard-core.js, PISTON_FORMAT.md, DESIGN.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

- **GAP-S69-1:** logic_version 1 is retired — reject any piston without `logic_version: 2`
  with a clear message. Remove lazy per-node migration. Delete all existing v1 pistons from
  sandbox userdata; start fresh.
- **GAP-S69-2 (BLOCKER — RE-POINTED Session 74):** editing certain nodes errors out / fails
  to update. Original hypothesis (v1 nodes missing `role_tokens`/`entity_ids` on hydrate)
  may still apply to leftover v1 data, but the Session 74 audit found a CURRENT-FORMAT
  cause that matches the symptom and will NOT self-resolve: editing any top-level
  trigger/condition routes through `_commitCondition`'s else branch and creates a duplicate
  if-block instead of updating the original (full trace in W-S18 / GAP-S74-1 item 4).
  Treat GAP-S69-2 as closed-by-W-S18 unless a distinct in-block edit failure reproduces
  after W-S18 lands. **Needs at session time (if it reproduces):** the actual
  console/network error.
- **GAP-S69-3:** `_normalizePiston` (editor.js ~96-114) silently `splice`s malformed nodes —
  permanent silent data loss, violates the render invariant. Fix: leave the node, flag it,
  show `⚠ Unknown statement [id] — edit to repair`.

---

## W-S13 — Editor / Wizard Cleanup

Small, low-risk items grouped so they don't each burn a session.

**Files:** editor.js, wizard-core.js, WIZARD_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

- **GAP-S58-2:** Copy/paste/duplicate statements (also MISSING_SPECS Item 26). The anchor item.
- **GAP-S69-4 (rides on GAP-S58-2) — NARROWED Session 74:** `_deepReId` (editor.js ~1008)
  now DOES cover `conditions[]` and `tasks[]` (~1023–1024) — do not re-fix those. Still
  missing: `until_conditions` (repeat blocks) and `else_ifs[].conditions` (the else_ifs
  handler re-IDs `eib.id` and `eib.statements` only). Copy/paste leaves those IDs stale.
- **GAP-S74-6 (LOW, NEW Session 74):** `only_on_days` encoding is inconsistent between
  builders: the condition builder writes ISO 1–7 Monday-first (wizard-condition.js ~76,
  `value="${i+1}"` — matches spec) but the timer/`every` builder writes 0–6
  (wizard-loops.js ~352, `value="${i}"`). Pin ISO 1–7 everywhere (one-character fix in
  wizard-loops + hydrate compatibility for any existing `every` nodes) so the compiler gets
  one encoding. Files: wizard-loops.js, STATEMENT_TYPES.md (§9 every).
- **GAP-S74-7 (decision + LOW, NEW Session 74):** `list_role` is NOT retired v1 residue —
  it is actively written on every new for_each (wizard-loops.js ~136, ~146, alongside
  `role`/`role_tokens`) and READ by the editor render (editor.js ~390–393), status.js
  (~201), the edit hydrate (wizard-core.js ~684), and seeded by wizard-statement.js (~98).
  STATEMENT_TYPES §6 omits it. DECISION (Jeremy): document it in §6 as a for_each display
  field, or migrate all four read sites to `role` and stop writing it. Migrating to `role`
  is cleaner (it's a duplicate) but touches four files; documenting is one spec line.
  Files: wizard-loops.js, editor.js, status.js, wizard-core.js, wizard-statement.js,
  STATEMENT_TYPES.md.
- **GAP-S69-6:** Remove dead `Editor.getDeviceMap()` export (editor.js ~1385). grep for callers
  first; if any exist they're using retired v1 thinking and need review.
- **GAP-S69-7:** `_sel = JSON.parse(JSON.stringify(editNode))` (wizard-core.js ~515) lets legacy
  fields (`list_role`, `devices`, old `device_map` refs) persist through an edit round-trip.
  Fix: build the commit output node from scratch using only spec-defined fields for the node type.
- **GAP-S69-8 (low):** `_groupDevices` uses "shortest friendly_name wins" — non-deterministic
  for equal-length names.

---

## W-S14 — Import Fixes

All import-path work grouped together.

**Files:** editor.js, list.js, api.py, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

- **GAP-S46-5:** Import modal is paste-only — add a file picker.
- **GAP-S68-1:** Import mapper shows raw entity_ids instead of friendly names.
- **GAP-S68-2:** Import role mapping does not populate defines `initial_value`.
- **GAP-S46-4 (G-3):** Imported globals land in piston variables instead of the globals store.
- **GAP-S71-3 (import role-mapping dialog never fires) — ROOT CAUSE FOUND Session 74:**
  The entire import step-2 flow in list.js is still built on the retired `device_map` model:
  unmapped roles are detected from `saved.device_map` (~325), which the Session 71 backend
  no longer returns — so `unmapped` is always empty and the dialog can never fire. Worse,
  the Continue handler writes `device_map` back onto the piston via savePiston (~396–404),
  re-introducing the retired field if it ever did fire. The fix is not "make the dialog
  fire" — it is REBUILDING step 2 against the v2 model per DESIGN 6.11: detect unmapped
  from nodes with `role`/`role_tokens` and empty `entity_ids` (walk statements + the three
  top-level arrays), and on Continue write resolved entity_ids onto those NODES (and
  friendly names into defines per GAP-S68-2), never a map. Found Session 71; diagnosed
  Session 74. Files: list.js (primary), editor.js, api.py.

---

## W-S16 — Visual / Display-Only Gaps (parked, non-blocking)

- **GAP-S70-2:** `_condLine` does not render `display_value` for some operators — editor shows
  `{Illuminance} is less than or equal to` with no `800`. Value IS saved correctly in JSON.
- **GAP-S74-9 (LOW render defects, NEW Session 74):**
  (a) editor.js ~229 reads `p.updated_at` but the wrapper field is `modified_at` — the
  "Modified" comment line always renders blank.
  (b) task render reads undocumented `task.service` before `task.command` (editor.js ~379) —
  dead/legacy first branch; nothing writes `service`.
  (c) define render reads `initial_device_names` FIRST with a comment calling it the model
  (editor.js ~244–249) — backwards per PISTON_FORMAT (initial_value is the model;
  initial_device_names is never written). Harmless fallback order; fix the comment and
  prefer `initial_value`.
- **(add visual items here as found)**

---

## STAGE G — Globals (remaining)

- **G-4 / GAP-S57-5:** Global device edit → redeploy prompt + batch entity_id update across
  all pistons referencing the changed global.
  **Design decision (Session 72):** Two viable approaches —
  (a) **Scan on demand** — at redeploy time, backend walks all piston JSON files, finds
      `role_tokens` containing `@GlobalName`, re-resolves entity_ids, saves. Simple, always
      correct, no drift. Fine at current scale (dozens of pistons).
  (b) **Indexed used_by list** — store `used_by: ["uuid1","uuid2"]` on each global object.
      Drift healed by inventory pass on editor load (and optionally on a timer). Faster lookup
      at scale. More moving parts but all within PistonCore's own files.
  **Decide at G-4 session time** based on piston library size at that point.
  **Files:** globals.js, api.py, wizard-core.js, editor.js, DESIGN.md, WIZARD_SPEC.md,
  CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## STAGE B — Backend Compiler  (BLOCKED until the wizard round-trip works)

**Do not start STAGE B until the alarm piston (or an equivalent real piston) builds AND
round-trips cleanly through the wizard.** The wizard gaps in W-S14/W-S15/W-S17 come first.

### B-1: compiler.py — Entity IDs Direct Read + MISSING_ENTITY Validation
**Blocked** per the stage note above.

**What to implement:**
1. Remove all `device_map` / `list_role` lookup from compiler.py.
2. Read `entity_ids` directly from condition, action, for_each nodes, and the top-level
   triggers/conditions/restrictions arrays.
3. Implement `resolve_entities()` per COMPILER_SPEC.md Section 8.
4. Add `MISSING_ENTITY` compiler error (COMPILER_SPEC.md Section 13).
5. Entity validation as Stage 2 in pre-deploy pipeline (Section 15).
6. Multi-entity triggers/actions: pass entity_ids array directly (no expansion).
7. for_each: write entity_ids list inline (no lookup).

**Reference:** PISTON_FORMAT.md v2.4, STATEMENT_TYPES.md v2.3, SAMPLE_PISTONS.md
(⚠ SAMPLE_PISTONS is old-format until D-S5d regenerates it — see D-S5d item 4).
**Note:** COMPILER_SPEC.md is intentionally STALE (see D-S6). Treat its content as directional
only; PISTON_FORMAT.md + STATEMENT_TYPES.md + REFERENCE_PISTON_V2.json are authoritative.
**Files:** compiler.py, context_builder.py, COMPILER_SPEC.md, PISTON_FORMAT.md,
STATEMENT_TYPES.md, REFERENCE_PISTON_V2.json, SAMPLE_PISTONS.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

### B-2: Full v1-Residue Audit — BACKEND + FRONTEND  (do with or before B-1; expanded Session 74)
Backend (original scope): grep every backend `.py` (context_builder.py, ha_client.py,
main.py, compiler.py, utils.py) for `device_map`, `list_role`, `logic_version` defaults of
1, and any other v1-model assumptions. storage.py already confirmed clean (Session 71).
**Frontend (NEW Session 74 — the audit found the residue is NOT backend-only):**
- **GAP-S74-8 (stale-comment cluster — these comments assert the OPPOSITE of the
  load-bearing rule and will mislead any session that reads them as truth):**
  api.js `createGlobal`/`updateGlobal` ("value is an array of entity ID strings" — twice)
  and `importPiston` ("device_map may be empty..."); globals.js header (~lines 7–9, "device
  value: array of entity_id strings") and `_renderDevicePicker` intro (~233); 
  wizard-variable.js header ("G-2b: Device initial value stores array of entity_id
  strings"); wizard-action.js header ("physical device row → primary_entity_id" —
  contradicts the sel.tokens HARD GUARDRAIL in its own file). Fix = rewrite the comments to
  state the friendly-name model; zero behavior change.
- editor.js `getDeviceMap()` dead export (GAP-S69-6, W-S13 — coordinate, don't double-fix).
- list.js import flow (GAP-S71-3, W-S14 — coordinate).
- status.js `_exportPiston` snapshot path (GAP-S74-4, S2-3 — coordinate).
- `list_role` is NOT residue — see GAP-S74-7 decision before grepping it out.
**Files:** all backend *.py, api.js, globals.js, wizard-variable.js, wizard-action.js,
editor.js, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## STAGE D — Spec (remaining)

### D-S5c: Leftover Audit Findings (spec cleanup — not yet applied)
- **Finding 7:** DESIGN.md bare "do not re-open" markers — replace with "re-open only if [condition]".
- **Finding 12:** `compile_target` is a cache, not a user preference — document in PISTON_FORMAT.md.
- **Finding 15:** Test button always fires real actions — deferred v2 dry-run feature, recorded.
- **Pattern B:** DESIGN.md superseded-section cascade — add preamble, reduce 6.2/6.3 to pointers.
- **§10-a ✅ RESOLVED (Session 73):** "Set location mode → input_select" researched live and
  confirmed (input_select.select_option + state-trigger); now in §10.1 as verified.
- **§10-b ✅ RESOLVED (Session 73):** §10.1 now has a column-meaning note distinguishing
  "HA doc read this session" from "Existing path" (already-in-code).
- **§10-c ✅ RESOLVED (Session 73):** LIFX researched — native effect actions exist
  (lifx.effect_pulse w/ modes, effect_colorloop, effect_move, set_state; scenes via
  select.select_option). LIFX is REPRODUCIBLE, moved to §10.1, removed from cut list.
- **§10-d ✅ RESOLVED (Session 73):** §10.4 now states plainly that "reproducible" = the HA
  action exists, NOT end-to-end behavior-tested (scene.create unavailable-entity quirk cited);
  real-HA testing still advised before v1.
- **§10 status:** non-device command research is COMPLETE for wizard load — no open items.
  The only remaining real-HA *testing* (not research) is end-to-end behavior verification of
  the §10.1 mappings, which belongs in Stage 3, not here.
**Files:** DESIGN.md, PISTON_FORMAT.md, HA_LIMITATIONS.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

### D-S5d: Spec Corrections from the Session 74 Audit (spec-only session — no code)
The Session 74 code↔spec audit found spec CLAIMS that are wrong against code, plus the
spec-file contradiction sweep from the same review. One housekeeping session applies all:
1. **CLAUDE_SESSION_PROMPT.md — downgrade two claims:** (a) "Code now obeys this rule for
   conditions/actions/for_each (W-S11 closed)" → conditions + for_each only; actions are
   GAP-S74-2. (b) "Triggers/conditions/restrictions are top-level wrapper arrays
   (Researched — confirmed against editor.js)" → confirmed for RENDER and DELETE only; the
   wizard cannot write them until W-S18. Also remove the stale "Session 73 output files
   want a review pass" note (review completed — TASKS.md is current) and sync the
   spec-versions block.
2. **PENDING vs COMPLETE sweep (command classification):** truth is COMPLETE for the
   non-device set per HA_LIMITATIONS §10. Still saying PENDING: CLAUDE_SESSION_PROMPT (×2),
   this file's spec-versions block (fixed Session 74), WITH_BLOCK_TASK_FRAMEWORK §4 heading,
   §5.4 blockquote, §7, §8 (the §4 body and §6 item 6 were patched; the rest weren't).
   Also fix the garbled sentence in framework §6 item 6 ("classify the full command
   classify each by...").
3. **PISTON_FORMAT.md:** fix the "Complete Minimal Example" — it omits the Required
   top-level `triggers`/`conditions`/`restrictions` arrays and embeds the trigger inside an
   `if` (the retired model) in the single source-of-truth doc. Also: document the
   location-action node shape (`devices:['Location']`, no role/role_tokens/entity_ids —
   what `_saveLocationCmd` actually writes) or mark it transitional-until-virtual-tasks;
   pin ONE `duration_unit` vocabulary (code writes full words everywhere — fix
   STATEMENT_TYPES §14's `ms/s/m/h/d/w` list to match); fix "update all four documents"
   (lists five); decide the time-condition schema with GAP-S74-5.
4. **SAMPLE_PISTONS.md:** all three pistons are old-format (nested `is_trigger` in if
   blocks, no top-level arrays, no `role_tokens`) — valid-looking files that compile to
   ZERO triggers under the current model. Add a FROZEN/STALE notice now; regenerate at
   D-S6 (ideally from real wizard output once W-S18 lands).
5. **S3-1 checklist:** item 1 references the (stale) first SAMPLE piston; item 5 references
   "hand-verified YAML in COMPILER_SPEC.md," which is FROZEN/STALE by our own decision.
   Reword both (done in this file, Session 74) — the spec-side mirror is updating any other
   doc that repeats the checklist.
6. **FRONTEND_SPEC.md (v1.5):** add a staleness header — it still shows the removed
   compile-target badge, has no RESTRICTIONS section in the editor layout (PISTON_FORMAT
   cites it for exactly that layout — dangling cross-ref), and predates the Session 73 task
   model. Point readers to WITH_BLOCK_TASK_FRAMEWORK.md + current code for those areas.
7. **Housekeeping:** retire PROGRESS_TRACKER.md (Session-12 fossil that contradicts current
   state — move to /reference; salvage the deploy-time visual checklist into a current doc
   if wanted); delete COMPILER_SPEC_STALE_NOTICE.md (the notice is already pasted into both
   compiler specs — verified); fix the notice's dangling "Data Preservation Invariant"
   reference (no such section — it's the Load-Bearing Rule / Field Lifecycle Rules);
   refresh stale version pins (WIZARD_SPEC header cites PISTON_FORMAT/STATEMENT_TYPES v2.2;
   prefer section-name anchors over line-number refs like "lines 200-272").
8. **PISTON_FORMAT Field Lifecycle table:** mark the Snapshot "Stripped" rows as TARGET
   until GAP-S74-4 / S2-3 implements them (or land the fix first and leave the table).
9. **D-S5c stale items:** DESIGN.md v1.8's header says Finding 7 and Pattern B were applied
   in Session 69c, but D-S5c still lists both as "not yet applied." Verify in DESIGN.md and
   close whichever is true.
10. **HA_LIMITATIONS §10.2 second look (question, not a verdict):** "Pause/Resume piston"
   is cut as having no HA analog — but §10.1 maps Execute piston to `automation.trigger`/
   `script.turn_on`, i.e. the compiled piston IS an addressable HA entity, and
   `automation.turn_off`/`turn_on` against it arguably reproduces pause/resume by the
   reproduce-the-result test (semantics differ from WebCoRE's mid-run pause — Jeremy
   decides). Piston tiles / set-piston-state remain genuine cuts.
**Files:** CLAUDE_SESSION_PROMPT.md, PISTON_FORMAT.md, STATEMENT_TYPES.md,
SAMPLE_PISTONS.md, FRONTEND_SPEC.md, WITH_BLOCK_TASK_FRAMEWORK.md, HA_LIMITATIONS.md,
DESIGN.md, PROGRESS_TRACKER.md, COMPILER_SPEC_STALE_NOTICE.md, TASKS.md

### D-S6: Compiler Spec Rewrite (after JSON structure is final)
COMPILER_SPEC.md and PYSCRIPT_COMPILER_SPEC.md intentionally FROZEN/STALE. Rewrite after
W-S11 + B-1 prove the round-trip and JSON format stops moving.
**Files:** COMPILER_SPEC.md, PYSCRIPT_COMPILER_SPEC.md, HA_LIMITATIONS.md, PISTON_FORMAT.md,
STATEMENT_TYPES.md, REFERENCE_PISTON_V2.json, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## STAGE 2 — Connect the Seams (after round-trip works)

- **S2-2:** GAP-S38-1 (/api/logs route missing), GAP-S39-1 (ha_client import pattern wrong)
- **S2-3:** GAP-S43-4 (Snapshot export), GAP-S58-3 (piston backup/restore)
  - **GAP-S74-4 (MED, NEW Session 74 — fold into GAP-S43-4):** the current Snapshot export
    (status.js `_exportPiston`, ~491–505) is still v1: it empties `device_map` values and
    strips NOTHING else. Per PISTON_FORMAT's Field Lifecycle table, Snapshot must strip
    `role_tokens`, `entity_ids`, and `compiled_value` (keep `role`, `display_value`,
    `aggregation`). Today's "snapshots" are full backups with a label — they leak the
    user's entity_ids, which defeats the share/anonymize purpose. The lifecycle table's
    "Stripped" column is currently aspirational; either fix the export here or mark the
    table rows "TARGET — not yet implemented" until S2-3 lands (D-S5d item 8).

---

## STAGE 3 — Round-Trip Verification

### S3-1: Smoke Test — Full Round-Trip on One Simple Piston
Prerequisites: W-S11, W-S12, W-S14, W-S15, W-S17, **W-S18 (Session 74 — the wizard cannot
write top-level triggers without it)**, B-1, G-4 complete.
Success = all seven checklist items at top of file.

### S3-2: Deferred Validation Testing (after S3-1)
- GAP-S33-2: condition_and/or template indentation — real-world testing
- Sunrise/sunset negative offset edge cases
- Numeric trigger unknown-state behavior
- Single-device missing-entity behavior

---

## STAGE 4 — Features (only after Stage 3)

- **S4-16:** GAP-S30-3 (double config load), GAP-S34-1, GAP-S47-1 (cosmetic)
- **S4-17:** MISSING_SPECS Item 25 (entity state subscription vs polling)
- **Post-S3 polish:** audit `_esc()` coverage; self-host Google Fonts; CSP; ARIA pass.

---

## DEFERRED

- **GAP-S63-1:** Domain priority investigation — not blocking anything.
- **D-1 through D-9:** See TASKS_HISTORY.md (unchanged).
- **MISSING_SPECS Item 11 (partial):** post-S3-2, production sample pistons.
- **MISSING_SPECS Item 12:** post-S3-1, write BEST_PRACTICES.md.
- **MISSING_SPECS Item 15:** before S4-10, write-a-piston.md prompt content.
- **AI_PROMPT_SPEC.md** stale (old device_map model) — rewrite before any AI-import work.
- **GAP-S70-1:** MOVED to W-S15 (Session 74) — verification done from code; it is a defect.
- **GAP-S50-1:** carry-forward from W-S11.

---

## Session 74 Notes — Code↔Spec Audit (what was checked and confirmed GOOD)

So the next session doesn't re-verify what's already traced:
- **GAP-S72-1 fix is present and coherent** across editor.js (task-owner attr, ~383,
  ~721–727) → wizard-core.js (`_route` edit-by-task-id, ~642–651) → wizard-action.js
  (`_saveDeviceCmd` CASE 1/2/3 append/replace-by-id, ~800–841; Add-more re-targets the
  same block, ~843–861). Still untestable end-to-end until GAP-S73-2.
- **`_globalsCache` strip/restore** in editor.js `save()` (~1265–1268) — correct.
- **sel.tokens hard guardrail** (physical rows store ALL entity_ids) implemented in the
  action, condition, and for_each pickers.
- **Union-then-intersect** implemented including per-field intersection across groups
  (wizard-action.js ~624–664).
- **Operator vocabularies, LOCATION_COMMANDS, statement-type cards** match
  WITH_BLOCK_TASK_FRAMEWORK §5.1/§5.4/§5.6 exactly.
- **GAP-S69-3** (normalize splices), **GAP-S69-6** (getDeviceMap), **GAP-S69-7** (_sel deep
  copy), **GAP-S69-8** (shortest-name label) — all still present exactly as filed.
- NOT re-verified: GAP-S45-1 (left as filed).

## Session 72 Notes

- **Test vehicle:** `claude_alarm_checks_faithful.json` — faithful structural alarm piston copy.
  Devices are role placeholders (`entity_ids: []`). Use this to walk the wizard.
- **Old globals (entity_ids in value field):** test/lights/lumin_sensor/lock/Notifications_Push
  still store entity_ids instead of friendly names — pre-fix data. Edit them manually via the
  globals panel to correct. NOTE (Session 73): `@Speakers` was switched off the broken Sonos
  to a ReSpeaker; resolution still failed (GAP-S73-2). An HA update broke the Sonos
  `media_player` entity feed. The pre-fix-globals cleanup and GAP-S73-1 (can't remove a
  missing device) compound each other.
- **`_globalsCache` in saved JSON:** fixed Session 72 (editor.js restores cache after save
  response, preventing it from accumulating on `_piston` and leaking to disk).
- **volume_set 0–100 vs HA 0.0–1.0:** conversion concern logged in W-S17 (GAP-S72-3).

## Spec File Versions (after Session 73)
- DESIGN.md **v1.8**
- PISTON_FORMAT.md **v2.4** (Session 73 — task model: device/non-device tasks, picker
  category as discriminator (storage is a coding-time choice), order)
- WIZARD_SPEC.md **v2.7** (Session 73 — W-6 task append/edit/delete + virtual-in-block flows)
- STATEMENT_TYPES.md **v2.3** (Session 73 — task schema device/virtual, wait/set_var duality)
- WITH_BLOCK_TASK_FRAMEWORK.md **v1.0 (NEW, Session 73)** — authoritative task-container spec
- FRONTEND_SPEC.md **v1.5**
- HA_LIMITATIONS.md — Section 3 corrected; **non-device command classification COMPLETE
  (Session 73, §10, vs HA 2026.6)** — remaining work is real-HA behavior *testing* (Stage 3)
  and `target-boundary.json` existence verification (UNVERIFIED — confirm in code or create)
- COMPILER_SPEC.md **v1.5 — FROZEN/STALE** (see D-S6 — do not touch until v1 JSON locks)
- PYSCRIPT_COMPILER_SPEC.md — **FROZEN/STALE** (see D-S6)
- SAMPLE_PISTONS.md v1.0
- AI_PROMPT_SPEC.md v2.0 (stale — old device_map model; FROZEN until v1 JSON locks)
- REFERENCE_PISTON_V2.json — v2 diff anchor
- SPEAK_ACTION_SPEC.md / NOTIFY_ACTION_SPEC.md — ledgered; PROPOSED field names now
  answerable against reconciled PISTON_FORMAT task schema (optional light reconciliation later)
- COMPILER_DECISIONS_HOLDING.md **v1.0 (NEW, Session 73)** — holds the at-risk SPEAK/NOTIFY
  compiler decisions until D-S6 folds them into COMPILER_SPEC; retire then
- BACKEND_SPEC_PROTO.md **v0.1 (NEW, Session 73)** — PROTO research-gathering for the add-on/
  backend phase (parked, builds when STAGE B unblocks). Verified findings so far: Shortumation
  add-on config.yaml + Dockerfile + WebSocket HA client (`hass-websocket-client`, with
  `fetch_services()` covering NOTIFY's service-registry need); issue-#115 file-vs-WS lesson.
  Research queue: HomeAssistantEditor, TimeMachine, addon-vscode, re-verify Shortumation vs
  current HA add-on docs.

### Session 73 output files — review status
Review COMPLETE. See the "✅ SESSION 73 OUTPUT REVIEW — DONE" block above. Code files
(editor.js, wizard-core.js, wizard-action.js) traced and verified; spec files reconciled
to code and safe to treat as reference.

---

## Reminder for Jeremy
At the end of each session: move fully-completed gaps/bundles to TASKS_HISTORY.md, roll
partial-fix remainders forward into their group, and assign any new gaps that came up during
testing to the right group. Tell Claude to do the history offload — it won't happen automatically.
