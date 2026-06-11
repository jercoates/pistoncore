# PistonCore — TASKS.md

**Status:** Living document — single active task file. Update at the end of every session.
**Last Updated:** Session 74 — (1) GAP-S73-4 CLOSED: load-error trapping banner fully fixed
across status.js and editor.js (graceful shell render + notice bar); PistonCore logo wired
as persistent home button on all pages routing through unsaved-changes guard (index.html,
app.js); nav restore now always boots to list eliminating startup trap; dead `_saveNavState`
/ `pistoncore_nav` localStorage removed (app.js). (2) GAP-S73-2 CLOSED: "No devices could
be resolved" was the v2-only backend gate blocking piston load before the wizard ever opened
— NOT a picker/resolution bug. Removing the gate (api.py) unblocked the picker immediately;
entity_ids domain filter also found missing in `_saveDeviceCmd` (was deliberately removed in
a prior session with a wrong comment) — restored and locked as a hard guardrail in
CLAUDE_SESSION_PROMPT.md. (3) GAP-S72-1 VERIFIED: multi-task with-block round-trips cleanly
— four tasks stacked, order preserved, entity_ids correct, JSON confirmed. (4) GAP-S74-1
NEW: command picker shows raw HA service names instead of WebCoRE vocabulary; three-group
picker structure (framework §5.2) not built. Assigned to W-S17.

Prior context: Session 73 coded GAP-S72-1 (multi-task with-block). Session 72 closed
GAP-S71-1 (global resolution). Session 71 closed B-0 (backend v2). Session 70 closed
W-S11 (first lossless round-trip). Session 69 full spec reconciliation.

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

## W-S15 — Action Wizard Fixes

**Files:** wizard-action.js, wizard-core.js, wizard-variable.js, editor.js,
WIZARD_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

- ** SPEAK_ACTION_SPEC.md holds the TTS spec for editor + compiler. GAP-S72-1 (the
multi-task with-block foundation) is done in code; Speak rides on it.

- **GAP-S71-1 ✅ CLOSED (Session 72):** Global resolution in action wizard fixed.
  `_getFlatEntityIds` and `_getGroupedEntityIdsForTokens` now read from
  `Editor.getGlobalsCache()` (loaded at editor-open time) instead of `_deviceData_globals`
  (which was never populated in the edit flow). `Editor.getGlobalsCache()` exposed on the
  Editor public API alongside `getPistonVariables()`. Also fixed `_globalsCache` leaking
  into saved piston JSON — editor.js restores the cache after backend response reassignment.
  Files changed: editor.js, wizard-core.js, wizard-action.js.

- **GAP-S72-1 ✅ CLOSED (Session 73 coded, Session 74 verified):** Multi-task with-block
  round-trips cleanly. Four tasks stacked on `@Speakers`, order preserved in JSON,
  entity_ids correct (`media_player.room2` only after domain filter fix). Edit-by-task-id,
  append, and Add-more all confirmed working against a live HA with real entities.
  **Remainder still open (rolled into W-S17):**
  - **GAP-S72-1b (UX):** “+ add a new task” on an EXISTING block forces a device re-pick.
    Code is safe (CASE 1 appends correctly) but user shouldn't re-select devices the block
    already has. Fix = pre-fill the device picker from the block on `'task'`-context entry.
    Picker is now healthy so this is unblocked. Assigned to W-S17.
  - **Per-task DELETE path** not yet built (framework spec §3.3). Assigned to W-S17.

- **GAP-S73-2 ✅ CLOSED (Session 74):** “No devices could be resolved” was NOT a
  picker/resolution bug. Root cause: the v2-only backend gate in `get_piston` (api.py)
  rejected the piston before the wizard ever opened — no device data reached the picker.
  Fixed by removing the lower-version rejection (future-version guard kept). The picker
  worked immediately once pistons could load. Separately: the entity_ids domain filter in
  `_saveDeviceCmd` was found missing (deliberately removed in a prior session with a wrong
  justification) — restored and locked as a hard guardrail in CLAUDE_SESSION_PROMPT.md.
  Files changed: api.py, wizard-action.js, CLAUDE_SESSION_PROMPT.md.


