# PistonCore — Piston Data Model

**Version:** 2.5 (consolidated — absorbs STATEMENT_TYPES.md v2.3)
**Status:** Authoritative — Single source of truth for piston data structure and all statement type schemas. STATEMENT_TYPES.md is retired; this file replaces both.
**Last Updated:** June 2026 (D-S5d session — consolidated PISTON_FORMAT.md v2.4 +
  STATEMENT_TYPES.md v2.3 into one document. No content changed — deduplication only.
  Prior: Session 73 — task model reconciled to code. Session 74 D-S5d — Complete Minimal
  Example fixed, duration_unit full-words, time condition schema corrected to code shape,
  Field Lifecycle table notes added for Snapshot strip verification.)

This document defines the canonical internal JSON format for a PistonCore piston and
every statement type schema the wizard writes, the editor renders from, and the compiler
reads. Every component that touches piston data must conform to this document.

Read DESIGN.md Section 6 before this document.
For compiler output from this format, see COMPILER_SPEC.md (FROZEN/STALE until D-S6).
For editor rendering and wizard behavior, see WIZARD_SPEC.md.
For frontend screen layouts, see FRONTEND_SPEC.md.

---

## ⭐ THE LOAD-BEARING RULE — Device → Entity Resolution

**Read this before anything else. If this is wrong, nothing works — the editor shows
pretty text that compiles to nothing.**

### The two layers

**Layer 1 — Variables and globals are DEVICE LISTS.** They store device references
(friendly names). They NEVER store entity IDs. The friendly name is the lookup key.

**Layer 2 — Nodes (condition / action / for_each / trigger) store ENTITY IDs.** At the
moment the wizard commits a statement, it resolves the device list to the **entity that
carries that attribute — one per physical device** — and writes those entity IDs to the
node. The compiler reads these directly.

### Why resolution can only happen at the node

The same variable feeds multiple statements, each using a different attribute. There is
no single "entity_ids for this variable." So the variable stays a name list, and each
node resolves independently.

### Worked example

A device variable `Outdoor_Sensors` = `["Outdoor Motion", "Zooz outdoor"]`.

**Motion trigger** — resolves to motion entities:
```json
{
  "role": "Outdoor_Sensors",
  "role_tokens": ["Outdoor_Sensors"],
  "attribute": "motion",
  "entity_ids": ["binary_sensor.outdoor_motion_motion", "binary_sensor.zooz_outdoor_motion"]
}
```

**Illuminance condition** — resolves to illuminance entities:
```json
{
  "role": "Outdoor_Sensors",
  "role_tokens": ["Outdoor_Sensors"],
  "attribute": "illuminance",
  "entity_ids": ["sensor.outdoor_motion_illuminance", "sensor.zooz_outdoor_illuminance"]
}
```

### The rules in one line each

1. Variables and globals store device names (friendly names). Never entity IDs.
2. Nodes store entity IDs — the attribute-bearing entity, one per device, for the chosen function.
3. Resolution happens at the node, at commit time, because the attribute is only known there.
4. `role` / `role_tokens` on the node keep the variable/device name for display and re-resolution.
5. The picker's transient `sel.tokens` may hold ALL entities of a device for capability intersection — but only the attribute-bearing entity per device is written to the node.

The complete worked piston is in REFERENCE_PISTON_V2.json (the diff anchor).

---

## The Two Formats — One Clear Purpose Each

**Internal stored format (this document):** Structured JSON. Every statement is a
typed data object. Source of truth for everything PistonCore does with a piston.

**Shared/export format (Snapshot JSON):** Structured JSON with role name placeholders
and no entity IDs. Used for AI import, community sharing, and WebCoRE migration.
See DESIGN.md Section 6.2. Never stored as the internal format.

---

## Top-Level Piston Wrapper

