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
- Do not write code without permission.
- Never mark a section as SUPERSEDED and leave the stale content. Either rewrite it correctly or delete it.
- All specs must be complete before any coding session starts. No exceptions.

## Deploy Command (Unraid)
```
cd /mnt/user/appdata/pistoncore-dev && git pull && docker build --no-cache -t pistoncore . && docker stop pistoncore && docker rm pistoncore && docker run -d --name pistoncore --restart unless-stopped -p 7777:7777 -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize pistoncore
```

## WARNING — /reference folder
Do NOT read any file in /reference. Those are archived session artifacts.
See reference/README.md. All authoritative specs are in the repo root.

## Completed Sessions
See TASKS_HISTORY.md for full archive. Do not read unless tracing a historical decision.

---

## Current Priority — D-S4 continuation (Steps 3–9 remaining)

**This is a spec-only session. No code.**
Steps 1 and 2 completed in Session 59. Steps 3–9 remain.

### Upload for D-S4 continuation:
DESIGN.md, FRONTEND_SPEC.md, WIZARD_SPEC.md, COMPILER_SPEC.md,
PISTON_FORMAT.md, STATEMENT_TYPES.md, MISSING_SPECS.md,
CLAUDE_SESSION_PROMPT.md, TASKS.md

### What was done in Session 59 (D-S4 Steps 1–2):
- GAP-S57-7/6/15/16/17: Confirmed closed in Session 58. No action needed.
- PISTON_FORMAT.md: confirmed at v2.1 (session prompt previously said v2.2 — corrected).
- COMPILER_SPEC.md line 8: stale "Read DESIGN.md v1.1" — fix to v1.3 when next editing.
- MISSING_SPECS.md Items 7/8: still written as MISSING in body — move to DONE section.
- SAMPLE_PISTONS.md: created with 3 logic_version 2 examples (GAP-S57-8 CLOSED).
- TASKS_HISTORY.md: created (completed sessions archived from TASKS.md).
- TASKS.md: cleaned and tightened.
- CLAUDE_SESSION_PROMPT.md: this file.

### Remaining steps (D-S4 Steps 3–9):

**Step 3 — MISSING_SPECS Item 24: Global device edit redeploy prompt UX**
Full UX spec — permission prompt, progress modal, banner, stale flag lifecycle.
Edge cases: never-deployed pistons, disabled pistons, merged stale flags,
HA disconnected during redeploy, revert detection.
Write into DESIGN.md Section 7.1 (expand existing summary).
**Blocks G-4.**

**Step 4 — Error states inventory (MISSING_SPECS Item 5)**
Every backend error + frontend display. Compile errors, deploy errors, HA connection
errors, missing entity, YAML validation failure, file permissions, piston not found.
Write into FRONTEND_SPEC.md as a new section.

**Step 5 — Piston list UI row states**
Every combination: deployed+healthy, deployed+entity_missing, deployed+manually_edited,
deployed+stale_globals, orphaned, never deployed, disabled, currently running.
Icon/color/text for each. Write into FRONTEND_SPEC.md.

**Step 6 — Status page full layout**
Complete spec: layout, sections, run log display, compile preview panel,
test button flow, deploy button states. Write into FRONTEND_SPEC.md.

**Step 7 — MISSING_SPECS Items 2-6, 10-12, 14, 19, 20**
Write each spec directly into the appropriate document. Do not leave as MISSING.

**Step 8 — HA_LIMITATIONS.md Section 3**
Rewrite to remove device_map and has_missing_devices references.
Use entity validation model from DESIGN.md Section 9.2.

**Step 9 — AI_PROMPT_SPEC.md (GAP-S57-3)**
Rewrite entirely for logic_version 2. No device_map references. New model:
entity_ids on nodes, role labels as placeholders, Snapshot format per
DESIGN.md Sections 6.10/6.11.

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

## Device Data Model — Locked (Session 55)
- Condition nodes: role (display label) + entity_ids (real HA entity ID array)
- Action nodes: role (display label) + entity_ids (real HA entity ID array)
- for_each nodes: role (display label) + entity_ids (real HA entity ID array)
- Piston variable type `devices`: default_value = { role, entity_ids }
- No device_map at piston wrapper level
- Compiler reads entity_ids directly — no role lookup needed
- On compile: backend validates every entity_id against live HA entity states
- Missing entity → MISSING_ENTITY compiler error with clear user message

