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
- Never mark a section as SUPERSEDED and leave the stale content.
- All specs must be complete before any coding session starts. No exceptions.
- **Always upload DESIGN.md for wizard/editor/picker sessions. Device model,
  entity model, and compilation decisions all live there. Do not assume.**
- **Coding discipline — fix what the user can see first.**

## Deploy Command (Unraid)
```
cd /mnt/user/appdata/pistoncore-dev && git pull && docker build --no-cache -t pistoncore . && docker stop pistoncore && docker rm pistoncore && docker run -d --name pistoncore --restart unless-stopped -p 7777:7777 -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize pistoncore
```

## WARNING — /reference folder
Do NOT read any file in /reference. Those are archived session artifacts.
All authoritative specs are in the repo root.

## Completed Sessions
See TASKS_HISTORY.md for full archive.

---

## Current Priority — W-S9 (Remaining Picker Gaps)

### Upload for W-S9:
wizard-core.js, wizard-action.js, wizard-condition.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, editor.js, globals.js,
DESIGN.md, WIZARD_SPEC.md, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

### What was done in Session 63 (W-S8 + device picker work):

**W-S8 gaps closed:**
- `_saveDeviceCmd` rewritten: entity_ids + role on action node, no device_map
- `registerDeviceRole` removed from editor.js
- `_buildConditionNode` verified — writes role + entity_ids correctly
- Globals wired into all device pickers (action, condition, variable)
- GAP-S52-2/3/4, GAP-S53-3/4/5, GAP-S44-1 all fixed

**Device picker rebuild:**
- Group entities by HA device_id (from config/entity_registry/list) — one row per physical device
- primary_entity_id chosen by domain priority (light > switch > cover > ...)
- _groupDevices() in wizard-core.js, _filteredDevices() in globals.js
- _filterGrouped() added — search filters on display label + primary_entity_id only
  (prevents power sensor sub-entities leaking into "light" searches)
- Physical device rows: store primary_entity_id in sel.devices
- Piston variable rows: resolve initial_value → entity_ids at click time
- Global variable rows: resolve value → entity_ids at click time
- data-row-type attribute on rows: 'physical' | 'pistonvar' | 'global' | 'demo'

**Friendly name display:**
- wizard-variable.js: stores initial_device_names[] on variable node at save time
- editor.js: renders initial_device_names in define block (friendly names not entity_ids)
- globals.js: _renderRow resolves entity_ids → friendly names from cached _devices

**Other fixes:**
- Variable type pre-fill fixed on edit (was silently switching to Dynamic)
- globals.js device list height increased (220px → 420px), scrollable
- Variable save() preserves initial_device_names through edit cycle

### W-S9 steps (in order — see TASKS.md for full detail):
1. GAP-S63-1: Investigate + fix domain priority / primary_entity_id wrong for some devices
2. GAP-S63-2: Fix _actDevSelectAll to resolve pistonvars/globals to entity_ids
3. GAP-S63-3: Fix condition picker to accumulate multi-select like action picker
4. GAP-S63-4: Write device grouping model rules into WIZARD_SPEC.md and PISTON_FORMAT.md
5. GAP-S63-5: Replace for_each text input with grouped device picker (wizard-loops.js)

---

## Architecture — Locked Decisions
- Nested tree model: children embedded directly, no ID references
- All HA YAML through Jinja2 templates only
- HACS companion eliminated — direct HA REST/WebSocket API
- Native HA Script as primary compile target (~95%), PyScript fallback
- Context_builder.py for fat compiler context assembly
- Piston identity via UUID throughout
- Editor must render from JSON correctly 100% of the time
- **device_map ELIMINATED** — entity_ids stored directly on condition, action, for_each nodes
- **entity_ids validated against live HA on every compile**
- **entity_ids captured from live HA device picker at wizard commit time — never at runtime**

## Device Data Model — Locked (Session 63 additions)
- `API.getDevices()` returns flat entity list with `device_id` field (HA physical device registry ID)
- Frontend groups by `device_id` → one picker row per physical device
- `primary_entity_id` chosen by domain priority at group time
- Physical device rows write `primary_entity_id` to `sel.devices`
- Piston variable rows resolve `initial_value` (entity_ids array) into `sel.devices` at click time
- Global variable rows resolve `value` (entity_ids array) into `sel.devices` at click time
- `role` on nodes = human-readable label for editor display (variable name, global @name, or friendly name)
- `entity_ids` on nodes = real HA entity IDs written at wizard commit — compiler reads these directly
- `initial_device_names` on variable nodes = display-only friendly names array, compiler ignores
- Search in device pickers: filter on display label + primary_entity_id only

## Multi-Entity Compilation — Confirmed HA Native (Session 57)
- Triggers: pass entity_ids array directly — one trigger block, HA fires on any match
- Actions: pass entity_ids array directly to target.entity_id — one action block
- Conditions: Jinja2 any()/all()/none() template
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
- SPEC REWRITE COMPLETE (Session 55): device_map eliminated, entity_ids on nodes
- FULL SPEC AUDIT (Session 57)
- D-S3 COMPLETE (Session 58)
- D-S4 COMPLETE (Sessions 59–60)
- W-S8 COMPLETE (Session 63): all wizard coding done, device picker rebuilt

---

## Open Gaps (after Session 63)

**Coding gaps blocking W-S9:**
- GAP-S63-1: domain priority / primary_entity_id wrong for some devices
- GAP-S63-2: _actDevSelectAll doesn't resolve pistonvars/globals
- GAP-S63-3: condition picker single-select only (pre-existing)
- GAP-S63-4: device grouping rules not yet in specs
- GAP-S63-5: for_each picker still uses text input

**Other coding gaps:**
- GAP-S46-4 → G-3, GAP-S57-5 → G-4
- GAP-S38-1, GAP-S39-1 → S2-2
- GAP-S43-4, GAP-S58-3 → S2-3
- GAP-S50-1 → S3-1
- GAP-S30-3, GAP-S34-1, GAP-S47-1, GAP-S45-1 → S4-16

---

## Spec File Versions (after Session 63)
- DESIGN.md v1.6
- PISTON_FORMAT.md v2.1 (needs update for initial_device_names — GAP-S63-4)
- COMPILER_SPEC.md v1.5
- WIZARD_SPEC.md v2.2 (needs update for device grouping model — GAP-S63-4)
- STATEMENT_TYPES.md v2.1
- FRONTEND_SPEC.md v1.4
- SAMPLE_PISTONS.md v1.0
- AI_PROMPT_SPEC.md v2.0


**Spec updates needed in W-S9 Step 4 (GAP-S63-4) — full list:**
- PISTON_FORMAT.md: initial_device_names field (display only, compiler ignores)
- PISTON_FORMAT.md: device var initial_value is always array of entity_ids
- PISTON_FORMAT.md: VAR_TYPE_DISPLAY round-trip (internal ↔ display string)
- PISTON_FORMAT.md: globals device value field is array of entity_ids
- WIZARD_SPEC.md: device grouping by device_id rule
- WIZARD_SPEC.md: primary_entity_id selection by domain priority
- WIZARD_SPEC.md: pistonvar/global resolution to entity_ids at click time
- WIZARD_SPEC.md: _filterGrouped search rule (label + primary_entity_id only)
- DESIGN.md: friendly name storage model for variables and globals