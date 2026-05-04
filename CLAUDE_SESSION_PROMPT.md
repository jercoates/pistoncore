# PistonCore — Claude Session Prompt

**Project:** PistonCore — open-source WebCoRE-style visual automation builder for Home Assistant
**Repo:** github.com/jercoates/pistoncore
**Stack:** Python/FastAPI backend, Vanilla JS/HTML/CSS frontend, no framework
**Deploy:** Docker container (Unraid) — port 7777

---

## How to Start Every Session

1. Read this file completely before saying anything
2. Ask Jeremy to upload the relevant spec files for what we're working on today
3. Read every uploaded file before writing any code or making any spec changes
4. Show proposed changes as text first — get approval before writing to files
5. Never remove existing spec content without explicit approval
6. Never write code that conflicts with the specs — specs are the authority

---

## Project Status — Session 19 Complete

### What Was Done This Session (Session 19)

All spec work. No code was written. Significant gaps were closed.

**Files updated:**
- `DESIGN.md` — three additions:
  - Compile target ownership rule (Section 3.1) — compiler always owns it, never user
  - Missing device rule split (Section 15.6) — single-device = hard flag/block redeploy, multi-device = degrade gracefully. HA behavior validation required before implementation.
  - Global Variable Model summary (Section 7.1) — device globals compile-time, non-device globals as HA helpers, edge cases to PyScript
- `COMPILER_SPEC.md` — five additions from Gemini research:
  - Boolean/state value quoting rule (Section 11) — always quote `"on"`, `"off"` etc.
  - `wait_for_trigger` timeout always required (Section 10.2) — default 1 hour, CompilerWarning
  - `trigger:` vs `platform:` inside wait_for_trigger (Section 10.2)
  - `continue_on_error` on parallel branches (Section 10.2)
  - Trigger `id:` field required on every compiled trigger (Section 9.3)
- `HA_LIMITATIONS.md` — Section 8 updated with all four new items marked as handled; Section 9 updated with HA missing-device behavior validation item
- `FRONTEND_SPEC.md` — three additions at top:
  - AST/pure projection invariant (hard rule — no exceptions)
  - `wizard_context` retirement notice
  - AI Import dialog full spec
- `PISTON_FORMAT.md` — NEW FILE created. Canonical piston JSON schema. Includes wrapper fields, device_map with cardinality meta, variables, statements, condition object, operand/value schema, complete minimal example.

**Files confirmed good (no changes needed):**
- `STATEMENT_TYPES.md` — reviewed and confirmed complete. Minor fix queued: Section 16 `log_message` is missing its `## 16. log_message` header line. Content is correct, just the header was dropped.
- `HA_LIMITATIONS.md` — living document, add to it whenever new HA limitations found
- `write-a-piston.md` — confirmed current and correct

---

## What Still Needs to Be Done

### Priority 1 — Must Do Before Any Coding

**WIZARD_SPEC.md cleanup**
The wizard spec still references old model concepts in places. Now that STATEMENT_TYPES.md
exists, go through WIZARD_SPEC.md and:
- Verify wizard output JSON matches STATEMENT_TYPES.md schemas exactly
- Remove any references to `wizard_context`
- Confirm the operator list matches STATEMENT_TYPES.md condition object operators
- Add explicit note: wizard writes structured JSON, never piston_text
Upload WIZARD_SPEC.md at the start of next session for this work.

**Code audit — all existing code written against old model**
Upload all current code files (app.js, main.py, editor JS, wizard JS, compiler.py)
and audit against the updated specs:
- BASE_URL injection in main.py (critical — blocks addon ingress)
- Companion stubs in deploy endpoint (remove)
- wizard_context references (remove)
- Any `piston_text` parsing outside of AI Import
- Statement JSON field names vs spec (service_call vs with_block, entity_id vs role,
  trigger operator format vs compiler type format)
- Binary sensor compiled_value lookup in wizard
- if_condition context block-id handling in editor insertStatement

### Priority 2 — Should Do Soon

**Snapshot export decision**
Not yet resolved. Two options:
- Option A: Backend gets Python render functions (clean separation, some duplication)
- Option B: Export goes through a frontend render step before sending to backend
Decision needed before export/import feature is coded.

**PISTON_FORMAT.md — device_map_meta field**
New field added this session: `device_map_meta` with `cardinality: "single" | "multi"`.
This field needs to be:
- Added to backend piston schema validation
- Set by wizard on device role creation
- Read by missing-device handler (DESIGN.md Section 15.6)
Confirm this field is handled in wizard and backend code during audit.

### Priority 3 — Deferred (Known, Not Blocking)

- STATEMENT_TYPES.md Section 16 header fix (cosmetic, queue for repo push)
- WebSocket drop during wizard — not yet handled in spec
- Ghost text recalculation after mutations — not fully specced
- Validation error contract between compiler and UI — partial
- Orphaned file cleanup — specced in DESIGN.md but not coded
- Compiler testing strategy — no test suite defined yet
- PyScript compiler — separate spec needed, not started
- HA missing-device behavior validation — must test in real HA before coding hard-flag logic

---

## Key Design Decisions — Locked, Do Not Relitigate

- Compile target always compiler-owned, never user-controlled
- Wizard writes structured JSON only — never piston_text
- Editor renders from structured JSON only — never stores or reads display text
- piston_text is output only — only parsed in AI Import dialog
- Device globals baked at compile time (no runtime lookup)
- Non-device globals as HA input helpers
- Frontend never calls HA directly — always through backend
- BASE_URL required on every connection — no hardcoded paths
- UUID-based file naming — never slug-based
- execute/end execute are rendering artifacts — not data nodes in JSON
- Single-device missing = hard flag, block redeploy (pending HA behavior validation)
- Multi-device missing = degrade gracefully on remaining devices
- wizard_context is retired — does not exist

---

## Spec File Authority Order

When specs conflict, this is the resolution order:
1. DESIGN.md — philosophy and architecture decisions
2. PISTON_FORMAT.md — canonical data format (NEW — Session 19)
3. STATEMENT_TYPES.md — statement-level schemas and render output
4. COMPILER_SPEC.md — compiler behavior
5. FRONTEND_SPEC.md — frontend behavior
6. WIZARD_SPEC.md — wizard behavior
7. HA_LIMITATIONS.md — known HA gotchas

---

## Deploy Commands (Jeremy's Unraid Setup)

```bash
cd /mnt/user/appdata/pistoncore-dev
git pull
docker build -t pistoncore .
docker stop pistoncore && docker rm pistoncore
docker run -d \
  --name pistoncore \
  --restart unless-stopped \
  -p 7777:7777 \
  -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata \
  -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize \
  pistoncore
```

---

## Communication Style

Jeremy works two jobs and codes in limited sessions. He has no formal programming
background. Direct and concise. Plain language over technical jargon. Show proposed
changes as text before writing files. Humor is welcome.

When something is unclear, ask one question — not five.
