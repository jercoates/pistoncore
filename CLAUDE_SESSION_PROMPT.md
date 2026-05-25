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
- **Coding discipline — fix what the user can see first.** If a backend change is required to fix a visible problem, make only the minimum change needed and return immediately to the frontend. Do not fix backend issues that are not directly blocking the current visible problem, even if you notice them. Log them as gaps in TASKS.md instead.

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

## Current Priority — W-S8 (Wizard Coding)

**D-S4 is complete.** All spec work is done. Next session is W-S8.

### Upload for W-S8:
wizard-core.js, wizard-condition.js, wizard-action.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, editor.js, list.js,
WIZARD_SPEC.md, PISTON_FORMAT.md, STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

### What was done in Session 60 (D-S4 Steps 3–9):
- Step 3: DESIGN.md v1.4 — Section 7.1 expanded with full permission prompt layout, progress
  modal layout, and all edge cases (never-deployed, disabled, merged stale flags, HA disconnected
  mid-redeploy, revert detection, running piston handling). MISSING_SPECS Item 24 CLOSED.
- Step 4: FRONTEND_SPEC.md v1.2 — Error States Inventory section added. Item 5 CLOSED.
- Step 5: FRONTEND_SPEC.md v1.2 — Piston List Row States section added. Priority order locked.
- Step 6: FRONTEND_SPEC.md v1.2 — Status Page Full Layout section added. All button states, deploy
  button state table, Test Compile panel, log panel, variables panel, quick facts panel all specced.
- Step 7: Items 2/3/4/6/10/11/12/14/19/20 resolved:
  - Items 2/3/4 written into FRONTEND_SPEC.md v1.2 (WebSocket protocol, Settings page, Folder management)
  - Item 6 written into MISSING_SPECS body (test strategy)
  - Items 10/11/12 written into MISSING_SPECS body (globals maintenance, sample library, best practices)
  - Item 14 written into COMPILER_SPEC.md v1.4 Section 11 (time condition compiler path)
  - Items 19/20 written as decisions into MISSING_SPECS body
- Step 8: HA_LIMITATIONS.md Section 3 rewritten (delivered as HA_LIMITATIONS_SECTION3.md — splice into repo)
- Step 9: AI_PROMPT_SPEC.md v2.0 — complete rewrite; device_map eliminated; write-a-piston.md requirements defined
- COMPILER_SPEC.md line 8 stale "v1.1" ref: **still not fixed** — fix on next COMPILER_SPEC edit (non-blocking)

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

## Open Gaps (after Session 60)

**All spec work complete. No open spec gaps blocking coding.**

**Remaining spec items (not blocking v1 coding):**
- MISSING_SPECS Item 11 (partial): production sample pistons → post-S3-2
- MISSING_SPECS Item 12: BEST_PRACTICES.md → post-S3-1
- MISSING_SPECS Item 15: write-a-piston.md actual prompt content → before S4-10
- MISSING_SPECS Item 25: HA entity state subscription vs polling → S4-17
- MISSING_SPECS Item 26: copy/paste/duplicate → W-S8 or dedicated session
- MISSING_SPECS Item 27: piston backup → S2-3

**Coding gaps (in priority order):**
- GAP-S52-2/3/4, GAP-S53-2/3/4/5, GAP-S44-1 → W-S8
- wizard-action.js `_saveDeviceCmd` rewrite → W-S8 Step 0
- compiler.py entity_ids direct read + MISSING_ENTITY → B-1
- GAP-S46-4 → G-3
- GAP-S57-5 → G-4 (spec complete in DESIGN.md v1.4 Section 7.1)

---

## Spec File Versions (after Session 62)
- DESIGN.md v1.6 (Section 9.2: entity state subscription vs polling decision added)
- PISTON_FORMAT.md v2.1
- COMPILER_SPEC.md v1.5
- PYSCRIPT_COMPILER_SPEC.md v1.1
- WIZARD_SPEC.md v2.2
- STATEMENT_TYPES.md v2.1
- FRONTEND_SPEC.md v1.4 (Snapshot and Backup Export section added)
- SAMPLE_PISTONS.md v1.0
- TASKS_HISTORY.md v1.0
- TEST_STRATEGY.md v1.0
- BEST_PRACTICES.md v1.0
- MISSING_SPECS.md — all items resolved (Item 15 deferred intentionally)
- AI_PROMPT_SPEC.md v2.0
- HA_LIMITATIONS.md — reviewed May 2026 against HA 2026.4