```json
{
  "id": "a3f8c2d1",
  "name": "Driveway Lights at Sunset",
  "description": "",
  "folder": "Outdoor Lighting",
  "mode": "single",
  "enabled": true,
  "logic_version": 2,
  "ui_version": 1,
  "compile_target": "native_script",
  "created_at": "2026-05-01T08:00:00Z",
  "modified_at": "2026-05-03T14:22:00Z",
  "variables": [],
  "triggers": [],
  "conditions": [],
  "restrictions": [],
  "statements": []
}
```

### Wrapper Field Reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | 8-char hex UUID. Assigned on creation. Never changes. |
| `name` | string | Yes | Human readable. Used for alias only — never for file naming. |
| `description` | string | No | Optional. Empty string if not set. |
| `folder` | string | No | Folder name. `null` or `"Uncategorized"` if not assigned. |
| `mode` | string | Yes | `"single"` / `"restart"` / `"queued"` / `"parallel"` |
| `enabled` | boolean | Yes | Default `true`. |
| `logic_version` | integer | Yes | Current version: 2. |
| `ui_version` | integer | Yes | Start at 1. Changes independently of logic_version. |
| `compile_target` | string | Yes | `"native_script"` or `"pyscript"`. Always set by compiler — never by user. |
| `created_at` | string | Yes | ISO 8601 UTC timestamp. |
| `modified_at` | string | Yes | ISO 8601 UTC timestamp. Updated on every save. |
| `variables` | array | Yes | Piston-local variable definitions (defines). Empty array if none. |
| `triggers` | array | Yes | Top-level trigger condition objects (`is_trigger: true`). Empty array if none. |
| `conditions` | array | Yes | Top-level piston-level condition objects. Empty array if none. |
| `restrictions` | array | Yes | Top-level restriction condition objects. Empty array if none. |
| `statements` | array | Yes | The action tree — top-level statement objects. Empty array if none. |

**Note:** `device_map` is eliminated as of logic_version 2.

### Trigger / Condition / Restriction Storage

Triggers, conditions, and restrictions are stored as **top-level arrays on the piston
wrapper** — NOT nested inside `if` blocks in `statements`. The compiler reads `triggers`
directly to build the automation trigger block. It does not walk `statements` looking for
`is_trigger` nodes. `if` blocks inside `statements` carry their own inline `conditions`
array for branch logic — that is separate from the top-level arrays.

### Mode Values

| PistonCore mode | HA automation mode | Behavior |
|---|---|---|
| `single` | `single` | Only one run at a time. New trigger ignored if already running. |
| `restart` | `restart` | New trigger cancels current run and starts fresh. |
| `queued` | `queued` | New trigger queued. Runs in order. |
| `parallel` | `parallel` | Each trigger starts an independent run. |

### Version Fields

- `logic_version` — **Version 2 = device_map eliminated, entity_ids on nodes, top-level trigger/condition/restriction arrays.** Logic_version 1 is retired — reject non-v2 pistons on load.
- `ui_version` — bump when editor rendering structure changes.
- These change independently — never collapse into one field.

---

## variables (Piston Variables)

Piston variables are local to a single piston run. Forgotten when the piston finishes.
Compile to the native HA script `variables:` action.

```json
"variables": [
  {
    "type": "variable",
    "id": "var_a3f8c2d1",
    "name": "message",
    "var_type": "string",
    "initial_value": ""
  }
]
```

### Variable Field Reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | string | Yes | Always `"variable"` — the node-kind marker. |
| `id` | string | Yes | Stable UUID. Format `var_` + 8 hex. Never changes even if variable is renamed. |
| `name` | string | Yes | Internal name. The `$`/`@` prefix is part of how it's referenced. |
| `var_type` | string | Yes | The variable's data type. See type table below. |
| `initial_value` | any | No | Initial value when piston starts. For `device`/`devices` types: **list of device references (friendly names) — NEVER entity IDs**. `null` or omitted if "Nothing selected". |
| `initial_value_type` | string | No | How the value was entered (`device` / `value` / `variable` / `expression`). Omitted for "Nothing selected". |
| `initial_device_names` | array | No | **Not written by current code.** Documented here only so readers know it duplicates `initial_value`. Do not add. |

