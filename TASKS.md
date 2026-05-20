# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 47 complete — vertical structure lines deployed
**Authority:** CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files

---

## The Goal Before Everything Else

**Get to a clean round-trip on a simple piston:**
wizard writes JSON → backend saves it → compiler reads it → frontend renders it correctly

The wizard split is done and deployed. Editor scroll is fixed. Vertical structure lines
are in. The remaining blockers before a meaningful smoke test are: globals system
(completely unbuilt end-to-end) and role mapping verification.

---

## How to Use This File

- **STAGE W** — Wizard and editor polish. Active work zone.
- **STAGE G** — Globals system. Completely unbuilt. Must be done before smoke test means anything.
- **STAGE 1** — Structural fixes. Mostly complete.
- **STAGE 2** — Connect the seams. Deferred until after smoke test passes.
- **STAGE 3** — Round-trip verified. Work can now split into focused modules.
- **STAGE 4** — Features. Only after Stage 3 is solid.
- **DEFERRED** — Known, not yet unblocked or not v1 scope.
- **DONE** — Completed and verified.

One task per session. Do not combine tasks.
Do not start a task without reading its listed spec files first.
Upload only the files needed for that task — nothing extra.
**Do not write any file until all necessary files for that task have been read.**

**Gap Assignment Rule — Non-Negotiable:**
Every gap created at the end of a session must be assigned to the most logical
future session before the session closes. Never leave a gap unassigned.

---

## STAGE W — Wizard and Editor Polish

### W-S7b: Wizard Stabilization + Debug Logging

**What this is:** Null-safety and defensive coding pass on the split wizard files.
Added between W-S7 and W-S8 based on Grok audit (May 2026).

**Tasks:**
- Null safety pass on _buildConditionNode, _commitCondition, device picker flows,
  _loadCapsIntoSelect
- Verify imported piston condition edit round-trip works end-to-end
  (flat-field format → pre-fill → save → correct JSON output)
- Add console.log at start of all _go* functions for debug tracing
- Fix obvious bugs found during review — no new features

**Upload for this session:**
wizard-core.js, wizard-condition.js, wizard-action.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, STATEMENT_TYPES.md, PISTON_FORMAT.md,
CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### W-S8: Role Mapping Verification + Wizard Smoke Test

**Step 1 — GAP-S45-4 — Role mapping end-to-end:**
- Import kitchen_motion_test2.json, confirm role mapping dialog fires for all placeholders
- Map roles to real HA entities, save, verify piston renders correctly

**Step 2 — Basic wizard smoke test:**
- New piston → add if block → add condition → add action (all must work)
- Edit existing condition (pre-fill must work)
- Edit existing variable → Delete button present and functional

**Step 3 — GAP-S44-1 (if time):** Group condition editing
**Step 4 — GAP-S46-5 (if time):** Add file picker to import modal in list.js

**Upload for this session:**
wizard-core.js, wizard-condition.js, wizard-action.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, editor.js, list.js,
CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## STAGE G — Globals System (Completely Unbuilt) ← NEXT

**Background:** Globals are referenced in several places in the frontend but nothing
is actually implemented end-to-end:
- list.js calls `GlobalsDrawer.open()` — that object does not exist
- editor.js can render `@variable` syntax — but there is no data source for it
- wizard.js has a local/global scope selector in set_variable — not wired to anything
- No backend API endpoints for globals exist
- No globals storage exists
- Imported pistons that contain globals currently dump them into piston variables
  because there is nowhere else for them to go (GAP-S46-4)

### G-1: Backend — Globals Storage + API Endpoints ← NEXT SESSION

**Decisions needed before coding (discuss at start of session):**
- Storage: separate globals.json in userdata
- Schema: `{ id, name, var_type, value, description }`
- API endpoints: GET /globals, POST /globals, PUT /globals/{id}, DELETE /globals/{id}
- How compiled pistons reference globals (PyScript globals dict)

**Upload for this session:**
api.py, main.py, DESIGN.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### G-2: Frontend — GlobalsDrawer Implementation

**What to build:**
- `GlobalsDrawer` object with open()/close() — already called from list.js
- Drawer shows list of all globals: name, type, current value
- Add / Edit / Delete actions matching wizard variable UI style
- Fetches from GET /globals on open, saves via POST/PUT/DELETE
- New file: `frontend/js/globals.js` — add to index.html load order after api.js

**Upload for this session:**
list.js, api.js, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### G-3: Import — Globals Land in the Right Place (GAP-S46-4)

**What to fix:**
- api.py import endpoint: detect variables with scope:'global' or is_global:true in
  imported JSON and POST them to globals storage instead of adding to piston define block
- Import role mapping dialog should not show globals as device roles

**Upload for this session:**
api.py, list.js, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### G-4: Editor + Wizard — Wire Globals Throughout

**What to wire:**
- Editor _val() and _subj() already render @variable — verify with real globals data
- Wizard condition builder: add global variables to subject type picker
- Wizard set_variable: scope selector routes to globals API on save
- Wizard action device picker: device-type globals appear in device lists

**Upload for this session:**
wizard-core.js, wizard-condition.js, wizard-action.js, editor.js,
CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## STAGE 1 — Structural Fixes (Mostly Complete)

