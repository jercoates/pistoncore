# PistonCore — Canonical Piston JSON Format

**Version:** 1.0
**Status:** Authoritative — Single source of truth for piston data structure
**Last Updated:** May 2026

This document defines the canonical internal JSON format for a PistonCore piston.
This is the format the wizard writes, the editor renders from, the backend stores,
and the compiler reads. Every component that touches piston data must conform to
this document.

Read DESIGN.md Section 6 before this document.
For statement-level schemas, see STATEMENT_TYPES.md.
For compiler output from this format, see COMPILER_SPEC.md.
For editor rendering from this format, see FRONTEND_SPEC.md.

---

## The Two Formats — One Clear Purpose Each

**Internal stored format (this document):** Structured JSON. Every statement is a
typed data object. This is the working format — the source of truth for everything
PistonCore does with a piston.

**Shared/export format (piston_text):** Plain text rendered from the internal format
by the frontend render functions. Used for AI import, snapshot export, and human
readability. Never stored internally. Never parsed by the compiler.

The compiler reads structured JSON only. It never reads piston_text.
The wizard writes structured JSON only. It never writes piston_text.
The editor renders from structured JSON only. It never stores display text.

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
  "logic_version": 1,
  "ui_version": 1,
  "compile_target": "native_script",
  "created_at": "2026-05-01T08:00:00Z",
  "modified_at": "2026-05-03T14:22:00Z",
  "device_map": {
    "driveway_light": ["light.driveway_main"]
  },
  "variables": [],
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
| `logic_version` | integer | Yes | Tracks statement schema version. Start at 1. |
| `ui_version` | integer | Yes | Tracks editor layout version. Start at 1. Changes independently of logic_version. |
| `compile_target` | string | Yes | `"native_script"` or `"pyscript"`. Always set by compiler — never by user. |
| `created_at` | string | Yes | ISO 8601 UTC timestamp. |
| `modified_at` | string | Yes | ISO 8601 UTC timestamp. Updated on every save. |
| `device_map` | object | Yes | Role → entity ID list mapping. See below. |
| `variables` | array | Yes | Piston-local variable definitions. Empty array if none. |
| `statements` | array | Yes | All statement objects. Empty array if none. |

### Mode Values

| PistonCore mode | HA automation mode | Behavior |
|---|---|---|
| `single` | `single` | Only one run at a time. New trigger ignored if already running. |
| `restart` | `restart` | New trigger cancels current run and starts fresh. |
| `queued` | `queued` | New trigger queued. Runs in order. |
| `parallel` | `parallel` | Each trigger starts an independent run. |

### Version Fields

- `logic_version` — bump when the statement schema changes
- `ui_version` — bump when editor rendering structure changes
- These change independently — never collapse into one field
- If either is missing on load, treat as v1
- If either is from the future, warn and refuse to load — never silently corrupt

---

## device_map

Maps role names to lists of HA entity IDs. Role names are the strings used throughout
the statements array to reference devices. Entity IDs are the actual HA entity IDs
baked in at import time or when the user maps a device.

```json
"device_map": {
  "driveway_light": ["light.driveway_main"],
  "Doors": ["binary_sensor.front_door", "binary_sensor.back_door", "binary_sensor.side_door"],
  "Announcement_Sonos": ["media_player.kitchen_sonos"]
}
```

**Rules:**
- Keys are role names exactly as they appear in statements (case-sensitive)
- Values are always arrays — even for single-device roles
- Empty array `[]` means the role exists but has no mapped devices (missing device state)
- Entity IDs are always lowercase HA entity IDs — never friendly names
- The user never sees entity IDs — the frontend always displays friendly names
- Friendly names for display are fetched live from HA using entity_id as the key

**Single vs multi-device roles:**
The compiler and missing-device handler must distinguish these:
- Single-device role: `device_map[role].length === 1` in original mapping
- Multi-device role: `device_map[role].length > 1` in original mapping

To distinguish intent from current state, the piston stores the original role cardinality:

```json
"device_map_meta": {
  "driveway_light": { "cardinality": "single" },
  "Doors": { "cardinality": "multi" },
  "Announcement_Sonos": { "cardinality": "single" }
}
```

This field allows the missing-device handler to correctly apply hard-flag vs degrade
logic even when the current entity list has changed. See DESIGN.md Section 15.6.

---

## variables (Piston Variables)

Piston variables are local to a single piston run. They are forgotten when the piston
finishes. They compile to the native HA script `variables:` action.

