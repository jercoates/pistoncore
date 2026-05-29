# PistonCore Wizard Specification

**Version:** 2.4
**Status:** Authoritative — supersedes both WIZARD_SPEC.md v0.6 and WIZARD_REBUILD_SPEC.md v1.0
**Last Updated:** May 2026 (Session 68 / W-S10 — sel.tokens model corrected to match working
  code: physical rows store ALL entity_ids in sel.tokens (not just primary_entity_id).
  Union-then-intersect cap model documented. Hard guardrail added — DO NOT CHANGE.
  selected_entity_ids references removed — that field does not exist, use sel.tokens.
  Edit pre-fill hydration corrected to use role_tokens → sel.tokens. GAP-S57-10 through
  S57-14 from Session 58 / D-S3 also reflected.)

**Authority rule:** WIZARD_REBUILD_SPEC.md is now merged into this document and retired.
This is the single wizard spec. All wizard coding must reference this document.

**Source:** WebCoRE piston.module.html, app.js, wizard-*.js files, PISTON_FORMAT.md v2.1,
STATEMENT_TYPES.md v2.1, SESSION_54_FINDINGS.md.

Read DESIGN.md and PISTON_FORMAT.md v2.1 before this document.

---

## Guiding Rules

- Match WebCoRE's wizard behavior exactly where possible. Deviation requires a specific documented reason.
- **Intentional PistonCore differences from WebCoRE (do NOT revert):**
  - Globals editable from any screen via top bar — WebCoRE was editor-only
  - Main screen layout and debug/log screen — PistonCore design kept
  - All other wizard dialogs: match WebCoRE exactly

---

## Output Invariant

The wizard writes structured JSON only — it never writes display text or piston_text.
Every completed wizard flow produces a typed statement or condition object that is
inserted directly into the piston's statements array.

The wizard's internal state object (selections, sentence, step) is transient UI state.
It exists only while the wizard is open. It is discarded on Cancel. It is never written
to the piston JSON on Done — only the final typed output object is written.

This matches DESIGN.md Section 2 and PISTON_FORMAT.md v2.1 exactly.

**The wizard is the ONLY thing that writes piston JSON.**
**The editor is the ONLY thing that reads and renders it.**
**Round-trip (wizard → JSON → editor → JSON → editor) must work 100% of the time.**

---

## Critical Architecture Notes

### Nested Tree — Non-Negotiable

All JSON output uses the nested tree model. Children are embedded objects, never ID
references. No flat arrays. No stmtMap.

```
if node → then:[...], else:[...], else_ifs:[{conditions:[], statements:[]}]
action node → entity_ids:[...], tasks:[...]  (tasks embedded, not child statements)
do/for/for_each/while/repeat/every/on_event → statements:[...]
switch → cases:[{statements:[]}], default:[...]
```

### ID Format

- Statement IDs: `stmt_` + 8 hex chars (e.g. `stmt_a3f8c2d1`)
- Condition IDs: `cond_` + 8 hex chars (e.g. `cond_b7e2f941`)
- Task IDs: `task_` + 8 hex chars (e.g. `task_c1d4e823`)
- Case IDs: `case_` + 8 hex chars (e.g. `case_f2a1b903`)

### Device Data Model — How the Wizard Writes Entities

Entity IDs are written directly onto condition and action nodes. There is no device_map.

**On condition commit:**
- `role` = human-readable label (e.g. `"Front Door"`) — display only
- `entity_ids` = array of real HA entity IDs (e.g. `["binary_sensor.front_door"]`)
- The wizard writes `entity_ids` at commit time, not role names

**On action commit:**
- `role` = human-readable label (e.g. `"Driveway Light"`) — display only
- `entity_ids` = array of real HA entity IDs (e.g. `["light.driveway_main"]`)

**The compiler reads `entity_ids` directly from each node. It never looks up a role name.**
`role` is a display label stored alongside `entity_ids` for the editor to show — nothing more.

---

## Wizard File Structure (Post-Split)

Files: `wizard-core.js`, `wizard-statement.js`, `wizard-condition.js`,
`wizard-action.js`, `wizard-variable.js`, `wizard-loops.js`

All functions top-level (no IIFE wrapping). Shared state via `WizardCore` object.

---

## Core Wizard Behaviors

These apply to every wizard instance regardless of statement type:

1. **Never show an empty dropdown.** Show a loading spinner until data arrives. Show an error with a Retry button if data fails to load.
2. **Every step changes the next step's options.** Device selection changes the capability list. Capability selection changes the operator list. Operator selection changes the value input type. Nothing is static.
3. **Build a plain English sentence at the top** as the user progresses. This sentence grows with each step and shows what has been selected so far.
4. **Back is always available.** Clicking Back returns to the previous step without losing the current step's selection.
5. **Cancel closes with no changes.** Nothing is written to the piston tree until the user clicks Done on the final step.
6. **Cog icon** in the bottom right expands advanced options (TEP, TCP, Execution Method). Always present, hidden until clicked.

---

## Wizard Features by Runtime Target

### Available in Both (Native HA Script and PyScript)

All standard triggers, conditions, and actions — device state changes, numeric comparisons,
all loop types except break, wait, wait for state, set variable, log message, call another
piston (fire-and-forget), control another piston/automation, and all HA service calls.

### PyScript Only — Addon v1 and Docker (permanent)

- `break` — interrupt a loop mid-iteration
- `cancel_pending_tasks` — cancel async tasks in flight
- `on_event` — execute a block when a specific event fires inside a running script
- Task Execution Policy (TEP) and Task Cancellation Policy (TCP) cog options
- System variables ($currentEventDevice, $previousEventDevice, etc.)
- Which Interaction — Physical vs Programmatic (PyScript context tracking)

When a user selects a PyScript-only feature and the piston is currently native-script-bound:
*"This option requires converting your piston to a PyScript piston. Your logic will be preserved. Continue?"*
`[Yes, convert]` `[No, pick something else]`

---

## Device Picker — Rules Applied Everywhere

### Allowed HA Domains (filter everything else out)

```
light, switch, binary_sensor, sensor, media_player, cover, climate, fan,
lock, input_boolean, input_number, input_select, automation, person,
device_tracker, alarm_control_panel
```

Exclude: sun, zone, group, script, persistent_notification, logger, system_log,
recorder, homeassistant, frontend, conversation, stt, tts, wake_word,
assist_pipeline, update, button, and any other service-only domain.

