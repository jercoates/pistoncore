# PistonCore — TASKS.md

**Status:** Living document — single active task file. Update at the end of every session.
**Last Updated:** Session 72 — GAP-S71-1 CLOSED (global resolution in action wizard). Root cause
was that `_getFlatEntityIds` and `_getGroupedEntityIdsForTokens` read `_deviceData_globals` which
was never populated in the edit flow. Fix: exposed `Editor.getGlobalsCache()` on the Editor public
API (alongside `getPistonVariables()`); both resolvers now read from `_piston._globalsCache` which
is already loaded at editor-open time. Also fixed `_globalsCache` leaking into saved piston JSON —
editor.js now restores the cache after `_piston = result.piston` reassignment so it survives save
without being persisted. GAP-S72-1 (multi-task with-block) and W-S17 (must-work wizard features
spec) filed this session. G-4 design decision captured: scan-on-demand vs indexed used_by list —
both viable, decide at G-4 session time.

Prior context: Session 71 closed B-0 (backend v2). Session 70 closed W-S11 (first lossless
round-trip). Session 69 full spec reconciliation.

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
S3-1 is not done until every item below verifies with the first piston in SAMPLE_PISTONS.md:
1. Wizard builds the piston from scratch, no manual JSON edits.
2. Save round-trips cleanly: close, reopen, every node renders identically. No "Unknown
   statement" placeholders, no missing nodes.
3. Edit one node (e.g. change a device). Save. Round-trip again. Identical except the change.
4. Compile target detected correctly as `native_script`.
5. Test Compile output matches hand-verified YAML in COMPILER_SPEC.md, normalized whitespace.
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

## W-S15 — Action Wizard Fixes  ← RECOMMENDED NEXT SESSION

**Files:** wizard-action.js, wizard-core.js, wizard-variable.js, editor.js,
WIZARD_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

- ** i added a SPEAK_ACTION_SPEC.md with a spec for the tts in the editor and the compiler
this is a do first task as it impacts how the rest get resolved.  from you, do GAP-S72-1 first
; the multi-task with-block fix is the foundation the Speak spec depends on.

- **GAP-S71-1 ✅ CLOSED (Session 72):** Global resolution in action wizard fixed.
  `_getFlatEntityIds` and `_getGroupedEntityIdsForTokens` now read from
  `Editor.getGlobalsCache()` (loaded at editor-open time) instead of `_deviceData_globals`
  (which was never populated in the edit flow). `Editor.getGlobalsCache()` exposed on the
  Editor public API alongside `getPistonVariables()`. Also fixed `_globalsCache` leaking
  into saved piston JSON — editor.js restores the cache after backend response reassignment.
  Files changed: editor.js, wizard-core.js, wizard-action.js.

- **GAP-S72-1 (multi-task with-block — HIGH):** `_saveDeviceCmd` always writes
  `tasks: [newTask]` — replaces the entire tasks array instead of appending. A with-block
  that already has tasks (e.g. Volume set + Play media) loses all previous tasks when a new
  one is added via "Add a new task". The with-block is designed to hold multiple sequential
  tasks; this is a fundamental editor/wizard contract failure. Needs design before code —
  see W-S17 note below. Filed Session 72.

- **GAP-S71-2 (variable edit dialog — wrong type, MED):** editing a device variable
  (e.g. Door_locks, var_type `devices`) opens with the type dropdown set to "Dynamic" instead
  of "Device". Renders fine in the define block; the edit round-trip mis-maps `var_type` on
  hydrate. File: wizard-variable.js. Found Session 71.

- **GAP-S45-1 (cosmetic):** set_variable wizard doesn't normalize `$` prefix.

---

## W-S17 — Must-Work Wizard Features Spec  ← DO BEFORE CODING W-S17 ITEMS

These are not nice-to-haves. They are core to real pistons and must be fully specced before
any code is written. Walking the alarm piston surfaced all of these as hard blockers.

**This is a SPEC SESSION — no code. Read WIZARD_SPEC.md, STATEMENT_TYPES.md, DESIGN.md,
PISTON_FORMAT.md, and the WebCoRE source before writing anything.**

### Multi-task with-blocks (GAP-S72-1)
The with-block holds multiple sequential tasks on ONE device/group — this is the core
WebCoRE action model. The wizard currently replaces tasks instead of stacking them.
Must spec and implement:
- How "Add a new task" appends to existing tasks array (not replaces)
- How each task in the list renders in the editor (task lines under the with-block)
- How editing an existing task re-opens the command picker pre-filled for THAT task only
- How deleting one task from a multi-task with-block works without losing the others
- JSON schema for tasks array (already exists — just the wizard flow is wrong)

