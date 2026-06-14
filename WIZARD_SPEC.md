# PistonCore Wizard & Editor Specification

**Version:** 2.8
**Status:** Authoritative — covers all wizard modal behavior, editor canvas rendering,
  with-block/task model, and JavaScript architecture. Absorbs WITH_BLOCK_TASK_FRAMEWORK.md
  (retired) and editor rendering content moved from FRONTEND_SPEC.md v1.6.
**Last Updated:** June 2026 (D-S5d consolidation session — editor rendering rules,
  role label rules, aggregation display, inline validation, with-block/task model, and
  wizard JS architecture absorbed from FRONTEND_SPEC.md; WITH_BLOCK_TASK_FRAMEWORK.md
  content absorbed and that file retired. Verified WebCoRE Wizard Reference section added
  from WEBCORE_WIZARD_MAP.md (source-verified June 2026).
  Prior: Session 73 — W-6 reconciled to code; "Add more" annotated with GAP-S72-1 root
  cause; per-task edit/delete/virtual-task flows added.)
**Prior:** May 2026 (Session 69 / D-S5 + D-S5b — role_tokens added to all JSON
  output examples; _reResolveVariableUses contract; globals cache model; UI/data
  separation rule; resolution path rule. Session 69b — CODE_FINDINGS reconciliation
  (Path A, code authoritative): W-7 variable JSON corrected to actual code field names
  (var_type/initial_value). Session 69c — device variable model
  corrected: variables/globals store DEVICE NAMES (friendly names) and NEVER entity IDs;
  the Device Variables section and _reResolveVariableUses contract rewritten so resolution
  is name → live HA entities → attribute-bearing entity at the NODE; cross-referenced to
  PISTON_FORMAT.md "⭐ THE LOAD-BEARING RULE".)

**Authority rule:** WIZARD_REBUILD_SPEC.md is now merged into this document and retired.
This is the single wizard spec. All wizard coding must reference this document.

**Source:** WebCoRE piston.module.html, app.js, wizard-*.js files, PISTON_FORMAT.md v2.2,
STATEMENT_TYPES.md v2.2, SESSION_54_FINDINGS.md.

Read DESIGN.md and PISTON_FORMAT.md v2.4 before this document.

---

## Guiding Rules

What matches WebCoRE is **the code and how it is built** — two things:

1. **What the user sees on screen — the rendered piston** (the "code" as displayed). The statement tree exactly as it appears in the editor: `if` / `then` / `else` / `end if;`, `with` / `do` / `end with;`, `for each`, `only when`, the indentation, the keyword styling, how each statement type reads as a line on screen. This is the most important match in the whole project — a WebCoRE user should look at the rendered piston and recognize it immediately. The match is at the glass: the visible output. It says nothing about the JSON that produces that output — the render function reads PistonCore JSON (PISTON_FORMAT.md) and draws WebCoRE-familiar text. Same picture on screen, entirely different data underneath.

2. **The wizard that builds those statements** — the flow and feel of assembling a statement: the condition builder, the device/command pickers, the operand widget, the step sequence, the running plain-English sentence. WebCoRE users know this flow; matching it is what makes PistonCore feel familiar.

What does NOT need to match WebCoRE is the **page furniture around the code** — the piston-name field, the header area, button placement, the save/deploy buttons, the folder dropdown, the surrounding screen layout. That is all PistonCore's own. WebCoRE's arrangement of that furniture is irrelevant; only the code area and the wizard that builds it carry the WebCoRE-matching obligation.

This is a visual/UX rule about the code and the wizard. It does NOT mean match WebCoRE's data structure — piston JSON is PistonCore's own (PISTON_FORMAT.md) and owes nothing to WebCoRE's internal format. The wizard makes statement-building feel like WebCoRE while producing PistonCore JSON that compiles to whatever HA needs. How a selection is stored and compiled is PistonCore's concern, driven by HA's capabilities.

**PistonCore's own — first-class choices, not deviations, needing no justification against WebCoRE:**
- Dark-mode theme, palette, and font — PistonCore's look.
- Globals editable from any screen via the top bar — placement is PistonCore's call.
- Piston-list main screen, the editor's surrounding chrome (name field, header, button bar) — PistonCore's layout.
- Debug / test-compile / log screens — PistonCore's own; WebCoRE has no equivalent.

In the code area and the statement-building wizard, a visible departure from WebCoRE is worth a documented reason so it's a deliberate choice, not an accident. Where HA cannot reproduce a WebCoRE behavior, the rendered statement may still read the same but the execution differs, or the feature is cut (see HA_LIMITATIONS.md).

---

## Output Invariant

The wizard writes structured JSON only — it never writes display text or piston_text.
Every completed wizard flow produces a typed statement or condition object that is
inserted directly into the piston's statements array.

The wizard's internal state object (selections, sentence, step) is transient UI state.
It exists only while the wizard is open. It is discarded on Cancel. It is never written
to the piston JSON on Done — only the final typed output object is written.

This matches DESIGN.md Section 2 and PISTON_FORMAT.md exactly.

**The wizard is the ONLY thing that writes piston JSON.**
**The editor is the ONLY thing that reads and renders it.**
**Round-trip (wizard → JSON → editor → JSON → editor) must never silently drop,
duplicate, or corrupt nodes. Malformed nodes render as clearly-flagged placeholders —
they are never silently dropped.**

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
- `role_tokens` = raw tokens the user selected (entity_ids for physical devices, variable name for piston var, `@name` for global) — edit round-trip only
- `entity_ids` = array of real HA entity IDs resolved via `_getFlatEntityIds` — compiler reads this
- The wizard writes `entity_ids` at commit time, not role names

**On action commit:**
- `role` = human-readable label (e.g. `"Driveway Light"`) — display only
- `role_tokens` = raw tokens the user selected — edit round-trip only
- `entity_ids` = array of real HA entity IDs resolved via `_getFlatEntityIds` — compiler reads this