### Deduplication

```javascript
const seen = new Set();
const filtered = raw.filter(d => {
  const domain = d.entity_id.split('.')[0];
  if (!ALLOWED_DOMAINS.has(domain)) return false;
  if (seen.has(d.entity_id)) return false;
  seen.add(d.entity_id);
  return true;
});
```

### Device Picker Section Order

```
─ Virtual Devices ──────────────────
  Location
  System Start
  Time
  Date
  Mode
─ Physical Devices ─────────────────
  [area grouped + filtered + deduplicated HA entities]
─ Local Variables (Device type) ────
  [$varName — filtered to var_type === 'device' or 'devices']
─ Global Variables (Device type) ───
  [@globalName — filtered to type === 'Device' or 'Devices' from globals.json]
─ System Variables ─────────────────
  [$currentEventDevice]
  [$previousEventDevice]
  [$device]
  [$devices]
  [$location]
```

**Global Variables section:** Now implemented (Sessions 48–50). Shows all globals of type `Device` or `Devices` from `globals.json`. When the user selects a global variable from this section, the wizard resolves its `entity_ids` from live HA state at commit time and writes them directly to the node — same as selecting physical devices. The global name becomes the `role` label. This means changes to the global's device list in the future require reopening the wizard and recommitting to pick up the new entities.

Demo devices shown when no HA connection or as fallback.

### Multi-Select Behavior

- Virtual devices: single-select, clicking immediately advances to next screen
- Physical devices: multi-select (aggregation bar appears when >1 selected)
- Local variables (device type): multi-select
- Global variables (Device/Devices type): single-select per global, but multiple globals can be selected together or mixed with physical devices. All selected entity_ids are merged into one flat array at commit time.
- System variables: single-select

**The aggregation bar** appears whenever more than one physical device group or variable is selected. The user picks any/all/none before committing.

---

### ⚠ sel.tokens — How Physical Device Selection Actually Works

**DO NOT CHANGE THIS BEHAVIOR. It took 6 sessions to get right. Read this entire section before touching any picker, token, capability, or intersection code. If you think it is wrong, you are wrong. Ask before changing anything.**

#### What sel.tokens contains

`sel.tokens` is the authoritative selection tracker. It contains different things depending on row type:

- **Physical device row clicked** → ALL entity_ids for that device group are added to `sel.tokens` (e.g. clicking "Outdoor Motion" adds `binary_sensor.outdoor_motion`, `sensor.outdoor_motion_illuminance`, `sensor.outdoor_motion_temperature`, `sensor.outdoor_motion_battery` — all four)
- **Piston variable row clicked** → the variable name (no dot, e.g. `"MyLights"`)
- **Global variable row clicked** → the `@name` token (e.g. `"@Fountains"`)

Deselecting a physical row removes all its entity_ids from `sel.tokens`.

#### Why ALL entity_ids must be stored for physical rows — never just primary_entity_id

`_getGroupedEntityIdsForTokens` finds a device's group by doing `grouped.find(g => g.entity_ids.includes(token))`. It needs at least one real entity_id from the group to find it.

**If only `primary_entity_id` were stored:** when a multi-entity device like "Outdoor Motion" is selected alongside another device, `_getGroupedEntityIdsForTokens` would only find the group via the one stored primary. The remaining sub-entity ids would come from the other device's tokens, causing the intersection to treat sub-entities as separate physical devices. The intersection collapses to only `state`. This was the bug. Storing all entity_ids fixes it permanently.

#### How the row renders and highlights

```javascript
// Row render — data-id carries ALL entity_ids comma-joined
const ids = d.entity_ids || [d.primary_entity_id];
const isSelected = ids.some(id => selTokens.has(id));
// data-id="${ids.join(',')}"

// Click handler — adds/removes ALL entity_ids
const rowIds = row.dataset.id.split(',').filter(Boolean);
if (row.classList.contains('selected')) {
  rowIds.forEach(id => newTokens.add(id));
} else {
  rowIds.forEach(id => newTokens.delete(id));
}
WizardCore.sel.tokens = [...newTokens];
```

The `isSelected` highlight check uses `ids.some(id => selTokens.has(id))` — a row re-highlights correctly as long as any one of its entity_ids is in `sel.tokens`.

#### Capability intersection — union within group, then intersect across groups

A physical device in HA is ONE device that can have MULTIPLE entities. These are NOT separate devices. "Outdoor Motion" with four sensor entities is one physical device.

**Step 1 — Union within a group:**
For each selected physical device group, fetch caps for ALL its entities and union them into one cap set. When two entities in the same group both return a cap named `state` but with different `device_class` values (e.g. `illuminance`, `temperature`, `battery`), key the union map by `device_class || name` — not just `name` — so they appear as distinct entries (`illuminance`, `temperature`, `battery`) instead of all collapsing into one `state` entry.

**Step 2 — Intersect across groups:**
Only when more than one physical device group is selected, intersect the unioned cap sets across groups. If only one group is selected, use its union directly — no intersection.

#### _getFlatEntityIds — commit time only

At commit time, `_getFlatEntityIds(sel.tokens)` resolves the full flat array of real HA entity_ids to write to the node:
- Token has `.` → plain entity_id, pass through as-is
- Token has no `.` → piston variable name → resolve `initial_value` (friendly names) → all entity_ids in each group
- Token starts with `@` → global variable → resolve `value` (friendly names) → all entity_ids in each group

Returns flat deduplicated array. This is what gets written to `entity_ids` on the node.

#### _getGroupedEntityIdsForTokens — cap/service lookup only

Used by `_loadCapsIntoSelect` and `_goCommandPicker`. Returns array of arrays — one inner array per physical device group — for the union-then-intersect cap lookup. Never used for writing nodes.

#### Hard rules — never violate

- **Never change** the physical row `data-id` construction (`ids.join(',')`)
- **Never change** the click handler that adds all entity_ids to `sel.tokens`
- **Never change** the `isSelected` highlight check (`ids.some(id => selTokens.has(id))`)
- **Never change** the union-then-intersect logic in `_loadCapsIntoSelect` or `_goCommandPicker`
- **Never change** `_getGroupedEntityIdsForTokens`
- **Never use** `selected_entity_ids` — that field does not exist. The field is `sel.tokens`
- **Before touching any of this:** state in plain English exactly what you are changing and why, and wait for confirmation

---

### Zero Devices Selected — GAP-S57-14

