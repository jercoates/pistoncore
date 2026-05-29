# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 68 — WIZARD_SPEC.md v2.4: sel.tokens model corrected (physical rows
store ALL entity_ids — confirmed correct, hard guardrail added, DO NOT CHANGE). GAP-S67-1/2/3/4
closed. GAP-S64-2 closed as won't fix. editor.js ln() fix: data-parent-block now reaches DOM,
condition edit replaces in place instead of inserting new if block. wizard-core.js: numeric
condition value pre-fill uses compiled_value to avoid unit suffix rejection. Three new gaps:
GAP-S68-1 (import mapper shows entity_ids), GAP-S68-2 (import doesn't populate defines),
GAP-S68-3 (action params save as indexed keys).
**Authority:** CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files
**Completed sessions:** See TASKS_HISTORY.md

---

## The Goal Before Everything Else

**Get to a clean round-trip on a simple piston:**
wizard writes JSON → backend saves it → compiler reads it → frontend renders it correctly

Blocking the round-trip: W-S10 remainder (picker gaps + import fixes), D-S5 + D-S5b
(spec hardening), B-1 backend compiler update, G-3 globals import.

### What "S3-1 passes" actually means — concrete checklist

S3-1 is not done until every item below is verifiable with the first piston in
SAMPLE_PISTONS.md:

1. Wizard builds the piston from scratch with no manual JSON edits.
2. Save round-trips cleanly: close editor, reopen, every node renders identically
   to what was committed. No "Unknown statement" placeholders. No missing nodes.
3. Edit one node (e.g., change an entity). Save. Round-trip again. Result is
   identical except the changed field.
4. Compile target detected correctly as `native_script`.
5. Test Compile output matches the hand-verified YAML in COMPILER_SPEC.md Section 18,
   byte-for-byte after normalizing whitespace.
6. Deploy succeeds with no HA reload errors.
7. Manual trigger fires the piston in HA. PISTONCORE_RUN_COMPLETE event is received
   by the backend and surfaced in the editor/status page.

Until all seven pass, S3-1 is not done. Partial passes are gaps, not victories.

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

Session 68 completed:
- GAP-S67-1 ✅: interaction row now only shows when isTrigger(op)
- GAP-S67-2 ✅: Next button syncs after re-render. NOTE: the primary_entity_id part of
  this gap was WRONG — physical rows correctly store ALL entity_ids in sel.tokens.
  See WIZARD_SPEC.md v2.4 guardrail. That text deleted from all specs.
- GAP-S67-3 ✅: command picker no longer auto-selects or auto-renders params on load
- GAP-S67-4 ✅: condition device button shows correct prefix tag (variable/global/device)
- GAP-S64-2 ✅: closed as won't fix — old-format pistons should be reimported
- editor.js ✅: ln() now writes all extra opts as data- attrs — fixes condition edit
  routing (insert-vs-replace bug) and value pre-fill
- wizard-core.js ✅: numeric condition value pre-fill uses compiled_value

Still open for W-S10:
- GAP-S46-5: Import modal has no file picker — paste-only
- GAP-S58-2: Copy/paste/duplicate statements
- GAP-S68-1: Import mapper shows raw entity_ids instead of friendly names
- GAP-S68-2: Import role mapping does not populate defines initial_value
- GAP-S68-3: Action params save as indexed keys {0:'',1:''} instead of named fields —
  _saveDeviceCmd querySelectorAll('[data-param]') reading index not data-param value

**Upload for W-S10 continued (Session 69):**
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

### D-S5b: Spec Hardening from Audit (Session 29 May 2026 Audit)

**Why this session exists:** A May 2026 audit (`SPEC_AUDIT.md`) found that several
spec rules were written with overconfident "locked / permanent / do not re-open"
language against decisions that were Claude-authored guesses, not validated
research. Some of those guesses are wrong or incomplete, and the language was
preventing pivots. CLAUDE_SESSION_PROMPT.md was updated to introduce three
confidence levels (Guardrail / Researched / Assumption). This session applies the
same hardening to the remaining specs.

**Must be done before B-1.** The compiler rewrite must not be written against
specs that the audit flagged as overconfident.

**Steps — apply audit findings to the specs:**

1. **PISTON_FORMAT.md — add "Field Lifecycle Rules" section.** For each field on
   condition, action, for_each, and variable nodes (role, role_tokens, entity_ids,
   device_label, compiled_value, display_value, aggregation, default_value, etc.),
   state exactly: when it is written, when it is read, when it is stripped on
   Snapshot export, who owns it (wizard / editor / compiler / import / `_reResolveVariableUses`).
   This surfaces the contradictions in audit findings #6, #13, and #14.

2. **PISTON_FORMAT.md — add role_tokens to the field reference table.** Currently
   GAP-S64-1 is open against this. role_tokens is required on action and condition
   nodes, ignored by compiler, preserved by editor, stripped (or zeroed) on Snapshot
   export. Decide and document the Snapshot rule explicitly — community-shared
   pistons must not leak the original user's variable/global names.

3. **PISTON_FORMAT.md — clarify `compile_target` field.** Document explicitly that
   the stored value is a cache of the last compiler decision, not a user preference.
   Snapshot export should set it from rescanning the imported statements, not from
   the source. Optional: add `compile_target_lock: null | "native_script" | "pyscript"`
   for users who need to pin a target (per audit finding #4) — but defer
   implementation until a real user case appears.

4. **PISTON_FORMAT.md — document the four legitimate write points for `entity_ids`
   on a node.** Replace any "captured at wizard commit time, never elsewhere"
   language with the actual rule: wizard commit, `_reResolveVariableUses`, Snapshot
   import role mapping, Redeploy All for global device variable changes. No other
   code may write to `entity_ids`.

5. **HA_LIMITATIONS.md + COMPILER_SPEC.md — fix variable scope warning contradiction.**
   Update COMPILER_SPEC.md Section 13 `VARIABLE_SCOPE_WARNING` to note it applies
   only when piston targets HA <2025.3. Cross-reference `loop_string_accumulation`
   in PYSCRIPT_COMPILER_SPEC.md 1.1 as the only currently-relevant case. Make a
   real decision on raising minimum HA to 2025.3 — current "consider raising before
   v1" language has been in the spec for sessions.

6. **DESIGN.md — soften "do not re-open" markers to include criteria for reopening.**
   AppDaemon, hybrid output model, multi-entity compilation, device globals
   compile-time-only — each one keeps its lock but gains a "re-open if X" criterion
   per audit finding #7. The decisions don't change; the language stops being
   hostile to future learning.

7. **DESIGN.md — explain why device_map was eliminated AND the path back if
   bookkeeping fails.** Audit finding #3. The escape path is `variable_refs` on
   nodes, NOT reintroducing the map. State this so a future session has a real
   option if `_reResolveVariableUses` + `globals_index.json` proves slow at scale.

8. **DESIGN.md — add bulk-orphan recovery dialog.** Audit finding #10. Default
   "never auto-delete" stays. Exception: orphan scan finding more than 5 orphaned
   files surfaces a one-time recovery dialog (import as backup / mark as
   user-managed / delete all).

9. **DESIGN.md — capability data being wrong (not just missing).** Audit finding
   #16. Add a manual capability override path alongside the Unknown Device Fallback,
   reachable from any device's wizard.

10. **COMPILER_SPEC.md — add Section 21 "Compiler Reality Discrepancies" stub.**
    Audit finding #18. A single place to log "HA actually does X instead of Y, the
    compiler must Z" as real testing reveals divergences. Pre-fill with the
    trigger:/platform: distinction (Section 9 line 916) as the example entry.

11. **FRONTEND_SPEC.md + STATEMENT_TYPES.md + PISTON_FORMAT.md — replace "100% of
    the time, every time, without fail" with "never silently drops, duplicates, or
    corrupts nodes" language.** Audit finding #1. CLAUDE_SESSION_PROMPT.md already
    has the corrected version — propagate to the other three files.

12. **All specs — sweep for "Locked / permanent / do not re-open / never be changed"
    phrasings.** For each one found: confirm it's a guardrail (scar tissue) or
    researched decision. If researched, attach the rationale. If guess, soften to
    "current decision based on [X]" and mark as a working assumption to validate
    in S3-1.

**Upload for D-S5b:**
ALL spec files (PISTON_FORMAT.md, COMPILER_SPEC.md, DESIGN.md, FRONTEND_SPEC.md,
HA_LIMITATIONS.md, PYSCRIPT_COMPILER_SPEC.md, STATEMENT_TYPES.md, WIZARD_SPEC.md),
plus CLAUDE_SESSION_PROMPT.md, SPEC_AUDIT.md, TASKS.md.

This is a large upload. If context budget is tight, split into two sessions:
- D-S5b-1: PISTON_FORMAT.md + COMPILER_SPEC.md + PYSCRIPT_COMPILER_SPEC.md + HA_LIMITATIONS.md (items 1-5, 10)
- D-S5b-2: DESIGN.md + FRONTEND_SPEC.md + STATEMENT_TYPES.md + WIZARD_SPEC.md (items 6-9, 11-12)

**Acceptance criteria:**
- All audit findings either applied or explicitly noted as "won't fix — Jeremy's call."
- Spec versions bumped where content changed.
- TASKS.md updated to reflect any new GAP entries surfaced during the hardening.

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

Prerequisites: W-S10 complete, D-S5 + D-S5b complete, B-1 complete, G-3 complete.

Success criteria: see "What 'S3-1 passes' actually means" checklist near top of this
file. All seven items must pass, not just the obvious ones.

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

### Session 68 gaps (new)

- **GAP-S68-1 → W-S10:** Import mapper shows raw entity_ids instead of friendly names
- **GAP-S68-2 → W-S10:** Import role mapping does not populate defines initial_value
- **GAP-S68-3 → W-S10:** Action params save as indexed keys {0:'',1:''} instead of
  named fields — _saveDeviceCmd querySelectorAll('[data-param]') reading index not
  data-param attribute value

### Session 67 gaps

- **GAP-S67-1 → W-S10 ✅:** Interaction row fixed — only shows when isTrigger(op)
- **GAP-S67-2 → W-S10 ✅:** Next button fixed. NOTE: the primary_entity_id part was
  WRONG and deleted from all specs. Physical rows correctly store ALL entity_ids.
  See WIZARD_SPEC.md v2.4.
- **GAP-S67-3 → W-S10 ✅:** Command picker no longer auto-renders params on load
- **GAP-S67-4 → W-S10 ✅:** Condition device button shows correct prefix tag

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
