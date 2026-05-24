# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 61 — MISSING_SPECS Items 6/10/12/19/20 body content moved to correct target documents (TEST_STRATEGY.md, DESIGN.md v1.5, BEST_PRACTICES.md, FRONTEND_SPEC.md v1.3, COMPILER_SPEC.md v1.5). HA_LIMITATIONS.md updated against HA 2026.4. Next: W-S8.
**Authority:** CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files
**Completed sessions:** See TASKS_HISTORY.md

---

## The Goal Before Everything Else

**Get to a clean round-trip on a simple piston:**
wizard writes JSON → backend saves it → compiler reads it → frontend renders it correctly

Blocking the smoke test: globals G-3/G-4 needed, W-S8 wizard coding needed (after D-S4
spec work completes), B-1 backend compiler update needed.

---

## How to Use This File

- **STAGE D** — Spec-only sessions. D-S4 is current.
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

**Gap Assignment Rule — Non-Negotiable:**
Every gap created at the end of a session must be assigned to the most logical
future session before the session closes. Never leave a gap unassigned.

---

## STAGE D — Spec Sessions

### D-S3: Post-Audit Cleanup ✅ (Session 58)
See TASKS_HISTORY.md.

---

### D-S4: Remaining Spec Completion ✅ (Sessions 59–60)

**All 9 steps complete.**

**Step 1 — Housekeeping ✅ (Session 59)**
**Step 2 — SAMPLE_PISTONS.md ✅ (Session 59)**
**Step 3 — Global device edit redeploy prompt UX ✅ (Session 60)**
DESIGN.md Section 7.1 expanded with: full permission prompt layout, progress modal
layout, edge cases (never-deployed, disabled, merged stale flags, HA disconnected
mid-redeploy, revert detection, running piston handling). MISSING_SPECS Item 24 resolved.
DESIGN.md → v1.4.

**Step 4 — Error states inventory ✅ (Session 60)**
Full error states written into FRONTEND_SPEC.md v1.2 — "Error States Inventory" section.
Covers all connection, save/deploy, piston list, import, and global redeploy errors.
MISSING_SPECS Item 5 resolved.

**Step 5 — Piston list UI row states ✅ (Session 60)**
Full row state table written into FRONTEND_SPEC.md v1.2 — "Piston List — Row States" section.
All 8 states defined with icon/color/text/tooltip. Multi-state priority order locked.
MISSING_SPECS Items 3/4/5 resolved.

**Step 6 — Status page full layout ✅ (Session 60)**
Full status page spec written into FRONTEND_SPEC.md v1.2 — "Status Page — Full Layout" section.
Covers: header, banners, all button states + deploy button state table, Test Compile panel,
Test Live Fire flow, Piston Script panel, Log panel, Variables panel, Quick Facts panel.
FRONTEND_SPEC.md → v1.2.

**Step 7 — MISSING_SPECS Items 2-6, 10-12, 14, 19, 20 ✅ (Session 60)**
- Item 2 (WebSocket protocol): written into FRONTEND_SPEC.md v1.2
- Item 3 (Settings page): written into FRONTEND_SPEC.md v1.2
- Item 4 (Folder management): written into FRONTEND_SPEC.md v1.2
- Item 6 (Test strategy): written into MISSING_SPECS Item 6 body
- Item 10 (Global variables maintenance strategy): written into MISSING_SPECS Item 10 body
- Item 11 (Sample piston library): partially resolved; production pistons deferred post-S3-2
- Item 12 (Best practices documentation): patterns defined; BEST_PRACTICES.md deferred post-S3-1
- Item 14 (Time condition compiler path): written into COMPILER_SPEC.md v1.4 Section 11
- Item 19 (Fast pre-check validation): decision — deferred post-v1; spec written in body
- Item 20 (Statement compiler registry): decision — post-S3-2 refactor; spec written in body
COMPILER_SPEC.md → v1.4.

**Step 8 — HA_LIMITATIONS.md Section 3 ✅ (Session 60)**
Rewritten as standalone output file (HA_LIMITATIONS_SECTION3.md — splice into repo).
device_map and has_missing_devices references removed. Entity validation model from
DESIGN.md Section 9.2 and COMPILER_SPEC.md v1.4 used throughout.

**Step 9 — AI_PROMPT_SPEC.md ✅ (Session 60)**
Complete rewrite → v2.0. All device_map references eliminated. New model: entity_ids on
nodes, role as placeholder, Snapshot format per DESIGN.md Sections 6.10/6.11.
Prompt 1 (write-a-piston.md) requirements fully defined. Prompt 2 (migrate-from-webcore.md)
deferred to v2.

---

## STAGE W — Wizard and Editor Coding

### W-S8: Wizard Coding (Blocked — D-S4 must complete first)

**Upload for W-S8:**
wizard-core.js, wizard-condition.js, wizard-action.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, editor.js, list.js,
WIZARD_SPEC.md, PISTON_FORMAT.md, STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

**Steps (in order):**
0. wizard-action.js `_saveDeviceCmd` rewrite — write new action node format
   (role + entity_ids, ha_service = domain.command, no registerDeviceRole call)