If the user clicks Next or Done with zero devices selected:
- **Next button is disabled** while `WizardCore.sel.tokens.length === 0`
- Show inline error below the device list: *"You must select at least one device or variable to continue."*
- Error appears only after the user has interacted with the picker (not on first open)
- Error clears as soon as any device is selected

This applies to: W-5 (action device picker), W-4 (condition device picker), W-2-foreach (for_each list picker), W-7 (variable devices type picker).

### Role Label Generation — GAP-S57-10

When the user commits a device selection, the `role` string is generated at commit time from the row labels (what the user selected — not from resolved entity_id count). Rules in priority order:

**Single physical device selected:**
Use the device's friendly name exactly.
`role: "Front Door"`

**Two physical devices selected:**
Join with " and ".
`role: "Front Door and Back Door"`

**Three physical devices selected:**
Join first two with ", " and last with " and ".
`role: "Front Door, Back Door and Garage Door"`

**Four or more physical devices selected:**
First friendly name + count of remaining selected rows.
`role: "Front Door +3"`

**Single global variable selected (no physical devices):**
Use the global's display name with @ prefix.
`role: "@Door_Contacts_Exterior"`

**Multiple globals selected (no physical devices):**
First global name with @ prefix + count of remaining.
`role: "@Door_Contacts_Exterior +1"`

**Mixed selection (physical devices AND globals):**
First selected row label + count of remaining selected rows.
`role: "Front Door +4"`

**Important:** The role label is derived from what the user selected (row labels and count), not from the number of resolved entity_ids. It is generated once at commit time and stored. It is never regenerated from entity_ids at render time. The role is a display convenience — the entity_ids array is the source of truth.

### Mixed Physical + Global Commit Logic — GAP-S57-11

When the user selects a mix of physical devices and global Device/Devices variables:

1. Physical device rows: all their entity_ids are already in `sel.tokens` from click time
2. Global rows: `@name` token is in `sel.tokens`; `_getFlatEntityIds` resolves it to entity_ids at commit time
3. `_getFlatEntityIds(sel.tokens)` produces the final flat deduplicated entity_ids array
4. Deduplicate — if a physical device and a global both contain the same entity_id, it appears only once
5. Role label generated from selected row labels per rules above

**When a local device variable's device list changes**, every condition and action node in the piston that references that variable has its `entity_ids` updated automatically via `_reResolveVariableUses` in editor.js. This runs immediately after the variable is saved. The user does not need to reopen and recommit every statement.

**When a global device variable's device list changes**, the user is shown a prompt immediately after saving the global: "This global is used in X pistons. Update them now?" If the user clicks yes, all affected pistons have their entity_ids updated automatically and are marked for redeploy. If the user clicks no, the affected pistons remain unchanged and are flagged as stale until the user manually updates them.

### Edit Pre-fill for Multi-Device Nodes — GAP-S57-13

When the user opens an existing condition, action, or for_each node for editing, the wizard must re-populate the device picker with the node's current selections.

**Hydration rule:**

On wizard open for edit, `_route()` reads `role_tokens` from the node (preferred) or falls back to `entity_ids`, then falls back to `devices` array, then falls back to `role` name. These are loaded into `WizardCore.sel.tokens`. During device list render, a row highlights as selected if any of its entity_ids (or its variable name / @token) is in `sel.tokens`:

```javascript
// Physical row highlight on re-render:
const ids = d.entity_ids || [d.primary_entity_id];
const isSelected = ids.some(id => selTokens.has(id));
```

**Identifying globals vs physical devices in an existing entity_ids list:**

`role_tokens` stores what the user originally selected (variable names, @globals, entity_ids). On edit, restore `sel.tokens` from `role_tokens` — this reliably re-highlights the correct rows. If `role_tokens` is absent (old-format node), fall back to `entity_ids` as tokens.

The role label shown on open is read from `editNode.role` — not regenerated.

### Aggregation Commit — GAP-S57-12

The aggregation bar (Any / All / None) is shown when more than one physical device group or variable is selected. The value defaults to `"any"`.

On commit, the selected aggregation value is written to the node:

```json
{ "aggregation": "any" }   // or "all" or "none"
```

**Single-device nodes always get `"any"`** regardless of what the aggregation bar shows. The aggregation bar is hidden for single-entity selections. If somehow a single-entity node is committed with a non-"any" aggregation, normalize to `"any"` at commit time.

**Aggregation → compiler behavior:**

| aggregation | Native HA trigger | Native HA condition | PyScript trigger |
|---|---|---|---|
| `"any"` | `entity_id: [list]` — fires on any | Jinja2 `any()` | One string per entity, OR'd |
| `"all"` | Template trigger | Jinja2 `all()` | All strings must match |
| `"none"` | Template trigger | Jinja2 `none()` | None of strings match |

This table is the authoritative mapping. The compiler reads `aggregation` from the node and uses this table. See COMPILER_SPEC.md v1.3 and FRONTEND_SPEC.md Aggregation Display Rules for the full spec.

### Search

Search filters all sections by name/entity_id. Empty query shows all sections.

---

## Device Variables (Defines) — How the Wizard Handles Them

**This section is non-negotiable. Read it before touching any picker, capability, or entity_id code.**

A device variable (define) is a named group of devices the user wants to treat as one unit. From the user's perspective it is a list of friendly device names — "Kitchen Light", "Outdoor Motion Sensor". From PistonCore's perspective it is a complete flat list of ALL entity IDs that belong to every device in that group. Both the friendly names and the entity IDs are stored on the variable node.

### In the Picker

When the user picks a device variable row (local or global) in a condition or action picker, the wizard immediately resolves that variable name to its full flat list of entity IDs via `_getFlatEntityIds`. It then fetches capabilities for ALL of those entity IDs and computes the intersection — only capabilities that every entity in the group shares are shown in the attribute dropdown. This is how the wizard knows what attributes and operators to offer.

- If all entities share `motion` and `battery` → show both
- If only some share `motion` → do not show `motion`
- The user sees only what every device in the group can actually do

### On Commit (Add / Add More)

When the user clicks Add or Add More, the wizard resolves the selected tokens to entity IDs via `_getFlatEntityIds` and writes them to `entity_ids` on the node. The variable name becomes the `role` label for display in the editor. `role_tokens` stores the original token (e.g. `["Motion_sensor"]`) for edit round-trip.

The entity IDs written are the ones relevant to the capability and domain the user selected — resolved from the variable's current `initial_value` at commit time.