## Multi-Entity Compilation — Confirmed HA Native (Session 57)
- **Triggers:** pass entity_ids array directly — one trigger block, HA fires on any match
- **Actions:** pass entity_ids array directly to target.entity_id — one action block
- **Conditions:** Jinja2 any()/all()/none() template — no native multi-entity support
- **PyScript actions:** Python list `entity_id=[...]`
- **PyScript triggers:** one @state_trigger string per entity (OR'd by PyScript)
- Never expand multi-entity into multiple blocks

## Wizard Architecture (Post-Split)
Files: wizard-core.js, wizard-statement.js, wizard-condition.js,
wizard-action.js, wizard-variable.js, wizard-loops.js
All functions top-level (no IIFE wrapping). Shared state via WizardCore object.

## Frontend File Locations
- frontend/js/ — all JS files
- frontend/css/style.css — all CSS

---

## Key State — What's Done
- Nested tree migration complete (Session 35)
- Editor.js nested tree rendering complete (Session 36)
- Wizard split complete (Session 46)
- Globals backend G-1 (Session 48), frontend G-2 (Session 49), CSS G-2b (Session 50)
- Vertical structure lines (Session 47)
- insertStatement condition fallthrough fixed (Session 53)
- wizard-condition.js _loadCapsIntoSelect uses real API.getCapabilities (Session 54)
- wizard-action.js stale sel reset fixed (Session 54)
- SPEC REWRITE COMPLETE (Session 55): device_map eliminated, entity_ids on nodes
- DESIGN.md updated (Session 56): v1.2 architecture pivot
- FULL SPEC AUDIT (Session 57): all spec files updated to logic_version 2
- D-S3 COMPLETE (Session 58): DESIGN.md v1.3, FRONTEND_SPEC.md v1.1, WIZARD_SPEC.md v2.2
- D-S4 Steps 1–2 COMPLETE (Session 59): SAMPLE_PISTONS.md created, TASKS.md cleaned

---

## Open Gaps (after Session 59)

**Spec work remaining (D-S4 Steps 3–9):**
- MISSING_SPECS Item 24 → D-S4 Step 3: Global device edit redeploy prompt UX (blocks G-4)
- MISSING_SPECS Item 5 → D-S4 Step 4: Error states inventory
- Piston list UI row states → D-S4 Step 5
- Status page full layout → D-S4 Step 6
- MISSING_SPECS Items 2-6, 10-12, 14, 19, 20 → D-S4 Step 7
- HA_LIMITATIONS.md Section 3 → D-S4 Step 8
- AI_PROMPT_SPEC.md → D-S4 Step 9 (GAP-S57-3)

**Coding gaps (after D-S4):**
- GAP-S57-5 → G-4: Global device edit redeploy prompt (blocked on Item 24 spec)
- GAP-S52-2/3/4, GAP-S53-2/3/4/5, GAP-S44-1 → W-S8
- compiler.py entity_ids direct read + MISSING_ENTITY → B-1
- GAP-S46-4 → G-3

---

## Spec File Versions (after Session 59)
- DESIGN.md v1.3
- PISTON_FORMAT.md v2.1
- COMPILER_SPEC.md v1.3 (line 8 has stale "v1.1" ref — fix next edit)
- PYSCRIPT_COMPILER_SPEC.md v1.1
- WIZARD_SPEC.md v2.2 (lines 12–15 ref PISTON_FORMAT v2.1 and STATEMENT_TYPES v2.0 — minor, non-blocking)
- STATEMENT_TYPES.md v2.1
- FRONTEND_SPEC.md v1.1
- SAMPLE_PISTONS.md v1.0 (new)
- TASKS_HISTORY.md v1.0 (new)
- MISSING_SPECS.md — Items 1,9,13,16,17,18,21,22,23 resolved; Items 7/8 body still says MISSING (move to DONE next edit); Items 2-6,10-12,14-15,19-20,24-27 open
- AI_PROMPT_SPEC.md — STALE, needs full rewrite (GAP-S57-3, D-S4 Step 9)
- HA_LIMITATIONS.md — Section 3 stale (D-S4 Step 8)
