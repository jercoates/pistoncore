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
- Keep the how to manage claude rules below in mind when coding.
- Remind Jeremy to review the rules below before coding starts.
- **Always check for stale comments and dead code before delivering files.**
- **Do not code without permission — explain what you plan to change first.**

## 📌 Architecture Guardrail: The "Lowest Common Denominator" Rule

Whenever the user is building an Action (`wizard-action.js`) or a Condition (`wizard-condition.js`) and selects a device, group of devices, or a Device Variable (e.g., `@MyLights`, `@Fountains`):

1. The Extraction Layer: The wizard must never evaluate capabilities based on the Variable string token itself. It must immediately run a background pass to unpack all selected targets into a single, flat array of raw Home Assistant entity IDs (`light.kitchen_1`, `switch.fountain_main`).
2. The Capability Matrix Lookup: For every raw entity ID in that flat array, look up its supported commands or attributes from `WizardCore.deviceData`.
3. The Intersection Filter (The Overlap): Calculate the mathematical intersection of those capability lists. The UI dropdown presented to the user must only display commands/attributes that are present across all resolved entities.
4. UI/Data Separation: The final saved node retains the user's chosen Friendly Name or Variable Token for the script display block, but the selectable parameters are safely constrained by the backend hardware intersection checked in step 3.

## 📌 UI/Data Separation Rule
- The user always sees friendly names (variable names, global @tokens, device friendly names).
- The JSON always stores entity_ids on nodes for the compiler.
- `role` and `device_label` are always friendly names or variable names. Never entity_ids.
- `entity_ids` on nodes are always real HA entity_ids. Never role names.
- `role_tokens` stores what the user selected (variable names, @globals, entity_ids) for edit round-trip. Compiler ignores it.
- These must never mix. If they are mixing anywhere that is a bug.

## 📌 sel.tokens Model

- `sel.tokens` is the authoritative selection tracker in all wizard pickers.
- It tracks exactly what the user clicked: variable names (e.g. `"MyLights"`), `@global` tokens (e.g. `"@Fountains"`), or plain entity_ids for physical devices.
- `_getFlatEntityIds(sel.tokens)` is the ONLY place that resolves tokens to real HA entity_ids at commit time. Never resolve inline anywhere else.
- `_getGroupedEntityIdsForTokens(sel.tokens)` is used for capability/service lookup ONLY — returns one array of entity_ids per physical device group.
- `role_tokens` is written to every action and condition node at commit time. It is a required field. The compiler ignores it. The editor preserves it on save.
- On edit, `_route()` restores `sel.tokens` from `role_tokens`. If `role_tokens` absent (old-format node), fall back to `entity_ids` as tokens, then `devices` array, then `role` name.
- `sel.devices` is NOT the authoritative list. Do not use it as the picker source of truth.

## 📌 Device Define / Variable Model

- A device define (piston variable of type `device`) holds a list of friendly names as `initial_value`.
- Friendly names resolve to device groups via `_groupDevices()`. Each group contains ALL entity_ids for that physical device.
- When selected in the wizard, the variable name becomes the `role` token.
- `_getFlatEntityIds` resolves the variable name → friendly names → all entity_ids (for commit).
- `_getGroupedEntityIdsForTokens` resolves the variable name → friendly names → groups → all entity_ids per group (for cap/service lookup).
- For capability lookup: fetch caps for ALL entity_ids in each group, union per group, intersect across groups. Caps named "state" with a device_class are keyed by device_class so illuminance/temperature/battery appear as distinct picker entries.
- Global device variables work exactly like local device variables. Both store friendly names.
- Globals store friendly names in `value` field (not entity_ids).
- Local variables store friendly names in `initial_value` field.

## 📌 Cap/Service Lookup — _getGroupedEntityIdsForTokens