### Hard Rules — Never Violate These

- **Never write a variable name into `entity_ids`.** Entity IDs are always real HA entity IDs like `binary_sensor.outdoor_motion_motion`. Never `Motion_sensor`.
- **Never show capabilities that not all selected entities share.** Intersection only.
- **Never touch the variable's `initial_value` from a condition or action wizard flow.** The variable wizard owns that. The condition and action wizard only reads it.
- **Never manually copy entity IDs from the JSON into a node.** Always resolve through `_getFlatEntityIds` at commit time.
- **Never add entity_id resolution logic outside of `_getFlatEntityIds`.** That function is the single resolution path. If it is broken, fix it there — nowhere else.
- **Before changing any entity_id, capability, or token resolution code:** state out loud in plain English exactly what you are changing and why, and wait for confirmation before writing any code.

### What the Compiler Sees

The compiler reads `entity_ids` directly from each condition and action node. It never looks up a role name. It never reads the variable definition. The entity IDs on the node are the complete truth for that statement.

---

## Dialog Flow Map

| User action | Context passed to wizard | First screen |
|---|---|---|
| `· add a new statement` (execute block or if.then) | `action` + `block-id` if inside branch | Statement Type Picker (W-1) |
| `· add a new trigger or condition` | `trigger_or_condition` | Condition or Group Picker (W-3) |
| `· add a new condition` (inside if block) | `if_condition` + `block-id` | Condition or Group Picker (W-3) |
| `· add a new restriction` | `restriction` | Condition or Group Picker (W-3) |
| `· add a new variable` | `variable` | Variable Picker (W-7) |
| `· add a new task` (inside action.tasks) | `task` + `block-id` | Action Device Picker (W-5) |
| Click existing if/switch/do/etc. | edit — goes direct to type detail | Type-specific screen |
| Click existing condition | `edit_condition` | Condition Builder (W-4) pre-filled |
| Click existing action task | `task` + node | Command Picker (W-6) pre-filled |
| Click existing variable | `variable` + node | Variable Picker (W-7) pre-filled |

---

## Screen W-1: Statement Type Picker

**When:** Context is `action` (adding new statement)
**WebCoRE source:** `dialog-edit-statement` page 0

### Layout — Grid of statement type cards

**Execution:** Add an action, Add a log message, Add a wait, Add a wait for state, Set a variable, Execute another piston, Exit

**Control Flow:** Add an if block, Add a switch, Add a do block

**Loops:** Add a for loop, Add a for each loop, Add a while loop, Add a repeat loop, Add an every timer

**Advanced:** Add a break *(PyScript only)*, Cancel pending tasks *(PyScript only)*, Add an on event block *(PyScript only)*

### Footer
`Cancel`

### After selection
- "Add an if block" → W-3 (Condition or Group Picker)
- "Add an action" → W-5 (Action Device Picker)
- All block types → insert empty node, close, editor re-renders
- Variable → W-7

---

## Screen W-2: Block Detail Screens

### W-2-for: For Loop Detail

**WebCoRE source:** `dialog-edit-statement` page 1, type `for`

Fields: Start value, End value, Step value, Counter variable (optional)

Footer: `← Back` | `Add a statement` (inserts node, closes)

JSON output:
```json
{
  "id": "stmt_xxxxxxxx",
  "type": "for",
  "async": false,
  "start": 1,
  "end": 10,
  "step": 1,
  "counter_variable": "$count",
  "statements": [],
  "description": null,
  "disabled": false
}
```

### W-2-foreach: For Each Loop Detail

Fields:
- **Loop variable** — text input with `$` prefix enforced (e.g. `$device`). Default: `$device`
- **Devices to loop over** — full device picker (same as W-5, multi-select). User can select any combination of physical devices and/or global Devices variables. If a global Devices variable is selected, its entity_ids are resolved from live HA data at commit time and written directly to the node — not stored as a reference.

Footer: `← Back` | `Add a statement` (inserts node, closes)

JSON output:
```json
{
  "id": "stmt_xxxxxxxx",
  "type": "for_each",
  "async": false,
  "variable": "$device",
  "role": "Smoke Detectors",
  "entity_ids": ["sensor.smoke_detector_basement", "sensor.smoke_detector_kitchen"],
  "statements": [],
  "description": null,
  "disabled": false
}
```

`role` is the label the user sees in the editor — either the friendly name(s) of the selected devices, a global variable name, or a mix. `entity_ids` is always the resolved list of real HA entity IDs captured at commit time.

### W-2-exit: Exit Detail

Fields: New piston state — operand (optional return value)

Footer: `← Back` | `Add` (inserts node, closes)

JSON output:
```json
{
  "id": "stmt_xxxxxxxx",
  "type": "exit",
  "value": null,
  "description": null,
  "disabled": false
}
```

---

## Screen W-3: Condition or Group Picker

**When:** Context is `trigger_or_condition`, `if_condition`, or `restriction`
**WebCoRE source:** `dialog-edit-condition` page 0

Triggers go directly to W-4 (skip W-3 — triggers are never wrapped in a group first).

### Layout — Two cards side by side

**Condition card (blue)**
- Title: "Condition"
- Text: "A condition is a single comparison between two or more operands, the basic building block of a decisional statement"
- Button: "Add a condition" → go to W-4

**Group card (orange)**
- Title: "Group"
- Text: "A group is a collection of conditions, with a logical operator between them, allowing for complex decisional statements"
- Button: "Add a group" → go to W-3b

### Footer
`Cancel`

---

## Screen W-3b: Group Builder

**WebCoRE source:** `dialog-edit-condition-group`

Fields: Logical Operator (AND | OR | XOR | Followed by), Whole group negation (Not negated | Negated)

Footer: `Cancel` | `Add` (inserts group node)

JSON output:
```json
{
  "id": "cond_xxxxxxxx",
  "type": "group",
  "operator": "and",
  "negated": false,
  "conditions": [],
  "group_operator": "and"
}
```

---

## Screen W-4: Condition Builder

**When:** User chose "Add a condition" from W-3, or editing existing condition
**WebCoRE source:** `dialog-edit-condition` page 1 with `comparison` template

**This is ONE screen — all fields visible at once. Not multi-step.**

### Fields top to bottom

**1. What to compare** — subject type selector
Options: Physical device(s) | Variable | Time | Date | Mode | Location | Expression