### Wait (GAP-S72-2)
`wait` duration nodes must be buildable in the wizard. The test piston has waits.
Currently the wait wizard only exists as a location command (indirect path). Must work
as a first-class statement type from the statement picker.
- Wait for N seconds/minutes/hours (literal duration)
- Wait for N seconds using a variable (e.g. `$Integer_Lock_Confirm_Wait`)
- JSON output: `{ type: "wait", duration: {type:"variable", name:"$varname"}, duration_unit: "seconds" }`

### Volume set with variable (GAP-S72-3)
`volume_level` in HA is 0.0–1.0. WebCoRE used 0–100. The wizard must:
- Accept a variable as the volume value (not just a literal number)
- Convert or document the 0–100 vs 0.0–1.0 difference so the compiler handles it
- This is part of the TTS/speaker flow — set volume before playing media

### TTS / Play media with composed message (GAP-S71-4 — carried forward)
No path exists to build a TTS or play_media action that:
- Targets a media_player global (now unblocked by GAP-S71-1)
- Composes the spoken text from literals + variables
  (e.g. `"System Disarmed — Unlocked by " + $Unlocked_By`)
Must spec: which HA service(s) to use (tts.speak / media_player.play_media), how the
message field accepts variable interpolation, how that compiles to a Jinja2 template.

### Set variable with expression (GAP-S72-4)
Set variable nodes using string concatenation expressions
(e.g. `$DoorsOpen = $DoorsOpen + " " + $contact`) must be buildable in the wizard.
The JSON schema supports it (`type: "expression"`) but there is no wizard path to build one.

**Files for spec session:** WIZARD_SPEC.md, STATEMENT_TYPES.md, DESIGN.md,
PISTON_FORMAT.md, wizard-action.js, wizard-statement.js, wizard-loops.js,
CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## W-S12 — v1 Retirement + Load Safety

Clean-slate the storage so testing isn't polluted by half-migrated files.

**Files:** editor.js, wizard-core.js, PISTON_FORMAT.md, DESIGN.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

- **GAP-S69-1:** logic_version 1 is retired — reject any piston without `logic_version: 2`
  with a clear message. Remove lazy per-node migration. Delete all existing v1 pistons from
  sandbox userdata; start fresh.
- **GAP-S69-2 (BLOCKER, may self-resolve):** editing certain nodes errors out / fails to
  update. Hypothesis: edit-route tries to hydrate `sel.tokens` from `role_tokens`/`entity_ids`,
  finds neither on old v1 nodes, throws. Once v1 pistons are gone (GAP-S69-1) this may stop —
  but verify the edit path is robust when a node is missing expected fields.
  **Needs at session time:** the actual console/network error when editing a node that fails.
- **GAP-S69-3:** `_normalizePiston` (editor.js ~96-114) silently `splice`s malformed nodes —
  permanent silent data loss, violates the render invariant. Fix: leave the node, flag it,
  show `⚠ Unknown statement [id] — edit to repair`.

---

## W-S13 — Editor / Wizard Cleanup

Small, low-risk items grouped so they don't each burn a session.

**Files:** editor.js, wizard-core.js, WIZARD_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

- **GAP-S58-2:** Copy/paste/duplicate statements (also MISSING_SPECS Item 26). The anchor item.
- **GAP-S69-4 (rides on GAP-S58-2):** `_deepReId` (editor.js ~1003) misses `until_conditions`
  (repeat blocks) and `else_ifs[].conditions`. Copy/paste leaves those IDs stale.
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
- **GAP-S71-3 (import role-mapping dialog never fires):** importing a v2 Snapshot did not
  trigger the role-mapping dialog (DESIGN 6.11 Steps 2–4). Piston imported with empty
  entity_ids, forcing manual per-node mapping. Found Session 71.

---

## W-S16 — Visual / Display-Only Gaps (parked, non-blocking)

- **GAP-S70-2:** `_condLine` does not render `display_value` for some operators — editor shows
  `{Illuminance} is less than or equal to` with no `800`. Value IS saved correctly in JSON.
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

