# PistonCore — Statement Types Reference

**Version:** 2.1
**Status:** Authoritative — Required reference before compiler or wizard coding
**Last Updated:** May 2026 (Session 57 — action schema updated to role+entity_ids,
  for_each list_role replaced with role+entity_ids, condition schema updated with entity_ids)

This document defines every statement type PistonCore supports. For each type it specifies:
1. The structured JSON schema the wizard writes
2. The display text the editor renders from that JSON
3. The HA YAML the compiler emits

Source: WebCoRE piston.module.html (ng-template blocks), confirmed against
COMPILER_SPEC.md and WIZARD_SPEC.md.

Read DESIGN.md Section 6 and COMPILER_SPEC.md before this document.

---

## Rendering Rules — Core Invariant

**Every edit operation acts on structured JSON first. Rendering is always a pure
projection from that structure. Rendered labels like `then`, `end if`, `when true`,
`end with` are never treated as editable nodes — they are display artifacts only.**

The editor calls a render function per statement type. The render function receives
the structured JSON object and returns display text. The same render functions are
used for editor display AND for the Snapshot preview on export.

**The editor must render from JSON correctly 100% of the time, every time, without
fail.** This is the non-negotiable foundation of the project. It is why the data
model uses a nested tree — children are embedded objects, never ID references.

---

## Nested Tree Model — How Children Work

Control flow nodes (`if`, `while`, `repeat`, `for`, `for_each`, `do`, `switch`,
`on_event`, `every`) own their children directly. The `then`, `else`, `statements`,
`else_ifs`, and `cases` arrays contain child statement objects embedded inline.

**There are no ID references between statements anywhere in the format.**

```json
{
  "id": "stmt_001",
  "type": "if",
  "then": [
    { "id": "stmt_002", "type": "action", ... },
    { "id": "stmt_003", "type": "set_variable", ... }
  ],
  "else": [],
  "else_ifs": []
}
```

The compiler walks this tree recursively. The editor renders it recursively.
Insert means add to the owning array. Remove means splice from the owning array.
Nothing can become orphaned because there is no separate lookup step.

`tasks` inside `action` nodes are also embedded objects (not child statements).
This is consistent with the nested tree model — everything is embedded.

---

## 1. action (with/do block)

### JSON Schema

```json
{
  "id": "stmt_001",
  "type": "action",
  "async": false,
  "role": "Living Room Light",
  "entity_ids": ["light.living_room"],
  "tasks": [
    {
      "id": "task_001",
      "command": "turn_on",
      "domain": "light",
      "ha_service": "light.turn_on",
      "parameters": {
        "brightness_pct": 75
      },
      "description": null
    }
  ],
  "description": null,
  "disabled": false
}
```

**Fields:**
- `async` — boolean, default false. If true renders as `async with`
- `role` — human-readable label shown in the editor (e.g. `"Living Room Light"`). Display only. Written at wizard commit time. Never used for compilation.
- `entity_ids` — array of real HA entity IDs. Written at wizard commit time from the live device picker selection. Always an array, even for a single device. The compiler reads this directly — it never looks up a role name. Multi-device example: `["light.living_room", "light.kitchen", "light.hallway"]`
- `tasks` — array of task objects embedded directly in the action node (see task schema below)

**Multi-device example:**
```json
{
  "id": "stmt_001",
  "type": "action",
  "async": false,
  "role": "Downstairs Lights",
  "entity_ids": ["light.living_room", "light.kitchen", "light.hallway"],
  "tasks": [
    {
      "id": "task_001",
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

### Task Schema

```json
{
  "id": "task_001",
  "command": "turn_on",
  "domain": "light",
  "ha_service": "light.turn_on",
  "parameters": {},
  "description": null
}
```

Tasks are embedded objects inside the action node. They are never referenced by ID
from outside the action node.

### Editor Render

```
with {Lights}
do
  Turn on;
end with;
```

Multi-task:
```
with {Announcement_Sonos}
do
  Set Volume to 70%;
  Speak text "{Message}";
end with;
```

Single task shorthand (when only one task and no restrictions):
```
● do Turn on {Lights};
```

### Compiler Output

Single device:
```yaml
- alias: "stmt_001"
  action: light.turn_on
  target:
    entity_id: light.living_room
  data:
    brightness_pct: 75
  continue_on_error: true
```

Multi-device — entity_ids array passed directly to target (HA handles all entities simultaneously):
```yaml
- alias: "stmt_001"
  action: light.turn_on
  target:
    entity_id:
      - light.living_room
      - light.kitchen
      - light.hallway
  data:
    brightness_pct: 75
  continue_on_error: true