**2. Device picker** (when subject = Physical device(s))
- Button showing selected device (or "Nothing selected")
- Clicking opens inline panel below
- Panel: search input + scrollable list per device picker rules
- Multi-select allowed (aggregation applies when >1)

**Aggregation bar** (shown when device selected)
Any of the selected devices | All of the selected devices | None of the selected devices

**3. Attribute selector** (shown when device selected)
Dropdown from device capabilities. Populated via `API.getCapabilities(entity_ids)`.
Merges capabilities across all selected entity_ids. Falls back to DOMAIN_CAPS static map.

**4. What kind of comparison?**

*Triggers (⚡ — fire when this happens):*
changes, changes to, changes to any of, changes away from, changes away from any of,
drops, drops below, drops to or below, rises, rises above, rises to or above,
stays, stays equal to, stays any of, stays away from, stays away from any of,
stays unchanged, gets, gets any, receives, happens daily at, event occurs,
is any and stays any of, is away and stays away from

*Conditions (check current state):*
is, is any of, is not, is not any of, is between, is not between, is even, is odd,
was, was any of, was not, was not any of, changed, did not change,
is equal to, is not equal to, is less than, is less than or equal to,
is greater than, is greater than or equal to

**5. Value field** (shown when operator needs a value)
- Type: Value | Variable | Expression | Argument
- Widget adapts to attribute_type:
  - `binary` → select from values (on/off, open/closed, active/inactive, etc.)
  - `enum` → select from known values
  - `numeric` → number input + unit label
  - other → text input
- `is between` / `is not between` → TWO value fields with "and" between them

**6. Duration** (shown for was/changed/stays operators)
- Label: "In the last..." (was/changed) or "For the next..." (stays)
- Number input (default: 1) + unit: seconds | minutes | hours | days

**7. Which interaction** (shown when physical device selected)
Any interaction | Physical | Programmatic

**8. AND / OR** (shown when adding to existing if block that already has conditions)
Connects this condition to the previous one.
Select: AND | OR
Written to `group_operator` on this condition node.

### Footer (new condition — if block flow)
`← Back` | ⚙ | `Add more` | `Add`

### Footer (new condition — trigger/restriction context)
`Cancel` | ⚙ | `Add more` | `Add`

### Footer (edit existing condition)
`Cancel` | `Delete` | ⚙ | `Save`

### Add behavior — CRITICAL FLOW

**Path A: First condition on a new if block**
(Context = `trigger_or_condition` or came from "Add an if block")
1. Build condition node
2. Build if node: `{ type:"if", conditions:[condNode], then:[], else_ifs:[], else:[] }`
3. Call `Editor.insertStatement(ctx, ifNode)` — inserts entire if block
4. Close wizard
5. Editor re-renders — if block appears with then slot visible

**Path B: Adding condition to existing if block**
(Context = `if_condition`, `block-id` in extra)
1. Build condition node
2. Call `Editor.insertStatement('if_condition', condNode, { blockId: extra['block-id'] })`
3. Editor finds if block by blockId, appends condNode to `block.conditions`
4. `group_operator` on condNode = AND or OR (from field 8)

**Path C: "Add more"**
Same as Add but wizard stays open for another condition.
After Path A, subsequent conditions go through Path B.

### Condition JSON output (final format — what wizard commits)

```json
{
  "id": "cond_xxxxxxxx",
  "is_trigger": true,
  "role": "Front Door",
  "entity_ids": ["binary_sensor.front_door"],
  "aggregation": "any",
  "attribute": "contact",
  "attribute_type": "binary",
  "device_class": "door",
  "operator": "changes to",
  "display_value": "Open",
  "compiled_value": "on",
  "value_to": null,
  "duration": null,
  "duration_unit": null,
  "interaction": "any",
  "group_operator": "and"
}
```

**`is_trigger`** — `true` for trigger operators (⚡), `false` for condition operators.
Set by wizard based on which operator group the user picked.

**`role`** — human-readable label shown in the PistonCore editor. Display only.
Written at commit time alongside `entity_ids`.

**`entity_ids`** — array of real HA entity IDs. Always an array, even for single device.
Written at commit time from the wizard's selected device list.
**The compiler reads this directly. The wizard must always write entity_ids, never just a role name.**

**`display_value`** — shown in the PistonCore editor. For binary sensors this is the
friendly label ("Open", "Detected"). For all other types same as compiled_value.

**`compiled_value`** — used by the compiler when generating HA YAML. For binary sensors
this is always `"on"` or `"off"`. The compiler ALWAYS uses `compiled_value`. Never `display_value`.

**`aggregation`** — applies when multiple devices are selected: `"any"`, `"all"`, `"none"`.
Use `"any"` for single-device conditions.

**Binary value translation (display_value → compiled_value):**
open→on, closed→off, detected→on, clear→off, active→on, inactive→off,
wet→on, dry→off, home→on, away→off, locked→off, unlocked→on, on→on, off→off

**Time condition:**
```json
{
  "id": "cond_xxxxxxxx",
  "is_trigger": false,
  "role": "time",
  "entity_ids": [],
  "subject": "time",
  "operator": "is between",
  "value_from": "08:00:00",
  "value_to": "23:00:00",
  "only_on_days": [1, 2, 3, 4, 5],
  "group_operator": "and"
}
```

---

## Screen W-5: Action Device Picker (Step 1 of Action)

**When:** User chose "Add an action" from W-1
**WebCoRE source:** `dialog-edit-statement` page 1 type `action` / `dialog-edit-task` page 0

### Layout
- Description text
- Selected devices bar (shows labels, hidden until selection made)
- Search input inside list container at top
- Select All / Deselect All buttons
- Scrollable device list per device picker section order above

### Footer
`Cancel` | `Next →` (disabled until ≥1 device selected)

### After Next →
- Location selected → W-5b (Location Command Picker)
- Otherwise → W-6 (Command Picker)

---

## Screen W-5b: Location Command Picker

### Layout
```
With... Location
Do...
[Command select dropdown]
[Parameter fields appear after command selected]
```

### Commands

| ID | Label |
|---|---|
| `set_variable` | Set variable... |
| `execute_piston` | Execute piston... |
| `wait` | Wait... |
| `send_notification` | Send push notification... |
| `log_message` | Log to console... |
| `http_request` | Make an HTTP request... |
| `set_mode` | Set HA mode... |
| `raise_event` | Raise an event... |

### Footer
`← Back` | (Delete if editing) | ⚙ | `Save`

### JSON output examples

