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

## Project Status — Session 23 Complete

### What Was Done in Session 22

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

## What Was Done in Session 23 (Current)

- TASKS.md created — all work organized into Stage 1 through Stage 4 with
  round-trip verification as the milestone goal
- COMPILER_SPEC.md reviewed — confirmed already updated, no companion refs,
  correct field names, target-boundary.json specced. One fix: removed one-click
  convert button reference from Section 2 (read-only indicator per DESIGN.md 3.1)
- S1-1 marked done
- Companion stub identified in api.py (_send_to_companion) and backend/README.md
  via external Grok review — added to S1-4 cleanup task
- HA direct write implementation added as S1-5 — replaces companion stub with
  real REST API deploy flow (write YAML files → call automation.reload + script.reload)

---

## What Still Needs to Be Done

All work is now tracked in TASKS.md. Read that file at the start of every session.
This section is a brief summary only — TASKS.md is the authority.

**Overall goal:** Clean round-trip on one simple piston before any feature work.
wizard → JSON → backend → compiler → frontend renders → HA deploy succeeds.

### Stage 1 — Structural Fixes (current stage, do in order)

- **S1-2:** Flat statements array refactor — wizard.js, editor.js, compiler.py
  all still use nested objects. Must be converted to flat array + ID references
  per PISTON_FORMAT.md. Upload all three files. Dedicated session.
- **S1-3:** Backend audit — upload main.py and api.py, produce written gap list.
  No code written this session.
- **S1-4:** Backend cleanup — remove _send_to_companion() stub, remove all
  companion references from api.py and backend/README.md, remove piston_text
  parsing, fix field names, fix device_map list format, add BASE_URL injection,
  add basic /ws endpoint, fix crashing API stubs.
- **S1-5:** HA direct write — implement real deploy flow replacing the companion
  stub. Write YAML files to HA config dirs via REST API, call automation.reload
  and script.reload, handle reload failure gracefully.

### Stage 2 — Connect the Seams

HAClient abstraction, device_map_meta wiring, Snapshot export, import role
mapping flow, HA version detection. See TASKS.md for full detail.

### Stage 3 — Round-Trip Smoke Test

One testing session. Build one simple piston, walk it all the way through.
When it passes, work splits into focused single-file module sessions.

### Stage 4 — Features

Everything else. Each session needs only its own listed files. See TASKS.md.

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

## Known Code vs Spec Gaps (Post Session 23)

**Structural (S1-2 — not yet fixed):**
- Flat statements array not implemented — code still uses nested objects
- editor.js tree walking functions assume nested model
- wizard.js writes nested objects for control flow blocks
- compiler.py reads nested structure

**Backend cleanup (S1-4 — not yet done):**
- _send_to_companion() stub still in api.py — must be removed
- Companion references still in api.py comments and backend/README.md
- BASE_URL injection missing
- piston_text references may exist
- device_map list format handling unverified
- Snapshot export not yet correctly implemented
- Role mapping on import not yet implemented
- /ws WebSocket endpoint absent (confirmed by external review)
- duplicate/import API methods missing — frontend calls crash

**Deploy (S1-5 — not yet implemented):**
- No real HA file write exists — companion stub was placeholder
- automation.reload and script.reload not yet called from deploy endpoint

**Minor (low priority):**
- STATEMENT_TYPES.md Section 16 missing header line

---

## Spec File Authority Order

When specs conflict, this is the resolution order:
1. DESIGN.md — philosophy and architecture decisions
2. PISTON_FORMAT.md — canonical data format
3. STATEMENT_TYPES.md — statement-level schemas and render output
4. COMPILER_SPEC.md — compiler behavior (updated Session 23 — current)
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