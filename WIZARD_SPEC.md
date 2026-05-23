# PistonCore Wizard Specification

**Version:** 2.0
**Status:** Authoritative — supersedes both WIZARD_SPEC.md v0.6 and WIZARD_REBUILD_SPEC.md v1.0
**Last Updated:** May 2026 (Session 55 — combined specs, entity_ids on nodes, device_map eliminated)

**Authority rule:** WIZARD_REBUILD_SPEC.md is now merged into this document and retired.
This is the single wizard spec. All wizard coding must reference this document.

**Source:** WebCoRE piston.module.html, app.js, wizard-*.js files, PISTON_FORMAT.md v2.1,
STATEMENT_TYPES.md v2.0, SESSION_54_FINDINGS.md.

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
  [$varName — filtered to var_type === 'device']
─ Global Variables (Device type) ───
  [@globalName — deferred until globals implemented]
─ System Variables ─────────────────
  [$currentEventDevice]
  [$previousEventDevice]
  [$device]
  [$devices]
  [$location]
```

Demo devices shown when no HA connection or as fallback.

### Multi-Select Behavior

- Virtual devices: single-select, clicking immediately advances to next screen
- Physical devices: multi-select (aggregation bar appears when >1 selected)
- Piston variables: multi-select
- System variables: single-select

### Search

Search filters all sections by name/entity_id. Empty query shows all sections.

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

Fields: Counter variable (optional), List of devices (device picker)

Footer: `← Back` | `Add a statement` (inserts node, closes)

JSON output:
```json
{
  "id": "stmt_xxxxxxxx",
  "type": "for_each",
  "async": false,
  "variable": "$device",
  "list_role": "SmokeDetectors",
  "statements": [],
  "description": null,
  "disabled": false
}
```

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
- Initial value section below (hidden for list types)

### Type options

**Basic:** Dynamic, String (text), Boolean (true/false), Number (integer),
Number (decimal), Large number (long), Date and Time, Date (date only),
Time (time only), Device

**Advanced lists:** Dynamic list, String list, Boolean list, Number list (integer),
Number list (decimal), Large number list (long), Date and Time list, Date list, Time list

### Initial value
Operand widget: Nothing selected | Physical device(s) | Value | Variable | Expression | Argument

Note: "By assigning an initial value, you instruct the piston to initialize
the variable on every run. If storing data between runs, leave as Nothing Selected."

### Footer (new)
`Cancel` | ⚙ | `Add more` | `Add`

### Footer (edit)
`Cancel` | `Delete` | ⚙ | `Save`

### JSON output
```json
{
  "type": "variable",
  "id": "stmt_xxxxxxxx",
  "name": "myLight",
  "var_type": "device",
  "initial_value_type": "device",
  "initial_value": "Living Room Light"
}
```

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