**set_variable:**
```json
{
  "id": "stmt_xxxxxxxx",
  "type": "set_variable",
  "variable": "myVar",
  "value": { "type": "expression", "expression": "some expression" },
  "description": null,
  "disabled": false
}
```

**wait:**
```json
{
  "id": "stmt_xxxxxxxx",
  "type": "wait",
  "wait_type": "duration",
  "duration": 5,
  "duration_unit": "minutes",
  "description": null,
  "disabled": false
}
```

**log_message:**
```json
{
  "id": "stmt_xxxxxxxx",
  "type": "log_message",
  "message": { "type": "literal", "data": "message text" },
  "level": "info",
  "description": null,
  "disabled": false
}
```

**execute_piston:**
```json
{
  "id": "stmt_xxxxxxxx",
  "type": "call_piston",
  "target_piston_id": "b7e2a1f4",
  "target_piston_name": "Announce Motion",
  "wait_for_completion": false,
  "description": null,
  "disabled": false
}
```

---

## Screen W-6: Command Picker (Step 2 of Action — Physical Devices)

**WebCoRE source:** `dialog-edit-task` page 0 (Do... section)

### Layout
```
With... {Device Name(s)}
Do...
[Command select dropdown]
[Parameter fields — appear after command selected]
```

### "With..." row
Single: `{Living Room Light}`
Multiple: `{Living Room Light}, {Kitchen Light}`

### Command select
Populated from `API.getServices(entity_id)`.
Default if API returns nothing: turn_on, turn_off, toggle.

### Parameter fields
Each field from service definition:
- Number → number input with min/max
- Select/enum → dropdown
- Boolean → true/false select
- Duration → number + unit select
- Text → text input

### "Add more" behavior
Inserts current task into action node's `tasks` array, reopens W-6 for same devices.
Does NOT create a new action node — accumulates tasks in one action node.

### Footer (new)
`← Back` | ⚙ | `Add more` | `Add`

### Footer (edit)
`← Back` | `Delete` | ⚙ | `Save`

### Action Node JSON output (complete — what wizard commits)

```json
{
  "id": "stmt_xxxxxxxx",
  "type": "action",
  "async": false,
  "role": "Living Room Light",
  "entity_ids": ["light.living_room"],
  "tasks": [
    {
      "id": "task_xxxxxxxx",
      "command": "turn_on",
      "domain": "light",
      "ha_service": "light.turn_on",
      "parameters": { "brightness_pct": 100 },
      "description": null
    }
  ],
  "description": null,
  "disabled": false
}
```

**`role`** — human-readable label shown in the editor. Display only. Never used for compilation.

**`entity_ids`** — array of real HA entity IDs. Written at commit time from wizard's device selection.
**The compiler reads this directly. Always an array, even for single device.**

**`ha_service` = `domain + "." + command` always. Never just `command`.**

Multi-device example:
```json
{
  "id": "stmt_xxxxxxxx",
  "type": "action",
  "async": false,
  "role": "Doors",
  "entity_ids": ["binary_sensor.front_door", "binary_sensor.back_door"],
  "tasks": [
    {
      "id": "task_xxxxxxxx",
      "command": "turn_on",
      "domain": "light",
      "ha_service": "light.turn_on",
      "parameters": {},
      "description": null
    }
  ],
  "description": null,
  "disabled": false
}
```

---

## Screen W-7: Variable Picker

**When:** Context is `variable`
**WebCoRE source:** `dialog-edit-variable`

### Layout — Single screen
- Type selector (~25%) + Name input (~75%) on same row
- Initial value section below — widget adapts based on var_type (see below)

### Type options

**Basic:** Dynamic, String (text), Boolean (true/false), Number (integer),
Number (decimal), Large number (long), Date and Time, Date (date only),
Time (time only), Device, Devices

**Advanced lists:** Dynamic list, String list, Boolean list, Number list (integer),
Number list (decimal), Large number list (long), Date and Time list, Date list, Time list

### Initial value — Widget by Type

| var_type | Initial value widget |
|---|---|
| `string`, `text` | Text input |
| `boolean` | True/False select |
| `integer`, `decimal`, `long` | Number input |
| `datetime`, `date`, `time` | Date/time picker |
| `device` | Single-select device picker (same picker sections as W-5, single-select only) |
| `devices` | **Multi-select device picker** (same picker as W-5/W-4, multi-select, no aggregation bar needed) |
| `dynamic` | Operand widget: Value \| Variable \| Expression \| Argument |
| list types | Hidden — lists have no initial value in v1 |

**`devices` type initial value:** When the user selects devices, entity_ids are resolved from live HA at commit time and written directly to `default_value`. Same rule as everywhere else — entity_ids captured at wizard commit, never at runtime.

Note: "By assigning an initial value, you instruct the piston to initialize
the variable on every run. If storing data between runs, leave as Nothing Selected."

### Footer (new)
`Cancel` | ⚙ | `Add more` | `Add`

### Footer (edit)
`Cancel` | `Delete` | ⚙ | `Save`

### JSON output — scalar types (string, number, boolean, datetime, device)
```json
{
  "id": "var_xxxxxxxx",
  "name": "my_light",
  "display_name": "My Light",
  "type": "device",
  "default_value": {
    "role": "Living Room Light",
    "entity_ids": ["light.living_room"]
  }
}
```

### JSON output — devices type (multi-select)
```json
{
  "id": "var_xxxxxxxx",
  "name": "my_lights",
  "display_name": "My Lights",
  "type": "devices",
  "default_value": {
    "role": "My Lights",
    "entity_ids": ["light.living_room", "light.kitchen", "light.hallway"]
  }
}
```

For `device` and `devices` types, `default_value` is always an object with `role`
(display label) and `entity_ids` (resolved array of real HA entity IDs). For all
other types, `default_value` is a scalar value matching the type.

If the user selects "Nothing selected" for initial value, `default_value` is `null`.

### for_each and piston variables — V1 Rule

**for_each always requires inline entity_ids on the for_each node itself.**
A piston `devices` variable cannot be used as the list source for for_each in v1.
Reason: HA native script `repeat: for_each:` requires a static list in the YAML —
there is no way to reference a runtime variable there. The list must be known at
compile time.

If a user wants to iterate over the same devices they stored in a variable, they
should pick those devices directly in the for_each wizard. The entity_ids are the
same — they just live on the for_each node instead of the variable node.
PyScript for_each with dynamic lists is a v2 feature.

