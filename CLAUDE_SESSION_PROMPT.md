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
- keep the how to manage claude rules below in mind when coding.
- Remind Jeremy to review the rules below before coding starts.

## How to manage Claude

Managing Claude — Three Rules

- Keep the UI label separate from the data payload. The user sees friendly names. The JSON stores entity_ids. Always tell Claude explicitly which one a piece of code is responsible for. Never let them mix.
- Demand helper functions, not monolithic code. When solving a multi-step problem, require Claude to isolate each step into its own small function before writing anything. Example: _getFlatEntityIds() is one job — resolve to entity_ids. The capability intersection is a separate job. Never combine them.
- Make Claude explain before it codes. If you are unsure Claude understands the problem, say: "Do not write any code yet. Explain in plain English the step-by-step logic and which files you will modify." If the explanation is wrong, correct it before a single line is written. This session's biggest mistakes happened when code was written before the architecture was fully understood.

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

note from you 
i still dont know if you are understanding what needs to happen you basically told me that nothing works behind the scenes that we did today and i have not checked the new version yet to see if the user side works yet7:57 PMClaude responded: You're right, I don't fully know if it works yet.You're right, I don't fully know if it works yet. You haven't tested the new version and I've been finding problems as I review the code.
Let me be honest about what I'm confident in and what I'm not:
Confident it works:

One row per physical device in all pickers — the grouping logic is straightforward
Search filtering — label + primary_entity_id only
Friendly names in editor define block — reads initial_device_names if present
Globals drawer showing friendly names — looks up from cached _devices
Variable type pre-fill on edit — VAR_TYPE_DISPLAY reverse map is simple

Not confident:

Physical device action picker — when user selects multiple devices and clicks Next then Add, do the right entity_ids end up in the node? The device_labels for role generation comes from selected DOM rows but after pistonvar/global resolution sel.devices may contain more ids than there are visible rows, which could break the label count logic in _saveDeviceCmd
Condition picker — still single-select, which means multi-device conditions don't work
_actDevSelectAll broken for variables/globals as noted
for_each picker unchanged — still text input
The switch.kitchen_motion problem — unknown root cause

Push what you have, test the user-visible parts first. Tell me what breaks and we go from there. Don't guess at what's wrong — find out.You said: that is a major fuck upthat is a major fuck up7:57 PMClaude responded: You're right.You're right. I should have caught this before producing files.
The role label generation in _saveDeviceCmd uses device_labels built from selected DOM rows. But when a pistonvar or global row is selected, its resolved entity_ids get added to sel.devices — so sel.devices might have 5 entity_ids but only 1 selected row in the DOM. The label count logic then generates "Kitchen Light +4" from a single label when it should just say "Lights" (the variable name).
The fix: device_labels should be built at click time and stored in sel.device_labels, not reconstructed from the DOM at save time. The click handler already does this for physical devices. For pistonvar and global rows it needs to store the variable/global name as the single label entry regardless of how many entity_ids resolved from it.
Looking at the click handler — it does set allLabels from selected DOM rows after the newSel update, which is correct for the label. The problem is sel.devices now contains all resolved entity_ids, so when _saveDeviceCmd counts entityIds.length it gets 5 (all the resolved ids) but labels only has 1 entry (the variable name). So it generates "Lights +4" instead of "Lights".
The fix in _saveDeviceCmd is to use labels.length for the role logic, not entityIds.length. The role represents what the user selected (devices/variables/globals), not how many entity_ids resolved from them.

** use the above for reference but the next section was made after with more information

CRITICAL GAP — GAP-S63-7 — Must be first in W-S9 before any picker code is touched
The Problem: Capability intersection across multi-device selections
When a user selects multiple devices, a piston variable, or a global variable in the wizard, the capability/attribute picker (conditions) and command picker (actions) must show ONLY what ALL selected devices can do — not a union of everything any one of them can do.
Current broken behavior:

_loadCapsIntoSelect in wizard-condition.js merges (union) capabilities across all entity_ids — shows everything any device can do
_goCommandPicker in wizard-action.js fetches services for only the first entity_id — ignores the rest entirely

The correct flow — must be implemented in this order:

Flatten to raw entity_ids first. Before showing capabilities or commands, resolve all selected items to a flat array of real HA entity_ids. Physical device rows already have entity_ids. Piston variable rows must look up initial_value from Editor.getPistonVariables(). Global variable rows must look up value from WizardCore.globalsData.
Fetch capabilities/services for every entity_id in the flat list. Not just the first one.
Intersect — not union. Only keep capabilities/commands that appear in ALL fetched results. If light.kitchen can do turn_on, turn_off, set_brightness and switch.fountain can do turn_on, turn_off, the picker shows only turn_on, turn_off.
Store the friendly label for display, the intersection drives the picker. The role on the node is still the friendly name the user saw. The entity_ids on the node are the resolved flat list. The intersection only affects what the user is allowed to pick in the wizard — it is not stored anywhere.

Files to change:

wizard-condition.js — _loadCapsIntoSelect: change from union to intersection
wizard-action.js — _goCommandPicker / _loadActCommands: fetch services for all entity_ids, intersect results