**Reference:** PISTON_FORMAT.md v2.3, STATEMENT_TYPES.md v2.2, SAMPLE_PISTONS.md.
**Note:** COMPILER_SPEC.md is intentionally STALE (see D-S6). Treat its content as directional
only; PISTON_FORMAT.md + STATEMENT_TYPES.md + REFERENCE_PISTON_V2.json are authoritative.
**Files:** compiler.py, context_builder.py, COMPILER_SPEC.md, PISTON_FORMAT.md,
STATEMENT_TYPES.md, REFERENCE_PISTON_V2.json, SAMPLE_PISTONS.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

### B-2: Full Backend v1-Residue Audit  (do with or before B-1)
Grep every backend `.py` (context_builder.py, ha_client.py, main.py, compiler.py, utils.py) for:
`device_map`, `list_role`, `logic_version` defaults of 1, and any other v1-model assumptions.
storage.py already confirmed clean (Session 71).
**Files:** all backend *.py, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## STAGE D — Spec (remaining)

### D-S5c: Leftover Audit Findings (spec cleanup — not yet applied)
- **Finding 7:** DESIGN.md bare "do not re-open" markers — replace with "re-open only if [condition]".
- **Finding 12:** `compile_target` is a cache, not a user preference — document in PISTON_FORMAT.md.
- **Finding 15:** Test button always fires real actions — deferred v2 dry-run feature, recorded.
- **Pattern B:** DESIGN.md superseded-section cascade — add preamble, reduce 6.2/6.3 to pointers.
**Files:** DESIGN.md, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

### D-S6: Compiler Spec Rewrite (after JSON structure is final)
COMPILER_SPEC.md and PYSCRIPT_COMPILER_SPEC.md intentionally FROZEN/STALE. Rewrite after
W-S11 + B-1 prove the round-trip and JSON format stops moving.
**Files:** COMPILER_SPEC.md, PYSCRIPT_COMPILER_SPEC.md, HA_LIMITATIONS.md, PISTON_FORMAT.md,
STATEMENT_TYPES.md, REFERENCE_PISTON_V2.json, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## STAGE 2 — Connect the Seams (after round-trip works)

- **S2-2:** GAP-S38-1 (/api/logs route missing), GAP-S39-1 (ha_client import pattern wrong)
- **S2-3:** GAP-S43-4 (Snapshot export), GAP-S58-3 (piston backup/restore)

---

## STAGE 3 — Round-Trip Verification

### S3-1: Smoke Test — Full Round-Trip on One Simple Piston
Prerequisites: W-S11, W-S12, W-S14, W-S15, W-S17, B-1, G-4 complete.
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
- **GAP-S70-1:** `_reResolveVariableUses` verification under a real variable edit.
- **GAP-S50-1:** carry-forward from W-S11.

---

## Session 72 Notes

- **Test vehicle:** `claude_alarm_checks_faithful.json` — faithful structural alarm piston copy.
  Devices are role placeholders (`entity_ids: []`). Use this to walk the wizard.
- **Old globals (entity_ids in value field):** test/lights/lumin_sensor/lock/Notifications_Push
  still store entity_ids instead of friendly names — pre-fix data. Edit them manually via the
  globals panel to correct. Speakers global is correct (`value: ['Basement']`).
- **`_globalsCache` in saved JSON:** fixed Session 72 (editor.js restores cache after save
  response, preventing it from accumulating on `_piston` and leaking to disk).
- **volume_set 0–100 vs HA 0.0–1.0:** conversion concern logged in W-S17 (GAP-S72-3).

## Spec File Versions (after Session 69)
- DESIGN.md **v1.8**
- PISTON_FORMAT.md **v2.3**
- WIZARD_SPEC.md **v2.6**
- STATEMENT_TYPES.md **v2.2**
- FRONTEND_SPEC.md **v1.5**
- HA_LIMITATIONS.md — Section 3 corrected
- COMPILER_SPEC.md **v1.5 — FROZEN/STALE** (see D-S6)
- PYSCRIPT_COMPILER_SPEC.md — **FROZEN/STALE** (see D-S6)
- SAMPLE_PISTONS.md v1.0
- AI_PROMPT_SPEC.md v2.0 (stale — old device_map model)
- REFERENCE_PISTON_V2.json — v2 diff anchor

---

## Reminder for Jeremy
At the end of each session: move fully-completed gaps/bundles to TASKS_HISTORY.md, roll
partial-fix remainders forward into their group, and assign any new gaps that came up during
testing to the right group. Tell Claude to do the history offload — it won't happen automatically.