1. Remove `registerDeviceRole` from editor.js (dead code)
2. Verify wizard-condition.js `_buildConditionNode` writes role + entity_ids
3. Wire globals into device picker (wizard-core.js loads globals from API)
4. wizard-variable.js `devices` type — full multi-select, default_value as {role, entity_ids}
5. Fix open gaps in priority order:
   - GAP-S52-2: Action wizard stale sel state
   - GAP-S52-3: Add task button wrong behavior
   - GAP-S52-4: open() shallow copy for complex edit nodes
   - GAP-S53-2: Attribute dropdown empty for real devices
   - GAP-S53-3: Condition edit pre-fill needs verification
   - GAP-S53-4: "on/null" rendering in editor (_condLine null check)
   - GAP-S53-5: Switch case statements missing branch
   - GAP-S44-1: Group condition editing not implemented

---

## STAGE G — Globals System

### G-1, G-2, G-2b ✅ (Sessions 48–50) — See TASKS_HISTORY.md

### G-3: Import — Globals Land in the Right Place (GAP-S46-4)

**Upload for G-3:**
api.py, list.js, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

### G-4: Editor + Wizard — Wire Globals Throughout

**Blocked by MISSING_SPECS.md Item 24** (global device edit redeploy prompt UX).
Item 24 must be written in D-S4 Step 3 before this session starts.

**Upload for G-4:**
wizard-core.js, wizard-condition.js, wizard-action.js, editor.js,
WIZARD_SPEC.md, MISSING_SPECS.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

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

## STAGE 2 — Connect the Seams (After smoke test)

### S2-2: api.py + error_logger.py Gaps
### S2-3: Snapshot Export + Backup Export (GAP-S43-4 + MISSING_SPECS Item 27)

---

## STAGE 3 — Round-Trip Verification

### S3-1: Smoke Test — Full Round-Trip on One Simple Piston
Use Piston 1 from SAMPLE_PISTONS.md as the test case.
Only attempt once W-S8, B-1, and G-1/G-2/G-2b/G-3 are complete.

### S3-2: Deferred Validation Testing (After S3-1 Passes)

---

## STAGE 4 — Features (Only After Stage 3 Complete)

### S4-16: Operational Hardening
- Gap A: Cache slug list in `get_all_slugs()`
- Gap C: Document recommended uvicorn worker config
- Gap D: Add startup validation in `docker-entrypoint.sh`
- Gap F: Security section in README
- Gap G: Tighten `_scan_globals` regex
- GAP-S30-3: Double config load per compile call
- GAP-S34-1: _compile_single_condition has no warnings param
- GAP-S45-1: set_variable wizard doesn't normalize $ prefix (cosmetic)
- GAP-S47-1: Structure line --block-left position needs fine-tuning (cosmetic)

### S4-17: HA Connection Reliability (after S4-9)

---

## DEFERRED

### D-1 through D-9: See previous TASKS.md entries (unchanged)

---

## Open Gaps — All Assigned

### Coding gaps — after D-S4

- **GAP-S57-5 → G-4:** Global device edit redeploy prompt (spec complete — DESIGN.md v1.4 Section 7.1)
- **GAP-S52-2 → W-S8:** Action wizard stale sel state
- **GAP-S52-3 → W-S8:** Add task button not working in some flows
- **GAP-S52-4 → W-S8:** open() shallow copy for complex edit nodes
- **GAP-S46-4 → G-3:** Imported globals land in piston variables instead of globals store
- **GAP-S46-5 → W-S8:** Import modal has no file picker — paste-only
- **GAP-S53-2 → W-S8:** Attribute dropdown empty for real devices
- **GAP-S53-3 → W-S8:** Condition edit pre-fill needs verification
- **GAP-S53-4 → W-S8:** "on/null" rendering in editor
- **GAP-S53-5 → W-S8:** Switch case statements missing branch
- **GAP-S44-1 → W-S8:** Group condition editing not implemented
- **GAP-S58-2 → W-S8 or dedicated session:** Copy/paste spec (MISSING_SPECS Item 26)
- **GAP-S58-3 → S2-3:** Piston backup (MISSING_SPECS Item 27)
- **GAP-S50-1 → S3-1:** Compiler does not handle device initial_value disambiguation
- **GAP-S33-2 → S3-2:** condition_and/or template indentation needs real-world testing
- **GAP-S34-1 → S4-16:** _compile_single_condition has no warnings param
- **GAP-S38-1 → S2-2:** /api/logs route missing from api.py
- **GAP-S39-1 → S2-2:** ha_client import pattern wrong in api.py and compiler.py
- **GAP-S43-4 → S2-3:** Snapshot export not yet implemented
- **GAP-S30-3 → S4-16:** Double config load per compile call
- **GAP-S47-1 → S4-16:** Structure line position needs fine-tuning (cosmetic)
- **GAP-S45-1 → S4-16:** set_variable wizard doesn't normalize $ prefix (cosmetic)

### Spec gaps still open (all D-S4 steps complete)

- **MISSING_SPECS Item 11 (partial)** → post-S3-2: Production sample pistons (Low Battery, Door Chime, CO Alert, Water Leak) — blocked on compiler being solid
- **MISSING_SPECS Item 12** → post-S3-1: Write BEST_PRACTICES.md
- **MISSING_SPECS Item 15** → D-S4 Step 9 prerequisite done — AI_PROMPT_SPEC.md v2.0 complete; write-a-piston.md prompt content still needed (actual prompt file, not the spec for it)
- **MISSING_SPECS Item 25** → S4-17: HA entity state subscription vs polling
- **MISSING_SPECS Item 26** → W-S8 or dedicated session: Copy/paste/duplicate statements
- **MISSING_SPECS Item 27** → S2-3: Piston backup trigger/download/restore
