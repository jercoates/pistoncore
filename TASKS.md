# PistonCore — TASKS.md

**Status:** Living document — update at the end of every session
**Last Updated:** Session 22 complete / Session 23 not started
**Authority:** CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files

---

## The Goal Before Everything Else

**Get to a clean round-trip on a simple piston:**
wizard writes JSON → backend saves it → compiler reads it → frontend renders it correctly

Once that works on even one simple piston, the seams between frontend, backend,
and compiler are locked and trusted. From that point on, each part can be worked
on in isolation — a wizard session only needs wizard files, a compiler session only
needs compiler files. Right now everything is tangled because the seams are not stable.

Do not work on wizard polish, compiler features, or UI improvements until
the round-trip works. Everything below is ordered toward that goal.

---

## How to Use This File

- **STAGE 1** — Structural fixes. Nothing works correctly until these are done.
- **STAGE 2** — Connect the seams. Frontend ↔ Backend ↔ Compiler all talking correctly.
- **STAGE 3** — Round-trip verified. Work can now split into focused modules.
- **STAGE 4** — Features. Only after Stage 3 is solid.
- **DEFERRED** — Known, not yet unblocked or not v1 scope.
- **DONE** — Completed and verified.

One task per session. Do not combine tasks.
Do not start a task without reading its listed spec files first.
Upload only the files needed for that task — nothing extra.

---

## STAGE 1 — Structural Fixes (Do In Order)

These are the foundation. Nothing built on top of them is trustworthy until they are done.

---

### S1-2: Flat Statements Array — Structural Refactor
**Why second:** The spec says statements are a flat array with ID references.
The code uses nested objects. This mismatch means the compiler, editor, and wizard
are all working against different assumptions. Fix this before touching any of them.
**Spec ref:** PISTON_FORMAT.md (statements section), DESIGN.md Section 6.1
**Upload:** wizard.js, editor.js, compiler.py
**What must change:**
- `wizard.js` — writes nested objects for if/for/while → must write flat array + ID refs
- `editor.js` — `_findNode`, `_removeNode`, `_insertAfter` recurse into nested children
  → must build ID lookup map and resolve by ID instead
- `compiler.py` — reads nested structure → must build lookup map from flat array,
  resolve child IDs before walking the tree

**Output:** All three files updated. Flat array is the only format in the codebase.

---

### S1-3: main.py Backend Audit (Audit Only, No Fixes Yet)
**Why third:** Before fixing anything in the backend, get a complete picture of
what is wrong. Fixing one thing at a time without the full list leads to
partial fixes and missed gaps.
**Spec ref:** DESIGN.md Sections 4, 15, 24, 26
**Upload:** main.py, api.py
**What to audit for:**
- BASE_URL injection missing (critical — breaks addon ingress)
- Companion stubs still present in deploy endpoint (must remove)
- Any piston_text parsing (must remove — not a v1 format)
- Statement JSON field names in save/validation logic (may still use old names)
- device_map handling — must store/return list format per PISTON_FORMAT.md
- Snapshot export — does it strip entity IDs correctly?
- Role mapping on import — is it implemented at all?
- WebSocket `/ws` endpoint — confirmed absent by external review, must be added
- duplicate/import API methods — missing, frontend calls them and gets errors

**Output:** A written audit list of every gap found. No code written this session.

---

### S1-4: main.py / api.py Backend Cleanup
**Why fourth:** Remove dead code and stubs before adding anything new. Clean slate
makes the HA write implementation in S1-5 easier to reason about.
**Spec ref:** DESIGN.md Sections 4, 24, 26
**Upload:** main.py, api.py, backend/README.md
**Fix in this order:**
1. Remove `_send_to_companion()` stub function from api.py entirely
2. Remove all companion references from api.py comments and docstrings
3. Remove companion references from backend/README.md
4. Remove any piston_text parsing
5. Fix statement field names in save/validation logic
6. Fix device_map handling — must store/return list format per PISTON_FORMAT.md
7. Add BASE_URL injection at page serve time
8. Add `/ws` WebSocket endpoint (basic — exists, stays connected, no logic yet)
9. Add duplicate/import API stubs that return a clean not-yet-implemented error
   instead of crashing the frontend

**Output:** Backend with no dead companion code, no piston_text references,
correct field names, and no crashing on known frontend calls.

---

### S1-5: HA Direct Write — Deploy Implementation
**Why fifth:** This is what the companion stub was supposed to do. Now we implement
it correctly using direct REST API calls from ha_client.py.
**Spec ref:** DESIGN.md Sections 22, 13, 16
**Upload:** ha_client.py, api.py
**What gets built:**
- Deploy endpoint calls compiler → gets YAML strings back
- Writes automation YAML to `<ha_config>/automations/pistoncore/pistoncore_{uuid}.yaml`
- Writes script YAML to `<ha_config>/scripts/pistoncore/pistoncore_{uuid}.yaml`
- Calls `POST /api/services/automation/reload` via HA REST
- Calls `POST /api/services/script/reload` via HA REST
- Catches reload failure — returns error to frontend, old version stays active
- File write uses token from config.json (Docker) or SUPERVISOR_TOKEN (addon)
- Every written file includes the signature header (DESIGN.md Section 13)