```

The compiler always emits `target.entity_id` as a list when `entity_ids` has more than one entry. Single-entity pistons may use a scalar string for readability — both forms are valid HA YAML.

---

## 2. do (grouping block)

### JSON Schema

```json
{
  "id": "stmt_002",
  "type": "do",
  "async": false,
  "statements": [],
  "description": null,
  "disabled": false
}
```

**Fields:**
- `statements` — array of child statement objects embedded directly (nested tree model)

### Editor Render

```
do
  [statements]
end do;
```

### Compiler Output

```yaml
- alias: "stmt_002"
  sequence:
    [compiled statements]
```

---

## 3. if

### JSON Schema

```json
{
  "id": "stmt_003",
  "type": "if",
  "async": false,
  "conditions": [],
  "condition_operator": "and",
  "then": [],
  "else_ifs": [
    {
      "id": "elseif_001",
      "conditions": [],
      "condition_operator": "and",
      "statements": []
    }
  ],
  "else": [],
  "description": null,
  "disabled": false
}
```

**Fields:**
- `conditions` — array of condition objects for this if block
- `condition_operator` — `"and"` / `"or"` connecting multiple conditions
- `then` — array of child statement objects embedded directly (nested tree model)
- `else_ifs` — array of else-if branch objects, each containing `conditions` and `statements` (child objects, nested)
- `else` — array of child statement objects embedded directly (nested tree model)

### Editor Render

Simple:
```
if
  [conditions]
then
  [statements]
end if;
```

With else:
```
if
  [conditions]
then
  [statements]
else
  [statements]
end if;
```

With else if:
```
if
  [conditions]
then
  [statements]
else if
  [conditions]
then
  [statements]
else
  [statements]
end if;
```

### Compiler Output

```yaml
- alias: "stmt_003"
  if:
    - condition: template
      value_template: "[compiled condition]"
  then:
    [compiled then statements]
  else:
    [compiled else statements]
```

---

## 4. switch

### JSON Schema

```json
{
  "id": "stmt_004",
  "type": "switch",
  "async": false,
  "expression": {
    "type": "variable",
    "name": "$count"
  },
  "case_traversal_policy": "safe",
  "cases": [
    {
      "id": "case_001",
      "case_type": "single",
      "value": 1,
      "statements": []
    },
    {
      "id": "case_002",
      "case_type": "range",
      "value_from": 5,
      "value_to": 10,
      "statements": []
    }
  ],
  "default": [],
  "description": null,
  "disabled": false
}
```

**Fields:**
- `cases` — array of case objects. Each case's `statements` is an array of child statement objects embedded directly (nested tree model)
- `default` — array of child statement objects embedded directly (nested tree model)

**`case_traversal_policy`:** `"safe"` (auto-break) or `"fallthrough"` (programmer style)

### Editor Render

```
switch ($count)
  case 1:
    [statements]
  case 5 through 10:
    [statements]
  default:
    [statements]
end switch;
```

### Compiler Output

```yaml
- alias: "stmt_004"
  choose:
    - conditions:
        - condition: template
          value_template: "{{ states('input_number.pistoncore_count') | int == 1 }}"
      sequence:
        [compiled case 1 statements]
    - conditions:
        - condition: template
          value_template: "{{ states('input_number.pistoncore_count') | int >= 5 and states('input_number.pistoncore_count') | int <= 10 }}"
      sequence:
        [compiled case 2 statements]
  default:
    [compiled default statements]