### var_type mapping
```
Dynamic → dynamic
String (text) → string
Boolean (true/false) → boolean
Number (integer) → integer
Number (decimal) → decimal
Large number (long) → long
Date and Time → datetime
Date (date only) → date
Time (time only) → time
Device → device
Devices → devices
[list types append _list]
```

---

## Delete Statement

Every edit dialog for an existing node MUST show a Delete button.
Delete calls `Editor.deleteStatement(node.id)`.

The `_editNode` passed to `Wizard.open(context, node)` must be the full node
object with a valid `.id`. Verify every `_openWizardForEdit()` call in editor.js
passes the actual node as the second argument.

---

## AND / OR Between Conditions in an If Block

When adding a second or later condition to an existing if block:

1. W-4 shows AND/OR selector at the bottom (default: AND)
2. User choice written to `group_operator` on the new condition node
3. The `condition_operator` on the if block itself is a separate field — controls
   whether ALL conditions must be true (and) or ANY condition (or)

Both fields required for correct rendering and compilation.

---

## Advanced Options (Gear Button)

Available under ⚙ on every statement and condition dialog:
- Description (optional text)
- Disable statement (yes/no)
- Execution Method: Synchronous (default) | Asynchronous (except `every` and `on_event`)
- Task Execution Policy (action): Always | On condition change | On piston change | On either
- Task Cancellation Policy (action): Never | On condition change (default) | On piston change | On either
- Task Scheduling Policy (action): Override existing (default) | Allow multiple
- Subscription method (condition): Automatic | Always subscribe | Never subscribe

These are optional fields on statement/condition nodes.
The ⚙ button must exist and not crash — full implementation can follow core flow.

---

## Complete Flow: Minimum Viable Piston

Every step must work before anything else is declared done:

1. Open editor on new piston
2. Click `· add a new statement` → W-1 opens
3. Click "Add an if block" → W-3 opens
4. Click "Add a condition" → W-4 opens
5. Select a physical device → attribute populates → select attribute
6. Select an operator → value field appears → enter a value
7. Click "Add" → if node inserted with condition inside it → editor re-renders
8. Inside the `then` block, click `· add a new statement` → W-1 opens
9. Click "Add an action" → W-5 opens
10. Physical devices appear (filtered + deduped)
11. Select a device → click "Next →" → W-6 opens with "With... {device}"
12. Select a command → click "Add" → action node inserted inside if.then
13. Editor re-renders showing complete piston
14. Save succeeds — piston JSON contains entity_ids on all condition and action nodes

---

## Triggers vs Conditions — The Lightning Bolt Distinction

Triggers and conditions are the same data type (condition object) — they differ by
`is_trigger: true/false`. The wizard sets this flag based on which operator the user picked.

**Triggers (⚡):** Fire when something happens. Compile to the automation wrapper.
**Conditions:** Check current state. Compile to condition templates in the script body.

The distinction is determined by operator, not by where in the wizard the user clicked.
Triggers always have the ⚡ lightning bolt in their operator name.

---

## No-Trigger Warning — The Upgrade Flow

If the user saves a piston with no triggers defined:

**Step 1 — Warning on status page validation banner:**
*"⚠ This piston has no triggers. It will never run automatically."*

**Step 2 — Offer to upgrade:**
*"Would you like to promote one of your conditions to a trigger?"*
`[Yes — show me]` `[No — I'll add a trigger manually]`

**Step 3 — If Yes:**
Show the piston's conditions list. User picks one to promote.
PistonCore converts it:
- Moves it to the TRIGGERS section
- Changes `is_trigger` to `true`
- Updates the operator to the trigger-equivalent (e.g., "is Open" → "changes to Open")
- Shows the updated piston with the promoted trigger highlighted

---

## "was" vs "stays" — Critical Distinction

| | `was` (condition) | `stays` (trigger) |
|---|---|---|
| Lightning bolt | No ⚡ | Yes ⚡ |
| Direction | Looks **backward** in history | Looks **forward** in time |
| Meaning | "Has this been true for the past X?" | "If this stays true for the next X, fire again" |
| Use case | Check recent history | Set a forward-looking timer |

**Duration Row Labels — Different for was vs stays:**

`was`-type operators (backward-looking — CONDITION): label = **"In the last..."**
`stays`-type operators (forward-looking — TRIGGER): label = **"For the next..."**

---

## Virtual Devices

| Virtual Device | Purpose | Appears in |
|---|---|---|
| Location | System commands (set variable, wait, notify, etc.) | Actions only |
| System Start | Fires when HA restarts | Triggers only |
| Time | Time-based conditions and triggers | Conditions, Triggers |
| Date | Date-based conditions | Conditions only |
| Mode | Check or trigger on HA input_select / zone mode changes | Conditions, Triggers |

---

## $sunrise / $sunset Offset

When a user picks `$sunrise` or `$sunset` as a value, an offset row appears immediately below:

> `[+ / -]` `[number input]` `[minutes / hours]`

Store as:
```json
{
  "type": "system_variable",
  "name": "$sunset",
  "offset": 30,
  "offset_unit": "minutes",
  "offset_direction": "+"
}
```

---

## Value Types — Three Modes

| Mode | When to use | What shows |
|---|---|---|
| Value | Simple static value | Dropdown or text input depending on attribute type |
| Variable | Reference a piston or system variable | Two-section picker |
| Expression | Math, string concat, comparisons | Freeform textarea |

---

## What the Backend Must Provide for the Wizard

| Step | Backend call | Returns |
|---|---|---|
| Device picker | `GET /api/devices` | All devices with entity_id, friendly name, area, domain |
| Capability picker | `GET /api/device/{id}/capabilities` | List of capabilities with name, attribute_type, device_class |
| Enum state list | `GET /api/device/{id}/state` | Current state + options attribute if present |
| Service picker (actions) | `GET /api/device/{id}/services` | List of services with name, label, schema |
| Zones (location operators) | `GET /api/zones` | List of zones with id and label |

Trigger and condition operators are derived from attribute_type — no backend call needed.
Binary sensor friendly labels come from the device_class table in this document — not from HA.

---

## System Variables Reference