Helper function needed — _getFlatEntityIds(devices):
Takes sel.devices array (may contain entity_ids, variable names, @global names).
For each entry:
  - If starts with '@': look up in WizardCore.globalsData, get value array
  - If no '.' (not an entity_id): look up in Editor.getPistonVariables(), get initial_value array  
  - Otherwise: it is already an entity_id, use as-is
Returns single flat deduplicated array of real HA entity_ids.
This helper should live in wizard-core.js and be exposed on WizardCore so both wizard-action.js and wizard-condition.js can use it.
Also fix in W-S9 before this:

GAP-S63-6: _saveDeviceCmd role label uses entityIds.length not labels.length — generates "Lights +4" instead of "Lights"
GAP-S63-2: _actDevSelectAll doesn't resolve pistonvars/globals to entity_ids

Feed Gemini's second response to Claude at the start of W-S9 — it describes this intersection pattern correctly.

** my conversation with gemini referenced above

ME:  i dont think either of you are getting the multi device and variable correct in context for this project.  when i select a define when making a statement or action the wizard needs to look at all the options of the selected devices and provide a list of what ALL of them are capable of and only listing things they all can do.  what i dont know is how to make this work acros the define using friendly names and resolving the list when added it seems logical to me but i dont code

Gemini
Oh, damn. You are completely right, and I see exactly where Claude and I both missed the mark on the true architectural problem you're staring at.

We were obsessing over how the data gets saved into the array, while completely ignoring the intersection logic required during the actual creation wizard.

Let me break down what you mean in plain English, why it's tricky, and exactly how the code needs to process this behind the scenes so it feels seamless to you as a user.

The Problem: The "Lowest Common Denominator" Rule
When you build a statement (like an Action or a Condition), the wizard asks you: "What devices do you want to control?"

If you select:

light.kitchen_1 (Can: turn_on, turn_off, set_level, set_color)

switch.fountain (Can: turn_on, turn_off)

The wizard should only show you turn_on and turn_off because the fountain can't change color or dim. If it let you pick set_level, the fountain would crash when the piston ran. It has to find the intersection—things all selected targets can do.

The Twist: Variables & Friendly Names
This gets hard when you aren't just clicking physical devices, but instead clicking a Piston Variable (like @MyLights) or a Global Variable (like @AllDownstairsDevices).

At the moment you click that variable in the wizard:

The wizard doesn't natively know what physical devices are hiding inside that variable name.

It just sees a string token (@MyLights).

Because it doesn't know what's inside, it doesn't know what capabilities (commands/attributes) to show you next.

How to Make This Work Plainly (The Logic)
Since you don't code, think of it like this 3-step assembly line that the JavaScript needs to execute the moment you select your targets:

Step 1: Flatten Everything into Raw Entity IDs First
Before looking up capabilities, the UI needs to translate your friendly names and variables into a plain list of physical Home Assistant IDs.

If you select light.kitchen_1 and the variable @Fountains (which holds switch.fountain_1 and switch.fountain_2), the code immediately unpacks them in the background into a hidden list: ['light.kitchen_1', 'switch.fountain_1', 'switch.fountain_2'].

Step 2: Look up Capabilities for Each Raw ID
The system goes to its database (WizardCore.deviceData) for each of those three raw IDs and grabs their individual list of commands.

Step 3: Find the Overlap (Intersection)
The code runs a filter. It says: "Is 'turn_on' available in the light? Yes. Is it in fountain 1? Yes. Is it in fountain 2? Yes. Keep it." "Is 'set_color' available in all three? No (fountains can't do it). Drop it."

The resulting filtered list is what gets displayed on your screen. When you finally hit "Save", the block remembers the Friendly Variable Name you picked for the UI display, but the capabilities it allowed you to choose were safely restricted by the actual hardware capabilities of the underlying devices.

What We Need to Tell Claude to Fix This
To fix this in your files (wizard-action.js and wizard-condition.js), the wizard's "Next" step needs to dynamically compute this overlap.

Here is the exact structural specification to give Claude so it implements this correctly:

Markdown
Claude, we have a gap in how the command/attribute picker generates options for multi-device selections, particularly when Piston Variables or Globals are selected. 

Currently, the wizard doesn't properly aggregate capabilities across multiple targets or resolve the physical entities hidden inside variables *before* showing the capability list. We need to implement a strict "Lowest Common Denominator" intersection rule.

Please modify the step transitions where we move from Device Selection to Capability/Command Selection:

1. RESOLVE TO RAW IDS FIRST:
   Create a helper function `_getFlatEntityIds(selectedArray)` that takes the current selections (which may contain raw entity IDs, local variable names, or global variable names). It must look up any variables via `Editor.getPistonVariables()` or `WizardCore.globalsData` and return a single, flat array of physical Home Assistant entity IDs.

2. INTERSECT CAPABILITIES:
   When rendering the commands (in wizard-action) or attributes (in wizard-condition), loop through EVERY entity ID from that flat array. Look up its capabilities in `WizardCore.deviceData`. The final list of commands/attributes displayed to the user must ONLY include options that are present across ALL selected entities.

3. PRESERVE THE DEFINE LABEL:
   The structural node should still point to the Variable or Global name chosen by the user for the role/UI execution, but the allowed options must be safely constrained by this background check.

Show me the updated capability rendering loop using this intersection logic.
Does this layout match the exact flow you are trying to achieve when building a statement?