**The compiler reads `entity_ids` directly from each node. It never looks up a role name.**
`role` is a display label stored alongside `entity_ids` for the editor to show — nothing more.
`role_tokens` is stored alongside `entity_ids` for the editor to restore selections on re-open — the compiler must ignore it entirely.

### UI / Data Separation Rule

This rule applies everywhere in the wizard and editor without exception:

- `role` and `device_label` always contain **friendly names** — what the user typed or selected as a display label. Never an entity_id.
- `entity_ids` always contains **real HA entity IDs** (e.g. `light.driveway_main`). Never a friendly name, never a variable name.
- `role_tokens` contains the **raw selection tokens** the user picked — which may be entity_ids (for physical rows), variable names (no dot), or `@globals`. This is the only field allowed to contain a mix.

Mixing these is always a bug. If you see a friendly name in `entity_ids` or an entity_id in `role`, that is a commit-time bug — fix `_saveDeviceCmd` or `_buildConditionNode`, not the reader.

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

### Device Grouping by device_id

Physical device rows are grouped by HA `device_id`. One row per physical device.
A device with multiple entities (e.g. a motion sensor with `binary_sensor`, `sensor.illuminance`,
`sensor.battery`) shows as one row. The row carries all entity_ids for that group.

`primary_entity_id` is chosen from the group by domain priority:
```
light > switch > cover > fan > climate > lock > media_player >
input_boolean > input_number > input_select > automation >
binary_sensor > sensor > person > device_tracker > alarm_control_panel
```

The `primary_entity_id` is used for display label and capability lookup. All entity_ids
in the group are stored in `sel.tokens` when the row is clicked — never just primary.

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

**Global Variables section:** Shows all globals of type `Device` or `Devices` from
`globals.json`. When the user selects a global variable row, the wizard resolves its
`entity_ids` from live HA state at commit time and writes them directly to the node.
The global name (`@name`) is stored in `role_tokens`. The global's friendly name
becomes the `role` label.

Demo devices shown when no HA connection or as fallback.

### Search

Search filters the device list on display label and `primary_entity_id` only.
Sub-entity IDs (non-primary entities in a group) are not searched. Empty query shows all sections.

### Multi-Select Behavior

- Virtual devices: single-select, clicking immediately advances to next screen
- Physical devices: multi-select (aggregation bar appears when >1 selected)
- Local variables (device type): multi-select
- Global variables (Device/Devices type): single-select per global, but multiple globals can be selected together or mixed with physical devices. All selected entity_ids are merged into one flat array at commit time.
- System variables: single-select

**The aggregation bar** appears whenever more than one physical device group or variable is selected. The user picks any/all/none before committing.

---

### sel.tokens — How Physical Device Selection Works

`sel.tokens` is the authoritative selection tracker during a wizard session. It is
transient — it exists only while the wizard is open and is never written to the piston JSON.

#### What sel.tokens contains

- **Physical device row clicked** → ALL entity_ids for that device group are added to `sel.tokens` (e.g. clicking "Outdoor Motion" adds `binary_sensor.outdoor_motion`, `sensor.outdoor_motion_illuminance`, `sensor.outdoor_motion_temperature`, `sensor.outdoor_motion_battery` — all four)
- **Piston variable row clicked** → the variable name (no dot, e.g. `"MyLights"`)
- **Global variable row clicked** → the `@name` token (e.g. `"@Fountains"`)

Deselecting a physical row removes all its entity_ids from `sel.tokens`.

#### Why ALL entity_ids are stored for physical rows

`_getGroupedEntityIdsForTokens` finds a device's group by doing
`grouped.find(g => g.entity_ids.includes(token))`. It needs at least one real entity_id
from the group to find it.

If only `primary_entity_id` were stored and a multi-entity device is selected alongside
another device, `_getGroupedEntityIdsForTokens` would only find the group via the one
stored primary. Sub-entity ids would appear to belong to the other device's group,
causing the intersection to collapse incorrectly. Storing all entity_ids fixes this.

If this behavior ever produces a bug in a new situation, investigate `_getGroupedEntityIdsForTokens`
and `_getFlatEntityIds` — the resolution functions — not the `data-id` construction on rows.

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

The `isSelected` highlight check uses `ids.some(id => selTokens.has(id))` — a row
re-highlights correctly as long as any one of its entity_ids is in `sel.tokens`.

#### Capability intersection — union within group, then intersect across groups

A physical device in HA is ONE device that can have MULTIPLE entities. These are NOT
separate devices. "Outdoor Motion" with four sensor entities is one physical device.

**Step 1 — Union within a group:**
For each selected physical device group, fetch caps for ALL its entities and union them
into one cap set. When two entities in the same group both return a cap named `state`
but with different `device_class` values (e.g. `illuminance`, `temperature`, `battery`),
key the union map by `device_class || name` — not just `name` — so they appear as
distinct entries instead of all collapsing into one `state` entry.

**Step 2 — Intersect across groups:**
Only when more than one physical device group is selected, intersect the unioned cap sets
across groups. If only one group is selected, use its union directly — no intersection.

#### _getFlatEntityIds — commit time only

At commit time, `_getFlatEntityIds(sel.tokens)` resolves the full flat array of real
HA entity_ids to write to the node:
- Token has `.` → plain entity_id, pass through as-is
- Token has no `.` → piston variable name → resolve `initial_value` (friendly names) → all entity_ids in each group
- Token starts with `@` → global variable → resolve `value` (friendly names) → all entity_ids in each group

Returns flat deduplicated array. This is what gets written to `entity_ids` on the node.

**This is the only place token-to-entity-id resolution happens at commit time.**
Read-side walks of `entity_ids` on already-committed nodes do not re-resolve — they
trust what is on the node. If a read-side walk seems to need resolution, the bug is
in the commit path, not the read path.

#### _getGroupedEntityIdsForTokens — cap/service lookup only

Used by `_loadCapsIntoSelect` and `_goCommandPicker`. Returns array of arrays — one
inner array per physical device group — for the union-then-intersect cap lookup.
Never used for writing nodes.

#### Notes on edge cases

