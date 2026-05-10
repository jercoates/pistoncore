# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 39 complete (S2-1 — HAClient Abstraction + wizard priority decision)
**Authority:** CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files

---

## The Goal Before Everything Else

**Get to a clean round-trip on a simple piston:**
wizard writes JSON → backend saves it → compiler reads it → frontend renders it correctly

The wizard is the current blocker. It cannot reliably produce valid JSON for even
a simple if/then/action piston. Until the wizard works, nothing else in the stack
can be tested or verified. All other work is deferred until the wizard works and
the round-trip smoke test (S3-1) passes.

---

## How to Use This File

- **STAGE W** — Wizard rebuild. Current priority. Nothing else until this is done.
- **STAGE 1** — Structural fixes. Mostly complete.
- **STAGE 2** — Connect the seams. Deferred until after wizard works.
- **STAGE 3** — Round-trip verified. Work can now split into focused modules.
- **STAGE 4** — Features. Only after Stage 3 is solid.
- **DEFERRED** — Known, not yet unblocked or not v1 scope.
- **DONE** — Completed and verified.

One task per session. Do not combine tasks.
Do not start a task without reading its listed spec files first.
Upload only the files needed for that task — nothing extra.

---

## STAGE W — Wizard Rebuild ← CURRENT PRIORITY

The wizard is broken. It cannot produce valid JSON for a simple piston reliably.
The WebCoRE source code (app.js, piston.module.html, dashboard.module.html) has
been obtained and is the reference for what the wizard must do.

All wizard sessions use the WebCoRE source as the authoritative UI reference.
Match WebCoRE's dialog flow, field structure, and behavior exactly unless there
is a documented HA-specific reason not to.

---

### W-0: Wizard Rebuild Spec ← NEXT SESSION
**What this is:** A spec-writing session, no code.
**Output:** WIZARD_REBUILD_SPEC.md — complete written spec of every wizard dialog,
every step, every field, what each writes to JSON. Referenced directly against
the WebCoRE source. This becomes the authoritative target for all wizard coding.

**Upload:** wizard.js, CLAUDE_SESSION_PROMPT.md, TASKS.md,
app.js (WebCoRE source), piston.module.html (WebCoRE source),
dashboard.module.html (WebCoRE source)

**Known problems to address in the spec (from live testing Session 39):**
- Device picker search box is in the wrong position — must be inside the dropdown
  per WebCoRE, not a separate field above the list
- Piston variables (local and global) do not appear in device picker results
- Too many HA entities showing that don't belong (domain filter not working correctly)
- Some entities appearing 3x instead of once
- Cannot delete statements
- Cannot complete a full if → action flow
- Action dialog layout does not match WebCoRE (two-step flow: pick devices, then
  pick command as separate step)
- Wizard boxes too small to read text when content is added
- Many fields across multiple statement types writing wrong field names or wrong
  format — fix all at once, not one at a time

**Do not write any wizard code until WIZARD_REBUILD_SPEC.md exists and is approved.**

---

### W-1 through W-N: Wizard Rebuild Coding Sessions
To be defined after W-0 produces WIZARD_REBUILD_SPEC.md.
Each session will target one dialog or one area of the wizard.
Session scope and upload list defined per session based on the spec.

---

## STAGE 1 — Structural Fixes (Mostly Complete)

---

### S-NESTED: Nested Tree Migration ✅ DONE (Sessions 35-37)

All three sessions complete. Nested tree model in place across compiler.py,
editor.js, and wizard.js. See DONE section for details.

---

### S1-2a: Flat Statements Array — wizard.js ✅ DONE (Session 26)
### S1-2b: Flat Statements Array — editor.js ✅ DONE (Session 36)
### S1-2c: Flat Statements Array — compiler.py ✅ DONE (Session 35)

---

### S1-3: Backend Audit ✅ DONE (Session 29)
### S1-4: main.py / api.py Backend Cleanup ✅ DONE (Session 30)
### S1-5: HA Direct Write — Deploy Implementation ✅ DONE (Session 31)
### S1-6: Fat Compiler Context Assembly ✅ DONE (Session 32)

---

### S1-7: Compiler Bug Fixes ✅ DONE (Sessions 28, 33, 34)

**Still open — assigned to later sessions:**
- GAP-S34-1: _compile_single_condition has no warnings param → S4-15
- GAP-S33-2: condition_and/or template indentation needs real-world testing → S3-2
- Bug 28 (_field_type entity_id selector) → S2-2 (deferred until after wizard)

---

### S1-8: Template Compliance Pass ✅ DONE (Session 33)

---

## STAGE 2 — Connect the Seams (DEFERRED until wizard works)

All Stage 2 tasks are deferred until after the wizard works and S3-1 passes.
The wizard is the real blocker — fixing backend seams before the wizard works
is wasted effort.

---

### S2-0: Storage Architecture Spec + SQLite Setup ✅ DONE (Session 38)

---

### S2-1: HAClient Abstraction ✅ DONE (Session 39)

---

### S2-2: device_map_meta — Wire Into Backend and Wizard
**DEFERRED until after wizard works.**
**Upload:** wizard.js, api.py, PISTON_FORMAT.md, DESIGN.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