- Replaces `_getPrimaryIdsForTokens` which was wrong — it returned only one entity per device.
- Returns array of arrays: one inner array = all entity_ids for one physical device group.
- For each group: fetch caps/services for ALL entity_ids → union → one cap set per device.
- Intersect cap sets across physical devices — only shared caps shown.
- This means a multi-sensor (motion + illuminance + temperature + battery) exposes ALL its attributes, not just the dominant domain's caps.

## How to Manage Claude — Three Rules

- Keep the UI label separate from the data payload. The user sees friendly names. The JSON stores entity_ids. Always tell Claude explicitly which one a piece of code is responsible for. Never let them mix.
- Demand helper functions, not monolithic code. When solving a multi-step problem, require Claude to isolate each step into its own small function before writing anything.
- Make Claude explain before it codes. If you are unsure Claude understands the problem, say: "Do not write any code yet. Explain in plain English the step-by-step logic and which files you will modify." If the explanation is wrong, correct it before a single line is written.

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

## Current Priority — W-S10 continued (Session 68 work)

### Upload for next session:
wizard-loops.js, wizard-core.js, wizard-action.js, wizard-condition.js,
wizard-variable.js, wizard-statement.js, editor.js, globals.js,
DESIGN.md, WIZARD_SPEC.md, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

### What was done in Session 67 (W-S10 partial):

**Cap/service intersection completely rewritten:**
- Root cause: `_getPrimaryIdsForTokens` returned ONE primary entity per device group.
  A multi-sensor (motion + illuminance + temperature + battery) got caps fetched only
  for its primary entity (binary_sensor.motion) → only motion/state shown.
- Fix: replaced with `_getGroupedEntityIdsForTokens` which returns ALL entity_ids per
  physical device group. Caps fetched for ALL entities in group, unioned per group,
  then intersected across selected physical devices.
- Additional fix: caps named "state" with a device_class are keyed by device_class
  in the union map, so illuminance/temperature/battery appear as distinct picker entries
  instead of all collapsing into one "state" entry.
- Globals now store friendly names in `value` (same as locals store in `initial_value`).
  Both resolve through `_getGroupedEntityIdsForTokens` identically.
- `API.getServices()` returns array directly — fixed `data.services || []` to
  `Array.isArray(data) ? data : (data.services || [])`.

**Files changed this session:**
- wizard-core.js — `_getPrimaryIdsForTokens` replaced with `_getGroupedEntityIdsForTokens`
- wizard-condition.js — `_loadCapsIntoSelect` rewritten with new function + device_class dedup
- wizard-action.js — `_goCommandPicker` rewritten with new function + services array fix
- globals.js — picker stores friendly names (not entity_ids), SelectAll/DeselectAll fixed,
  `_filteredDevices` primary-before-use bug fixed

### New gaps found in Session 67 — all assigned to W-S10:

- **GAP-S67-1 → W-S10:** Interaction row ("Which interaction / Any interaction") shows
  on conditions. Should only show when the selected operator IS a trigger (isTrigger(op)).
  Fix: change `showInteraction` in `_goConditionBuilder` from `subjType === 'device' && hasDevice`
  to `subjType === 'device' && hasDevice && isTrigger(op)`. Also update `_refreshConditionRows`
  to toggle the row correctly when operator changes.

- **GAP-S67-2 → W-S10:** Next button in action device picker does nothing when a piston
  variable row is selected. Root cause: `_goCommandPicker` destructures
  `_getGroupedEntityIdsForTokens` from WizardCore but deployed wizard-core.js had the
  old function name, causing silent undefined error. Fixed by ensuring wizard-core.js
  output is always deployed together with wizard-action.js.
  Additional issue: physical device rows still write all entity_ids into sel.tokens
  (comma-separated data-id). For non-virtual physical rows, only `primary_entity_id`
  should be written to sel.tokens — `_getGroupedEntityIdsForTokens` handles expansion
  from there. Fix both `_renderActDevList` (wizard-action.js) and `_renderDevPanelList`
  (wizard-condition.js) physical row data-id and click handler.

