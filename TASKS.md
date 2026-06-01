# PistonCore — TASKS.md

**Status:** Living document — single active task file. Update at the end of every session.
**Last Updated:** Session 70 — ⭐ MILESTONE: first lossless, compiler-ready round-trip.
W-S11 closed (GAP-S69-9/-10/-11). The real root cause was NOT only `_getFlatEntityIds` —
the dominant bugs were three commit-path defects: (1) editor.js dropped `block-id` because
the DOM camelCases `data-block-id`→`dataset.blockId` while every consumer read `block-id`,
so a second AND/OR condition orphaned into `statements[]` typeless and got stripped on load;
(2) the AND/OR operator was never read at commit; (3) the Add button never required an
attribute, so a device condition could commit with empty attribute → fell back to all
sub-entity IDs. All three fixed. The "by hand kitchen" piston now builds → saves → reopens
identically with correct single attribute-bearing entity_ids, populated attribute/
display_value, and both conditions nested in one `if` with `condition_operator: "and"`.
First time the compiler could actually be run on real wizard output. Prior context:
Session 69 did full spec reconciliation (D-S5 + D-S5b); device-data model locked;
logic_version 1 / device_map retired. CODE_FINDINGS.md and SESSION_69B_GAPS.md retired
into this file.
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

## W-S11 — Device-Data Core Fix  ✅ CLOSED (Session 70)

The blocker is cleared. The first lossless, compiler-ready round-trip is proven on the
"by hand kitchen" piston. What actually fixed it (the diagnosis evolved from the original
single-function theory):

- **editor.js — dataset key casing (the dominant bug).** `_handleDocClick` copied
  `ghost.dataset` keys verbatim into `extra`. The DOM camelCases `data-block-id` →
  `dataset.blockId`, but every wizard consumer reads `extra['block-id']`. Mismatch → `block-id`
  was lost → a second condition added with AND/OR fell out of the `if_condition` path,
  orphaned into top-level `statements[]` as a typeless `cond_*` node, and got stripped by
  `_normalizePiston` on the next load. **Fix:** normalize camelCase dataset keys back to
  hyphen form at the single chokepoint. Also: `insertStatement`'s `if_condition` branch now
  applies `meta.conditionOperator` to the target block.
- **wizard-condition.js — operator never read.** `_commitCondition` / `_commitConditionAndMore`
  did not read `wiz-group-op-selector`, so the chosen AND/OR was discarded. **Fix:** both
  commit paths read the selector and thread it through `meta` (append) or seed it on the new
  wrapping `if` node; Add-more carries it into the next `sel`.
- **wizard-condition.js — attribute not required at commit.** The Add/Add-more guard checked
  device+operator only. A device condition could commit with no attribute → `_capEntityMap`
  had no key to resolve → fell back to `_getFlatEntityIds` and wrote ALL sub-entity IDs
  (battery, illuminance, motion, temperature) plus empty `attribute`/`display_value`. This was
  the live form of GAP-S69-9. **Fix:** `hasAttr` gates initial render, `attrChosen` gates the
  live guard, the attr `change` handler re-runs the guard, and `_loadCapsIntoSelect` re-runs it
  after caps load. Non-device subjects exempt. Result: cannot commit without picking the
  attribute; `_capEntityMap` then resolves the single attribute-bearing entity per device.
- **GAP-S69-11 (for_each entity_ids):** addressed earlier in the session — for_each commit now
  writes `entity_ids` via `_getFlatEntityIds(tokens)` (no attribute filter, correct for a loop).
- **GAP-S69-10 (variable re-resolve):** variable commit confirmed correct (stores friendly
  names only). `_reResolveVariableUses` still to be exercised against the attribute-aware path
  under a real edit — see carry-forward below.

**Confirmed in saved JSON (`bdc4cca2.json`, 2026-06-01):** illuminance condition →
`entity_ids: ["sensor.outdoor_motion_illuminance"]` only, `attribute: "illuminance"`,
`display_value: "800"`; both conditions in one `if`, `condition_operator: "and"`; turn-off
block with `duration: 5 / minutes` round-tripped. Files delivered: editor.js, wizard-condition.js.

### Carried forward from W-S11 (do not lose):
- **GAP-S70-1 (verify, low):** exercise `_reResolveVariableUses` — edit a device variable that
  feeds an attribute-bearing condition, confirm node `entity_ids` re-resolve via the variable's
  name list + the node's attribute (and that IDs are never written back onto the variable).
  Belongs with STAGE G / globals-edit work.
- **GAP-S50-1 (verify):** with nodes now carrying attribute-bearing entity_ids, confirm the
  compiler reads them directly and needs no initial_value disambiguation. Verify during B-1.

