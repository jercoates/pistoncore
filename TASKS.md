# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 45 complete (W-S6 partial — rendering audit + placeholder fix)
**Authority:** CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files

---

## The Goal Before Everything Else

**Get to a clean round-trip on a simple piston:**
wizard writes JSON → backend saves it → compiler reads it → frontend renders it correctly

Session 45 made progress on editor rendering. The role mapping flow, scroll fix,
bracket rendering fix, and compile test path are the remaining blockers before
any smoke test is meaningful.

---

## How to Use This File

- **STAGE W** — Wizard rebuild. Core bugs fixed. Rendering audit in progress.
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

## STAGE W — Wizard Rebuild

### W-0 through W-S5: Complete ✅
See DONE section below.

---

### W-S6: Editor Rendering Audit Continuation ← NEXT SESSION

**What this is:** Continue the rendering audit started in Session 45.
Fix the wrong bracket implementation, scroll, and verify role mapping end-to-end.

**Items in priority order:**

1. **Verify wizard.js Delete button** — confirm variable edit dialog has Delete button
   wired to `_deleteEditNode`. Was intended for Session 45 but delivery was incomplete.

2. **GAP-S45-2 — Remove wrong `{ }` brackets from `_renderConditionBlock`.**
   The `{ }` text characters added in Session 45 are WRONG.
   WebCoRE uses CSS vertical sidebar connector lines (visual block guides like a
   code editor), not literal curly brace text. This is a CSS/HTML rendering feature.
   The vertical line runs from the condition keyword down to the closing keyword
   (`then`, `do`, `until`), drawn as a `border-left` on the indented block container.
   Remove the text brackets. Add the CSS sidebar lines instead.

3. **GAP-S45-3 — Fix scroll broken in editor.**
   Likely a CSS overflow issue on the editor-doc container. Investigate and fix.

4. **GAP-S45-4 — Verify role mapping end-to-end.**
   Import kitchen_motion_test2.json (placeholders in device_map).
   Confirm role mapping dialog fires for all three roles.
   Map each role to a real HA entity.
   Confirm piston saves and renders correctly after mapping.
   This must pass before any compile test is attempted.

5. **GAP-S44-1 — Group condition editing** (low priority, if time allows)

**Do not attempt smoke test. Rendering and role mapping must work first.**

**Upload for this session:**
editor.js, wizard.js, list.js, STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### W-S7: Smoke Test — Full Round-Trip on One Simple Piston

**Only attempt once W-S6 passes and role mapping works end-to-end.**

**The 14-step test (from WIZARD_REBUILD_SPEC.md):**
1. Open editor on new piston
2. Click `· add a new statement` → W-1 opens
3. Click "Add an if block" → W-3 opens
4. Click "Add a condition" → W-4 opens
5. Select a physical device → attribute populates → select attribute
6. Select an operator → value field appears → enter a value
7. Click "Add" → if node inserted with condition inside it → editor re-renders
8. Inside the `then` block, click `· add a new statement` → W-1 opens
9. Click "Add an action" → W-5 opens
10. Piston device variables appear in the list (from define block)
11. Select a device → click "Next →" → W-6 opens with "With... {device}"
12. Select a command → click "Add" → action node inserted inside if.then
13. Editor re-renders showing complete piston
14. Save succeeds

**If any step fails:** Document exactly which step and what happened.
Do not start fixing things mid-smoke-test — finish the test first, then fix.

**Upload for this session:**
WIZARD_REBUILD_SPEC.md, wizard.js, editor.js, PISTON_FORMAT.md,
STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

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
See W-S7 above — same test. Once W-S7 passes, mark S3-1 done.

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
### S4-8: Global Variables — Stale Piston Tracking
### S4-9: Run Status Reporting — WebSocket Events
### S4-10: Snapshot Import — AI Prompt Files
### S4-11: AI-REVIEW-PROMPT.md — Update
### S4-12: target-boundary.json — Add Missing PyScript-Forcing Patterns
### S4-13: Sample Piston Library — Write Snapshot JSON
### S4-14: Best Practices Documentation
### S4-15: Drag and Drop Reordering (editor.js only — safe to add any time after S3-1)

### S4-16: Operational Hardening
- **(Gap A)** Cache slug list in `get_all_slugs()`
- **(Gap C)** Document recommended uvicorn worker config
- **(Gap D)** Add startup validation in `docker-entrypoint.sh`
- **(Gap F)** Security section in README
- **(Gap G)** Tighten `_scan_globals` regex
- **GAP-S30-3** Double config load per compile call
- **GAP-S34-1** _compile_single_condition has no warnings param
- **GAP-S45-1** set_variable wizard doesn't normalize $ prefix — if user types
  `$varName` editor renders `$$varName`. Low priority cosmetic fix.

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
wait_type "until" and "state" render branches exist in editor but wizard has no UI
for them yet.

### D-9: `when true` / `when false` per-condition sub-blocks — v2
WebCoRE TCP/TEP per-condition action branches. Jeremy does not use them.
Significant complexity. Do not implement in v1.

---

## DONE — Completed Sessions

### Session 45 — W-S6 partial: Editor rendering audit + placeholder fix ✅ (partial)
editor.js: _friendlyCmd() added (snake_case → Title Case for task commands),
log_message/wait/call_piston/cancel_pending_tasks do-keyword prefixes added,
aggregation always shown for device conditions, modified_at fallback,
device variables in define never show = value.
list.js: _isUnmapped() helper — placeholder entity IDs now trigger role mapping.
GAP-S43-1 CLOSED. GAP-S43-5 CLOSED.
Session ran out before wizard.js delivery confirmed and bracket fix completed.
New gaps: GAP-S45-1 (S4-16), GAP-S45-2 (W-S6), GAP-S45-3 (W-S6), GAP-S45-4 (W-S6).

### Session 44 — W-S5: Editor Rendering Fixes ✅
editor.js: _condLine() flat-field normalization (GAP-S43-3 CLOSED), group object guard,
_subj() null-safe, if renderer reverted to then/else.
wizard.js: _condId() helper, _route() edit-condition flat-field pre-fill.
GAP-S40-1 and GAP-S40-2 CLOSED.
New gaps: GAP-S44-1 (group editing) → W-S7.

### Session 43 — S2-4: Import Role Mapping Flow ✅
POST /pistons/import implemented. API.importPiston() added. Import paste modal +
"Rebuild piston items" role mapping dialog in list.js matching WebCoRE flow.
api.py creates device variable entries from device_map roles on import.

### Session 42 — W-S1 through W-S4: Wizard + Editor Bug Fixes ✅
All 7 bugs from WIZARD_REBUILD_SPEC.md fixed. See W-S5 entry for full list.

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
### GAP-S43-4 → S2-3: Snapshot export not yet implemented (POST /pistons/{id}/export returns 501)
### GAP-S44-1 → W-S6: Group condition editing not implemented
### GAP-S45-1 → S4-16: set_variable wizard doesn't normalize $ prefix (cosmetic)
### GAP-S45-2 → W-S6: Wrong { } text brackets in _renderConditionBlock — replace with CSS sidebar lines
### GAP-S45-3 → W-S6: Scroll broken in editor — investigate CSS overflow on editor-doc
### GAP-S45-4 → W-S6: Role mapping end-to-end not yet verified — must pass before compile test
### GAP-S30-3 → S4-16: Double config load per compile call