- **GAP-S67-3 → W-S10:** Action command picker shows all parameter fields immediately
  on load. WebCoRE shows no fields until a command is selected, then shows only
  relevant fields for that command. Fix `_renderCmdParams` and `_goCommandPicker` to
  not auto-render params until user selects a command.

- **GAP-S67-4 → W-S10:** Variable/global names in condition device button missing
  prefix — shows `Light_Sensor` instead of `{Light_Sensor}` or similar. Check spec
  for correct display format and fix the button label in `_goConditionBuilder` and
  the action sel bar in `_goActionDevicePicker`.

### Still open from before Session 67:
- GAP-S64-2: Old-format piston picker state wrong — debug first, then fix
- GAP-S46-5: Import modal has no file picker
- GAP-S58-2: Copy/paste/duplicate statements

**Upload for W-S10 continued (Session 68):**
wizard-core.js, wizard-action.js, wizard-condition.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, editor.js, globals.js,
DESIGN.md, WIZARD_SPEC.md, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

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
- **sel.tokens is the authoritative selection tracker — never sel.devices**
- **role_tokens is a required field on all action and condition nodes**
- **_getFlatEntityIds is the only resolution path for commit — never resolve tokens inline**
- **_getGroupedEntityIdsForTokens is the only resolution path for cap/service lookup**

## Device Data Model — Locked
- `API.getDevices()` returns flat entity list with `device_id` field
- Frontend groups by `device_id` → one picker row per physical device
- `primary_entity_id` chosen by domain priority at group time:
  light > switch > cover > fan > climate > lock > media_player >
  input_boolean > input_number > input_select > automation >
  binary_sensor > sensor > person > device_tracker > alarm_control_panel
- Physical device rows write `primary_entity_id` to `sel.tokens` (NOT all entity_ids)
- Piston variable rows write variable name to `sel.tokens`
- Global variable rows write `@name` token to `sel.tokens`
- `_getFlatEntityIds(sel.tokens)` resolves all tokens to flat real entity_ids (commit time)
- `_getGroupedEntityIdsForTokens(sel.tokens)` resolves to grouped entity_ids (cap lookup)
- `role` on nodes = human-readable label (variable name, @global, friendly name) — display only
- `role_tokens` on nodes = raw tokens user selected — edit round-trip only, compiler ignores
- `entity_ids` on nodes = real HA entity_ids — compiler reads these directly
- Device variables: `initial_value` = array of friendly names (local) or `value` (globals)
- Search in device pickers: filter on display label + primary_entity_id only

## _getFlatEntityIds Resolution Order
For each token in sel.tokens:
1. Starts with `@` → global variable → look up in `WizardCore.globalsData`, get `value` array (friendly names) → resolve each to all entity_ids in group
2. No `.` → piston variable name → look up in `Editor.getPistonVariables()`, get `initial_value` array (friendly names) → resolve each to all entity_ids in group
3. Has `.` → plain entity_id → expand to all entity_ids in its group
Returns flat deduplicated array of real HA entity_ids.

## _getGroupedEntityIdsForTokens Resolution Order
For each token in sel.tokens:
1. Starts with `@` → global variable → friendly names in `value` → groups → all entity_ids per group
2. No `.` → piston variable name → friendly names in `initial_value` → groups → all entity_ids per group
3. Has `.` → plain entity_id → find its group → all entity_ids in group
Returns array of arrays — one inner array per physical device group.

## _reResolveVariableUses Contract
Called after any device variable (define) is saved.
Walks the entire piston tree (statements recursively, triggers, conditions, restrictions).
Finds every node where `role_tokens` contains the variable name.
Re-resolves `entity_ids` from current variable definitions.
Other tokens in the same node (other variables, globals, physical devices) are preserved.
Globals resolve from `_piston._globalsCache` (loaded at editor open via `API.getGlobals()`).