### Variable Types (`var_type` values)

| `var_type` value | Description |
|---|---|
| `"string"` | Text value |
| `"number"` | Numeric value (integer or decimal) |
| `"boolean"` | True/false |
| `"datetime"` | Date and time |
| `"device"` | Single device reference — resolved to attribute-bearing entity IDs at each consuming node |
| `"devices"` | List of device references — resolved to attribute-bearing entity IDs at each consuming node |

**Variable naming in statements:**
- Piston variables use `$` prefix: `$message`, `$count`
- Global variables use `@` prefix: `@smoke_detectors`
- System variables use `$` prefix: `$now`, `$sunrise`, `$sunset`, `$index`

---

## statements — Nested Tree Model

The statements array is the action tree. Every element is a typed statement object.

**The statements array is a nested tree. Control flow nodes own their children directly.**
`then`, `else`, `statements`, `else_ifs`, and `cases` contain child statement objects
embedded inline — not ID references.

**Render invariant:** The editor must render every well-formed piston JSON correctly.
For malformed nodes, it renders a clearly-flagged placeholder row. The editor must never
silently drop, duplicate, or corrupt nodes.

There are no ID references between statements anywhere in the format.

### tasks — Embedded Objects

`tasks` inside `action` nodes are embedded objects, not child statements. The `tasks[]`
array is the **universal ordered task container** — the "do …" list of a WebCoRE
`with {devices} do … end with` block. Order = execution order (load-bearing). Tasks are
appended/edited/removed in place by their `task_` id. See WIZARD_SPEC.md for the full
task-container contract and current implementation gaps (GAP-S72-1).

---

## Statement Common Fields

Every statement object has these fields regardless of type:

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | string | Yes | — | Unique within piston. Used for compiler alias and edit-in-place lookup. |
| `type` | string | Yes | — | One of the types defined in this document. |
| `async` | boolean | No | false | If true, statement executes asynchronously. |
| `description` | string | No | null | Optional user note, renders as `/* comment */`. |
| `disabled` | boolean | No | false | If true, statement is greyed out and skipped by compiler. |

### Statement ID Generation

- Statement IDs: `stmt_` + 8 hex chars
- Condition IDs: `cond_` + 8 hex chars
- Task IDs: `task_` + 8 hex chars
- Case IDs: `case_` + 8 hex chars

IDs are stable — they never change once assigned. The compiler uses them as YAML aliases.

---

## Statement Types

> ⚠ **Compiler Output sections are directionally correct but not actively maintained**
> during the current JSON stabilization phase. The JSON schemas ARE authoritative and
> current. The compiler output examples are reference material, not a contract.
> D-S6 will rewrite COMPILER_SPEC.md once the JSON format is final.

---

## 1. action (with/do block)

### JSON Schema

```json
{
  "id": "stmt_001",
  "type": "action",
  "async": false,
  "role": "Living Room Light",
  "role_tokens": ["light.living_room"],
  "entity_ids": ["light.living_room"],
  "tasks": [
    {
      "id": "task_001",
      "command": "turn_on",
      "domain": "light",
      "ha_service": "light.turn_on",
      "parameters": { "brightness_pct": 75 },
      "description": null
    }
  ],
  "description": null,
  "disabled": false
}
```

**Fields:**
- `role` — human-readable label shown in the editor. Display only. Never used for compilation.
- `role_tokens` — raw tokens the user selected at commit time. Stored for edit round-trip hydration only. Compiler ignores this field. Editor must preserve it on every save.
- `entity_ids` — array of real HA entity IDs. Written at wizard commit time. Always an array. The compiler reads this directly — it never looks up a role name.
- `tasks` — array of task objects embedded directly in the action node (see Task Field Reference below).