```json
"variables": [
  {
    "id": "var_a3f8c2d1",
    "name": "message",
    "display_name": "Message",
    "type": "string",
    "default_value": ""
  },
  {
    "id": "var_b7e2f941",
    "name": "count",
    "display_name": "Count",
    "type": "number",
    "default_value": 0
  }
]
```

### Variable Field Reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Stable UUID. Never changes even if variable is renamed. |
| `name` | string | Yes | Internal name used in statements. Lowercase, underscores only. |
| `display_name` | string | Yes | Shown to user. Can contain spaces and capitals. |
| `type` | string | Yes | See type table below. |
| `default_value` | any | No | Initial value when piston starts. Type must match `type` field. |

### Variable Types

| `type` value | Description | HA compile target |
|---|---|---|
| `"string"` | Text value | `variables:` with string value |
| `"number"` | Numeric value (integer or decimal) | `variables:` with numeric value |
| `"boolean"` | True/false | `variables:` with boolean value |
| `"datetime"` | Date and time | `variables:` with datetime string |
| `"device"` | Single HA entity reference | Baked inline at compile time |
| `"devices"` | Collection of HA entity references | Baked inline at compile time |

**Variable naming in statements:**
- Piston variables use `$` prefix: `$message`, `$count`
- Global variables use `@` prefix: `@smoke_detectors`, `@announcement_device`
- System variables use `$` prefix: `$now`, `$sunrise`, `$sunset`, `$index`
- These prefixes are always shown in the editor and are part of the variable name

---

## statements

The statements array is the action tree. Every element is a typed statement object.
Statements are always typed objects — the compiler never parses text.

The full schema for each statement type is defined in STATEMENT_TYPES.md.

```json
"statements": [
  {
    "id": "stmt_a3f8c2d1",
    "type": "if",
    "conditions": [ ... ],
    "condition_operator": "and",
    "then": [ "stmt_b7e2f941", "stmt_c1d4e823" ],
    "else_ifs": [],
    "else": [],
    "description": null,
    "disabled": false
  },
  {
    "id": "stmt_b7e2f941",
    "type": "action",
    "devices": ["driveway_light"],
    "tasks": [ ... ],
    "description": null,
    "disabled": false
  }
]
```

### Statement Common Fields

Every statement object has these fields regardless of type:

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | string | Yes | — | Stable UUID. Never changes once assigned. Used by compiler for YAML alias and by editor for edit-in-place lookup. |
| `type` | string | Yes | — | One of the types in STATEMENT_TYPES.md |
| `async` | boolean | No | `false` | If true, statement executes asynchronously |
| `description` | string | No | `null` | Optional user note. Renders as `/* comment */` in editor. |
| `disabled` | boolean | No | `false` | If true, statement is greyed out and skipped by compiler. |

### Statement ID Format

```
stmt_  + 8 character lowercase hex  →  stmt_a3f8c2d1
cond_  + 8 character lowercase hex  →  cond_b7e2f941
task_  + 8 character lowercase hex  →  task_c1d4e823
case_  + 8 character lowercase hex  →  case_f2a1b903
var_   + 8 character lowercase hex  →  var_d5e6f7a8
```

IDs are assigned by the wizard at creation time. They never change, even if the
statement is moved, edited, nested, or the piston is renamed.

### Statement References Inside Blocks

Control flow statements (`if`, `while`, `repeat`, `for`, `for_each`, `do`) contain
child statements by reference using statement IDs, not by embedding:

```json
{
  "id": "stmt_003",
  "type": "if",
  "then": ["stmt_004", "stmt_005"],
  "else": ["stmt_006"]
}
```

The statements array at the top level is flat. The tree structure is expressed through
ID references in `then`, `else`, `statements` etc. The compiler resolves IDs by
building a lookup map from the flat statements array before walking the tree.

**This is the same approach WebCoRE used internally.**

---

## Condition Object Schema

Conditions appear inside `if`, `while`, `repeat`, `on_event` statement types.
The same schema is used for triggers (`is_trigger: true`) and conditions
(`is_trigger: false`).

```json
{
  "id": "cond_a3f8c2d1",
  "is_trigger": true,
  "aggregation": "any",
  "role": "Doors",
  "attribute": "contact",
  "attribute_type": "binary",
  "device_class": "door",
  "operator": "changes to",
  "display_value": "Open",
  "compiled_value": "on",
  "duration": null,
  "duration_unit": null,
  "group_operator": "and",
  "subscription_method": "auto"
}
```