## Multi-Entity Compilation — Confirmed HA Native
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
- W-S9 COMPLETE (Session 64): sel.tokens model, capability intersection, define auto-update
- W-S10 PARTIAL (Sessions 65–67): cap/service intersection rewritten, globals aligned

---

## Open Gaps — All Assigned

### Session 67 gaps (new)

- **GAP-S67-1 → W-S10:** Interaction row shows on conditions — should only show when operator is a trigger
- **GAP-S67-2 → W-S10:** Next button dead when piston variable selected in action picker; also physical rows write all entity_ids to sel.tokens instead of primary_entity_id only
- **GAP-S67-3 → W-S10:** Action command picker shows all params immediately — should wait for command selection
- **GAP-S67-4 → W-S10:** Variable/global names missing prefix in condition device button display

### Session 64 gaps

- **GAP-S64-1 → D-S5:** role_tokens must be documented as required in PISTON_FORMAT.md
- **GAP-S64-2 → W-S10:** Picker not loading correct state for old-format imported pistons

### Session 63 gaps

- **GAP-S63-1 → deferred:** Domain priority investigation — not blocking anything
- **GAP-S63-4 → D-S5:** Spec update — sel.tokens, role_tokens, _getFlatEntityIds,
  device grouping, _getGroupedEntityIdsForTokens, globals friendly name model,
  _reResolveVariableUses contract, globals cache model, UI/data separation rule
- **GAP-S63-5 → W-S10 ✅:** for_each device picker complete (Session 66)

### Pre-session-63 coding gaps still open

- **GAP-S57-5 → G-4:** Global device edit redeploy prompt
- **GAP-S46-4 → G-3:** Imported globals land in piston variables instead of globals store
- **GAP-S46-5 → W-S10:** Import modal has no file picker — paste-only
- **GAP-S58-2 → W-S10:** Copy/paste/duplicate statements
- **GAP-S58-3 → S2-3:** Piston backup trigger/download/restore
- **GAP-S50-1 → S3-1:** Compiler does not handle device initial_value disambiguation
- **GAP-S33-2 → S3-2:** condition_and/or template indentation needs real-world testing
- **GAP-S34-1 → S4-16:** _compile_single_condition has no warnings param
- **GAP-S38-1 → S2-2:** /api/logs route missing from api.py
- **GAP-S39-1 → S2-2:** ha_client import pattern wrong in api.py and compiler.py
- **GAP-S43-4 → S2-3:** Snapshot export not yet implemented
- **GAP-S30-3 → S4-16:** Double config load per compile call
- **GAP-S47-1 → S4-16:** Structure line position needs fine-tuning (cosmetic)
- **GAP-S45-1 → S4-16:** set_variable wizard doesn't normalize $ prefix (cosmetic)

### Spec gaps still open

- **MISSING_SPECS Item 11 (partial)** → post-S3-2: Production sample pistons
- **MISSING_SPECS Item 12** → post-S3-1: Write BEST_PRACTICES.md
- **MISSING_SPECS Item 15** → before S4-10: write-a-piston.md actual prompt content
- **MISSING_SPECS Item 25** → S4-17: HA entity state subscription vs polling
- **MISSING_SPECS Item 26** → W-S10: Copy/paste/duplicate statements
- **MISSING_SPECS Item 27** → S2-3: Piston backup trigger/download/restore

---

## Spec File Versions (after Session 67)
- DESIGN.md v1.6
- PISTON_FORMAT.md v2.1 (needs update — GAP-S63-4, GAP-S64-1)
- COMPILER_SPEC.md v1.5
- WIZARD_SPEC.md v2.2 (needs update — GAP-S63-4)
- STATEMENT_TYPES.md v2.1
- FRONTEND_SPEC.md v1.4
- SAMPLE_PISTONS.md v1.0
- AI_PROMPT_SPEC.md v2.0


After B-1 and S3-1, do a pass to audit all raw HTML insertions in editor.js and the wizard files to confirm _esc() is applied everywhere. Also check Google Fonts import in style.css for offline HA compatibility.