### Task Schema

A task is one entry in the action node's `tasks[]` array. Two kinds:

**Device task** (a service call against the block's `entity_ids`):
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

**Virtual task** (a non-device action — Wait, Set variable, notify, log):
```json
{
  "id": "task_002",
  "kind": "virtual",
  "command": "wait",
  "parameters": { "duration": 5, "duration_unit": "minutes" },
  "description": null
}
```

Note: the `kind` discriminator is **ASSUMED (Session 73) — proposed, not yet in code.**
The exact mechanism (this `kind` field, or a reserved `domain`) is a coding-session choice.
Override freely. See WIZARD_SPEC.md §task-container.

**Order is load-bearing** — tasks run top to bottom in array order, not concurrently.

The same command may appear as a **virtual task here OR as a top-level statement node**
(`wait`, `set_variable`, `log_message`, `call_piston`). WebCoRE allows both.

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

### Compiler Output

```yaml
- alias: "stmt_001"
  action: light.turn_on
  target:
    entity_id:
      - light.living_room
  data:
    brightness_pct: 75
  continue_on_error: true
```

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
- `else_ifs` — array of else-if branch objects, each containing `conditions` and `statements`
- `else` — array of child statement objects embedded directly (nested tree model)

### Editor Render

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
  "expression": { "type": "variable", "name": "$count" },
  "case_traversal_policy": "safe",
  "cases": [
    { "id": "case_001", "case_type": "single", "value": 1, "statements": [] },
    { "id": "case_002", "case_type": "range", "value_from": 5, "value_to": 10, "statements": [] }
  ],
  "default": [],
  "description": null,
  "disabled": false
}
```

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
        [compiled case statements]
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

### Editor Render

```
for ($count = 1 to 10 step 1)
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

**Note:** Emits CompilerWarning if start != 1 or step != 1.

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
  "role_tokens": ["sensor.smoke_detector_basement", "sensor.smoke_detector_kitchen"],
  "entity_ids": ["sensor.smoke_detector_basement", "sensor.smoke_detector_kitchen"],
  "statements": [],
  "description": null,
  "disabled": false
}
```

**Fields:**
- `variable` — the loop variable name (with `$` prefix). On each iteration, holds the current entity_id string.
- `role` — human-readable label. Display only. Never used by the compiler.
- `role_tokens` — raw tokens the user selected. Stored for edit round-trip only. Compiler ignores.
- `entity_ids` — array of real HA entity IDs to iterate over. Written at commit time from the live picker. The compiler uses this list directly.
- `statements` — array of child statement objects embedded directly.

**Note:** `list_role` is a legacy field being retired (decided D-S5d session). Do not write
it in new code. The B-2 sweep will remove it from code. `role` is the correct field.

### Editor Render

```
for each ($device in {Smoke Detectors})
do
  [statements]
end for each;
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

**`interval_unit` values:** `"ms"`, `"s"`, `"m"`, `"h"`, `"d"`, `"w"`, `"n"` (month), `"y"`

`only_on_days` uses ISO weekday numbers: 1=Monday through 7=Sunday.

### Editor Render

```
every 5 minutes
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

**Note:** Advanced scheduling (day/month filters) emits CompilerWarning.

---

## 10. on_event (PyScript only)

### HA Limitation — Read Before Using

**`on_event` compiles to a blocking wait, not a true async listener.**

In WebCoRE, `on_event` ran as a genuinely asynchronous background listener. **HA cannot
replicate this behavior.** In PistonCore, `on_event` compiles to `task.wait_until()` in
PyScript — the piston **pauses** until one of the specified events fires.

**Required wizard warning:** When a user adds an `on_event` block, display a clear warning.

**Required compiler warning:** `CompilerWarning` with code `ON_EVENT_BLOCKING` must always
be emitted when compiling an `on_event` statement.

### JSON Schema

```json
{
  "id": "stmt_010",
  "type": "on_event",
  "conditions": [],
  "condition_operator": "and",
  "statements": [],
  "description": null,
  "disabled": false
}
```

**System variables available inside `on_event` statements:**

| Variable | Meaning |
|---|---|
| `$currentEventDevice` | Entity ID of the device that fired |
| `$currentEventValue` | New state value that fired |
| `$currentEventAttribute` | Attribute that changed |

### Editor Render

```
on events
  ⚡ Any of {Doors}'s contact changes to Open
