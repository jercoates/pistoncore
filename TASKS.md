# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 46 complete — wizard split deployed, priorities realigned
**Authority:** CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files

---

## The Goal Before Everything Else

**Get to a clean round-trip on a simple piston:**
wizard writes JSON → backend saves it → compiler reads it → frontend renders it correctly

The wizard split is done and deployed. Editor scroll is fixed. The remaining blockers
before a meaningful smoke test are: vertical structure lines (visual), globals system
(completely unbuilt end-to-end), and role mapping verification.

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

### W-S7: Vertical Structure Lines ← NEXT SESSION

**What this is:** Add CSS vertical connector lines to the editor document so nested
blocks visually connect — matching the blue sidebar lines in real WebCoRE.
This is the single biggest visual gap. Pure editor.js + CSS change, no backend needed.

**What to implement:**
- border-left connector lines on indented content containers inside each block
- Apply to: if/then/else/end if, with/do/end with, while/do/end while,
  repeat/do/until/end repeat, for/end for, for each/end for each, every/end every
- Lines should be teal or muted blue, thin (2px), running the full height of the
  block's indented content
- Click handling, ghost points, and line numbers must remain intact
- See Notes_Vertical_Lines.md in reference/ for full visual spec

**Upload for this session:**
editor.js, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### W-S8: Role Mapping Verification + Wizard Smoke Test

**What this is:** Verify role mapping works end-to-end, then run the basic wizard
smoke test to confirm nothing broke in the split.

**Step 1 — GAP-S45-4 — Role mapping end-to-end:**
- Import kitchen_motion_test2.json, confirm role mapping dialog fires for all placeholders
- Map roles to real HA entities, save, verify piston renders correctly

**Step 2 — Basic wizard smoke test:**
- New piston → add if block → add condition → add action (all must work)
- Edit existing condition (pre-fill must work)
- Edit existing variable → Delete button present and functional

**Step 3 — GAP-S44-1 (if time):** Group condition editing

**Upload for this session:**
wizard-core.js, wizard-condition.js, wizard-action.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, editor.js, list.js,
CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## STAGE G — Globals System (Completely Unbuilt)

**Background:** Globals are referenced in several places in the frontend but nothing
is actually implemented end-to-end:
- list.js calls `GlobalsDrawer.open()` — that object does not exist
- editor.js can render `@variable` syntax — but there is no data source for it
- wizard.js has a local/global scope selector in set_variable — not wired to anything
- No backend API endpoints for globals exist
- No globals storage exists
- Imported pistons that contain globals currently dump them into piston variables
  because there is nowhere else for them to go (GAP-S46-4)

This is a multi-session feature. Must be done before the project is truly usable.

### G-1: Backend — Globals Storage + API Endpoints

**Decisions needed before coding (discuss at start of session):**
- Storage: separate globals.json in userdata? or part of a shared config file?
- Schema: `{ id, name, var_type, value, description }`
- API endpoints: GET /globals, POST /globals, PUT /globals/{id}, DELETE /globals/{id}
- How compiled pistons reference globals (HA input_* helpers? PyScript globals dict?)

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
See DONE section below.

---

## STAGE 2 — Connect the Seams (Deferred until smoke test passes)

### S2-2: api.py + error_logger.py Gaps
- GAP-S38-1: /api/logs route missing from api.py
- GAP-S39-1: ha_client import pattern wrong in api.py and compiler.py

### S2-3: Snapshot Export
GAP-S43-4: POST /pistons/{id}/export still returns 501.
Needed for community sharing and AI migration flow.

### S2-4: Complete ✅ (Import Role Mapping — Session 43)

---

## STAGE 3 — Round-Trip Verification

### S3-1: Smoke Test — Full Round-Trip on One Simple Piston
Only attempt once W-S8 passes and globals G-1/G-2 are complete.

**The 14-step test:**
1. Open editor on new piston
2. Click · add a new statement → W-1 opens
3. Click "Add an if block" → W-3 opens
4. Click "Add a condition" → W-4 opens
5. Select a physical device → attribute populates → select attribute
6. Select an operator → value field appears → enter a value
7. Click "Add" → if node inserted with condition inside it → editor re-renders
8. Inside the then block, click · add a new statement → W-1 opens
9. Click "Add an action" → W-5 opens
10. Piston device variables appear in the list
11. Select a device → click "Next →" → W-6 opens with "With... {device}"
12. Select a command → click "Add" → action node inserted inside if.then
13. Editor re-renders showing complete piston
14. Save succeeds

**Upload for this session:**
WIZARD_REBUILD_SPEC.md, wizard-core.js, wizard-condition.js, wizard-action.js,
editor.js, PISTON_FORMAT.md, STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