**Sequence:**
1. Compile piston → YAML strings in memory
2. yamllint check on strings before writing
3. Write files to HA config directories
4. Call reload endpoints
5. Return success or structured error per DESIGN.md Section 18

**Output:** A piston that actually deploys to HA. This is the first real end-to-end
deploy. Test it against a real HA instance before marking done.

---

## STAGE 2 — Connect the Seams

Once Stage 1 is done, the individual pieces are correct in isolation.
Stage 2 wires them together and verifies they talk to each other correctly.

---

### S2-1: HAClient Abstraction + HA API Externalization
**Spec ref:** DESIGN.md Sections 4, 15
**Upload:** ha_client.py, main.py
**What gets built:**
- `HAClient(auth_mode, token=None)` class
- Supervisor mode: reads `SUPERVISOR_TOKEN` env var
- Token mode: reads from `config.json` on volume
- All existing HA calls routed through HAClient — nothing calls HA directly anymore
- Externalize all HA REST endpoint URLs to `pistoncore-customize/ha_api/ha_YYYY.x/endpoints.json`
- No hardcoded HA URLs anywhere in Python after this session

---

### S2-2: device_map_meta — Wire Into Backend and Wizard
**Spec ref:** PISTON_FORMAT.md (device_map_meta), DESIGN.md Section 15.6
**Upload:** wizard.js, api.py
**What gets wired:**
- Wizard sets `device_map_meta` cardinality when a device role is created (single vs multi)
- Backend schema validation accepts and stores `device_map_meta`
- Snapshot export preserves `device_map_meta` (cardinality needed for role mapping on import)

---

### S2-3: Snapshot Export — Backend Implementation
**Spec ref:** DESIGN.md Sections 6.2, 6.5
**Upload:** api.py
**What gets built:**
- Export endpoint strips entity IDs from device_map (empty arrays)
- Preserves device_map_meta
- Clears piston ID for reassignment on import
- Returns valid Snapshot JSON per PISTON_FORMAT.md

---

### S2-4: Import Role Mapping Flow — Frontend + Backend
**Spec ref:** DESIGN.md Section 6.3, FRONTEND_SPEC.md (Import Dialog)
**Upload:** import dialog JS, api.py
**What gets built:**
- Import dialog detects empty device_map arrays → shows role mapping step
- One device picker per role, same component used throughout wizard
- Backend populates device_map and assigns new piston ID on import completion
- Role mapping step skipped entirely if device_map is already populated (Backup import)

---

### S2-5: HA Version Detection — Wire In
**Spec ref:** DESIGN.md Section 9
**Upload:** ha_client.py, main.py
**What gets built:**
- On every HA connect, call `GET /api/` and store detected HA version
- Display in settings/status area
- Version stored for compiler template selection
- Re-checked on every reconnect

---

## STAGE 3 — Round-Trip Verification

**This is the milestone.** When this session is done, the seams are locked and
work can split into focused single-file modules.

### S3-1: Smoke Test — Full Round-Trip on One Simple Piston
**This is a testing session, not a coding session.**
Build the simplest possible piston in the wizard:
- One trigger (time-based or device state change)
- One action (turn on a light)

Verify each step passes:
1. Wizard writes correct flat JSON ✓
2. Editor renders it correctly from that JSON ✓
3. Backend saves and returns it without corrupting any fields ✓
4. Compiler reads it and produces valid HA YAML ✓
5. Test Compile preview shows the YAML without errors ✓
6. Deploy writes to HA and reload succeeds ✓

**If any step fails:** That step becomes a new Stage 1 or Stage 2 task. Fix it and re-run.
**When all six steps pass:** Stage 3 is done. The seams are locked.

---

## STAGE 4 — Features (Only After Stage 3 Complete)

Once the round-trip works, each session below only needs its own listed files.
No need to load everything every time.

**Before starting any Stage 4 task, check MISSING_SPECS.md.** If the spec for
that feature is listed as missing, write the spec first — then code.

### S4-0: Write Missing Specs (as needed, before dependent tasks)
These spec-writing sessions should happen just before the task that needs them —
not all at once. Each is a dedicated spec-only session, no code written.

- **WebSocket message protocol** → write before S4-9 (run status reporting)
- **Settings page frontend spec** → write before settings page is built
- **Piston list folder management** → write before folder management is built
- **PyScript compiler spec** → write before any complex piston can deploy
- **Error states inventory** → write before Stage 4 UI work begins
- **Test strategy** → write before v1 ships

See MISSING_SPECS.md for full detail on what each spec must cover.

---

### S4-1: PyScript Detection and Setup Prompt
**Spec ref:** DESIGN.md Section 3.2
**Files needed:** ha_client.py, frontend PyScript indicator JS