do
  [statements]
end on;
⚠ Blocks until event fires — not async
```

### Compiler Output

PyScript only. Forces PyScript compilation via target-boundary.json.
Native HA script compilation raises CompilerError with code `PYSCRIPT_REQUIRED`.

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

### Editor Render / Compiler Output

Editor: `break;`
Compiler: PyScript only. Native HA raises CompilerError.

---

## 12. exit (stop/return)

### JSON Schema

```json
{
  "id": "stmt_012",
  "type": "exit",
  "value": { "type": "literal", "data": "true" },
  "description": null,
  "disabled": false
}
```

### Editor Render

```
exit true;
```

### Compiler Output

```yaml
- alias: "stmt_012"
  stop: "exit"
```

---

## 13. set_variable

> Also available as a **virtual task** inside an action node's `tasks[]`. Same payload. See §1 Task Schema.

### JSON Schema

```json
{
  "id": "stmt_013",
  "type": "set_variable",
  "variable": "$message",
  "value": { "type": "literal", "data": "Hello" },
  "description": null,
  "disabled": false
}
```

**Value types:** `"literal"`, `"variable"`, `"expression"`, `"system_variable"`

### Editor Render

```
do Set variable {message} = {"Hello"};
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

> Also available as a **virtual task** inside an action node's `tasks[]`. The `duration`
> field should accept an operand (literal OR variable) for variable-duration waits.
> (ASSUMED operand-duration extension — not yet in code.)

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

**`duration_unit` values:** `"milliseconds"`, `"seconds"`, `"minutes"`, `"hours"`, `"days"`, `"weeks"` — full words, matching what the code writes. Do not use abbreviations.

### Editor Render / Compiler Output

Editor: `do Wait 5 minutes;`

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

### Editor Render / Compiler Output

Editor: `do Wait until 11:00 PM;`

```yaml
- alias: "stmt_015"
  wait_for_trigger:
    - trigger: time
      at: "23:00:00"
  timeout:
    minutes: 60
  continue_on_timeout: true
```

