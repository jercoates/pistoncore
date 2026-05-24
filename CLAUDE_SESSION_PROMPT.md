# PistonCore — Claude Session Prompt

## What is PistonCore?
Open-source WebCoRE-style visual automation builder for Home Assistant.
GitHub: github.com/jercoates/pistoncore
Stack: Python/FastAPI backend, vanilla JS/HTML/CSS frontend, Jinja2 templates,
SQLite/JSON storage, Docker on Unraid at port 7777.
Jeremy has no formal programming background — relies entirely on Claude for
architecture and code. Never does targeted/line-level edits — only full file replacements.

## Non-Negotiable Rules
- Specs before code. Read all listed files before writing anything.
- All problems logged in TASKS.md with GAP-SXX-N format.
- No HA YAML emitted inline in Python — always through Jinja2 templates.
- Session boundaries kept clean. Context usage monitored deliberately.
- Every gap created must be assigned to a future session before session closes.
- Do not write any file until all necessary files for that task have been read.
- One task per session. Do not combine tasks.
- Do not write code in a spec session. Specs only.
- Do not write code without permission. Do not omit this line when writing a new prompt again.
- Never mark a section as SUPERSEDED and leave the stale content. Either rewrite it correctly or delete it. A warning label on wrong information is not a fix — it is still wrong information.
- All specs must be complete before any coding session starts. No exceptions. Missing specs always bite harder than the tokens cost to write them.

## Deploy Command (Unraid)
```
cd /mnt/user/appdata/pistoncore-dev && git pull && docker build --no-cache -t pistoncore . && docker stop pistoncore && docker rm pistoncore && docker run -d --name pistoncore --restart unless-stopped -p 7777:7777 -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize pistoncore
```

## Current Priority — Session 59: D-S4 (Remaining Spec Completion)

**This is a spec-only session. No code.**
Complete all remaining unspecced items before any coding session starts.

### Upload for Session 59:
DESIGN.md, FRONTEND_SPEC.md, WIZARD_SPEC.md, COMPILER_SPEC.md,
PISTON_FORMAT.md, STATEMENT_TYPES.md, MISSING_SPECS.md,
CLAUDE_SESSION_PROMPT.md, TASKS.md

### What to do this session (in order):

**Step 1 — Close housekeeping gaps (small, do first)**
- GAP-S57-7: Add duplicate role name note to DESIGN.md Section 6.11
  (same role name on import = same entity_ids on all matching nodes — intentional)
- GAP-S57-6/15/16/17: Mark closed in TASKS.md (already done in FRONTEND_SPEC.md v1.1)

**Step 2 — GAP-S57-8: SAMPLE_PISTONS.md**
Create a new file with 3 complete logic_version 2 piston examples:
- Simple: single trigger, single action (door opens → light on)
- Multi-device: multi-entity trigger with aggregation, multi-entity action
- Global variable: uses a global Devices variable, for_each loop
All examples must be valid against PISTON_FORMAT.md v2.2 and STATEMENT_TYPES.md v2.1.

**Step 3 — MISSING_SPECS Item 24: Global device edit redeploy prompt UX**
Full UX spec for the permission prompt, progress modal, banner, and stale flag
lifecycle. Covers all edge cases (never-deployed pistons, disabled pistons,
merged stale flags, HA disconnected during redeploy, revert detection).
Write into DESIGN.md Section 7.1 (expand the existing summary) or a new subsection.

**Step 4 — Error states inventory**
Every error the backend can return and how the frontend displays it.
Covers: compile errors, deploy errors, HA connection errors, missing entity,
YAML validation failure, file permission errors, piston not found, etc.
Write into FRONTEND_SPEC.md as a new section.

**Step 5 — Piston list UI states**
Every combination of piston row state:
deployed+healthy, deployed+entity_missing, deployed+manually_edited,
deployed+stale_globals, orphaned, never deployed, disabled, currently running.
What icon/color/text shows for each. Write into FRONTEND_SPEC.md.

**Step 6 — Status page full layout**
Complete spec for the piston status page: layout, sections, run log display,
compile preview panel, test button flow, deploy button states.
Write into FRONTEND_SPEC.md.

**Step 7 — MISSING_SPECS Items 2-6, 10-12, 14, 19, 20**
Work through each remaining open MISSING_SPECS item and write the spec
directly into the appropriate document. Do not leave items as "MISSING" —
write the actual spec.

**Step 8 — HA_LIMITATIONS.md Section 3**
Rewrite Section 3 to remove device_map and has_missing_devices references.
Use the entity validation model from DESIGN.md Section 9.2.

**Step 9 — AI_PROMPT_SPEC.md**
Rewrite entirely for logic_version 2. Remove all device_map/device_map_meta
references. New model: entity_ids on nodes, role labels as placeholders,
Snapshot format per DESIGN.md Section 6.10/6.11. This is GAP-S57-3.

---

## Architecture — Locked Decisions
- Nested tree model: children embedded directly, no ID references
- All HA YAML through Jinja2 templates only
- HACS companion eliminated — direct HA REST/WebSocket API
- Native HA Script as primary compile target (~95%), PyScript fallback
- Context_builder.py for fat compiler context assembly
- Piston identity via UUID throughout
- Editor must render from JSON correctly 100% of the time
- **device_map ELIMINATED** — entity_ids stored directly on condition, action, and for_each nodes
- **entity_ids validated against live HA on every compile**
- **entity_ids captured from live HA device picker at wizard commit time — never at runtime**

