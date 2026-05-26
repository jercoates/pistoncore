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

## 📌 sel.tokens Model — 

- `sel.tokens` is the authoritative selection tracker in all wizard pickers.
- It tracks exactly what the user clicked: variable names (e.g. `"MyLights"`), `@global` tokens (e.g. `"@Fountains"`), or plain entity_ids for physical devices.
- `_getFlatEntityIds(sel.tokens)` is the ONLY place that resolves tokens to real HA entity_ids. Never resolve inline anywhere else.
- `role_tokens` is written to every action and condition node at commit time. It is a required field. The compiler ignores it. The editor preserves it on save.
- On edit, `_route()` restores `sel.tokens` from `role_tokens`. If `role_tokens` absent (old-format node), fall back to `entity_ids` as tokens, then `devices` array, then `role` name.
- `sel.devices` is NOT the authoritative list. Do not use it as the picker source of truth.

## 📌 Device Define / Variable Model

- A device define (piston variable of type `device`) holds a list of entity_ids as `initial_value`.
- When selected in the wizard, the variable name becomes the `role` token.
- `_getFlatEntityIds` resolves the variable name to its entity_ids via `Editor.getPistonVariables()`.
- The intersection of capabilities across all resolved entity_ids drives the command/attribute picker.
- Only the entity_ids that support the chosen command are written to the node's `entity_ids`.
- The role on the node is always the variable name — never the entity_ids.
- When a define is edited (entity_ids change), `_reResolveVariableUses` in editor.js
  immediately re-resolves `entity_ids` on every node in the piston that references
  that variable name in `role_tokens`. This is the entire point of defines.
- Global device variables work exactly like local device variables in this model.
  They resolve from `_piston._globalsCache` (loaded at editor open time).
- Local variable entity_ids are re-resolved by the backend on every piston save.
- Global variable entity_ids are resolved at wizard commit time and stored. User must
  re-open and re-save affected nodes to pick up global changes (per WIZARD_SPEC.md).

## How to Manage Claude — Three Rules

- Keep the UI label separate from the data payload. The user sees friendly names. The JSON stores entity_ids. Always tell Claude explicitly which one a piece of code is responsible for. Never let them mix.
- Demand helper functions, not monolithic code. When solving a multi-step problem, require Claude to isolate each step into its own small function before writing anything. Example: `_getFlatEntityIds()` is one job — resolve to entity_ids. The capability intersection is a separate job. Never combine them.
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

## Current Priority — W-S10 continued (Session 65 work)

### Upload for next session:
wizard-core.js, wizard-action.js, wizard-condition.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, editor.js, globals.js, ha_client.py,
DESIGN.md, WIZARD_SPEC.md, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

### What was done in Session 65 (W-S10 partial):

**Root cause found and fixed — capability picker was broken at every level:**
- `ha_client.py` `_fetch_capabilities`: was only returning `state` plus hardcoded
  numeric attrs. Now walks ALL real HA attributes and builds caps from them.
  Binary sensors use `device_class` as primary cap name (e.g. `motion` not `state`).
  UniFi cameras and combo devices now return all their real attributes.
- `wizard-core.js` `_getCapsForDomain`: was losing caps after first unique name match.
  Now returns full domain caps array for a single entity correctly.
- `wizard-condition.js` `_loadCapsIntoSelect`: API empty response now falls back to
  domain map. Final fallback uses single id not full array.
- `wizard-condition.js` `_renderDevPanelList`: physical device rows now carry ALL
  entity_ids for that device (comma-separated in data-id). Click handler adds/removes
  all of them to sel.tokens so capability intersection runs across all entities.
- `wizard-action.js` `_renderActDevList`: same fix. Virtual device check updated.
  `_actDevSelectAll` updated to split comma-separated ids.
- `globals.js`: same fix throughout — rows, click handler, SelectAll, DeselectAll,
  name map.
- `WIZARD_SPEC.md` v2.3: Device Variables section added with hard rules.

**Critical rule added to WIZARD_SPEC.md — read before every session:**
The user ALWAYS sees friendly names. PistonCore ALWAYS stores entity_ids.
These must NEVER mix. Device defines are lists — they store ALL entity_ids for
all selected devices. The capability intersection happens at picker time, not
at define time. The compiler reads entity_ids from nodes directly.

**Files changed this session:**
- `ha_client.py` — deploy
- `wizard-core.js` — deploy
- `wizard-condition.js` — deploy
- `wizard-action.js` — deploy
- `globals.js` — deploy
- `WIZARD_SPEC.md` — commit
- `wizard-variable.js` — NO CHANGE, original restored

### What still needs testing after deploy:

