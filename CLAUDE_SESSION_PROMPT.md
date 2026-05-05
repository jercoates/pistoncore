# PistonCore — Claude Session Prompt

**Project:** PistonCore — open-source WebCoRE-style visual automation builder for Home Assistant
**Repo:** github.com/jercoates/pistoncore
**Stack:** Python/FastAPI backend, Vanilla JS/HTML/CSS frontend, no framework
**Deploy:** Docker container (Unraid) — port 7777

---

## How to Start Every Session

1. Read this file completely before saying anything
2. Ask Jeremy to upload the relevant spec files and code files for what we're working on today
3. Read every uploaded file before writing any code or making any spec changes
4. Show proposed changes as text first — get approval before writing to files
5. Never remove existing spec content without explicit approval
6. Never write code that conflicts with the specs — specs are the authority

---

## Project Status — Session 22 Complete

### What Was Done This Session (Session 22)

Two things: completed the code field name alignment pass started in Session 21,
and made a major share format architecture decision.

**Code alignment pass — completed:**
All old type names and field names eliminated from wizard.js, editor.js,
status.js, compiler.py, api.js. Every file now uses spec-correct names.
See Session 21 commit for the full change list.

**Share format decision — piston_text retired:**
piston_text is no longer the v1 share/AI format. Snapshot JSON (structured
JSON with empty device_map arrays) is now the single share format for
community sharing, AI generation, and WebCoRE migration. piston_text deferred
to v2 or dropped entirely.

**Files updated:**
- `DESIGN.md` — Sections 6.2–6.7 rewritten, dev log updated through Session 22
- `FRONTEND_SPEC.md` — Import dialog rewritten, piston_text parser removed,
  role mapping step specced with UI mockup
- `AI_PROMPT_SPEC.md` — NEW FILE. Specifies requirements for both AI prompt
  files before they are written. Includes WebCoRE → PistonCore mapping table
  and test criteria.

---

## What Still Needs to Be Done

### Priority 1 — Must Do Before Any Coding

**Flat statements array — structural change not yet implemented**
The spec (PISTON_FORMAT.md) defines statements as a flat array with child
statements referenced by ID:
  `"then": ["stmt_004", "stmt_005"]`

The code still uses nested objects:
  `"then": [{ "id": "stmt_004", "type": "if", ... }]`

The field names were fixed in Session 21 but the nested tree architecture
is still in place. This affects editor.js (_findNode, _removeNode,
_insertAfter all recurse into nested children), wizard.js (writes nested
objects for if/for/while blocks), and compiler.py (reads nested structure).

This is a significant structural change that touches every part of the
stack simultaneously. Needs its own dedicated session. Do not attempt
alongside other work.

**main.py backend audit**
The backend has not been audited against the updated specs. Known issues:
- BASE_URL injection (critical — blocks addon ingress)
- Companion stubs in deploy endpoint (remove)
- Any piston_text parsing (remove — piston_text is not v1)
- Statement JSON field names in validation/save logic
- device_map handling — does it store/return list format per spec?
- Snapshot export — does it strip entity IDs correctly?
- Role mapping on import — is it implemented?

Upload main.py at the start of next session for this audit.

**COMPILER_SPEC.md — still flagged as stale**
Must be updated before any new compiler work begins.
Written against old architecture. Do not write compiler code against it.

### Priority 2 — Should Do Soon

**AI prompt files — write-a-piston.md and migrate-from-webcore.md**
Specced in AI_PROMPT_SPEC.md. Do not write the actual prompts until:
1. Snapshot JSON import flow is tested end-to-end in real PistonCore
2. Role mapping step works correctly in the import dialog
3. A test piston round-trips cleanly (wizard → JSON → export → import → editor)

**Snapshot export decision — now resolved**
Snapshot export strips entity IDs from device_map (empty arrays) and clears
the piston ID for reassignment. This is the same as the current Snapshot
export behavior — no parser needed. The backend export endpoint just needs
to implement this correctly.

**PISTON_FORMAT.md — device_map_meta field**
Added in Session 19. Needs to be:
- Added to backend piston schema validation
- Set by wizard on device role creation
- Read by missing-device handler (DESIGN.md Section 15.6)
- Preserved in Snapshot export (cardinality info is needed on import)

### Priority 3 — Deferred (Known, Not Blocking)

- STATEMENT_TYPES.md Section 16 header fix (cosmetic)
- WebSocket drop during wizard — not yet handled in spec
- Ghost text recalculation after mutations — not fully specced
- Validation error contract between compiler and UI — partial
- Orphaned file cleanup — specced in DESIGN.md but not coded
- Compiler testing strategy — no test suite defined yet
- PyScript compiler — separate spec needed, not started
- HA missing-device behavior validation — must test in real HA
- AI Help modal — second tab for WebCoRE migration (FRONTEND_SPEC.md
  AI Help Modal section needs updating when modal is built)
- Prompt versioning — how outdated cached prompts are detected

---

## Key Design Decisions — Locked, Do Not Relitigate

- Compile target always compiler-owned, never user-controlled
- Wizard writes structured JSON only — never piston_text
- Editor renders from structured JSON only — never stores or reads display text
- piston_text is NOT a v1 format — retired, deferred to v2
- Snapshot JSON is the single share/AI/community format — structured JSON
  with empty device_map arrays and role name placeholders
- AI prompts target Snapshot JSON output — no text parsing on import
- Device globals baked at compile time (no runtime lookup)
- Non-device globals as HA input helpers
- Frontend never calls HA directly — always through backend
- BASE_URL required on every connection — no hardcoded paths
- UUID-based file naming — never slug-based
- execute/end execute are rendering artifacts — not data nodes in JSON
- Single-device missing = hard flag, block redeploy (pending HA behavior validation)
- Multi-device missing = degrade gracefully on remaining devices
- wizard_context is retired — does not exist
- Condition object: flat format with `role` at top level (not nested subject object)
- device_map values are always arrays, even for single-device roles
- Statement IDs: `stmt_` + 8 char lowercase hex
- Statements array is FLAT per spec — child references by ID (not yet
  implemented in code — this is Priority 1 structural work)

---

## Known Code vs Spec Gaps (Post Session 21 Audit)

**Structural (not yet fixed):**
- Flat statements array not implemented — code still uses nested objects
- editor.js tree walking functions assume nested model
- wizard.js writes nested objects for control flow blocks
- compiler.py reads nested structure

**Likely gaps in main.py (not yet audited):**
- BASE_URL injection
- Companion stubs
- piston_text references
- device_map list format
- Snapshot export implementation
- Role mapping on import

**Minor (low priority):**
- STATEMENT_TYPES.md Section 16 missing header line

---

## Spec File Authority Order

When specs conflict, this is the resolution order:
1. DESIGN.md — philosophy and architecture decisions
2. PISTON_FORMAT.md — canonical data format
3. STATEMENT_TYPES.md — statement-level schemas and render output
4. COMPILER_SPEC.md — compiler behavior (flagged stale — update before compiler work)
5. FRONTEND_SPEC.md — frontend behavior
6. WIZARD_SPEC.md — wizard behavior
7. HA_LIMITATIONS.md — known HA gotchas
8. AI_PROMPT_SPEC.md — AI prompt file requirements

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

Jeremy works two jobs and codes in limited sessions. He has no formal
programming background. Direct and concise. Plain language over technical
jargon. Show proposed changes as text before writing files. Humor is welcome.

When something is unclear, ask one question — not five.