Always emits CompilerWarning. `timeout` defaults to 1 hour.

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
  "message": { "type": "literal", "data": "Piston ran successfully" },
  "level": "info",
  "description": null,
  "disabled": false
}
```

**`level` values:** `"info"`, `"warn"`, `"error"`

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

Compiler: PyScript only. Native HA raises CompilerError.

---

## PyScript-Only Statement Types

These statement types force PyScript compilation. Detected by target-boundary.json
(existence of this file in the backend is UNVERIFIED — confirm in code or create it).

| Type | Reason |
|---|---|
| `on_event` | No native HA script equivalent for event-conditional blocks inside running script |
| `break` | No native HA script equivalent for mid-loop interruption |
| `cancel_pending_tasks` | No native HA script equivalent for cancelling async tasks |

---

## Condition Object Schema

Conditions appear inside `if`, `while`, `repeat`, `on_event` statement types, and in the
top-level `triggers`, `conditions`, and `restrictions` arrays. The same schema is used for
triggers (`is_trigger: true`) and conditions (`is_trigger: false`).

```json
{
  "id": "cond_a3f8c2d1",
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
  "group_operator": "and",
  "interaction": "any"
}
```

### Condition Field Reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Stable ID. Format: `cond_` + 8 hex chars. |
| `is_trigger` | boolean | Yes | `true` = trigger, `false` = condition. |
| `role` | string | Yes | Human-readable label. For time conditions, use `"time"`. Display only. |
| `role_tokens` | array | Yes | Raw tokens the user selected. Edit round-trip only. Compiler ignores. Editor must preserve on every save. |
| `entity_ids` | array | Yes | Array of real HA entity IDs. Compiler reads this directly. For time conditions, use `[]`. |
| `aggregation` | string | Yes | `"any"` / `"all"` / `"none"`. Use `"any"` for single-device. |
| `attribute` | string | Yes | Device attribute name. For time conditions, omit. |
| `attribute_type` | string | Yes | `"binary"` / `"numeric"` / `"string"` / `"enum"`. |
| `device_class` | string | No | HA device class (e.g. `"door"`, `"motion"`). |
| `operator` | string | Yes | Operator string. Full list in WIZARD_SPEC.md. |
| `display_value` | string | Yes | Friendly value shown in editor. Never `"on"` or `"off"` for binary sensors. |
| `compiled_value` | string | Yes | HA state string used by compiler. |
| `value_to` | string | No | Second value for `"is between"` / `"is not between"`. Null if not used. |
| `duration` | number | No | For `"stays for"` operators. Duration value. |
| `duration_unit` | string | No | `"seconds"` / `"minutes"` / `"hours"`. |
| `group_operator` | string | Yes | `"and"` / `"or"`. Connects this condition to the next. |
| `interaction` | string | No | `"any"` / `"physical"` / `"programmatic"`. Defaults to `"any"`. |

**The compiler reads `entity_ids` directly. It never looks up a role name.**

**Variable/global example** — `role_tokens` differs from `entity_ids`:
```json
{
  "id": "cond_c9d4a112",
  "is_trigger": false,
  "role": "@Door_Contacts",
  "role_tokens": ["@Door_Contacts"],
  "entity_ids": ["binary_sensor.front_door", "binary_sensor.back_door"],
  "aggregation": "any",
  "attribute": "contact",
  "attribute_type": "binary",
  "device_class": "door",
  "operator": "is",
  "display_value": "Open",
  "compiled_value": "on",
  "value_to": null,
  "duration": null,
  "duration_unit": null,
  "group_operator": "and",
  "interaction": "any"
}
```

### Time Condition

The code commits time conditions with `role: "time"` and flat `value_from`/`value_to`
fields. The `subject` field is NOT written by the wizard commit path (GAP-S74-5 — the spec
previously showed `subject: "time"` but the code does not write it and the hydration code
mis-routes a spec-shaped time condition as a device condition). Use this shape:

```json
{
  "id": "cond_c1d4e823",
  "is_trigger": false,
  "role": "time",
  "role_tokens": [],
  "entity_ids": [],
  "operator": "is between",
  "value_from": "08:00:00",
  "value_to": "23:00:00",
  "only_on_days": [1, 2, 3, 4, 5],
  "group_operator": "and"
}
```

`only_on_days` uses ISO weekday numbers: 1=Monday through 7=Sunday.

### Condition Group

```json
{
  "id": "cond_d2e5f894",
  "type": "group",
  "operator": "and",
  "negated": false,
  "conditions": [ { ... }, { ... } ],
  "group_operator": "and"
}
```

Groups can contain other groups — nesting is unlimited. The renderer and compiler detect
groups by checking for `"type": "group"`.

### Condition Render Examples

```
⚡ Any of {Doors}'s contact changes to Open
Time is between 8:00 AM and 11:00 PM
Any of {lumen_sensor}'s illuminance is less than 800 lux
Time is between 6:00 AM and $sunrise + 30 minutes
and Any of {lumen_sensor}'s illuminance is less than 800 lux
```

---

## Action Node Schema

Action nodes appear in `then`, `else`, `statements`, and `else_ifs[n].statements` arrays.
The full JSON schema is in §1 (action statement type). This section provides the field reference table.

### Action Node Field Reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Stable ID. Format: `stmt_` + 8 hex chars. |
| `type` | string | Yes | Always `"action"`. |
| `async` | boolean | No | Default `false`. Reserved — not compiled yet. |
| `role` | string | Yes | Human-readable label. Display only — never used for compilation. |
| `role_tokens` | array | Yes | Raw tokens the user selected. Edit round-trip only. Compiler ignores. Editor must preserve on every save. |
| `entity_ids` | array | Yes | Array of real HA entity IDs. Compiler reads this directly. |
| `tasks` | array | Yes | One or more task objects. |
| `description` | string | No | Optional note. Null if not set. |
| `disabled` | boolean | Yes | Default `false`. If `true`, compiler skips this statement. |

### Task Field Reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Stable ID. Format: `task_` + 8 hex chars. |
| `kind` | string | No | **ASSUMED (Session 73) — not yet in code.** `"device"` (default if absent) or `"virtual"`. Exact mechanism is a coding-session choice. Override freely. |
| `command` | string | Yes | Service name without domain for device tasks (e.g. `"turn_on"`); virtual command id for virtual tasks (e.g. `"wait"`). |
| `domain` | string | Device tasks only | HA domain (e.g. `"light"`). Omitted on virtual tasks. |
| `ha_service` | string | Device tasks only | `domain + "." + command`. Omitted on virtual tasks. |
| `parameters` | object | No | Service call data for device tasks; command payload for virtual tasks. Empty object `{}` if none. |
| `description` | string | No | Null if not set. |

**Task order is load-bearing.** Array position = execution order. Round-trip and compile
must preserve it exactly.

---

## Operand / Value Schema

Used in conditions, set_variable, for loop bounds, and anywhere a value is needed.

```json
{ "type": "literal", "data": "Hello" }
{ "type": "literal", "data": 42 }
{ "type": "variable", "name": "$count" }
{ "type": "global_variable", "name": "@motion_count" }
{ "type": "system_variable", "name": "$sunrise", "offset": 30, "offset_unit": "minutes", "offset_direction": "+" }
{ "type": "expression", "expression": "$count + 1" }
```

| `type` value | Fields | Notes |
|---|---|---|
| `"literal"` | `data` | String, number, or boolean value |
| `"variable"` | `name` | Piston variable with `$` prefix |
| `"global_variable"` | `name` | Global variable with `@` prefix |
| `"system_variable"` | `name`, `offset`, `offset_unit`, `offset_direction` | `$sunrise`, `$sunset`, `$now`, `$hour`, `$minute`, `$index`, `$weekday` |
| `"expression"` | `expression` | Free-form expression string |

---

## Field Lifecycle Rules

This section defines exactly when each key field is written, read, and what happens
to it on Snapshot export. **This is the authoritative reference** — if another spec
contradicts this table, this table wins and the other spec needs updating.

| Field | Written by | Read by | On Snapshot export |
|---|---|---|---|
| `role` | Wizard at commit time. Generated from selected row labels. | Editor for display only. Never read by compiler. | Kept — used as the placeholder label in Snapshot format. |
| `role_tokens` | Wizard at commit time. Stores the raw tokens the user selected (entity_ids, variable names, `@globals`). | Editor on re-open for edit — restores `sel.tokens` to re-highlight correct rows. | Intended to be stripped — but verify before implementing: stripping `role_tokens` may erase variable names and authored content (e.g. message text in Speak tasks) that the user needs to survive import. Only resolved device identity data should be stripped, not authored content. See GAP-S74-4 / S2-3. |
| `entity_ids` | Wizard at commit time via `_getFlatEntityIds(sel.tokens)`. Also updated by `_reResolveVariableUses` when a device variable is edited. | Compiler reads this directly. Editor does not re-resolve — it trusts what is on the node. | Stripped — Snapshot format uses role placeholders, not entity IDs. Not yet implemented correctly; see GAP-S74-4 / S2-3. |
| `display_value` | Wizard at commit time. Friendly label for binary values (e.g. `"Open"`). | Editor for display only. Never read by compiler. | Kept — helps the AI mapper understand what the condition means. |
| `compiled_value` | Wizard at commit time. The raw HA state string (e.g. `"on"`). | Compiler reads this. Editor uses it for numeric condition pre-fill. | Stripped — Snapshot format does not include compiled values. Not yet implemented correctly; see GAP-S74-4 / S2-3. |
| `aggregation` | Wizard at commit time. `"any"` / `"all"` / `"none"`. Single-device nodes always get `"any"`. | Compiler reads this to decide trigger/condition template expansion. Editor displays it in the aggregation bar on re-open. | Kept — relevant to the Snapshot mapping step. |

**Resolution rule:** Token-to-entity-id resolution at wizard commit time goes through
`_getFlatEntityIds` only. Read-side walks of `entity_ids` on already-committed nodes
do not re-resolve — they trust what is on the node. If you find yourself wanting to
resolve tokens in a read-side walk, the bug is in the commit path, not the read path.

---

## Complete Minimal Example

A simple single-trigger piston with one action. The trigger lives in the top-level
`triggers` array — NOT nested inside an `if` block in `statements`. The `conditions` and
`restrictions` arrays are required even when empty.

```json
{
  "id": "a3f8c2d1",
  "name": "Driveway Lights at Sunset",
  "description": "",
  "folder": "Outdoor Lighting",
  "mode": "single",
  "enabled": true,
  "logic_version": 2,
  "ui_version": 1,
  "compile_target": "native_script",
  "created_at": "2026-05-01T08:00:00Z",
  "modified_at": "2026-05-03T14:22:00Z",
  "variables": [],
  "triggers": [
    {
      "id": "cond_001",
      "is_trigger": true,
      "role": "time",
      "role_tokens": [],
      "entity_ids": [],
      "operator": "happens daily at",
      "value": { "preset": "sunset", "offset": 0, "offset_unit": "minutes", "offset_direction": "+" },
      "group_operator": "and"
    }
  ],
  "conditions": [],
  "restrictions": [],
  "statements": [
    {
      "id": "stmt_002",
      "type": "action",
      "async": false,
      "role": "Driveway Light",
      "role_tokens": ["light.driveway_main"],
      "entity_ids": ["light.driveway_main"],
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
  ]
}
```

---

## What This Format Is Not

- **Not Snapshot JSON** — Snapshot JSON is the export/share format. Snapshot is generated on export, not stored internally.
- **Not compiled YAML** — produced by the compiler from this format. Never stored here.
- **Not a UI state object** — wizard context, scroll position etc. are transient UI state.

---

## Keeping This Document In Sync

This document must stay in sync with:
- **WIZARD_SPEC.md** — wizard flows, editor rendering, operator and value lists, task-container contract
- **COMPILER_SPEC.md** — how the compiler reads this format (FROZEN/STALE until D-S6)
- **FRONTEND_SPEC.md** — screen layouts and chrome
- **DESIGN.md** — architecture decisions that drive format choices
- **REFERENCE_PISTON_V2.json** — the canonical diff anchor; a real save looks like this

If any field is added, removed, or changed, update all five documents and bump
`logic_version` or `ui_version` as appropriate.

---

## ⚠ Assumption Disclaimer

This document contains claims about what the code does. Where those claims have been
traced directly to code this session they are noted as VERIFIED. The Verified/Decided/ASSUMED
ledger convention is the target discipline but is not yet complete across all sections.
**Absence of an ASSUMED tag does not mean a claim is verified** — it means it has not been
audited yet. When in doubt, read the actual code. The most significant ASSUMED items in this
document are the `kind` task discriminator field (§1 Task Schema, §Task Field Reference) and
the operand-duration extension for wait (§14).

---

*STATEMENT_TYPES.md is retired. This document is the single source of truth for all
piston JSON schemas and statement types.*
