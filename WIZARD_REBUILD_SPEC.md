# WIZARD_REBUILD_SPEC.md

**Version:** 1.0
**Authority:** This document supersedes WIZARD_SPEC.md for all wizard behavior.
**Source:** WebCoRE piston.module.html (webcore3.txt), app.js (webcore1.txt),
           wizard.js (current), editor.js, PISTON_FORMAT.md v2.0, STATEMENT_TYPES.md v2.0
**Rule:** Match WebCoRE dialog flow exactly for all wizard dialogs.
         Output must always be nested tree JSON per PISTON_FORMAT.md v2.0.
         The wizard is the ONLY thing that writes piston JSON.
         The editor is the ONLY thing that reads and renders it.
         Round-trip (wizard → JSON → editor → JSON → editor) must work 100% of the time.

---

## Intentional PistonCore Differences from WebCoRE (Do NOT revert these)

- Globals editable from any screen via top bar — WebCoRE editor-only
- Main screen layout and debug/log screen — PistonCore design kept
- All other wizard dialogs: match WebCoRE exactly

---

## Critical Architecture Notes

### Nested Tree — Non-Negotiable
All JSON output uses the nested tree model. Children are embedded objects, never ID
references. No flat arrays. No stmtMap.

```
if node → then:[...], else:[...], else_ifs:[{conditions:[], statements:[]}]
action node → tasks:[...]  (embedded, not child statements)
do/for/for_each/while/repeat/every/on_event → statements:[...]
switch → cases:[{statements:[]}], default:[...]
```

### ID Format
- Statement IDs: `stmt_` + 8 hex chars (e.g. `stmt_a3f8c2d1`)
- Condition IDs: `cond_` + 8 hex chars (e.g. `cond_b7e2f941`)
- Task IDs: `task_` + 8 hex chars (e.g. `task_c1d4e823`)
- Case IDs: `case_` + 8 hex chars (e.g. `case_f2a1b903`)

### Condition Subject Object — Critical Field Alignment
The wizard MUST write conditions with a `subject` object. The editor reads `c.subject`.

**CORRECT (what editor reads):**
```json
{
  "id": "cond_a3f8c2d1",
  "is_trigger": true,
  "subject": {
    "type": "device",
    "role": "Living Room Light",
    "entity_id": "light.living_room",
    "capability": "switch",
    "attribute_type": "binary",
    "device_class": null
  },
  "aggregation": "any",
  "operator": "changes to",
  "display_value": "on",
  "compiled_value": "on",
  "value_to": null,
  "duration": null,
  "duration_unit": null,
  "interaction": "any",
  "group_operator": "and"
}
```

**WRONG (what wizard currently writes — flat fields that editor cannot read):**
```json
{ "role": "...", "attribute": "...", "operator": "..." }
```

This mismatch is why conditions render blank in the editor. Every condition
the wizard writes must use the `subject` object format shown above.

### Action Device Field — Critical Field Alignment
`devices` array in action nodes must contain **role names** (friendly labels),
not entity IDs. The device_map maps these roles to entity IDs at compile time.

`ha_service` MUST be `domain + "." + command` — never just `command` alone.

### Statement Insertion into if.then
When `· add a new statement` inside an `if then` block is clicked, the ghost
carries `data-block-id` and `data-branch="then"`. The wizard receives these in
the `extra` argument. `insertStatement` must use these to place the new statement
inside `if.then`, not at the top level.

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
Deduplicate by entity_id before rendering. The HA API returns duplicates.
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

### Four Source Sections (all pickers show these)
1. **Physical devices** — filtered + deduplicated HA entities
2. **Piston variables (device type)** — from `Editor.getPistonVariables()` filtered to `var_type === 'device'`
3. **Global variables (device type)** — deferred until globals implemented
4. **System variables** — `$currentEventDevice`, `$previousEventDevice`, `$device`, `$devices`, `$location`

Demo devices shown when no HA connection or as fallback.

### Search
Search filters all sections by name/entity_id. Empty query shows all sections.

---

## Dialog Flow Map

| User action | Context passed to wizard | First screen |
|---|---|---|
| `· add a new statement` (execute block or if.then) | `action` + `block-id` if inside branch | Statement Type Picker |
| `· add a new trigger or condition` | `trigger_or_condition` | Condition Builder |
| `· add a new condition` (inside if block) | `if_condition` + `block-id` | Condition Builder |
| `· add a new restriction` | `restriction` | Condition Builder |
| `· add a new variable` | `variable` | Variable Picker |
| `· add a new task` (inside action.tasks) | `task` + `block-id` | Action Device Picker |
| Click existing if/switch/do/etc. | edit — goes direct to type detail | Type-specific screen |
| Click existing condition | `edit_condition` | Condition Builder pre-filled |
| Click existing action task | `task` + node | Command Picker pre-filled |
| Click existing variable | `variable` + node | Variable Picker pre-filled |

---

## Screen W-1: Statement Type Picker

**When:** Context is `action` (adding new statement)
**WebCoRE source:** `dialog-edit-statement` page 0

### Layout — Two sections of cards

**Basic statements** (always shown):