### S3-2: Deferred Validation Testing (After S3-1 Passes)
- GAP-S33-2 — condition_and/or template indentation
- D-1, D-5, D-6, D-7 — HA behavior edge cases

---

## STAGE 4 — Features (Only After Stage 3 Complete)

### S4-0: Write Missing Specs (as needed)
### S4-1: PyScript Detection and Setup Prompt
### S4-2: Missing Device Handler (depends on D-1 validated)
### S4-3: Orphan Cleanup — Queue and Retry
### S4-4: Compiler Template System — Jinja2 Scaffolding
### S4-5: Pre-Save Validation Pipeline
### S4-6: File Signature and Hash System
### S4-7: Test Compile / Preview Mode
### S4-8: Global Variables — Stale Piston Tracking (after G-1 through G-4)
### S4-9: Run Status Reporting — WebSocket Events
### S4-10: Snapshot Import — AI Prompt Files
### S4-11: AI-REVIEW-PROMPT.md — Update
### S4-12: target-boundary.json — Add Missing PyScript-Forcing Patterns
### S4-13: Sample Piston Library — Write Snapshot JSON
### S4-14: Best Practices Documentation
### S4-15: Drag and Drop Reordering (editor.js only — safe any time after S3-1)

### S4-16: Operational Hardening
- **(Gap A)** Cache slug list in `get_all_slugs()`
- **(Gap C)** Document recommended uvicorn worker config
- **(Gap D)** Add startup validation in `docker-entrypoint.sh`
- **(Gap F)** Security section in README
- **(Gap G)** Tighten `_scan_globals` regex
- **GAP-S30-3** Double config load per compile call
- **GAP-S34-1** _compile_single_condition has no warnings param
- **GAP-S45-1** set_variable wizard doesn't normalize $ prefix (cosmetic)

### S4-17: HA Connection Reliability (after S4-9)
- No retry logic on _ws_call
- No reconnect on stale WebSocket
- Persistent WebSocket manager with reconnect loop, jittered backoff, ping/pong keepalive

---

## DEFERRED — Blocked on External Validation or Not v1 Scope

### D-1: HA Missing Entity Behavior — Must Test Before Coding
### D-2: Which-Interaction Step — Evaluate Feasibility First
### D-3: settings / end settings Block Contents
### D-4: Timer Statement — Evaluate Before Including
### D-5: Sunrise/Sunset Negative Offset Edge Cases
### D-6: Numeric Trigger Unknown State Behavior
### D-7: Long-Running Piston Timeouts

### D-8: wait 'until' and 'state' wizard UI (GAP-S36-3)
wait_type "until" and "state" render branches exist in editor but wizard has no UI yet.

### D-9: `when true` / `when false` per-condition sub-blocks — v2
WebCoRE TCP/TEP per-condition action branches. Jeremy does not use them. Do not implement in v1.

---

## DONE — Completed Sessions

### Session 46 — W-S6 complete + wizard.js split ✅
editor.js: scroll fix, device variable = value suppression, aggregation 'Any of' always
shown for device conditions. GAP-S45-2 confirmed already clean.
GAP-S45-3 CLOSED. GAP-S46-2 CLOSED. GAP-S46-3 CLOSED.
wizard.js (2480 lines) split into 6 files: wizard-core.js, wizard-statement.js,
wizard-condition.js, wizard-loops.js, wizard-action.js, wizard-variable.js.
WizardCore namespace — shared state via window.WizardCore getters/setters.
GAP-S46-1 CLOSED — Delete button in _goVariablePicker when editing.
index.html updated with 6 new script tags. Deployed and confirmed working.
Priorities realigned: vertical lines → globals system → smoke test.

### Session 45 — W-S6 partial: Editor rendering audit + placeholder fix ✅ (partial)
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
### GAP-S45-2 → CLOSED S46: No { } brackets in editor.js — already clean
### GAP-S45-3 → CLOSED S46: Scroll fixed
### GAP-S45-4 → W-S8: Role mapping end-to-end not yet verified
### GAP-S46-1 → CLOSED S46: Delete button added to _goVariablePicker
### GAP-S46-2 → CLOSED S46: Device variable = value suppression fixed
### GAP-S46-3 → CLOSED S46: Aggregation 'Any of' fixed in _condLine
### GAP-S46-5 → W-S8: Import modal has no file picker — paste-only
Add `<input type="file" accept=".json,.piston">` to the import modal in list.js.
On file select, read contents and drop into the existing textarea. Rest of import
flow is unchanged — no backend work needed. Small addition to list.js only.
### GAP-S30-3 → S4-16: Double config load per compile call