| Variable | Type | Description |
|---|---|---|
| $currentEventDevice | device | Device that triggered the piston |
| $previousEventDevice | device | Device that triggered the previous run |
| $device | device | Same as $currentEventDevice (shorthand) |
| $devices | device list | All devices matching a condition |
| $now | datetime | Current date and time |
| $date | date | Current date only |
| $time | time | Current time only |
| $hour | integer | Current hour (0–23) |
| $minute | integer | Current minute (0–59) |
| $second | integer | Current second (0–59) |
| $day | integer | Day of month |
| $month | integer | Month (1–12) |
| $year | integer | Year |
| $weekday | integer | Day of week (1=Monday) |
| $sunrise | time | Today's sunrise time |
| $sunset | time | Today's sunset time |
| $midnight | time | Midnight (00:00:00) |
| $noon | time | Noon (12:00:00) |
| $index | integer | Loop counter in for/for each loops |
| $utc | datetime | Current UTC time |
| $longitude | number | Hub location longitude |
| $latitude | number | Hub location latitude |

`$currentEventDevice`, `$previousEventDevice`, `$device`, `$devices` are PyScript-only in v1.

---

## Complete Statement Type Reference

| Statement type | Editor keyword | PyScript only? |
|---|---|---|
| `action` | `with {devices}` / `do` / `end with` | No |
| `do` | `do` / `end do` | No |
| `if` | `if` / `then` / `else if` / `else` / `end if` | No |
| `switch` | `switch ({expr})` / `case` / `default` / `end switch` | No |
| `for` | `for ({start} to {end} step {step})` / `do` / `end for` | No (simplified) |
| `for_each` | `for each ({var} in {list})` / `do` / `end for each` | No |
| `while` | `while` / `conditions` / `do` / `end while` | No |
| `repeat` | `repeat` / `do` / `until` / `conditions` / `end repeat` | No |
| `every` | `every {timer}` / `do` / `end every` | No |
| `on_event` | `on events from` / `do` / `end on` | **Yes** |
| `break` | `break` | **Yes** |
| `exit` | `exit {value}` | No |
| `set_variable` | `do Set variable {name} = {value}` | No |
| `wait` | `do Wait {duration}` or `do Wait until {time}` | No |
| `wait_for_state` | `do Wait for state` | No |
| `log_message` | `do Log message {text}` | No |
| `call_piston` | `do Execute piston {name}` | No |
| `cancel_pending_tasks` | `do Cancel all pending tasks` | **Yes** |

---

## Complete Operator Reference

### Condition Operators (no ⚡)

| Operator | Extra input needed |
|---|---|
| is | Value |
| is any of | Multi-value |
| is not | Value |
| is not any of | Multi-value |
| is between | Two values |
| is not between | Two values |
| is even | None (numeric only) |
| is odd | None (numeric only) |
| was | Value + duration "In the last..." |
| was any of | Multi-value + duration |
| was not | Value + duration |
| was not any of | Multi-value + duration |
| changed | Duration only |
| did not change | Duration only |
| is equal to | Value |
| is not equal to | Value |
| is less than | Value (numeric only) |
| is less than or equal to | Value (numeric only) |
| is greater than | Value (numeric only) |
| is greater than or equal to | Value (numeric only) |

### Trigger Operators (⚡)

| Operator | Extra input needed |
|---|---|
| ⚡ changes | None |
| ⚡ changes to | Value |
| ⚡ changes to any of | Multi-value |
| ⚡ changes away from | Value |
| ⚡ changes away from any of | Multi-value |
| ⚡ drops | None (numeric) |
| ⚡ drops below | Value (numeric) |
| ⚡ drops to or below | Value (numeric) |
| ⚡ rises | None (numeric) |
| ⚡ rises above | Value (numeric) |
| ⚡ rises to or above | Value (numeric) |
| ⚡ stays | Value + duration "For the next..." |
| ⚡ stays equal to | Value + duration |
| ⚡ stays any of | Multi-value + duration |
| ⚡ stays away from | Value + duration |
| ⚡ stays away from any of | Multi-value + duration |
| ⚡ stays unchanged | Duration only |
| ⚡ gets | Value |
| ⚡ gets any | None |
| ⚡ receives | Value |
| ⚡ happens daily at | Time or $sunrise/$sunset + offset |
| ⚡ event occurs | None |
| ⚡ is any and stays any of | Value + duration |
| ⚡ is away and stays away from | Value + duration |

---

## Location Virtual Device Commands

| Command | Parameters |
|---|---|
| Set variable | Variable picker + Value/Expression |
| Execute piston | Piston picker + optional Arguments |
| Set timezone | Timezone ID text input |
| Send push notification | Message + optional Title + optional Device |
| Log to console | Message + level (info/warn/error) |
| Make HTTP request | Method + URL + Content Type + optional Body |
| Send email | To + Subject + Body |
| Wait | Duration (ms/seconds/minutes/hours) |
| Set HA mode | Mode picker |
| Raise event | Event name + optional data |

File system commands (Write to file, Read from file, etc.) — skip v1, Hubitat-specific.

---

## Simple vs Complex Mode — Wizard Differences

**Simple mode wizard:**
- Does not show piston variable picker in value inputs
- Does not show loop statement types
- Does not show Wait for State action
- Does not show Call Another Piston action
- Does not show Cancel All Pending Tasks, Break, Switch, Do Block, On Event
- Duration operators are available

**Advanced mode wizard:** Shows everything.

---

## Not Building in V1 — Wizard Skip List

| Feature | Reason | Future? |
|---|---|---|
| Physical vs Programmatic interaction | PyScript only, sandbox validation needed first | v2 |
| XOR group operator | Too rare | Maybe v2 |
| `FOLLOWED BY` sequence trigger | No HA native equivalent | v2 PyScript |
| $weather variables | Requires HA weather integration | v2 |
| Real-time expression evaluation | v2 feature | v2 |
| File read/write commands | Hubitat-specific | No |

---

## Open Items

1. **Which-interaction step feasibility** — requires sandbox validation. PyScript context tracking needs to be confirmed as reliable.
2. **on_event wizard warning required** — when user adds `on_event` block, wizard must display a warning explaining it compiles to a blocking wait, not true async behavior.
3. **Collapse/expand for individual conditions inside an if block** — WebCoRE supported this. Include in v1 or defer?
4. **System variable availability in native script pistons** — confirm which system variables are expressible in native YAML templates.
5. **Expression editor** — v2.

---

## Upload List for Every Wizard Coding Session

WIZARD_SPEC.md, wizard-core.js, wizard-condition.js, wizard-action.js,
wizard-statement.js, wizard-loops.js, wizard-variable.js, editor.js,
PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