```

---

## 5. for

### JSON Schema

```json
{
  "id": "stmt_005",
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

**Fields:**
- `statements` — array of child statement objects embedded directly (nested tree model)

### Editor Render

```
for ($count = 1 to 10 step 1)
do
  [statements]
end for;
```

Without counter variable:
```
for (1 to 10)
do
  [statements]
end for;
```

### Compiler Output

```yaml
- alias: "stmt_005"
  repeat:
    count: 10
    sequence:
      [compiled statements]
```

**Note:** Emits CompilerWarning if start != 1 or step != 1. Native HA script
repeat only supports count-based loops.

---

## 6. for_each

### JSON Schema

```json
{
  "id": "stmt_006",
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

**Fields:**
- `variable` — the loop variable name (with `$` prefix). On each iteration, `$device` holds the current entity_id string.
- `role` — human-readable label shown in the editor. Display only. Never used by the compiler.
- `entity_ids` — array of real HA entity IDs to iterate over. Written at wizard commit time from the live device picker selection. The compiler uses this list directly — no lookup, no runtime resolution.
- `statements` — array of child statement objects embedded directly (nested tree model)

**The same rule as action and condition nodes:** entity_ids are captured from the live HA device picker at wizard commit time and stored directly on the node. If the user picks a global Devices variable in the picker, its entity_ids are resolved and written inline at that moment. The compiled YAML always has a static list.

Inside the loop body, `$device` holds the current entity_id and can be referenced in actions:
```json
{
  "id": "task_001",
  "command": "turn_on",
  "domain": "light",
  "ha_service": "light.turn_on",
  "parameters": {},
  "description": null
}
```
The compiler emits `target.entity_id: "{{ repeat.item }}"` for actions inside a for_each body.

### Editor Render

```
for each ($device in {Smoke Detectors})
do
  [statements]
end for each;
```

The role label is shown in curly braces. The entity count is shown as a subtitle when the block is collapsed:
```
for each ($device in {Smoke Detectors})  ← 2 devices
```

### Compiler Output

```yaml
- alias: "stmt_006"
  repeat:
    for_each:
      - sensor.smoke_detector_basement
      - sensor.smoke_detector_kitchen
    sequence:
      [compiled statements — actions use target.entity_id: "{{ repeat.item }}"]
```

The compiler writes the `entity_ids` array directly into `for_each:`. No lookup required.

---

## 7. while

### JSON Schema

```json
{
  "id": "stmt_007",
  "type": "while",
  "async": false,
  "conditions": [],
  "condition_operator": "and",
  "statements": [],
  "description": null,
  "disabled": false
}
```

**Fields:**
- `statements` — array of child statement objects embedded directly (nested tree model)

### Editor Render

```
while
  [conditions]
do
  [statements]
end while;
```

### Compiler Output

```yaml
- alias: "stmt_007"
  repeat:
    while:
      - condition: template
        value_template: "[compiled condition]"
    sequence:
      [compiled statements]
```

---

## 8. repeat (do/until)

### JSON Schema

```json
{
  "id": "stmt_008",
  "type": "repeat",
  "async": false,
  "statements": [],
  "until_conditions": [],
  "condition_operator": "and",
  "description": null,
  "disabled": false
}
```

**Fields:**
- `statements` — array of child statement objects embedded directly (nested tree model)

### Editor Render

```
repeat
do
  [statements]
until
  [conditions]
end repeat;
```

### Compiler Output

```yaml
- alias: "stmt_008"
  repeat:
    sequence:
      [compiled statements]
    until:
      - condition: template
        value_template: "[compiled until condition]"
```

---

## 9. every (timer)

### JSON Schema

```json
{
  "id": "stmt_009",
  "type": "every",
  "interval": 5,
  "interval_unit": "minutes",
  "at_minute": null,
  "at_time": null,
  "only_on_days": [],
  "only_on_dom": [],
  "only_on_months": [],
  "statements": [],
  "description": null,
  "disabled": false
}
```

**Fields:**
- `statements` — array of child statement objects embedded directly (nested tree model)

**`interval_unit` values:** `"ms"`, `"s"`, `"m"`, `"h"`, `"d"`, `"w"`, `"n"` (month), `"y"`

### Editor Render

```
every 5 minutes
do
  [statements]
end every;
```

With constraints:
```
every 1 hour at minute 0, only on Mondays and Fridays
do
  [statements]
end every;
```

### Compiler Output

Compiles as a trigger in the automation wrapper, not as a statement in the script body:

```yaml
- trigger: time_pattern
  minutes: "/5"
```

**Note:** Advanced scheduling (day/month filters) emits CompilerWarning and compiles
with basic time_pattern only.

---

## 10. on_event (PyScript only)

### HA Limitation — Read Before Using

**`on_event` in PistonCore compiles to a blocking wait, not a true async listener.**

In WebCoRE (Hubitat), `on_event` ran as a genuinely asynchronous background listener —
the piston body continued executing while `on_event` watched for device activity
independently. **Home Assistant cannot replicate this behavior.**

In PistonCore, `on_event` compiles to `task.wait_until()` in PyScript — the piston
**pauses at that point** until one of the specified device events fires, then runs the
statements and continues. The rest of the piston does not run in parallel.

**What this means in practice:**
- Tracking last-active time, capturing `$currentEventDevice`, reacting to the next
  device event — these all work correctly.
- A piston that does other work while simultaneously watching for device events in the
  background — **this cannot be done in HA**. It is an HA platform limitation, not a
  PistonCore limitation.

**Required wizard warning:** When a user adds an `on_event` block, the wizard must
display a clear warning explaining the blocking behavior and that true async listening
is not available in HA. This must also be documented in the PistonCore user docs under
a "PistonCore can't do this — because HA can't do it" section.

**Required compiler warning:** `CompilerWarning` with code `ON_EVENT_BLOCKING` must
always be emitted when compiling an `on_event` statement, regardless of context.

---

### JSON Schema

```json
{
  "id": "stmt_010",
  "type": "on_event",
  "conditions": [
    {
      "id": "cond_001",
      "is_trigger": true,
      "role": "Doors",
      "entity_ids": ["binary_sensor.front_door", "binary_sensor.back_door"],
      "aggregation": "any",
      "attribute": "contact",
      "attribute_type": "binary",
      "device_class": "door",
      "operator": "changes to",
      "display_value": "Open",
      "compiled_value": "on",
      "group_operator": "and"
    }
  ],
  "condition_operator": "and",
  "statements": [],
  "description": null,
  "disabled": false
}
```

**Fields:**
- `conditions` — standard condition objects (same schema as `if`, `while`, `repeat`).
  `is_trigger: true` on these conditions — they watch for device state changes.
- `condition_operator` — `"and"` / `"or"` connecting multiple conditions
- `statements` — array of child statement objects embedded directly (nested tree model)

**System variables available inside `on_event` statements:**

| Variable | Meaning | PyScript source |
|---|---|---|
| `$currentEventDevice` | Entity ID of the device that fired | `var_name` from kwargs |
| `$currentEventValue` | New state value that fired | `value` from kwargs |
| `$currentEventAttribute` | Attribute that changed | derived from condition |

### Editor Render

```
on events
  ⚡ Any of {Doors}'s contact changes to Open
do
  [statements]
end on;
```

With blocking warning shown inline in the editor:
```
⚠ Blocks until event fires — not async
```

### Compiler Output

PyScript only. Forces PyScript compilation via target-boundary.json.
Native HA script compilation raises CompilerError with code `PYSCRIPT_REQUIRED`.

```python
# stmt_010 — on_event: any of Doors changes to Open
# ⚠ BLOCKING: piston pauses here until event fires (HA limitation — not truly async)
result = task.wait_until(
    state_trigger=[
        "binary_sensor.front_door_contact == 'on' and binary_sensor.front_door_contact.old != 'on'",
        "binary_sensor.back_door_contact == 'on' and binary_sensor.back_door_contact.old != 'on'"
    ],
    timeout=None   # waits indefinitely by default — user can set timeout via description field
)
var_name = result.get("var_name")
value = result.get("value")
# [compiled child statements — $currentEventDevice resolves to var_name]
```

**Timeout:** `on_event` has no user-facing timeout field in v1. It waits indefinitely.
This is intentional — adding a timeout UI is a v2 feature. The compiler emits
`CompilerWarning` with code `ON_EVENT_BLOCKING` on every compile.

---

## 11. break (PyScript only)

### JSON Schema

```json
{
  "id": "stmt_011",
  "type": "break",
  "description": null,
  "disabled": false
}
```

### Editor Render

```
break;
```

### Compiler Output

PyScript only. Forces PyScript compilation via target-boundary.json.
Native HA script compilation raises CompilerError.

---

## 12. exit (stop/return)

### JSON Schema

```json
{
  "id": "stmt_012",
  "type": "exit",
  "value": {
    "type": "literal",
    "data": "true"
  },
  "description": null,
  "disabled": false
}
```

### Editor Render

```
exit true;
```

Without value:
```
do Stop;
```

### Compiler Output

```yaml
- alias: "stmt_012"
  stop: "exit"
```

---

## 13. set_variable

### JSON Schema

```json
{
  "id": "stmt_013",
  "type": "set_variable",
  "variable": "$message",
  "value": {
    "type": "literal",
    "data": "Hello"
  },
  "description": null,
  "disabled": false
}
```

**Value types:** `"literal"`, `"variable"`, `"expression"`, `"system_variable"`

### Editor Render

```
do Set variable {message} = {"Hello"};
```

With expression:
```
do Set variable {message} = {"$currentEventDevice Opened"};
```

With number:
```
do Set variable {count} = {0};
```

### Compiler Output

Piston variable:
```yaml
- alias: "stmt_013"
  variables:
    message: "Hello"
```

Global variable:
```yaml
- alias: "stmt_013"
  action: input_text.set_value
  target:
    entity_id: input_text.pistoncore_message
  data:
    value: "Hello"
```

---

## 14. wait (duration)

### JSON Schema

```json
{
  "id": "stmt_014",
  "type": "wait",
  "wait_type": "duration",
  "duration": 5,
  "duration_unit": "minutes",
  "description": null,
  "disabled": false
}
```

**`duration_unit` values:** `"ms"`, `"s"`, `"m"`, `"h"`, `"d"`, `"w"`

### Editor Render

```
do Wait 5 minutes;
```

### Compiler Output

```yaml
- alias: "stmt_014"
  delay:
    minutes: 5
```

---

## 15. wait (until time)

### JSON Schema

```json
{
  "id": "stmt_015",
  "type": "wait",
  "wait_type": "until",
  "until": "23:00:00",
  "description": null,
  "disabled": false
}
```

### Editor Render

```
do Wait until 11:00 PM;
```

### Compiler Output

```yaml
- alias: "stmt_015"
  wait_for_trigger:
    - trigger: time
      at: "23:00:00"
  timeout:
    minutes: 60
  continue_on_timeout: true
```

Always emits CompilerWarning — see COMPILER_SPEC.md Section 13.
`timeout` defaults to 1 hour if not specified. `continue_on_timeout: true` ensures
the piston continues rather than stopping if the time is never reached.

---

## 15b. wait_for_state

### JSON Schema

```json
{
  "id": "stmt_015b",
  "type": "wait_for_state",
  "conditions": [],
  "condition_operator": "and",
  "timeout_seconds": 300,
  "continue_on_timeout": true,
  "description": null,
  "disabled": false
}
```

### Editor Render

```
do Wait for state
  [conditions]
  timeout: 5 minutes;
```

### Compiler Output

```yaml
- alias: "stmt_015b"
  wait_template: "[compiled condition template]"
  timeout:
    seconds: 300
  continue_on_timeout: true
```

---

## 16. log_message

### JSON Schema

```json
{
  "id": "stmt_016",
  "type": "log_message",
  "message": {
    "type": "literal",
    "data": "Piston ran successfully"
  },
  "level": "info",
  "description": null,
  "disabled": false
}
```

**`level` values:** `"info"`, `"warn"`, `"error"`

### Editor Render

```
do Log message {"Piston ran successfully"};
```

### Compiler Output

```yaml
- alias: "stmt_016"
  event: PISTONCORE_LOG
  event_data:
    piston_id: "a3f8c2d1"
    message: "Piston ran successfully"
    level: "info"
```

---

## 17. call_piston

### JSON Schema

```json
{
  "id": "stmt_017",
  "type": "call_piston",
  "target_piston_id": "b7e2a1f4",
  "target_piston_name": "Announce Motion",
  "wait_for_completion": false,
  "arguments": {},
  "description": null,
  "disabled": false
}
```

### Editor Render

```
do Execute piston Announce Motion;
```

### Compiler Output

```yaml
- alias: "stmt_017"
  action: script.pistoncore_b7e2a1f4
```

If `wait_for_completion: true` with native script target → CompilerError.

---

## 18. cancel_pending_tasks (PyScript only)

### JSON Schema

```json
{
  "id": "stmt_018",
  "type": "cancel_pending_tasks",
  "description": null,
  "disabled": false
}
```

### Editor Render

```
do Cancel all pending tasks;
```

### Compiler Output

PyScript only. Forces PyScript compilation via target-boundary.json.
Native HA script compilation raises CompilerError.

---

## Condition Object Schema

Conditions appear inside `if`, `while`, `repeat`, `on_event` statement types.
The same schema is used for both triggers (`is_trigger: true`) and conditions
(`is_trigger: false`).

```json
{
  "id": "cond_001",
  "is_trigger": false,
  "role": "Doors",
  "entity_ids": ["binary_sensor.front_door", "binary_sensor.back_door"],
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
  "group_operator": "and",
  "interaction": "any"
}
```

**Fields:**
- `role` — human-readable label shown in the editor. Display only. Never used by the compiler.
- `entity_ids` — array of real HA entity IDs. Written at wizard commit time from the live device picker. Always an array. The compiler reads this directly. For time/date/mode/virtual conditions: empty array `[]`.
- `aggregation` — `"any"` / `"all"` / `"none"`. Applies when multiple entities selected. Use `"any"` for single-device conditions. Determines how the compiler generates the trigger or condition template.
- `compiled_value` — the HA state string used by the compiler (e.g. `"on"`). Always used by the compiler, never `display_value`.
- `display_value` — the friendly label shown in the editor (e.g. `"Open"`). For binary sensors this differs from `compiled_value`. For all other types they are the same.
- `interaction` — `"any"` / `"physical"` / `"programmatic"`. Defaults to `"any"`.

### Time Condition

```json
{
  "id": "cond_002",
  "is_trigger": false,
  "subject": "time",
  "operator": "is between",
  "value_from": "08:00:00",
  "value_to": "23:00:00",
  "only_on_days": [1, 2, 3, 4, 5],
  "group_operator": "and"
}
```

### Condition Group

```json
{
  "id": "cond_003",
  "type": "group",
  "operator": "and",
  "negated": false,
  "conditions": [
    { ... },
    { ... }
  ],
  "group_operator": "and"
}
```

**Nesting:** Groups can contain other groups — nesting is unlimited in the data model.
In practice, deeply nested groups become unreadable and are rare. The wizard UI supports
at least two levels of nesting (group within group). There is no enforced maximum depth
but the compiler and editor must handle arbitrary nesting recursively.

A condition array entry is either a flat condition object (has `is_trigger`, `role`,
`operator` etc.) or a group object (has `type: "group"`, `operator`, `conditions`).
The renderer and compiler detect which by checking for the `type: "group"` field.

### Condition Render Examples

Single device trigger:
```
⚡ Any of {Doors}'s contact changes to Open
```

Condition with time:
```
Time is between 8:00 AM and 11:00 PM
```

Condition with days:
```
Time is between 8:00 PM and 8:00 AM, but only on Mondays, Tuesdays, Wednesdays, Thursdays, or Fridays
```

Numeric condition:
```
Any of {lumen_sensor}'s illuminance is less than 800 lux
```

Multiple conditions with AND:
```
Time is between 6:00 AM and $sunrise + 30 minutes
and Any of {lumen_sensor}'s illuminance is less than 800 lux
```

Multiple conditions with OR:
```
Any of {Doors}'s contact changes to Open
or Any of {Windows}'s contact changes to Open
```

---

## Operand / Value Schema

Values used in conditions, set_variable, for loop bounds, etc.

```json
{
  "type": "literal",
  "data": "Hello"
}
```

```json
{
  "type": "variable",
  "name": "$count"
}
```

```json
{
  "type": "system_variable",
  "name": "$sunrise",
  "offset": 30,
  "offset_unit": "minutes",
  "offset_direction": "+"
}
```

```json
{
  "type": "expression",
  "expression": "$count + 1"
}
```

---

## Statement Common Fields

Every statement object has these fields regardless of type:

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | string | Yes | — | Unique within piston, used for compiler alias and edit-in-place lookup |
| `type` | string | Yes | — | One of the types defined in this document |
| `async` | boolean | No | false | If true, statement executes asynchronously |
| `description` | string | No | null | Optional user note, renders as `/* comment */` |
| `disabled` | boolean | No | false | If true, statement is greyed out and skipped by compiler |

---

## PyScript-Only Statement Types

These statement types force PyScript compilation. They are detected by
target-boundary.json, not hardcoded in Python.

| Type | Reason |
|---|---|
| `on_event` | No native HA script equivalent for event-conditional blocks inside running script |
| `break` | No native HA script equivalent for mid-loop interruption |
| `cancel_pending_tasks` | No native HA script equivalent for cancelling async tasks |

If any of these appear in a piston's statements array, compile_target must be `"pyscript"`.
The compiler raises CompilerError if it encounters these with `compile_target == "native_script"`.

---

## Statement ID Generation

Statement IDs are generated by the wizard at creation time.
Format: `stmt_` + 8 character hex: `stmt_a3f8c2d1`
Condition IDs: `cond_` + 8 character hex: `cond_b7e2f941`
Task IDs: `task_` + 8 character hex: `task_c1d4e823`
Case IDs: `case_` + 8 character hex: `case_f2a1b903`

IDs are stable — they never change once assigned, even if the statement is moved,
edited, or the piston is renamed. The compiler uses them as YAML aliases.
Edit-in-place uses them to find the correct statement to update within its owning
parent's child array.

---

*This document must be kept in sync with WIZARD_SPEC.md (operator list, render patterns)
and COMPILER_SPEC.md (compiler output). If any statement type is added or changed,
update all three documents.*