- If a device's entity list changes in HA after a node was committed (e.g. a new sensor
  entity is added to a device via reconfigure), the node's `entity_ids` will not include
  the new entity until the user re-opens and recommits that node. This is expected behavior.
  Entity validation at deploy time (DESIGN.md 9.2) will catch removed entities but not
  added ones — the node was correct when committed.
- `_reResolveVariableUses` handles the case where the *variable's device list* changes,
  not where HA's entity list changes. See the _reResolveVariableUses section below.

---

### Zero Devices Selected

If the user clicks Next or Done with zero devices selected:
- **Next button is disabled** while `WizardCore.sel.tokens.length === 0`
- Show inline error below the device list: *"You must select at least one device or variable to continue."*
- Error appears only after the user has interacted with the picker (not on first open)
- Error clears as soon as any device is selected

This applies to: W-5 (action device picker), W-4 (condition device picker), W-2-foreach (for_each list picker), W-7 (variable devices type picker).

### Role Label Generation

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

### Mixed Physical + Global Commit Logic

When the user selects a mix of physical devices and global Device/Devices variables:

1. Physical device rows: all their entity_ids are already in `sel.tokens` from click time
2. Global rows: `@name` token is in `sel.tokens`; `_getFlatEntityIds` resolves it to entity_ids at commit time
3. `_getFlatEntityIds(sel.tokens)` produces the final flat deduplicated entity_ids array
4. Deduplicate — if a physical device and a global both contain the same entity_id, it appears only once
5. Role label generated from selected row labels per rules above

### Edit Pre-fill for Multi-Device Nodes

When the user opens an existing condition, action, or for_each node for editing, the wizard must re-populate the device picker with the node's current selections.

**Hydration rule:**

On wizard open for edit, `_route()` reads `role_tokens` from the node (preferred) or
falls back to `entity_ids`, then falls back to `devices` array, then falls back to
`role` name. These are loaded into `WizardCore.sel.tokens`. During device list render,
a row highlights as selected if any of its entity_ids (or its variable name / @token)
is in `sel.tokens`:

```javascript
// Physical row highlight on re-render:
const ids = d.entity_ids || [d.primary_entity_id];
const isSelected = ids.some(id => selTokens.has(id));
```

**Identifying globals vs physical devices in an existing entity_ids list:**

`role_tokens` stores what the user originally selected (variable names, @globals, entity_ids). On edit, restore `sel.tokens` from `role_tokens` — this reliably re-highlights the correct rows. If `role_tokens` is absent (old-format node), fall back to `entity_ids` as tokens.

The role label shown on open is read from `editNode.role` — not regenerated.

### Aggregation Commit

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

---

## Device Variables (Defines) — How the Wizard Handles Them