| Type | Label | Description | Button text |
|---|---|---|---|
| `if` | If Block | Execute different actions depending on conditions | Add an if block |
| `action` | Action | Control devices and execute tasks | Add an action |
| `every` | Every | Trigger execution at set time intervals | Add a timer |

**Advanced statements** (shown always in PistonCore):

| Type | Label | Description | Button text |
|---|---|---|---|
| `switch` | Switch | Compare expression against list of values | Add a switch |
| `do` | Do Block | Group statements into a single block | Add a do block |
| `on_event` | On Event | Execute statements when certain events happen | Add an on event |
| `for` | For Loop | Repeat statements for a set number of times | Add a for loop |
| `for_each` | For Each Loop | Repeat for each device in a list | Add a for each loop |
| `while` | While Loop | Execute while a condition is true | Add a while loop |
| `repeat` | Repeat Loop | Execute until a condition is met | Add a repeat loop |
| `break` | Break | Interrupt the innermost loop | Add a break |
| `exit` | Exit | Stop piston execution immediately | Add an exit |

### What each button does

- `if` → go to W-3 (Condition/Group Picker) — if node created when first condition saved
- `action` → go to W-5 (Action Device Picker)
- `every` → go to W-2-every
- `switch` → go to W-2-switch
- `do` → insert do node immediately, close wizard
- `on_event` → insert on_event node immediately, close wizard
- `for` → go to W-2-for
- `for_each` → go to W-2-foreach
- `while` → insert while node immediately, close wizard
- `repeat` → insert repeat node immediately, close wizard
- `break` → insert break node immediately, close wizard
- `exit` → go to W-2-exit

### Footer
`Cancel`

---

## Screen W-2-every: Every (Timer) Detail

**WebCoRE source:** `dialog-edit-statement` page 1, type `every`

### Fields
- **Every...** — number input (default: 5) + unit select:
  milliseconds | seconds | minutes (default) | hours | days | weeks | months | years
- **Only during these minutes** (shown when unit is ms or s) — multi-select 0-59
- **Only during these hours** (shown when unit is ms, s, or m) — multi-select 0-23
- **Only on these days of the week** — multi-select Sun-Sat
- **Only on these days of the month** — multi-select 1-31 + last/second-last/third-last
- **Only on these weeks of the month** — multi-select 1st-5th + last
- **Only on these months of the year** — multi-select Jan-Dec

### Footer
`← Back` | `Add a statement` (inserts node, closes)

### JSON output
```json
{
  "id": "stmt_xxxxxxxx",
  "type": "every",
  "async": false,
  "interval": 5,
  "interval_unit": "minutes",
  "only_on_minutes": [],
  "only_on_hours": [],
  "only_on_days": [],
  "only_on_dom": [],
  "only_on_wom": [],
  "only_on_months": [],
  "statements": [],
  "description": null,
  "disabled": false
}
```

---

## Screen W-2-switch: Switch Detail

**WebCoRE source:** `dialog-edit-statement` page 1, type `switch`

### Fields
- **Expression** — operand widget (what to switch on)
- **Case Traversal Policy** (advanced): Safe (auto-break) | Fall-through

### Footer
`← Back` | `Add a case` (inserts node, closes)

### JSON output
```json
{
  "id": "stmt_xxxxxxxx",
  "type": "switch",
  "async": false,
  "expression": { "type": "literal", "data": "" },
  "case_traversal_policy": "safe",
  "cases": [],
  "default": [],
  "description": null,
  "disabled": false
}
```

---

## Screen W-2-for: For Loop Detail

**WebCoRE source:** `dialog-edit-statement` page 1, type `for`

### Fields
- **Start value** — number input (default: 1)
- **End value** — number input (default: 10)
- **Step** — number input (default: 1)
- **Counter variable** (optional) — select from piston variables of type integer/decimal/dynamic
  and global variables of same types

### Footer
`← Back` | `Add a statement` (inserts node, closes)

### JSON output
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

---

## Screen W-2-foreach: For Each Detail

**WebCoRE source:** `dialog-edit-statement` page 1, type `each`

### Fields
- **Counter variable** (optional) — select from piston variables of type `device`,
  and global device variables. This is the variable that receives the current device
  on each iteration.
- **List of devices** — device picker (which device group to iterate over)

### Footer
`← Back` | `Add a statement` (inserts node, closes)

### JSON output
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

---

## Screen W-2-exit: Exit Detail

**WebCoRE source:** `dialog-edit-statement` page 1, type `exit`

### Fields
- **New piston state** — operand (optional return value)

### Footer
`← Back` | `Add` (inserts node, closes)

### JSON output
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

### Fields
- **Logical Operator**: AND | OR | XOR | Followed by
- **Whole group negation**: Not negated | Negated

### Footer
`Cancel` | `Add` (inserts group node)

### JSON output
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
- Panel: search input + scrollable list
- List sections per device picker rules:
  - Physical devices (filtered + deduped HA entities)
  - Piston variables (device type only)
  - Global variables (device type) — deferred
  - System variables
- Multi-select allowed (aggregation applies when >1)