### S4-2: Missing Device Handler
**Depends on:** S2-2 wired, D-1 HA behavior validated first
**Spec ref:** DESIGN.md Section 15.6, HA_LIMITATIONS.md Section 9
**Note:** Do not implement hard-flag logic until D-1 is tested.

### S4-3: Orphan Cleanup — Queue and Retry
**Spec ref:** DESIGN.md Section 16
**Files needed:** api.py

### S4-4: Compiler Template System — Jinja2 Scaffolding
**Depends on:** S1-1 COMPILER_SPEC.md updated, S1-2 flat array done
**Spec ref:** DESIGN.md Sections 9, 14
**Files needed:** compiler.py, template folder structure

### S4-5: Pre-Save Validation Pipeline
**Spec ref:** DESIGN.md Section 18
**Files needed:** compiler.py, api.py, validation-rules JSON

### S4-6: File Signature and Hash System
**Depends on:** Compiler producing output
**Spec ref:** DESIGN.md Section 13
**Files needed:** compiler.py

### S4-7: Test Compile / Preview Mode
**Depends on:** Compiler working
**Spec ref:** DESIGN.md Section 17
**Files needed:** api.py, status page JS

### S4-8: Global Variables — Stale Piston Tracking
**Spec ref:** DESIGN.md Section 7.1
**Files needed:** api.py, globals_index.json logic

### S4-9: Run Status Reporting — WebSocket Events
**Spec ref:** DESIGN.md Section 21
**Files needed:** main.py WebSocket handler, status page JS

### S4-10: Snapshot Import — AI Prompt Files
**Depends on:** S2-4 import flow tested end-to-end with real round-trip
**Spec ref:** DESIGN.md Section 31, AI_PROMPT_SPEC.md
**Do not write until:** Import tested, role mapping working, round-trip clean.

### S4-11: AI-REVIEW-PROMPT.md — Update
**Spec ref:** DESIGN.md Section 31
**Files needed:** AI-REVIEW-PROMPT.md only

---

## DEFERRED — Blocked on External Validation or Not v1 Scope

### D-1: HA Missing Entity Behavior — Must Test Before Coding
**Blocks:** S4-2 missing device hard-flag logic
**What to test:** Create a test automation referencing a known entity. Remove/rename it.
Reload. Does HA error and disable the automation? Skip silently? Behave differently
for trigger vs condition vs action? Error surfaced or silent?
**Results go in HA_LIMITATIONS.md Section 9.**

### D-2: Which-Interaction Step — Evaluate Feasibility First
**What to do:** Validate PyScript context tracking (`context.id`, `context.parent_id`)
in a real sandbox before building the wizard step.

### D-3: settings / end settings Block Contents
**What to do:** Research WebCoRE behavior. Define contents before implementing.

### D-4: Timer Statement — Evaluate Before Including
**What to do:** Evaluate overlap with HA scheduler. Decide if it belongs in v1.

### D-5: Sunrise/Sunset Negative Offset Edge Cases
**What to do:** Test in real HA before compiler handles these.

### D-6: Numeric Trigger Unknown State Behavior
**What to do:** Test in real HA before shipping numeric trigger compilation.

### D-7: Long-Running Piston Timeouts
**Status:** Known risk. Test before v1 release. No fix defined yet.

---

## DONE — Completed Sessions

### S1-1: COMPILER_SPEC.md — Rewrite ✅
Completed during Session 22 update work. Companion references removed, schema_version
replaced with logic_version/ui_version, target-boundary.json specced in Section 3,
fat compiler context object in Section 7, statement field names aligned.
Minor fix applied post-review: one-click convert button removed from Section 2 —
complexity indicator is read-only per DESIGN.md Section 3.1.

### Session 21 — Field Name Alignment Pass ✅
All old type names and field names replaced in wizard.js, editor.js, status.js,
compiler.py, api.js. Spec-correct names throughout.

### Session 22 — Share Format Decision ✅
piston_text retired as v1 share/AI format. Snapshot JSON is now the single
share/AI/community format. AI_PROMPT_SPEC.md created. DESIGN.md Sections 6.2–6.7
rewritten. FRONTEND_SPEC.md import dialog updated. Session prompt updated.

### Sessions 1–20 — See DESIGN.md Section 33 (Development Log) ✅

---

## Minor / Cosmetic (Do Anytime, Low Priority)

- STATEMENT_TYPES.md Section 16 — missing header line
- AI-UPDATE-GUIDE.md files for each customize volume folder (DESIGN.md Section 31):
  `templates/`, `ha_api/`, `compiler/`, `validation-rules/`

---

## Session Start Checklist

Before writing any code:
1. Read CLAUDE_SESSION_PROMPT.md
2. Read TASKS.md (this file)
3. Find the next incomplete task in the current Stage
4. Read only the spec files listed for that task
5. Upload only the code files listed for that task
6. Propose changes as text — get approval before writing to files

Before ending any session:
1. Update CLAUDE_SESSION_PROMPT.md — what was done this session
2. Update TASKS.md — mark task done, note any new gaps discovered
3. Confirm which task is next so the next session starts without guessing
