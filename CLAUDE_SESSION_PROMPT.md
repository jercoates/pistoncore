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
- Do not write code without permision.  Do not omit this line when writing a new prompt again

## Deploy Command (Unraid)
```
cd /mnt/user/appdata/pistoncore-dev && git pull && docker build --no-cache -t pistoncore . && docker stop pistoncore && docker rm pistoncore && docker run -d --name pistoncore --restart unless-stopped -p 7777:7777 -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize pistoncore
```

## Current Priority — Session 56: D-S1 DESIGN.md ARCHITECTURE PIVOT UPDATE

**This is a spec-only session. No code.**

DESIGN.md (1695 lines, 85KB) is stale — it still references device_map architecture
which was eliminated in Session 55. Anyone reading DESIGN.md gets wrong information.
Fix this before any coding resumes.

### What to do this session:

**Read first:** DESIGN.md, PISTON_FORMAT.md, COMPILER_SPEC.md, TASKS.md

**Step 1 — Add Architecture Pivot section at the very top of DESIGN.md**
After the document header, insert a clearly marked section:
- What changed in Session 55 (device_map → entity_ids on nodes)
- Which DESIGN.md sections are now superseded
- Where to find the correct current specs

**Step 2 — Fix fat compiler context object**
Find the section in DESIGN.md showing the compiler context dict.
Remove `"device_map": { ... }` from it.
COMPILER_SPEC.md v1.2 Section 7 is the correct version.

**Step 3 — Mark superseded sections**
Add `> ⚠ SUPERSEDED — See PISTON_FORMAT.md v2.1 and COMPILER_SPEC.md v1.2`
at the top of every section that covers: device_map, device_map_meta, cardinality,
missing device handler (hard-flag vs degrade), role→entity lookup.

**Step 4 — Snapshot import note**
Add a note that Snapshot import flow needs redesigning under the new model.
Roles extracted from individual node `role` fields on import, not from a central
device_map. Full spec pending (MISSING_SPECS.md Item 21).

**Step 5 — Clarify has_missing_devices flag**
Either remove it or redefine it. Under new model, MISSING_ENTITY compiler error
replaces the old silent missing-device behavior.

**Step 6 — Add MISSING_SPECS.md Item 21: Snapshot import flow**

**Do NOT rewrite anything unrelated to device_map.**
Surgical changes only. Leave all other DESIGN.md sections untouched.

### Upload for Session 56:
DESIGN.md, PISTON_FORMAT.md, COMPILER_SPEC.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

### Session after D-S1 — W-S8 (wizard coding):
wizard-core.js, wizard-condition.js, wizard-action.js, wizard-statement.js,
wizard-loops.js, wizard-variable.js, editor.js,
WIZARD_SPEC.md, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

## Architecture — Locked Decisions
- Nested tree model: children embedded directly, no ID references
- All HA YAML through Jinja2 templates only
- HACS companion eliminated — direct HA REST/WebSocket API
- Native HA Script as primary compile target (~95%), PyScript fallback
- Context_builder.py for fat compiler context assembly
- Piston identity via UUID throughout
- Editor must render from JSON correctly 100% of the time
- **device_map ELIMINATED** — entity_ids stored directly in condition and action nodes
- **entity_ids validated against live HA on every compile**

## Device Data Model — Locked Decision (Session 54)
- Condition nodes: role (display label) + entity_ids (real HA entity ID array)
- Action nodes: role (display label) + entity_ids (real HA entity ID array)
- No device_map at piston wrapper level
- Compiler reads entity_ids directly — no role lookup needed
- On compile: backend validates every entity_id against live HA entity states
- Missing entity → MISSING_ENTITY compiler error with clear user message
- User fixes in editor, recompiles

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
  WIZARD_SPEC.md v2.0 (combined with WIZARD_REBUILD_SPEC), MISSING_SPECS.md items 17–20.
  device_map eliminated. entity_ids on condition and action nodes. MISSING_ENTITY defined.

## Frontend File Locations
- frontend/js/ — all JS files
- frontend/css/style.css — all CSS

## Open Critical Gaps (as of Session 55)
- **GAP-S55-1 → D-S1:** DESIGN.md stale — contradicts entity_ids model throughout
- **GAP-S55-2 → D-S1:** Fat compiler context in DESIGN.md still shows device_map field
- **GAP-S55-3 → MISSING_SPECS Item 21:** Snapshot import flow undefined under new model
- **GAP-S55-4 → D-S1:** has_missing_devices flag status unclear under new model
- **GAP-S55-5 → B-1:** for_each list_role resolution needs clarification in COMPILER_SPEC
- wizard-action.js _saveDeviceCmd: still writes old format — fix in W-S8
- editor.js registerDeviceRole(): remove in W-S8 after _saveDeviceCmd updated
- compiler.py: needs entity_ids direct read + MISSING_ENTITY validation — B-1
- GAP-S52-2: Action wizard stale sel state
- GAP-S52-3: Add task button wrong behavior
- GAP-S52-4: open() shallow copy for complex edit nodes
- GAP-S53-2: Attribute dropdown needs real device test
- GAP-S53-3: Condition edit pre-fill needs verification
- GAP-S53-5: Switch case statements missing branch
- GAP-S46-4 → G-3: Imported globals land in wrong place
- GAP-S44-1 → W-S8: Group condition editing not implemented

## Warning — DESIGN.md is Partially Stale
DESIGN.md still references device_map architecture eliminated in Session 55.
Do NOT use DESIGN.md as authority for anything related to:
- device_map, device_map_meta, cardinality
- Missing device handler (hard-flag vs degrade)
- Fat compiler context object (still shows device_map field)
- Import flow (device_map population)
Use PISTON_FORMAT.md v2.1, COMPILER_SPEC.md v1.2, WIZARD_SPEC.md v2.0 instead.
DESIGN.md will be updated in Session 56 (D-S1).