A device variable (define) is a named group of devices the user wants to treat as one
unit. It is a **list of device references — friendly names** ("Kitchen Light", "Outdoor
Motion"). The friendly name is the lookup key: it is how PistonCore asks HA for that
device's current entity IDs. **The variable stores device names only — it NEVER stores
entity IDs.** Entity IDs are pulled live from HA whenever the variable is used, and the
resolved attribute-bearing entity IDs are written onto the consuming NODE, never back
onto the variable. See PISTON_FORMAT.md "⭐ THE LOAD-BEARING RULE" for the authoritative
contract.

### In the Picker

When the user picks a device variable row (local or global) in a condition or action
picker, the wizard takes the variable's device names, asks HA for each device's current
entities (live), and computes the capability intersection across all of them — only
capabilities every device in the group shares are shown in the attribute dropdown.

- If all devices have `motion` and `battery` → show both
- If only some have `motion` → do not show `motion`
- The user sees only what every device in the group can actually do

This live lookup is why the variable stores names, not entity IDs: the entity list is
always current, even if a device was reconfigured in HA since the variable was created.

### On Commit (Add / Add More)

When the user clicks Add or Add More, the wizard knows the attribute the user chose. For
each device in the variable, it resolves to the **entity that carries that attribute**
(one per device) and writes those entity IDs to `entity_ids` on the NODE. The variable
name becomes the `role` label for display; `role_tokens` stores the variable name (e.g.
`["Motion_sensor"]`) so the node can be re-resolved later.

Example: variable `Outdoor_Sensors` = `["Outdoor Motion", "Zooz outdoor"]`. Used in an
illuminance condition, the node gets
`entity_ids: ["sensor.outdoor_motion_illuminance", "sensor.zooz_outdoor_illuminance"]` —
two devices, two illuminance entities. Used in a motion trigger, the node gets the two
`*_motion` entities instead. The variable never changes; only the node's `entity_ids`
differ by attribute.

### _reResolveVariableUses Contract

Called in editor.js after any device variable (define) is saved by the user.

**What it does:**
1. Walks the entire piston tree recursively (statements, triggers, conditions, restrictions)
2. Finds every node where `role_tokens` contains the variable name (for local vars) or `@name` (for globals)
3. Re-resolves `entity_ids` on those nodes by: reading the variable's current device-name list, asking HA for each device's entities, and selecting the entity that carries the node's existing `attribute` — one per device. (Resolution is name → live HA entities → attribute-bearing entity. It does NOT read entity IDs out of the variable, because the variable has none.)
4. Other tokens in the same node (other variables, globals, physical devices) are preserved — only the changed variable's contribution is updated
5. Globals resolve from `_piston._globalsCache` (loaded at editor open via `API.getGlobals()`); a global's `value` is also a device-name list, resolved the same way

**What it does NOT do:**
- It does not update nodes that do not reference the changed variable in `role_tokens`
- It does not update nodes where `role_tokens` is absent (those nodes used physical devices only and do not need updating)
- It does not handle HA-side entity list changes (e.g. a new entity added to a device in HA). That requires the user to re-open and recommit the node.

**When `role_tokens` is absent on a node:** Fall back to treating `entity_ids` as tokens for the re-resolution check. If none of the entity_ids in the node match what the variable resolves to, skip the node — it does not reference this variable.

### Globals Cache Model

At editor open time, `API.getGlobals()` is called and the result is stored in
`_piston._globalsCache`. All globals resolution during the editor session reads from
this cache — including `_getFlatEntityIds` when it encounters `@` tokens, and
`_reResolveVariableUses` when it updates global references.

The cache is not refreshed during an editing session. If the user edits a global in
the globals drawer while the editor is open, the globals drawer updates
`_piston._globalsCache` directly after saving.

### Capability Intersection — Primary Entity per Group

For capability lookup (`_loadCapsIntoSelect`, `_goCommandPicker`), `_getPrimaryIdsForTokens`
is used instead of `_getGroupedEntityIdsForTokens` when the goal is to determine what
the user's *device* can do — one primary_entity_id per physical device group, not all
sub-entities. This produces shared device-level capabilities rather than the intersection
of all sub-entity capabilities, which is usually too narrow.

`_getGroupedEntityIdsForTokens` is still used when all entity_ids in a group genuinely
matter (e.g. multi-sensor aggregation conditions).

### Hard Rules

The following rules exist because violating them produced real bugs. The rationale is
documented above — if a rule seems wrong for a new situation, read the rationale first,
then discuss before changing anything.

- Physical row `data-id` construction stores all entity_ids comma-joined. This is required for `_getGroupedEntityIdsForTokens` to find groups correctly.
- The click handler adds all entity_ids in `data-id` to `sel.tokens`. Storing only primary_entity_id broke group intersection for multi-entity devices.
- The `isSelected` highlight check uses `ids.some(id => selTokens.has(id))`. Any one matching entity_id is enough to highlight the row correctly.
- The union-then-intersect logic in `_loadCapsIntoSelect` and `_goCommandPicker` is correct for multi-entity devices — union within group first, then intersect across groups.
- `_getFlatEntityIds` is the only token-to-entity-id resolution path at commit time. Read-side code that already has `entity_ids` on a committed node does not re-resolve — it trusts the node.
- `selected_entity_ids` does not exist as a field. The field is `sel.tokens`.
- Before changing any picker, token, or capability code: state in plain English exactly what you are changing and why, and confirm the rationale above does not apply before proceeding.

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
  "role_tokens": ["sensor.smoke_detector_basement", "sensor.smoke_detector_kitchen"],
  "entity_ids": ["sensor.smoke_detector_basement", "sensor.smoke_detector_kitchen"],
  "statements": [],
  "description": null,
  "disabled": false
}
```

`role` is the label the user sees in the editor. `role_tokens` stores what the user selected (entity_ids for physical rows, variable name for piston var, @name for global). `entity_ids` is always the resolved list of real HA entity IDs captured at commit time.

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
- Panel: search input + scrollable list per device picker section order above
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

**7. Which interaction** (shown when operator is a trigger — isTrigger(op) is true)
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
  "role_tokens": ["binary_sensor.front_door"],
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

**`role_tokens`** — raw tokens the user selected. Stored for edit round-trip only.
Compiler ignores this field. Editor must preserve it on every save.

**`entity_ids`** — array of real HA entity IDs. Always an array, even for single device.
Written at commit time from the wizard's selected device list via `_getFlatEntityIds`.
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
  "role_tokens": [],
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

> ⚠ **IMPLEMENTATION STATUS (Session 73 — VERIFIED against code):** This is the correct
> spec'd behavior, but the code does NOT do it yet. `_saveDeviceCmd` (wizard-action.js)
> rebuilds the whole action node with `tasks:[newTask]` on every commit — overwriting the
> array instead of appending. This is the true root cause of GAP-S72-1. The fix: commit one
> task via the existing `insertStatement('task', task, {blockId})` append seam (editor.js),
> which already pushes-or-replaces by `task.id`. The editor render and append seam already
> support multi-task blocks; only the wizard commit path is wrong. See
> WITH_BLOCK_TASK_FRAMEWORK.md §1.2 (BUG A) and §6 item 2.

### Editing one task in a multi-task block (Session 73 — currently broken, VERIFIED)
The editor renders each task line with its own `task.id` (editor.js), so clicking a task
should open THAT task. But `_route` (wizard-core.js) hydrates only `_editNode.tasks[0]`, so
editing the 2nd+ task is impossible. Fix: thread the clicked `task.id` into the edit context;
hydrate that task; on Save replace it by id via the same append seam. See
WITH_BLOCK_TASK_FRAMEWORK.md §1.2 (BUG B) and §3.2.

### Deleting one task (Session 73 — not yet covered)
Delete in task-edit mode removes only the addressed task by `task.id` from `tasks[]`,
preserving siblings and order. If the last task is removed, the empty action node is removed
(default; confirm — see framework spec §3.3). A remove-by-task-id path must be added (the
current `insertStatement` seam only inserts/replaces). See WITH_BLOCK_TASK_FRAMEWORK.md §3.3.

### Virtual tasks inside a device block (Session 73 — not yet possible)
`+ add a new task` inside a device with-block must offer BOTH device commands AND the
virtual/location commands (LOCATION_COMMANDS) in one picker (WebCoRE's three-group "Do…"
dropdown), and append a virtual task into the block's `tasks[]` — interleaved with device
tasks, order preserved. Today `_saveLocationCmd` only produces standalone statements or
fake one-task "Location" nodes, so Wait/notify/etc. cannot live inside a device block. The
non-device task carries the picker category it was selected under (how that's stored is a
coding-time choice — the framework owns this, not this screen spec). See
WITH_BLOCK_TASK_FRAMEWORK.md §1.2 (BUG C), §3.4, and §2.3.

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
  "role_tokens": ["light.living_room"],
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

**`role_tokens`** — raw tokens the user selected. Stored for edit round-trip only.
Compiler ignores this field. Editor must preserve it on every save.

**`entity_ids`** — array of real HA entity IDs. Written at commit time from wizard's device selection via `_getFlatEntityIds`.
**The compiler reads this directly. Always an array, even for single device.**

**`ha_service` = `domain + "." + command` always. Never just `command`.**

Multi-device example:
```json
{
  "id": "stmt_xxxxxxxx",
  "type": "action",
  "async": false,
  "role": "Doors",
  "role_tokens": ["binary_sensor.front_door", "binary_sensor.back_door"],
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

Variable/global example — role_tokens differs from entity_ids:
```json
{
  "id": "stmt_xxxxxxxx",
  "type": "action",
  "async": false,
  "role": "@Exterior_Lights",
  "role_tokens": ["@Exterior_Lights"],
  "entity_ids": ["light.driveway_main", "light.porch", "light.garage"],
  "tasks": [
    {
      "id": "task_xxxxxxxx",
      "command": "turn_off",
      "domain": "light",
      "ha_service": "light.turn_off",
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

**`devices` type initial value:** When the user selects devices, their **friendly names**
are stored in `initial_value` — NOT entity IDs. A device variable is a device list; entity
IDs are resolved live from HA at each consuming node, never stored on the variable. See
the "Device Variables (Defines)" section and PISTON_FORMAT.md "⭐ THE LOAD-BEARING RULE".

Note: "By assigning an initial value, you instruct the piston to initialize
the variable on every run. If storing data between runs, leave as Nothing Selected."

### Footer (new)
`Cancel` | ⚙ | `Add more` | `Add`

### Footer (edit)
`Cancel` | `Delete` | ⚙ | `Save`

### JSON output — scalar types (string, number, boolean, datetime)
```json
{
  "type": "variable",
  "id": "var_xxxxxxxx",
  "name": "message",
  "var_type": "string",
  "initial_value": "Hello"
}
```

### JSON output — device type (single-select)
```json
{
  "type": "variable",
  "id": "var_xxxxxxxx",
  "name": "my_light",
  "var_type": "device",
  "initial_value_type": "device",
  "initial_value": ["Living Room Light"]
}
```

### JSON output — devices type (multi-select)
```json
{
  "type": "variable",
  "id": "var_xxxxxxxx",
  "name": "my_lights",
  "var_type": "devices",
  "initial_value_type": "device",
  "initial_value": ["Living Room Light", "Kitchen Light", "Hallway Light"]
}
```

**Field names match the actual frontend code (not the older `type`/`default_value`
draft).** `type` is always `"variable"` (the node-kind marker); `var_type` is the
variable's data type; `initial_value` holds the value.

**`initial_value` for device/devices types holds a LIST OF DEVICE REFERENCES (friendly
names), NEVER entity IDs.** A device variable is a list of devices. It never stores entity
IDs — not at save, not resolved, not anywhere. The picker re-grabs each device's current
entities live from HA every time the variable is used, so the list stays accurate when
devices are reconfigured.

**Why the variable never holds entity IDs:** the same variable can feed many statements,
each using a different attribute (illuminance condition, motion trigger, battery condition).
There is no single correct set of entity IDs for the variable — resolution depends on what
attribute each consuming statement uses, so it can only happen at the node. See
PISTON_FORMAT.md "Device Variables and Globals — Entity IDs Live on NODES, Never on
Variables."

**`initial_value_type`** — set alongside `initial_value` to record how the value was entered
(`device` for the device picker). Omitted for "Nothing selected".

**Display source** — the editor reads the `initial_value` friendly-name array directly for
display. Current code does NOT write a separate `initial_device_names` field; the friendly
names in `initial_value` serve as both data and display. (If you see `initial_device_names`
in an older file, it duplicates `initial_value` and can be ignored.)

For all non-device variable types, `initial_value` is a scalar matching `var_type`.

If the user selects "Nothing selected" for initial value, `initial_value` is omitted or `null`.

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

## Editor Rendering Rules

This section covers how the editor canvas renders piston JSON. The editor is not the wizard — the wizard is the modal that writes JSON; the editor renders it. Both live in this spec because both are part of what the frontend developer builds, and the rendering rules must be consistent with the wizard's output.

### Visual Rules — Match WebCoRE Exactly

- Keywords in a distinct highlight color: `if`, `when true`, `when false`, `else if`, `else`, `end if;`, `with`, `do`, `end with;`, `only when`, `repeat`, `for each`, `end repeat;`, `execute`, `end execute;`, `define`, `end define;`, `settings`, `end settings;`
- Indentation increases with nesting depth — each level adds one indent stop (suggest 2rem per level)
- Curly braces `{` and `}` mark branch boundaries in editor display — styled same as keywords
- `end if;` closes every if block at the same indent level as the opening `if`
- `else if` and `else` appear at the same indent level as the opening `if`
- `when true` and `when false` label branches in **editor display**
- `then` and `end if;` are used in the **status page read-only view** and export format
- `and` and `or` between conditions appear at the **same indent level as the conditions**
- `until` in a repeat block appears at the **bottom** of the block, before `end repeat;`
- Statement numbers appear on the left side (used by Trace mode)
- Line numbers are NOT shown — trace uses statement numbers, not line numbers

Vertical structure lines are **not yet implemented.** Do not add them until scheduled.

### Ghost Text — Primary Insertion Method

At every valid insertion point, ghost text appears inline in a muted color. Ghost text is always visible at valid insertion points — not only on hover.

- `+ add a new statement` — at the top level and inside blocks
- `+ add a new task` — inside a with/do block
- `+ add a new trigger` — in the triggers section
- `+ add a new condition` — in the conditions section
- `+ add a new restriction` — after an `only when` line

Clicking any ghost text opens the wizard modal for that insertion point.

### Simple Mode Rendering

Simple mode shows:
- Comment header block
- `settings / end settings` (if non-empty)
- `define` block — **ALWAYS shown in both Simple and Advanced** (users define variables constantly)
- `execute` block with `+ add a new statement`
- NO `only when` blocks unless they have content

Advanced mode shows everything including `only when` blocks with ghost text.

### Right-Click Context Menu

Right-clicking any statement node shows:
- Copy selected statement
- Duplicate selected statement
- Cut selected statement
- Delete selected statement
- Clear clipboard (if clipboard has content)

Paste is triggered by clicking a ghost text insertion point when the clipboard has content. Cut statement is visually dimmed in place (50% opacity) until pasted or clipboard is cleared.

### Within-Block Drag to Reorder

Statements can be dragged to reorder within their containing block only. Dragging across block boundaries is not supported in v1 — use cut and paste. No undo for drag operations in v1.

### define Block — Variable Display Rules

- **Local variables (non-device):** Show name and current value. Example: `myCounter = 0`
- **Device variables:** Show name only. **Never show `= value` for device variables.**

```
define
  myCounter = 0
  motionSensor           ← device variable, no = value
  frontDoorLock          ← device variable, no = value
end define;
```

### Role Label Display Rules

Role labels appear in curly braces in condition and action lines:

```
⚡ Any of {Front Door and Back Door}'s contact changes to Open
   with {Downstairs Lights}
   for each ($device in {Smoke Detectors})
```

**Generating the role label (wizard commit time):**
- Single device → friendly name: `"Front Door"`
- Two devices → joined with " and ": `"Front Door and Back Door"`
- Three devices → first two with ", ", last with " and ": `"Front Door, Back Door and Garage Door"`
- Four or more → first name + count: `"Front Door +3"`
- Single global variable → @ prefix: `"@Door_Contacts_Exterior"`
- Mixed (physical + global) → resolve all, use first name + total count: `"Front Door +4"`

Generated once at commit time. Never regenerated from entity_ids at render time.

Global variable roles render with @ prefix inside the braces:
```
⚡ Any of {@Door_Contacts_Exterior}'s contact changes to Open
```

### Aggregation Display Rules

| aggregation | Rendered prefix |
|---|---|
| `"any"` | `Any of {role}` |
| `"all"` | `All of {role}` |
| `"none"` | `None of {role}` |

Single-device nodes always show `Any of` regardless of aggregation value. The aggregation bar in the wizard is always visible when more than one entity_id is present. Hidden for single-entity nodes.

**Aggregation → Compiler → HA output** (authoritative — compiler reads `aggregation` and uses this):

| aggregation | Native HA trigger | Native HA condition | PyScript trigger |
|---|---|---|---|
| `"any"` | entity_id array (HA fires on any) | Jinja2 `any()` template | One string per entity OR'd |
| `"all"` | Template trigger (no native all-match) | Jinja2 `all()` template | All strings must match |
| `"none"` | Template trigger | Jinja2 `none()` template | None of strings match |

### Inline Validation Feedback

Lightweight pre-compile warnings appear inline on statement rows. Informational only — never block editing or saving.

| Condition | Warning shown |
|---|---|
| Action or condition node has `entity_ids: []` | ⚠ "No device mapped — edit to assign" |
| for_each node has `entity_ids: []` | ⚠ "No devices in list — edit to assign" |
| Piston variable type `devices` has empty entity_ids | ⚠ "No devices assigned" |
| Condition node has no operator set | ⚠ "Incomplete condition" |

Warnings appear as a small ⚠ icon on the right side of the statement row. Hovering shows tooltip text. Clicking the row opens the wizard to fix.

### Global Variable Visual Distinction

In condition/action/for_each role labels: `{@Door_Contacts_Exterior}` — @ prefix inside curly braces.

In the define block:
```
define
  @MyLights        ← global variable reference — @ prefix, no = value
  myCounter = 0   ← local variable — name = value
end define;
```

---

## With-Block / Task Model

A `with {devices}` block in the action tree is an `action` node containing an ordered `tasks[]` array. This section covers the wizard's responsibility for building and maintaining that array. For the JSON schema, see PISTON_FORMAT.md §1.

### The Central Finding

The `tasks[]` container already exists in the codebase. The wizard and editor don't fully drive it yet — specifically, multi-task stacking (append vs overwrite), per-task edit, per-task delete, and virtual tasks inside device blocks are the remaining gaps. The architecture is correct; the gaps are behavioral.

### Governing Principles (DECIDED)

1. A `with {devices}` block can hold MULTIPLE tasks — not one. This is the core WebCoRE behavior (Set Volume then Speak, for example).
2. `tasks[]` is the universal ordered task container. Order = execution order. Round-trip must preserve it exactly.
3. Device tasks (service calls against the block's entity_ids) and virtual tasks (Wait, Set variable, notify, log — non-device) can be interleaved in the same block.
4. The wizard appends a new task to the existing array on "Add more." It does NOT overwrite the array.
5. Editing a task replaces it by task.id. It does NOT rebuild the node.
6. Per-task delete removes one task by task.id and preserves siblings.

### Editor Render — Multi-Task Example

```
with {Announcement_Sonos}
do
    Set Volume to 70%;
    Speak text "{Message}";
    + add a new task
end with;
```

### Wizard Behavior Contract

**Adding first task to a block:**
1. User clicks `+ add a new statement` → picks Action → picks devices → wizard commits the action node with `tasks: []`
2. Wizard immediately continues to task picker (command picker)
3. User picks command + parameters → wizard appends one task to `tasks[]` via `insertStatement('task', task, {blockId})`

**Adding more tasks (Add more):**
- "Add more" re-opens the command picker for the same block
- Each completion appends one task to the existing `tasks[]`
- Device picker is pre-filled with the block's existing devices (not shown again)

**Editing a task:**
- Clicking a task line opens the wizard hydrated with that task's data
- On commit, wizard replaces the task by `task.id` — does not rebuild the node or overwrite siblings

**Per-task delete:**
- Delete button on a task line removes that task by `task.id`
- If the last task is deleted: confirm whether to remove the action node entirely or leave it empty (open question — see TASKS.md GAP-S72-1 §3.3)

### What Is Implemented (coded, unverified — GAP-S72-1, Session 73)

- Action node shape (`type: "action"`, `entity_ids`, `tasks[]`) correct, editor renders multiple tasks
- Each task line carries its own `task.id` and is independently clickable
- Append seam (`insertStatement('task', ...)`) pushes or replaces tasks by id
- "Add more" coded to append rather than overwrite — untestable until picker resolves devices (GAP-S73-2)

### What Is Not Yet Built

- Per-task delete (removes one task, preserves siblings)
- Virtual tasks (Wait, Set variable, etc.) inside a device with-block (BUG C)
- Device picker pre-fill when adding a task to an existing block (GAP-S72-1b)

### Command Picker Vocabulary

Three groups in the task picker, built dynamically (verified from WebCoRE source):

**Common** — commands supported by ALL selected devices

**Partial** — commands supported by only SOME of the selected devices

**Virtual (Location commands)** — non-device commands available regardless of device selection

Commands have a type badge: `device` / `emulated` / `custom` / `location`.

Variable device resolution: if a device variable is selected instead of a specific device, the wizard attempts to resolve the variable's current value to get the device list; if empty/unknown, falls back to the full physical command DB.

### Virtual Tasks Inside a Device Block

The virtual command list (non-device tasks available inside a `with` block) maps to the Location virtual device commands from WebCoRE. These are commands that have no `r` (required capability) requirement — available to all blocks regardless of device. See the Location Virtual Device Commands section of this spec.

---

## Wizard JavaScript Architecture

The wizard is split into six files. Each file owns a distinct concern. All wizard files are loaded together; there is no dynamic import.

| File | Responsibility |
|---|---|
| `wizard-core.js` | Modal lifecycle, step navigation, sentence builder, Done/Cancel/Back, shared state |
| `wizard-statement.js` | Statement type picker (first step for action insertion) |
| `wizard-condition.js` | Condition builder, operator list, value input, group builder |
| `wizard-loops.js` | Repeat, For Each, While, For Loop step flows |
| `wizard-action.js` | With block, service call, set variable, log, call piston, break, exit |
| `wizard-variable.js` | Variable define step (used when adding entries to the define block) |

### Shared State — window.WizardCore

Wizard state that must be shared across files is exposed via `window.WizardCore` with explicit getter and setter properties. Files must never reach into another file's internal variables directly.

```javascript
window.WizardCore = {
  get currentStep() { ... },
  set currentStep(v) { ... },
  get selections() { ... },
  set selections(v) { ... },
};

// Correct
const step = window.WizardCore.currentStep;
window.WizardCore.selections = newSelections;

// Wrong — never reach into another file's scope directly
```

---

## Verified WebCoRE Wizard Reference

**Source:** `ady624/webCoRE` — `dashboard/html/modules/piston.module.html` and `piston.js` (master branch, fetched June 2026). Extracted directly from template HTML and JS source, no assumptions. Full extraction in WEBCORE_WIZARD_MAP.md.

**What "match WebCoRE" means here — read this first.** PistonCore matches WebCoRE's **visuals and UI**: what the editor canvas looks like, how the dialogs are laid out, the wizard step sequences, the operand picker's appearance, the card names and descriptions, the section render order. PistonCore does **NOT** match WebCoRE's data structure. The piston JSON is entirely PistonCore's own (defined in PISTON_FORMAT.md) and owes nothing to WebCoRE's internal format. Any WebCoRE field names that appear in WEBCORE_WIZARD_MAP.md (`lo`, `k`, `s`, `co`, `ro`, etc.) are WebCoRE's storage and are **never** a guide for how PistonCore stores anything.

So when this section says "match WebCoRE," it means *make the screen look and behave like that for the user*. How the resulting selection is stored, and how it compiles, is PistonCore's own concern — and is driven by what HA can actually do, not by what WebCoRE did. Where HA cannot reproduce a WebCoRE behavior, the visual may still match but the underlying execution differs (or the feature is cut). Everything below is VERIFIED from the cited source as a description of WebCoRE's UI; treat it as the visual baseline to adapt from, not a structural or behavioral contract.

### Statement Picker — WebCoRE's Card Set (VERIFIED)

WebCoRE shows 3 "simple" cards always, 9 "advanced" cards behind a toggle. PistonCore groups its statement picker differently (Execution / Control Flow / Loops / Advanced — see W-1), which is a deliberate design choice; the card *content* below is the verified WebCoRE reference for names, descriptions, and the simple/advanced split.

**Simple (always visible):**
- **If Block** — "An if block allows the piston to execute different actions depending on the truth result of a comparison or set of comparisons"
- **Action** — "An action allows the piston to control devices and execute tasks"
- **Timer** (our `every`) — "A timer will trigger execution of the piston at set time intervals"

**Advanced (behind toggle):**
- **Switch** — "compares an operand against a set of values and executes statements corresponding to those matches"
- **Do Block** — "can help organize several statements into a single block"
- **On event** (our `on_event`) — "executes its statements only when certain events happen"
- **For Loop** — "executes the same statements for a set number of iteration cycles"
- **For Each Loop** (our `for_each`) — "executes the same statements for each device in a device list"
- **While Loop** — "executes the same statements for as long as a condition is met"
- **Repeat Loop** — "executes the same statements until a condition is met"
- **Break** — "allows the interruption of the inner most switch, for loop, for each loop, while loop, or repeat loop"
- **Exit** — "interrupts the piston execution and exits immediately"

Total: 12 statement types. PistonCore's set matches these 12 (note: PistonCore type keys differ from WebCoRE's internal keys — PistonCore uses `for_each`/`on_event` where WebCoRE uses `each`/`on`).

### Statement Properties Panel (VERIFIED)

Per-statement properties WebCoRE exposes, and which statement types they apply to. PistonCore surfaces these through the cog/advanced-options area. Applicability may shift where HA's execution model differs:

| Property | Applies to | Options |
|---|---|---|
| Case Traversal Policy | switch only | Safe (auto-break) / Fall-through |
| Description | all | free text |
| Disabled | all | Yes / No |
| Execution Method | all except on, every | Synchronous / Asynchronous |
| Subscription Method | conditions, switch with `ct=='c'` | Auto / Always / Never |
| Task Cancellation Policy | all except on | Never / On condition state / On piston state / On condition or piston state |
| Task Execution Policy | all except on | Always / On condition state / On piston state / On condition or piston state |
| Task Scheduling Policy | action only | Override / Allow multiple |

Many of these are WebCoRE/Hubitat scheduling concepts. Which ones map cleanly to HA's automation/script model is a per-property question for the compiler work — treat applicability as flexible until verified against HA.

### dialog-edit-task Layout (VERIFIED)

WebCoRE's task dialog (the picker for a command inside an `action` with-block) is a single page containing, in order:
- **Header context** — shows the current device list for the block
- **Existing tasks preview** — tasks already in the with-block shown above and below the insertion point, clickable to reposition where the new task lands
- **"Do..." command picker** — three optgroups: "Commands available to all devices" (common), "Commands available to only some devices" (partial), "Location commands (non-device)" (virtual). Live search enabled.
- **Parameters** — rendered dynamically per selected command
- **"Only during these modes"** — multi-select, shown once a command is selected
- **Advanced** — description textarea

The **existing-tasks-preview with repositionable insertion point** is a WebCoRE behavior PistonCore's W-6 does not yet specify — worth adopting for multi-task blocks so the user can insert a task between two existing tasks, not only append. This supports the load-bearing task-order requirement.

### Operand Widget Input Types (VERIFIED)

WebCoRE's universal value picker offers these input types via a left dropdown, shown conditionally based on the operand's data type and context:

| Key | Type | Notes |
|---|---|---|
| `d` | Physical device(s), variable form | device operands, for-each lists |
| `p` | Physical device(s) with attribute | the standard device condition picker |
| `v` | Virtual device | Location, time, etc. |
| `s` | Preset | sunrise/noon/sunset/midnight for time; color presets for color |
| `c` | Value (constant) | plain input or dropdown by data type |
| `x` | Variable | local / global / system |
| `e` | Expression | textarea with autocomplete |
| `u` | Argument | plain text |

Visibility rules (VERIFIED, abbreviated — full logic in WEBCORE_WIZARD_MAP.md Part 23):
- Physical-device-with-attribute (`p`) is hidden for datetime/date/time/device/variable/duration data types
- Preset (`s`) appears only for datetime/time/color
- Constant (`c`) is hidden for device and variable data types
- Expression (`e`) is hidden for variable, strict-boolean, and event contexts
- In "constants only" mode (editing a local var, global var, or every-timer): only constant (`c`) or device-list (`d`) are offered

A **duration unit selector** (milliseconds / seconds / minutes / hours / days / weeks / months / years) is appended whenever the operand's data type is `duration`. PistonCore writes duration units as full words (see PISTON_FORMAT.md §14) — this matches the WebCoRE selector labels.

PistonCore's condition builder (W-4) and operand handling should offer this same set where the data type allows it. Which input types are actually reachable depends on what HA can express — treat the visibility rules as the WebCoRE baseline, adjusted where HA differs.

### comparison Widget — Three-Step Structure (VERIFIED)

WebCoRE's comparison widget (used in conditions, events, restrictions) is three steps:
1. **What to compare** (or "What event to expect" for events) — full operand widget for the left side
2. **What kind of comparison** — operator dropdown, grouped by category; not shown for events
3. **Compare to / Between** — right operand shown when the operator takes one parameter; a second right operand shown for range operators (two parameters)

Time-specific affordances appear when the left operand is the `time` virtual device: day-of-week / day-of-month / week-of-month / month-of-year multi-select filters, and offset fields for non-constant time values. Timed comparisons (`was` / `stays`) add an "In the last..." or "For..." duration operand. PistonCore's W-4 follows this structure; HA's trigger/condition model determines which operators and affordances are actually available (the operator lists themselves are PistonCore-defined — see below).

### Restriction Dialog Warning (VERIFIED)

WebCoRE's restriction dialog (`only when` blocks) carries a specific warning PistonCore should reproduce, because it captures a real semantic distinction: **"Restrictions DO NOT subscribe to events and will not cause the piston to run."** A restriction gates execution but never triggers it. This warning should appear when adding or editing a restriction.

### Piston-Level Render Order (VERIFIED)

WebCoRE's code editor renders piston sections in this order: comment header → settings → define (local variables) → only when (restrictions) → execute (main statements) → end execute. This matches the editor layout in FRONTEND_SPEC.md (define, then only when, then execute). Verified consistent.

### The Comparison Operator Lists Are PistonCore's to Define (VERIFIED gap)

The one piece of wizard vocabulary WebCoRE does NOT expose in its frontend source: the comparison operator lists themselves (`db.comparisons.conditions` and `db.comparisons.triggers` — "is", "is not", "was", "stays", "changes to", etc.). In WebCoRE these are served from the Hubitat/SmartThings backend. PistonCore must define its own operator vocabulary, mapping each operator to the appropriate HA trigger or condition type. PistonCore's operator list lives in the Complete Operator Reference section of this spec — that list is the PistonCore-defined equivalent, not a WebCoRE extraction.

---

## Open Items

1. **Which-interaction step feasibility** — requires sandbox validation. PyScript context tracking needs to be confirmed as reliable.
2. **on_event wizard warning required** — when user adds `on_event` block, wizard must display a warning explaining it compiles to a blocking wait, not true async behavior.
3. **Collapse/expand for individual conditions inside an if block** — WebCoRE supported this. Include in v1 or defer?
4. **System variable availability in native script pistons** — confirm which system variables are expressible in native YAML templates.
5. **Expression editor** — v2.
6. **Insert-between for multi-task blocks** — WebCoRE's task dialog lets the user position a new task between existing tasks via the existing-tasks preview. PistonCore W-6 currently only appends. Adopt insert-at-position for multi-task blocks.

---

## Upload List for Every Wizard Coding Session

WIZARD_SPEC.md, wizard-core.js, wizard-condition.js, wizard-action.js,
wizard-statement.js, wizard-loops.js, wizard-variable.js, editor.js,
DESIGN.md, PISTON_FORMAT.md, FRONTEND_SPEC.md, WEBCORE_WIZARD_MAP.md,
CLAUDE_SESSION_PROMPT.md, TASKS.md

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