**Aggregation bar** (shown when device selected)
Any of the selected devices | All of the selected devices | None of the selected devices

**3. Attribute selector** (shown when device selected)
Dropdown from device capabilities. Attribute names: switch, brightness, contact, state, etc.

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

### JSON output (condition node — correct format)
```json
{
  "id": "cond_xxxxxxxx",
  "is_trigger": true,
  "subject": {
    "type": "device",
    "role": "Living Room Light",
    "entity_id": "light.living_room",
    "capability": "switch",
    "attribute_type": "binary",
    "device_class": null
  },
  "aggregation": "any",
  "operator": "changes to",
  "display_value": "on",
  "compiled_value": "on",
  "value_to": null,
  "duration": null,
  "duration_unit": null,
  "interaction": "any",
  "group_operator": "and"
}
```

**Binary value translation (display_value → compiled_value):**
open→on, closed→off, detected→on, clear→off, active→on, inactive→off,
wet→on, dry→off, home→on, away→off, locked→off, unlocked→on, on→on, off→off

**Time condition:**
```json
{
  "id": "cond_xxxxxxxx",
  "is_trigger": false,
  "subject": { "type": "time" },
  "operator": "is between",
  "value_from": "08:00:00",
  "value_to": "23:00:00",
  "only_on_days": [1,2,3,4,5],
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
- Scrollable device list

### Device list sections (in order)
1. **Virtual devices**: Location, Time, Date, Mode, System Start
2. **Physical devices** (filtered + deduplicated per domain rules above)
3. **Piston variables** — device-type only from `Editor.getPistonVariables()` where `var_type === 'device'`
4. **Global variables** — device-type globals (deferred)
5. **System variables**: `$currentEventDevice`, `$previousEventDevice`, `$device`, `$devices`
6. **Demo devices** (always shown)

### Selection behavior
- Virtual devices: single-select, clicking immediately advances to next screen
- Physical devices: multi-select
- Piston variables: multi-select
- System variables: single-select

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

### Parameter fields

**set_variable:** Scope (local/global) + variable name + value type + value textarea

**wait:** Duration number + unit (ms/s/m/h)

**log_message:** Message textarea + level (info/warn/error)

**execute_piston:** Piston select from known pistons

**send_notification:** Message textarea + title input (optional)

### Footer
`← Back` | (Delete if editing) | ⚙ | `Save`

### JSON output

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
Populated from `API.getServices(device_id)`.
Default if API returns nothing: turn_on, turn_off, toggle.

Groups:
- Commands available to all devices
- Commands available to only some devices
- Location commands (non-device)

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

### JSON output (complete action node)
```json
{
  "id": "stmt_xxxxxxxx",
  "type": "action",
  "async": false,
  "devices": ["Living Room Light"],
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

**`ha_service` = `domain + "." + command` always. Never just `command`.**
**`devices` = role labels (friendly names), NOT entity IDs.**

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
10. Piston device variables appear in the list (from define block)
11. Select a device → click "Next →" → W-6 opens with "With... {device}"
12. Select a command → click "Add" → action node inserted inside if.then
13. Editor re-renders showing complete piston
14. Save succeeds

---

## Known Current Bugs — Fix in This Order

**Bug 1 — Condition subject format (BLOCKER)**
Wizard writes flat `role`/`attribute` fields. Editor reads `subject` object.
Fix: `_buildConditionNode()` in wizard.js must write the `subject` object format.

**Bug 2 — Statement inserted at wrong level**
`· add a new statement` inside if.then puts node at top level.
Fix: pass `block-id` and `branch` from ghost through to insertStatement correctly.

**Bug 3 — Piston variables missing from device picker**
`Editor.getPistonVariables()` called but not filtered to `var_type === 'device'`.
Fix: filter correctly in all picker render functions.

**Bug 4 — Wrong/duplicate HA entities in device picker**
No domain filter, no deduplication.
Fix: `_renderActDevList`, `_renderDevPanelList` — add ALLOWED_DOMAINS filter + dedup.

**Bug 5 — `ha_service` wrong**
Writes bare `command` not `domain.command`.
Fix: `_saveDeviceCmd` — `ha_service: domain + '.' + command`.

**Bug 6 — AND/OR between conditions**
`group_operator` not shown or written when adding second condition.
Fix: show AND/OR selector in W-4 when context is `if_condition`.

**Bug 7 — Delete not working**
Verify `_openWizardForEdit` passes node correctly.
Verify delete button visible and wired on all edit dialogs.

---

## Implementation Session Order

One coding session per item. Do not combine.

**W-S1:** Bug 1 (condition subject format) + Bug 6 (AND/OR)
**W-S2:** Bug 2 (statement insertion into branches)
**W-S3:** Bugs 3 + 4 (device picker — piston variables + domain filter + dedup)
**W-S4:** Bugs 5 + 7 (ha_service field + delete)
**W-S5:** Smoke test — complete round-trip on minimum viable piston
**W-S6+:** Remaining statement types detail screens (for, for_each, switch, every)

### Upload list for every coding session
WIZARD_REBUILD_SPEC.md, wizard.js, editor.js, PISTON_FORMAT.md,
STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