**Open gaps to resolve this session when reached:**
- GAP-S39-1: Update import in api.py and compiler.py from `import ha_client` to
  `from ha_client import ha_client`. Audit all call sites in both files.
- GAP-S38-1: Add /api/logs route to api.py while api.py is open.
- Bug 28: _field_type entity_id selector fix — api.py is in scope.

---

### S2-3: Snapshot Export — Backend Implementation
**DEFERRED until after wizard works.**

---

### S2-4: Import Role Mapping Flow — Frontend + Backend
**DEFERRED until after wizard works.**

---

### S2-5: HA Version Detection — Display and Template Selection
**DEFERRED — moved to Stage 4.**

---

## STAGE 3 — Round-Trip Verification

### S3-1: Smoke Test — Full Round-Trip on One Simple Piston
**DEFERRED until wizard works.**

Build the simplest possible piston in the wizard:
- One trigger (time-based or device state change)
- One action (turn on a light)

Verify each step passes:
1. Wizard writes correct nested JSON ✓
2. Editor renders it correctly from that JSON ✓
3. Backend saves and returns it without corrupting any fields ✓
4. Compiler reads it and produces valid HA YAML ✓
5. Test Compile preview shows the YAML without errors ✓
6. Deploy writes to HA and reload succeeds ✓

**Also complete this session:** The render-back verification table from S1-2b.

---

### S3-2: Deferred Validation Testing (After S3-1 Passes)
**DEFERRED.**
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

### S4-15: Operational Hardening
- **(Gap A)** Cache slug list in `get_all_slugs()`
- **(Gap C)** Document recommended uvicorn worker config
- **(Gap D)** Add startup validation in `docker-entrypoint.sh`
- **(Gap F)** Security section in README
- **(Gap G)** Tighten `_scan_globals` regex
- **GAP-S30-3** Double config load per compile call
- **GAP-S34-1** _compile_single_condition has no warnings param

### S4-16: HA Connection Reliability (after S4-9)
- No retry logic on _ws_call
- No reconnect on stale WebSocket
- No /api/ha/status endpoint
- Persistent WebSocket manager with reconnect loop, jittered backoff, ping/pong keepalive

---

## DEFERRED — Blocked on External Validation or Not v1 Scope

### D-1: HA Missing Entity Behavior — Must Test Before Coding
**Blocks:** S4-2 missing device hard-flag logic

### D-2: Which-Interaction Step — Evaluate Feasibility First
### D-3: settings / end settings Block Contents
### D-4: Timer Statement — Evaluate Before Including
### D-5: Sunrise/Sunset Negative Offset Edge Cases
### D-6: Numeric Trigger Unknown State Behavior
### D-7: Long-Running Piston Timeouts

### D-8: wait 'until' and 'state' wizard UI (GAP-S36-3)
wait_type "until" and "state" render branches exist in editor but wizard has no UI
for them yet. When wait wizard UI is built, verify render branches against STATEMENT_TYPES.md.

---

## DONE — Completed Sessions

### Session 39 — S2-1: HAClient Abstraction ✅
ha_client.py rewritten as HAClient class with module-level singleton (`ha_client`).
Auth mode auto-detected on construction.
reload_config() added. Bug 26 fixed. Bug 27 fixed.
endpoints.json externalization skipped.
GAP-S39-1 opened → assigned to S2-2 (deferred).
**Decision:** Stage 2 deferred. Wizard rebuild is next priority.

### Session 38 — S2-0: SQLite Error Logger ✅
error_logger.py created. main.py updated.
GAP-S38-1 opened → assigned to S2-2 (deferred).

### Session 37 — S-NESTED Session C: wizard.js audit + field name fixes ✅
GAP-S36-1, GAP-S36-2 resolved. GAP-S37-1 found and fixed same session.
wait field name fixed. GAP-S27-4 confirmed closed.

### Session 36 — S-NESTED Session B: editor.js Nested Tree Migration ✅
All statement tree operations rewritten for nested object tree.
GAP-S36-1 → resolved S37. GAP-S36-2 → resolved S37. GAP-S36-3 → deferred D-8.

### Session 35 — S-NESTED Session A: Nested Tree Spec + compiler.py ✅
Nested tree model established. All spec files updated. compiler.py updated.

### Session 34 — S1-7 Session 3: else_ifs + time condition + PyScript spec ✅
### Session 33 — S1-8: Template Compliance + S1-7 Session 2 Bug Fixes ✅
### Session 32 — S1-6: Fat Compiler Context Assembly ✅
### Session 31 — S1-5: HA Direct Write ✅
### Session 30 — S1-4: main.py / api.py Backend Cleanup ✅
### Session 29 — S1-3: Backend Audit ✅
### Session 28 — S1-2c: compiler.py Flat Array + S1-7 Session 1 Bug Fixes ✅
### Session 27 — S1-2b: editor.js Flat Array ✅ (superseded by S-NESTED Session B)
### Session 26 — S1-2a: wizard.js Flat Array ✅
### Sessions 21-25 — Spec work, field alignment, COMPILER_SPEC rewrite ✅
### Sessions 1-20 — See DESIGN.md Section 33 (Development Log) ✅

---

## Unassigned Gaps

### GAP-S28-4: 6 test pistons in tests/pistons/ not yet created
Fits after S3-1. Must use nested tree JSON per PISTON_FORMAT.md v2.0.