### Condition Field Reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Stable ID. Format: `cond_` + 8 hex chars. |
| `is_trigger` | boolean | Yes | `true` = trigger, `false` = condition. Set by wizard based on which section was clicked. |
| `aggregation` | string | Yes | `"any"` / `"all"` / `"none"`. Applies to multi-device roles. |
| `role` | string | Yes | Role name from device_map. For time conditions, use `"time"`. |
| `attribute` | string | Yes | Device attribute name (e.g. `"contact"`, `"illuminance"`). For time conditions, omit. |
| `attribute_type` | string | Yes | `"binary"` / `"numeric"` / `"string"` / `"enum"`. |
| `device_class` | string | No | HA device class (e.g. `"door"`, `"motion"`). Used for display value lookup. |
| `operator` | string | Yes | Operator string (e.g. `"changes to"`, `"is less than"`). Full list in WIZARD_SPEC.md. |
| `display_value` | string | Yes | Friendly value shown in editor (e.g. `"Open"`). Never `"on"` or `"off"` for binary sensors. |
| `compiled_value` | string | Yes | HA state string used by compiler (e.g. `"on"`). |
| `value_to` | string | No | Second value for `"is between"` / `"is not between"` operators. Matches `value_from`/`value_to` pattern used in time conditions. |
| `duration` | number | No | For `"stays for"` operators. Duration value. |
| `duration_unit` | string | No | `"seconds"` / `"minutes"` / `"hours"`. |
| `group_operator` | string | Yes | `"and"` / `"or"`. Operator connecting this condition to the next. |
| `subscription_method` | string | No | `"auto"` (default). Reserved for future use. |

### Time Condition

```json
{
  "id": "cond_b7e2f941",
  "is_trigger": false,
  "subject": "time",
  "operator": "is between",
  "value_from": "08:00:00",
  "value_to": "23:00:00",
  "only_on_days": [1, 2, 3, 4, 5],
  "group_operator": "and"
}
```

`only_on_days` uses ISO weekday numbers: 1=Monday through 7=Sunday.

### Condition Group

A condition array entry is either a flat condition object or a group object.
The renderer and compiler detect which by checking for `"type": "group"`.

```json
{
  "id": "cond_c1d4e823",
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

Groups can contain other groups — nesting is unlimited in the data model.
The compiler and editor must handle arbitrary nesting recursively.

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

## Complete Minimal Example

A simple single-trigger piston with one action:

```json
{
  "id": "a3f8c2d1",
  "name": "Driveway Lights at Sunset",
  "description": "",
  "folder": "Outdoor Lighting",
  "mode": "single",
  "enabled": true,
  "logic_version": 1,
  "ui_version": 1,
  "compile_target": "native_script",
  "created_at": "2026-05-01T08:00:00Z",
  "modified_at": "2026-05-03T14:22:00Z",
  "device_map": {
    "driveway_light": ["light.driveway_main"]
  },
  "device_map_meta": {
    "driveway_light": { "cardinality": "single" }
  },
  "variables": [],
  "statements": [
    {
      "id": "stmt_001",
      "type": "if",
      "async": false,
      "conditions": [
        {
          "id": "cond_001",
          "is_trigger": true,
          "subject": "time",
          "operator": "happens daily at",
          "value": { "preset": "sunset", "offset": 0, "offset_unit": "minutes", "offset_direction": "+" },
          "group_operator": "and"
        }
      ],
      "condition_operator": "and",
      "then": ["stmt_002"],
      "else_ifs": [],
      "else": [],
      "description": null,
      "disabled": false
    },
    {
      "id": "stmt_002",
      "type": "action",
      "async": false,
      "devices": ["driveway_light"],
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

- **Not piston_text** — that is a rendered plain-text representation. Never stored internally.
- **Not compiled YAML** — that is produced by the compiler from this format. Never stored here.
- **Not a UI state object** — wizard context, selected statement, scroll position etc. are transient UI state, not part of the piston format.

---

## Keeping This Document In Sync

This document must stay in sync with:
- **STATEMENT_TYPES.md** — statement-level JSON schemas
- **COMPILER_SPEC.md** — how the compiler reads this format
- **FRONTEND_SPEC.md** — how the editor renders and wizard writes this format
- **WIZARD_SPEC.md** — operator and value lists that appear in condition objects

If any field is added, removed, or changed, update all four documents and bump
`logic_version` or `ui_version` as appropriate.