- **GAP-S73-1 (global editor can't remove a missing device — HIGH structural, NEW):**
  A global device that goes missing in HA cannot be deselected and "remove all" fails — the
  only escape is deleting and recreating the whole global. Underlying cause (per Jeremy):
  removal operates on a LIVE-resolved match instead of the stored reference, so an
  unresolvable entry becomes un-removable. Full write-up:
  GAP_global_editor_missing_device_removal.md. Verify against the global-editor code before
  fixing. Files: globals editor path (globals.js / wizard-variable.js / editor.js).

- **GAP-S71-2 (variable edit dialog — wrong type, MED):** editing a device variable
  (e.g. Door_locks, var_type `devices`) opens with the type dropdown set to "Dynamic" instead
  of "Device". Renders fine in the define block; the edit round-trip mis-maps `var_type` on
  hydrate. File: wizard-variable.js. Found Session 71.

- **GAP-S45-1 (cosmetic):** set_variable wizard doesn't normalize `$` prefix.

- **GAP-S73-4 ✅ CLOSED (Session 74):** A piston that failed the v2 check trapped the
  entire UI. Root causes: (a) `_restoreNavState` saved the last page to localStorage and
  re-navigated into the editor on boot — if that piston 409'd, the user booted straight
  into a dead page with no way back; (b) the editor and status page load-error catch blocks
  painted a full-page banner with nothing behind it. Fixed: nav restore now always boots
  to list (`_saveNavState` and `pistoncore_nav` localStorage removed as dead code); status
  page load-error renders a functional shell with the error in the validation-banner slot
  and Delete available; editor load-error renders a blank editor shell with the error in
  the non-blocking notice bar; PistonCore logo wired as a persistent home button on all
  pages (including dead-editor state), routing through the unsaved-changes guard so a
  dirty-editor click prompts Save/Discard/Cancel. Files: app.js, editor.js, status.js,
  index.html.

---

## ✅ SESSION 73 OUTPUT REVIEW — DONE (consolidation review)

The Session 73 outputs were reviewed against the conversation context and the CODE (source
of truth). Findings:
- **Code (editor.js / wizard-core.js / wizard-action.js):** GAP-S72-1 fix traced end-to-end
  and verified consistent across all three files (task-owner threading → edit-by-task-id →
  and verified (Session 74 — four tasks stacked, round-trip clean, domain filter confirmed).
  No code changes needed to the Session 73 files.
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

### Multi-task with-blocks (GAP-S72-1) ✅ SPEC DONE + CODED + VERIFIED (Session 74)
Specced in WITH_BLOCK_TASK_FRAMEWORK.md; coded and verified this session. Per-task DELETE
path (framework spec §3.3) and picker pre-fill (GAP-S72-1b) remain open — see below.

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


### Command picker vocabulary / three-group structure (GAP-S74-1 — NEW Session 74)
The task command picker shows raw HA service names instead of the WebCoRE vocabulary
migration users expect. The three-group picker structure from framework §5.2
(“Commands available to all devices” / “Commands available to only some devices” /
“Location commands”) is not built. `Speak text` is not in the picker at all — it is
not a raw HA service but a PistonCore-defined task type that compiles to `tts.speak`
(see SPEAK_ACTION_SPEC.md). The operand widget (Value/Variable/Expression dropdown)
backing Speak text, Set Volume, Wait, and any parameterized command does not exist.
This is the foundation all of W-S17 sits on. Build it once; all commands use it.
Prerequisite to: GAP-S71-4, GAP-S72-2, GAP-S72-3, GAP-S72-1b, GAP-S73-3.
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
  globals panel to correct. NOTE (Session 73): `@Speakers` was switched off the broken Sonos
  to a ReSpeaker; resolution still failed (GAP-S73-2). An HA update broke the Sonos
  `media_player` entity feed. The pre-fix-globals cleanup and GAP-S73-1 (can't remove a
  missing device) compound each other.
- **`_globalsCache` in saved JSON:** fixed Session 72 (editor.js restores cache after save
  response, preventing it from accumulating on `_piston` and leaking to disk).
- **volume_set 0–100 vs HA 0.0–1.0:** conversion concern logged in W-S17 (GAP-S72-3).

## Spec File Versions (after Session 74)
- DESIGN.md **v1.8**
- PISTON_FORMAT.md **v2.4** (Session 73 — task model: device/non-device tasks, picker
  category as discriminator (storage is a coding-time choice), order)
- WIZARD_SPEC.md **v2.7** (Session 73 — W-6 task append/edit/delete + virtual-in-block flows)
- STATEMENT_TYPES.md **v2.3** (Session 73 — task schema device/virtual, wait/set_var duality)
- WITH_BLOCK_TASK_FRAMEWORK.md **v1.0 (NEW, Session 73)** — authoritative task-container spec
- FRONTEND_SPEC.md **v1.5**
- HA_LIMITATIONS.md — Section 3 corrected; command classification still PENDING (separate
  research deliverable vs current HA; `target-boundary.json` existence UNVERIFIED)
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

### Session 73 + 74 output files — review status
Session 73 reviewed and verified (see above). Session 74 files: api.py (v2 gate
removed), app.js (_saveNavState removed, logo home button), editor.js (load-error
graceful shell), status.js (load-error graceful shell), index.html (logo id),
wizard-action.js (domain filter restored), CLAUDE_SESSION_PROMPT.md (domain filter
hard guardrail added). All syntax-checked. Safe to treat as reference.

## Reminder for Jeremy
At the end of each session: move fully-completed gaps/bundles to TASKS_HISTORY.md, roll
partial-fix remainders forward into their group, and assign any new gaps that came up during
testing to the right group. Tell Claude to do the history offload — it won't happen automatically.