---

## ⚠ NEXT BLOCKER — STAGE B (compiler) is now UNBLOCKED

W-S11 was the gate. B-1 (compiler.py — direct entity_id read + MISSING_ENTITY validation) can
now be written and tested against real, correct wizard output. See STAGE B below. This is the
recommended next coding session.

---

## W-S12 — v1 Retirement + Load Safety

Clean-slate the storage so testing isn't polluted by half-migrated files. Doing this early
makes W-S11 testing cleaner (no v1 noise).

**Files:** editor.js, wizard-core.js, PISTON_FORMAT.md, DESIGN.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

- **GAP-S69-1:** logic_version 1 is retired — no v1→v2 migration. On load, reject any piston
  without `logic_version: 2` with a clear message. Remove lazy per-node migration (it produced
  mixed-format files — the 7b468be7.json artifact had two v1 device_map blocks + one v2 block).
  Delete all existing v1 pistons from sandbox userdata; start fresh.
- **GAP-S69-2 (BLOCKER, may self-resolve):** editing certain nodes errors out / fails to
  update (produced a duplicate cond in a new empty if-block). Hypothesis: edit-route tries to
  hydrate `sel.tokens` from `role_tokens`/`entity_ids`, finds neither on old v1 nodes, throws.
  Once v1 pistons are gone (GAP-S69-1) this may stop — but verify the edit path is robust when
  a node is missing expected fields (render a repair placeholder per the invariant, don't throw).
  **Needs at session time:** the actual console/network error when editing a node that fails.
- **GAP-S69-3:** `_normalizePiston` (editor.js ~96-114) silently `splice`s malformed nodes with
  only a console.warn — permanent silent data loss, violates the render invariant. Fix: don't
  splice; leave the node in place, flag it (`_render_as_unknown` or check `!n.type` at render),
  show `⚠ Unknown statement [id] — edit to repair`. The future-version `throw` stays (intentional refusal).

---

## W-S13 — Editor / Wizard Cleanup

Small, low-risk items grouped so they don't each burn a session.

**Files:** editor.js, wizard-core.js, WIZARD_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

- **GAP-S58-2:** Copy/paste/duplicate statements (also MISSING_SPECS Item 26). The anchor item.
- **GAP-S69-4 (rides on GAP-S58-2):** `_deepReId` (editor.js ~1003) misses `until_conditions`
  (repeat blocks) and `else_ifs[].conditions`. Copy/paste leaves those IDs stale. Add re-id for both.
- **GAP-S69-6:** Remove dead `Editor.getDeviceMap()` export (editor.js ~1385). grep for callers
  first; if any exist they're using retired v1 thinking and need review.
- **GAP-S69-7:** `_sel = JSON.parse(JSON.stringify(editNode))` (wizard-core.js ~515) lets legacy
  fields (`list_role`, `devices`, old `device_map` refs) persist through an edit round-trip.
  Fix: build the commit output node from scratch using only spec-defined fields for the node type.
- **GAP-S69-8 (low):** `_groupDevices` (wizard-core.js ~211-214) uses "shortest friendly_name
  wins" for the group label — non-deterministic for equal-length names. Document it in WIZARD_SPEC,
  or improve to prefer the friendly_name matching `primary_entity_id`. Or never — not a real bug.

---

## W-S14 — Import Fixes

All import-path work grouped together.

**Files:** editor.js, list.js, api.py, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

- **GAP-S46-5:** Import modal is paste-only — add a file picker.
- **GAP-S68-1:** Import mapper shows raw entity_ids instead of friendly names.
- **GAP-S68-2:** Import role mapping does not populate defines `initial_value`.
- **GAP-S46-4 (G-3):** Imported globals land in piston variables instead of the globals store.
  (Was STAGE G item G-3; folded here since it's import work. Upload api.py for this one.)

---

## W-S15 — Action Param Bug + Loose Wizard Items

**Files:** wizard-action.js, wizard-core.js, WIZARD_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

- **GAP-S68-3 ✅ DONE (Session 70):** Action params no longer save as indexed keys. Two fixes
  in wizard-action.js: `_renderCmdParams` treats `svc.fields` as the array the backend sends
  ({name,label,type,...}) instead of `Object.entries()` (which produced "0","1","2" keys);
  `_saveDeviceCmd` scopes `querySelectorAll('[data-param]')` to `wiz-cmd-params` only. Also in
  the same area: ha_client.py `_fetch_services` now filters fields by the specific entity's
  capabilities (supported_color_modes / effect_list / supported_features) and caches per
  entity_id, and `_goCommandPicker` intersects service fields across multi-device selections.
  Confirmed: turn_on action saved `parameters: {transition, advanced_fields}` cleanly.
- **GAP-S45-1 (cosmetic):** set_variable wizard doesn't normalize `$` prefix.
- **GAP-S69-5 superseded** — merged into GAP-S69-11 (W-S11).

---

## W-S16 — Visual / Display-Only Gaps (parked, non-blocking)

Cosmetic and display issues deliberately deferred during the round-trip push. None block the
compiler. Group and clear in a dedicated UI-polish session.

- **GAP-S70-2:** `_condLine` (editor.js) does not render `display_value` for some operators —
  e.g. the editor shows `{Illuminance} is less than or equal to` with no `800` (the value IS
  saved correctly in JSON; this is render-only). Append display_value/value_to + unit to the
  condition line.
- **(add visual items here as found)** — action-edit routing should open the device picker
  first, device picker should show checkmarks + persist the selected device label, "Only during
  these modes" restriction block (WebCoRE parity) not yet present. Triage and split out per
  earlier screenshots when this session runs.

---

## STAGE G — Globals (remaining)

- **G-4 / GAP-S57-5:** Global device edit → redeploy prompt. Wire globals through editor+wizard
  fully. (Most globals wiring done in W-S8/W-S9; this is the redeploy-on-edit prompt.)
  **Files:** wizard-core.js, wizard-condition.js, wizard-action.js, editor.js, globals.js,
  DESIGN.md, WIZARD_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## STAGE B — Backend Compiler  (BLOCKED until W-S11 done)

### B-1: compiler.py — Entity IDs Direct Read + MISSING_ENTITY Validation
**Blocked:** do not start until W-S11 lands. A compiler written now would read entity_ids that
the wizard isn't yet writing correctly (whole-cluster instead of attribute-bearing). Also blocked
on the trigger-storage model — now resolved: triggers/conditions/restrictions are TOP-LEVEL
wrapper arrays (Path A, documented in PISTON_FORMAT.md). The compiler reads `_piston.triggers`
directly; it does NOT walk `statements` for `is_trigger` nodes.

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

---

## STAGE D — Spec (remaining)

### D-S5c: Leftover Audit Findings (spec cleanup — not yet applied)
These SPEC_AUDIT.md findings were identified but NOT applied in Session 69 (some because the
compiler specs were frozen, some just not reached). Logged here so they aren't lost when the
audit files move to /reference. None block the round-trip; do when convenient.

- **Finding 7 — re-open criteria on DESIGN.md locked decisions.** DESIGN.md still has bare
  "do not re-open" / "do not relitigate" markers (3.1 line ~168, 7.1 ~529, 8 ~917, 27 ~1896).
  CLAUDE_SESSION_PROMPT got confidence levels, but DESIGN's markers were never softened.
  Replace each with "re-open only if [condition]" (AppDaemon, hybrid output, multi-entity,
  device globals compile-time — each keeps its lock but gains a reopen criterion).
- **Finding 12 — `compile_target` is a cache, not a user preference.** PISTON_FORMAT.md does
  not yet say this explicitly. Document that the stored value caches the last compiler decision;
  Snapshot export should set it by rescanning imported statements, not copying the source.
  Optional `compile_target_lock` deferred until a real user case appears.
- **Finding 15 — Test button always fires real actions (no dry-run).** Deferred v2 feature:
  a global "Test Mode" that logs instead of firing. Recorded so it's not forgotten. (The
  mandatory "Live Fire ⚠" confirmation already exists per HA_LIMITATIONS.md.)
- **Pattern B — DESIGN.md superseded-section cascade.** DESIGN.md is 2160 lines; sections 6.2
  and 6.3 are superseded by 6.10/6.11 but still exist as stubs a top-to-bottom reader absorbs
  as authoritative first. Add a "What's authoritative in this document" preamble at the top,
  and reduce 6.2/6.3 to one-line "see 6.10/6.11" pointers.

**Files:** DESIGN.md, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

### D-S6: Compiler Spec Rewrite (after JSON structure is final)
COMPILER_SPEC.md and PYSCRIPT_COMPILER_SPEC.md are intentionally frozen/stale during JSON
stabilization (stale notice added at top of both — see COMPILER_SPEC_STALE_NOTICE.md). Once
W-S11 + B-1 prove the round-trip and the JSON format stops moving, rewrite both compiler specs
against the final structure in one pass. Until then, do not update them piecemeal.

Include these deferred audit findings in the rewrite (they needed compiler-spec edits that
were blocked by the freeze):
- **Finding 8 — variable scope warning contradiction.** Three files give three impressions.
  Correct state: scoping fixed in HA 2025.3, but `loop_string_accumulation` still forces
  PyScript. Update COMPILER_SPEC.md `VARIABLE_SCOPE_WARNING` to fire only when targeting
  HA <2025.3; cross-reference PYSCRIPT_COMPILER_SPEC.md 1.1. Also make the real decision on
  raising minimum HA to 2025.3 (HA_LIMITATIONS.md has carried "consider raising" for sessions).
- **Finding 18 — add a "Compiler Reality Discrepancies" section** to COMPILER_SPEC.md: a single
  place to log "HA actually does X not Y, compiler must Z" as real testing reveals divergences.
  Pre-fill with the `trigger:` vs `platform:` distinction as the first entry.

**Files:** COMPILER_SPEC.md, PYSCRIPT_COMPILER_SPEC.md, HA_LIMITATIONS.md, PISTON_FORMAT.md,
STATEMENT_TYPES.md, REFERENCE_PISTON_V2.json, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## STAGE 2 — Connect the Seams (after round-trip works)

- **S2-2 — api.py + error_logger.py gaps:**
  - GAP-S38-1: /api/logs route missing from api.py
  - GAP-S39-1: ha_client import pattern wrong in api.py and compiler.py
- **S2-3 — Snapshot Export + Backup Export:**
  - GAP-S43-4: Snapshot export not yet implemented
  - GAP-S58-3 / MISSING_SPECS Item 27: Piston backup trigger/download/restore

---

## STAGE 3 — Round-Trip Verification

### S3-1: Smoke Test — Full Round-Trip on One Simple Piston
Prerequisites: W-S11, W-S12, W-S14, B-1, G-4 (globals redeploy) complete.
Success = all seven checklist items at top of file.

### S3-2: Deferred Validation Testing (after S3-1)
- GAP-S33-2: condition_and/or template indentation — real-world testing
- Sunrise/sunset negative offset edge cases (HA_LIMITATIONS.md Section 9)
- Numeric trigger unknown-state behavior (HA_LIMITATIONS.md Section 9)
- Single-device missing-entity behavior (HA_LIMITATIONS.md Section 9 — validate before
  implementing the hard flag)

---

## STAGE 4 — Features (only after Stage 3)

- **S4-16 — Operational hardening:** GAP-S30-3 (double config load), GAP-S34-1
  (_compile_single_condition no warnings param), GAP-S47-1 (structure line position, cosmetic)
- **S4-17 — HA connection reliability:** MISSING_SPECS Item 25 (entity state subscription vs polling)
- **Post-S3 polish (from Grok audit, FRONTEND_SPEC.md):** audit all raw HTML insertions for
  `_esc()` consistency; consider self-hosting Google Fonts for offline HA; CSP in index.html;
  ARIA pass; golden-sample-piston compile-check script.

---

## DEFERRED

- **GAP-S63-1:** Domain priority investigation — not blocking anything.
- **D-1 through D-9:** See TASKS_HISTORY.md (unchanged).
- **MISSING_SPECS Item 11 (partial):** post-S3-2, production sample pistons.
- **MISSING_SPECS Item 12:** post-S3-1, write BEST_PRACTICES.md.
- **MISSING_SPECS Item 15:** before S4-10, write-a-piston.md prompt content.
- **AI_PROMPT_SPEC.md** still written against old device_map model (GAP-S57-3) — rewrite before
  any AI-import work. Not blocking v1 round-trip.

---

## Spec File Versions (after Session 69)
- DESIGN.md **v1.8**
- PISTON_FORMAT.md **v2.3** (load-bearing rule, top-level arrays, var_type/initial_value, v1 retired)
- WIZARD_SPEC.md **v2.6** (device variable model corrected)
- STATEMENT_TYPES.md **v2.2**
- FRONTEND_SPEC.md **v1.5**
- HA_LIMITATIONS.md — Section 3 corrected (device_map references removed)
- COMPILER_SPEC.md **v1.5 — FROZEN/STALE** (see D-S6; stale notice at top)
- PYSCRIPT_COMPILER_SPEC.md — **FROZEN/STALE** (see D-S6; stale notice at top)
- SAMPLE_PISTONS.md v1.0
- AI_PROMPT_SPEC.md v2.0 (stale — old device_map model)
- REFERENCE_PISTON_V2.json — new, the v2 diff anchor

---

## Reminder for Jeremy
At the end of each session: move fully-completed gaps/bundles to TASKS_HISTORY.md, roll
partial-fix remainders forward into their group, and assign any new gaps that came up during
testing to the right group. Tell Claude to do the history offload — it won't happen automatically.