1. Open Kitchen Motion 1, edit the Motion_sensor condition — attribute picker should
   now show `motion`, `illuminance`, `temperature`, `battery`, `state` etc.
2. Edit the Light_Sensor define — reassign to `sensor.outdoor_motion_illuminance`
3. Edit the Light_Sensor condition — should now show illuminance attributes
4. Edit the Lights action — command picker should show light commands
5. Save the piston — check JSON has entity_ids on all condition and action nodes
6. If round-trip works → attempt compile

### Remaining W-S10 gaps (after testing confirms picker works):

1. **GAP-S64-2** — Old-format node edit: picker may still not restore state correctly
   for nodes with no role_tokens and no entity_ids. Test after deploy.
2. **GAP-S63-5** — for_each device picker (wizard-loops.js still uses text input)
3. **GAP-S46-5** — Import modal has no file picker — paste-only
4. **GAP-S58-2** — Copy/paste/duplicate statements in editor
5. **D-S5** — Spec update for role_tokens, sel.tokens etc. — must happen before B-1

### Next session priority:
Test the deploy first. If picker works → fix remaining gaps above in order.
If picker still broken → debug before writing any more code.

### HARD RULE — Added this session, must stay in every prompt:
Before changing ANY entity_id resolution, capability fetch, or picker logic:
1. State in plain English exactly what you are changing and why
2. Wait for Jeremy to confirm before writing a single line
3. Never write entity_ids into nodes manually — always resolve through _getFlatEntityIds
4. Never show entity_ids to the user anywhere in the editor or wizard
5. The user sees friendly names. The JSON stores entity_ids. These never mix.

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
- **_getFlatEntityIds is the only resolution path — never resolve tokens inline**

## Device Data Model — Locked
- `API.getDevices()` returns flat entity list with `device_id` field
- Frontend groups by `device_id` → one picker row per physical device
- `primary_entity_id` chosen by domain priority at group time:
  light > switch > cover > fan > climate > lock > media_player >
  input_boolean > input_number > input_select > automation >
  binary_sensor > sensor > person > device_tracker > alarm_control_panel
- Physical device rows write `primary_entity_id` to `sel.tokens`
- Piston variable rows write variable name to `sel.tokens`
- Global variable rows write `@name` token to `sel.tokens`
- `_getFlatEntityIds(sel.tokens)` resolves all tokens to flat real entity_ids
- `role` on nodes = human-readable label (variable name, @global, friendly name) — display only
- `role_tokens` on nodes = raw tokens user selected — edit round-trip only, compiler ignores
- `entity_ids` on nodes = real HA entity_ids — compiler reads these directly
- `initial_device_names` on variable nodes = display-only friendly names, compiler ignores
- Search in device pickers: filter on display label + primary_entity_id only

## _getFlatEntityIds Resolution Order
For each token in sel.tokens:
1. Starts with `@` → global variable → look up in `WizardCore.globalsData`, get `value` array
2. No `.` → piston variable name → look up in `Editor.getPistonVariables()`, get `initial_value` array
3. Has `.` → plain entity_id → use as-is (skip `__virtual__` ids)
Returns flat deduplicated array of real HA entity_ids.

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

---

## Open Gaps — All Assigned

### Session 64 gaps (new)

- **GAP-S64-1 → D-S5:** role_tokens must be documented as required in PISTON_FORMAT.md
- **GAP-S64-2 → W-S10:** Picker not loading correct state for old-format imported pistons —
  attribute picker shows wrong caps, value shows compiled_value not display_value.
  Exact failure point unknown — debug with console.log before writing fix.

### Session 63 gaps

- **GAP-S63-1 → deferred:** Domain priority investigation — not blocking anything
- **GAP-S63-2 → W-S9 ✅**
- **GAP-S63-3 → W-S9 ✅**
- **GAP-S63-4 → D-S5:** Spec update — sel.tokens, role_tokens, _getFlatEntityIds,
  device grouping, initial_device_names, _reResolveVariableUses contract,
  globals cache model, UI/data separation rule, define model
- **GAP-S63-5 → W-S10:** for_each device picker (wizard-loops.js still uses text input)
- **GAP-S63-6 → W-S9 ✅**
- **GAP-S63-7 → W-S9 ✅**

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

## Spec File Versions (after Session 64)
- DESIGN.md v1.6
- PISTON_FORMAT.md v2.1 (needs update — GAP-S63-4, GAP-S64-1)
- COMPILER_SPEC.md v1.5
- WIZARD_SPEC.md v2.2 (needs update — GAP-S63-4)
- STATEMENT_TYPES.md v2.1
- FRONTEND_SPEC.md v1.4
- SAMPLE_PISTONS.md v1.0
- AI_PROMPT_SPEC.md v2.0