## Device Data Model — Locked Decision (Session 55)
- Condition nodes: role (display label) + entity_ids (real HA entity ID array)
- Action nodes: role (display label) + entity_ids (real HA entity ID array)
- for_each nodes: role (display label) + entity_ids (real HA entity ID array)
- Piston variable type `devices`: default_value = { role, entity_ids }
- No device_map at piston wrapper level anywhere
- Compiler reads entity_ids directly — no role lookup needed
- On compile: backend validates every entity_id against live HA entity states
- Missing entity → MISSING_ENTITY compiler error with clear user message
- User fixes in editor, recompiles

## Multi-Entity Compilation — Confirmed HA Native (Session 57)
- **Triggers:** pass entity_ids array directly — one trigger block, HA fires on any match
- **Actions:** pass entity_ids array directly to target.entity_id — one action block
- **Conditions:** Jinja2 any()/all()/none() template — no native multi-entity support
- **PyScript actions:** Python list `entity_id=[...]` — same behavior as YAML array
- **PyScript triggers:** one @state_trigger string per entity (OR'd by PyScript)
- Never expand multi-entity into multiple blocks in native HA script

## Wizard Architecture (Post-Split)
Files: wizard-core.js, wizard-statement.js, wizard-condition.js,
wizard-action.js, wizard-variable.js, wizard-loops.js
All functions top-level (no IIFE wrapping). Shared state via WizardCore object.

## Key State — What's Done
- Nested tree migration complete (Session 35)
- Editor.js nested tree rendering complete (Session 36)
- Wizard split complete (Session 46)
- Globals backend G-1 (Session 48), frontend G-2 (Session 49), CSS G-2b (Session 50)
- Vertical structure lines (Session 47)
- insertStatement condition fallthrough fixed (Session 53)
- _replaceCondition, _removeConditionNode added to editor.js (Session 53)
- wizard-condition.js _loadCapsIntoSelect now uses real API.getCapabilities (Session 54)
- _buildConditionNode writes flat format with entity_ids (Session 54)
- wizard-action.js stale sel reset fixed, demo _renderCmdParams fixed (Session 54)
- _condLine flat format + null value_to fixed in editor.js (Session 54)
- **SPEC REWRITE COMPLETE (Session 55):** PISTON_FORMAT.md v2.1, COMPILER_SPEC.md v1.2,
  WIZARD_SPEC.md v2.0. device_map eliminated. entity_ids on nodes. MISSING_ENTITY defined.
- **DESIGN.md UPDATED (Session 56):** v1.2 — Architecture Pivot section added,
  superseded sections marked, fat compiler context corrected, has_missing_devices retired.
- **FULL SPEC AUDIT (Session 57):** All spec files updated to logic_version 2 model.
- **D-S3 COMPLETE (Session 58):** DESIGN.md v1.3 fully cleaned — no active stale refs.
  FRONTEND_SPEC.md v1.1 — Import dialog, role labels, aggregation, validation feedback,
  global visual distinction, corrupt loading, copy/paste, WebSocket protocol, Settings page.
  WIZARD_SPEC.md v2.2 — multi-device spec complete (GAP-S57-10 through S57-14).
  MISSING_SPECS Items 7/8 rewritten. Items 22/23 resolved. Items 25/26/27 added.
  reference/README.md created. Grep sweep clean (GAP-S57-9).

## Frontend File Locations
- frontend/js/ — all JS files
- frontend/css/style.css — all CSS

## WARNING — /reference folder
Do NOT read any file in /reference. Those are archived session artifacts.
See reference/README.md. All authoritative specs are in the repo root.

## Open Gaps (as of Session 58)

**Still needs spec work (D-S4):**
- GAP-S57-3 → D-S4: AI_PROMPT_SPEC.md rewrite (device_map model, fully stale)
- GAP-S57-7 → D-S4: DESIGN.md Section 6.11 duplicate role name note (small)
- GAP-S57-8 → D-S4: SAMPLE_PISTONS.md missing (blocks AI prompt + compiler testing)
- GAP-S58-3 → D-S4: Piston backup spec (MISSING_SPECS Item 27 summary exists, needs full spec in FRONTEND_SPEC.md)
- MISSING_SPECS Items 2-6, 10-12, 14, 19, 20 — all still open, write specs directly
- Error states inventory — not specced
- Piston list UI row states — not specced
- Status page full layout — not specced
- MISSING_SPECS Item 24 — global device edit redeploy prompt UX detail

**Coding gaps (after D-S4):**
- GAP-S57-5 → G-4: Global device edit redeploy prompt (blocked on Item 24 spec)
- GAP-S52-2/3/4, GAP-S53-2/3/4/5, GAP-S44-1 → W-S8
- compiler.py entity_ids direct read + MISSING_ENTITY → B-1
- GAP-S46-4 → G-3

## Spec File Versions (as of Session 58)
- DESIGN.md v1.3
- PISTON_FORMAT.md v2.2
- COMPILER_SPEC.md v1.3
- PYSCRIPT_COMPILER_SPEC.md v1.1
- WIZARD_SPEC.md v2.2
- STATEMENT_TYPES.md v2.1
- FRONTEND_SPEC.md v1.1
- MISSING_SPECS.md — Items 1,9,13,17,18,21,22,23 resolved; Items 2-8,10-12,14-16,19-20,24-27 open
- AI_PROMPT_SPEC.md — STALE, needs full rewrite (GAP-S57-3)
- HA_LIMITATIONS.md — Section 3 still stale (device_map references)