### S1-1 through S1-8: Complete ✅

---

## STAGE 2 — Connect the Seams (Deferred until smoke test passes)

### S2-2: api.py + error_logger.py Gaps
- GAP-S38-1: /api/logs route missing from api.py
- GAP-S39-1: ha_client import pattern wrong in api.py and compiler.py

### S2-3: Snapshot Export
GAP-S43-4: POST /pistons/{id}/export still returns 501.

### S2-4: Complete ✅ (Import Role Mapping — Session 43)

---

## STAGE 3 — Round-Trip Verification

### S3-1: Smoke Test — Full Round-Trip on One Simple Piston
Only attempt once W-S8 passes and globals G-1/G-2 are complete.

**Upload for this session:**
WIZARD_REBUILD_SPEC.md, wizard-core.js, wizard-condition.js, wizard-action.js,
editor.js, PISTON_FORMAT.md, STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

### S3-2: Deferred Validation Testing (After S3-1 Passes)
- GAP-S33-2 — condition_and/or template indentation
- D-1, D-5, D-6, D-7 — HA behavior edge cases

---

## STAGE 4 — Features (Only After Stage 3 Complete)

### S4-0 through S4-15: See previous TASKS.md entries (unchanged)

### S4-16: Operational Hardening
- **(Gap A)** Cache slug list in `get_all_slugs()`
- **(Gap C)** Document recommended uvicorn worker config
- **(Gap D)** Add startup validation in `docker-entrypoint.sh`
- **(Gap F)** Security section in README
- **(Gap G)** Tighten `_scan_globals` regex
- **GAP-S30-3** Double config load per compile call
- **GAP-S34-1** _compile_single_condition has no warnings param
- **GAP-S45-1** set_variable wizard doesn't normalize $ prefix (cosmetic)
- **GAP-S47-1** Structure line --block-left position needs fine-tuning (cosmetic)

### S4-17: HA Connection Reliability (after S4-9)

---

## DEFERRED

### D-1 through D-9: See previous TASKS.md entries (unchanged)

---

## DONE — Completed Sessions

### Session 47 — W-S7 complete: Vertical structure lines ✅
editor.js: bOpen/bClose wrappers on all block types. div.doc-block-body[data-indent=N].
CSS ::before draws solid 2px teal line. --block-left set inline via requestAnimationFrame
after render — dynamic, zoom-safe. style.css: .doc-block-body rules added.
GAP-S47-1 opened → S4-16.

### Session 46 — W-S6 complete + wizard.js split ✅
editor.js: scroll fix, device variable = value suppression, aggregation 'Any of' fix.
wizard.js split into 6 files. GAP-S46-1 CLOSED. index.html updated.

### Session 45 — W-S6 partial: Editor rendering audit ✅ (partial)
### Session 44 — W-S5: Editor Rendering Fixes ✅
### Session 43 — S2-4: Import Role Mapping Flow ✅
### Session 42 — W-S1 through W-S4: Wizard + Editor Bug Fixes ✅
### Session 40 — W-0: WIZARD_REBUILD_SPEC.md written ✅
### Session 39 — S2-1: HAClient Abstraction ✅
### Session 38 — S2-0: SQLite Error Logger ✅
### Session 37 — S-NESTED Session C: wizard.js audit + field name fixes ✅
### Session 36 — S-NESTED Session B: editor.js Nested Tree Migration ✅
### Session 35 — S-NESTED Session A: Nested Tree Spec + compiler.py ✅
### Session 34 — S1-7 Session 3: else_ifs + time condition + PyScript spec ✅
### Session 33 — S1-8: Template Compliance + S1-7 Session 2 Bug Fixes ✅
### Session 32 — S1-6: Fat Compiler Context Assembly ✅
### Session 31 — S1-5: HA Direct Write ✅
### Session 30 — S1-4: main.py / api.py Backend Cleanup ✅
### Session 29 — S1-3: Backend Audit ✅
### Sessions 1-28 — See DESIGN.md Section 33 (Development Log) ✅

---

## Open Gaps — All Assigned

### GAP-S28-4 → S3-1: 6 test pistons in tests/pistons/ not yet created
### GAP-S33-2 → S3-2: condition_and/or template indentation needs real-world testing
### GAP-S34-1 → S4-16: _compile_single_condition has no warnings param
### GAP-S38-1 → S2-2: /api/logs route missing from api.py
### GAP-S39-1 → S2-2: ha_client import pattern wrong in api.py and compiler.py
### GAP-S43-4 → S2-3: Snapshot export not yet implemented
### GAP-S44-1 → W-S8: Group condition editing not implemented
### GAP-S45-1 → S4-16: set_variable wizard doesn't normalize $ prefix (cosmetic)
### GAP-S45-4 → W-S8: Role mapping end-to-end not yet verified
### GAP-S46-4 → G-3: Imported globals dump into piston variables instead of globals store
### GAP-S46-5 → W-S8: Import modal has no file picker — paste-only
### GAP-S47-1 → S4-16: Structure line --block-left position needs fine-tuning
### GAP-S30-3 → S4-16: Double config load per compile call
