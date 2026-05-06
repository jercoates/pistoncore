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

### What Was Done This Session (Session 23)

Full backend audit of api.py against PISTON_FORMAT.md and the session prompt
known gaps list. Six bugs/gaps fixed across api.py, storage.py, and status.js.

**storage.py:**
- `updated_at` renamed to `modified_at` throughout — field name now matches
  PISTON_FORMAT.md spec

**api.py:**
- `list_pistons()` response key and docstring updated to `modified_at`
- `get_piston()` now refuses to load a piston whose `logic_version` or
  `ui_version` is ahead of the current supported version (409 with plain
  English message). Missing version fields treated as v1 per spec. Two
  module-level constants added: `CURRENT_LOGIC_VERSION = 1`,
  `CURRENT_UI_VERSION = 1` — bump these when versions change.
- `create_piston()` now applies all spec-required defaults for any fields
  the client omits: name, description, folder, mode, enabled, logic_version,
  ui_version, device_map, device_map_meta, variables, statements.
- `create_piston()` and `update_piston()` both strip `compile_target` from
  incoming body — compiler owns this field, never the user.
- `_mark_pistons_stale_for_global()` overbroad `or f"@" in piston_json`
  removed — was marking every piston stale on any global delete.

**status.js:**
- Snapshot export `_exportPiston()` fixed — was doing `delete copy.device_map`
  which dropped the whole object. Now zeroes each role's array
  (`device_map[role] = []`) and deletes `device_map_meta`. Role keys are
  preserved per spec so importers know what roles exist.

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

**COMPILER_SPEC.md — still flagged as stale**
Must be updated before any new compiler work begins.
Written against old architecture. Do not write compiler code against it.

### Priority 2 — Backend Gaps (audit findings, not yet implemented)

These were identified in the Session 23 audit. None are blocking but all
need to be resolved before v1 is solid.

**Snapshot export endpoint — missing**
No `/pistons/{id}/snapshot` backend endpoint exists. The frontend currently
does the Snapshot transform client-side in `_exportPiston()`. The spec calls
for the backend to own this — strip entity IDs, clear piston ID for
reassignment. Needs a dedicated endpoint.

**Import / role mapping endpoint — missing**
No import endpoint exists. `POST /pistons` just accepts raw JSON with no
role mapping step. The role mapping UI (user maps Snapshot roles to their
own devices on import) has no backend support. Needs spec review of
FRONTEND_SPEC.md import dialog section before coding.

**`device_map_meta` — not validated on save**
Field passes through passively if present but is never checked for presence
or correctness on `create_piston()` or `update_piston()`. The `create_piston()`
defaults fix from Session 23 initializes it as `{}` but does not validate
structure. Full validation (each role in `device_map` has a corresponding
`device_map_meta` entry with valid `cardinality`) still needed.

**Version fields — not validated on save**
`get_piston()` now guards against future versions on load. But `update_piston()`
does not prevent a client from writing a `logic_version` or `ui_version` that
is ahead of `CURRENT_LOGIC_VERSION` / `CURRENT_UI_VERSION`. Should strip or
reject out-of-range version fields on save.

### Priority 3 — Should Do Soon

**AI prompt files — write-a-piston.md and migrate-from-webcore.md**
Specced in AI_PROMPT_SPEC.md. Do not write the actual prompts until:
1. Snapshot JSON import flow is tested end-to-end in real PistonCore
2. Role mapping step works correctly in the import dialog
3. A test piston round-trips cleanly (wizard → JSON → export → import → editor)

**PISTON_FORMAT.md — device_map_meta field**
Added in Session 19. Needs to be:
- Added to backend piston schema validation
- Set by wizard on device role creation
- Read by missing-device handler (DESIGN.md Section 15.6)
- Preserved in Snapshot export (cardinality info is needed on import)
  Note: Snapshot export now correctly preserves device_map keys with empty
  arrays — device_map_meta is stripped on Snapshot (not needed by importer
  since cardinality is implied by role structure, not entity count).

### Priority 4 — Deferred (Known, Not Blocking)

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
- `update_piston()` version field validation — prevent client writing
  future logic_version/ui_version values

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
- compile_target is stripped from all client input on create and update —
  compiler sets it, user never does
- Missing version fields on load treated as v1 (safe default per spec)
- Future version fields on load → 409 error, plain English message, refuse to open

---

## Known Code vs Spec Gaps (Post Session 23)

**Structural (not yet fixed):**
- Flat statements array not implemented — code still uses nested objects
- editor.js tree walking functions assume nested model
- wizard.js writes nested objects for control flow blocks
- compiler.py reads nested structure

**Backend gaps (identified Session 23, not yet fixed):**
- No Snapshot export backend endpoint
- No import / role mapping endpoint
- device_map_meta not validated on save
- update_piston() does not reject future version field values

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
