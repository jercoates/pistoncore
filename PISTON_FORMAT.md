# PistonCore — Canonical Piston JSON Format

**Version:** 2.2
**Status:** Authoritative — Single source of truth for piston data structure
**Last Updated:** May 2026 (Session 69 — D-S5/D-S5b: role_tokens added to Condition and
  Action schemas (GAP-S64-1); Field Lifecycle Rules section added; render invariant
  language softened per SPEC_AUDIT.md finding #1; single-resolution-path rule clarified
  per finding #2)

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

**Shared/export format (Snapshot JSON):** Structured JSON with role name placeholders
and no entity IDs. Used for AI import, community sharing, and WebCoRE migration.
See DESIGN.md Section 6.2. Never stored as the internal format — the snapshot is
generated on export, not on save.

The compiler reads structured JSON only.
The wizard writes structured JSON only.
The editor renders from structured JSON only.

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
| `logic_version` | integer | Yes | Tracks statement schema version. Current version: 2. |
| `ui_version` | integer | Yes | Tracks editor layout version. Start at 1. Changes independently of logic_version. |
| `compile_target` | string | Yes | `"native_script"` or `"pyscript"`. Always set by compiler — never by user. |
| `created_at` | string | Yes | ISO 8601 UTC timestamp. |
| `modified_at` | string | Yes | ISO 8601 UTC timestamp. Updated on every save. |
| `variables` | array | Yes | Piston-local variable definitions. Empty array if none. |
| `statements` | array | Yes | Top-level statement objects. Empty array if none. |

**Note:** `device_map` is eliminated as of logic_version 2. Entity IDs are stored
directly on condition and action nodes. See Condition Object Schema and Action Node
Schema below.

### Mode Values

| PistonCore mode | HA automation mode | Behavior |
|---|---|---|
| `single` | `single` | Only one run at a time. New trigger ignored if already running. |
| `restart` | `restart` | New trigger cancels current run and starts fresh. |
| `queued` | `queued` | New trigger queued. Runs in order. |
| `parallel` | `parallel` | Each trigger starts an independent run. |

### Version Fields

- `logic_version` — bump when the statement schema changes. **Version 2 = device_map
  eliminated, entity_ids stored directly on condition and action nodes.**
- `ui_version` — bump when editor rendering structure changes
- These change independently — never collapse into one field
- If either is missing on load, treat as v1
- If either is from the future, warn and refuse to load — never silently corrupt

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
| `default_value` | any | No | Initial value when piston starts. Type must match `type` field. For `device`/`devices` types, an object `{ "role": "...", "entity_ids": [...] }`. |

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

## statements — Nested Tree Model

The statements array is the action tree. Every element is a typed statement object.
Statements are always typed objects — the compiler never parses text.

**The statements array is a nested tree. Control flow nodes own their children
directly.** `then`, `else`, `statements`, `else_ifs`, and `cases` contain child
statement objects embedded inline — not ID references. The tree structure is explicit
and self-contained. This eliminates the entire class of orphaned-reference bugs and
guarantees that what is stored is exactly what renders in the editor.

**Render invariant:** The editor must render every well-formed piston JSON correctly.
For malformed nodes (missing required fields, unknown type, future logic_version),
it renders a clearly-flagged placeholder row that preserves the node in the JSON and
lets the user repair or delete it. The editor must never silently drop, duplicate,
or corrupt nodes.

```json
"statements": [
  {
    "id": "stmt_a3f8c2d1",
    "type": "if",
    "conditions": [ ... ],
    "condition_operator": "and",
    "then": [
      {
        "id": "stmt_b7e2f941",
        "type": "action",
        "role": "Driveway Light",
        "role_tokens": ["light.driveway_main"],
        "entity_ids": ["light.driveway_main"],
        "tasks": [
          {
            "id": "task_c1d4e823",
            "command": "turn_on",
            "domain": "light",
            "ha_service": "light.turn_on",
            "parameters": { "brightness_pct": 100 }
          }
        ],
        "description": null,
        "disabled": false
      }
    ],
    "else_ifs": [],
    "else": [],
    "description": null,
    "disabled": false
  }
]
```

There are no ID references between statements. A node's children live inside it.
Rendering, compilation, insert, and remove all operate on the tree directly —
no lookup map is required or permitted.

### tasks — Embedded Objects

`tasks` inside `action` nodes are embedded objects, not child statements. This is
consistent with the nested tree model — everything is embedded. Tasks have their
own `task_` prefixed IDs and are never referenced from outside their parent action node.

---

## Condition Object Schema

Conditions appear inside `if`, `while`, `repeat`, `on_event` statement types.
The same schema is used for triggers (`is_trigger: true`) and conditions
(`is_trigger: false`).

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
| `is_trigger` | boolean | Yes | `true` = trigger, `false` = condition. Set by wizard based on which section was clicked. |
| `role` | string | Yes | Human-readable label shown in the editor (e.g. `"Front Door"`, `"Doors"`). For time conditions, use `"time"`. Display only — never used for compilation. |
| `role_tokens` | array | Yes | Raw tokens the user selected at commit time — entity_ids for physical devices, variable names for piston variables, `@name` for globals. Stored for edit round-trip hydration only. Compiler ignores this field. Editor must preserve it on every save. |
| `entity_ids` | array | Yes | Array of real HA entity IDs. Always an array — even for single-device conditions. Compiler reads this directly. For time conditions, omit or use `[]`. |
| `aggregation` | string | Yes | `"any"` / `"all"` / `"none"`. Applies to multi-device conditions (entity_ids.length > 1). Use `"any"` for single-device. |
| `attribute` | string | Yes | Device attribute name (e.g. `"contact"`, `"illuminance"`). For time conditions, omit. |
| `attribute_type` | string | Yes | `"binary"` / `"numeric"` / `"string"` / `"enum"`. |
| `device_class` | string | No | HA device class (e.g. `"door"`, `"motion"`). Used for display value lookup. |
| `operator` | string | Yes | Operator string (e.g. `"changes to"`, `"is less than"`). Full list in WIZARD_SPEC.md. |
| `display_value` | string | Yes | Friendly value shown in editor (e.g. `"Open"`). Never `"on"` or `"off"` for binary sensors. |
| `compiled_value` | string | Yes | HA state string used by compiler (e.g. `"on"`). |
| `value_to` | string | No | Second value for `"is between"` / `"is not between"` operators. Null if not used. |
| `duration` | number | No | For `"stays for"` operators. Duration value. |
| `duration_unit` | string | No | `"seconds"` / `"minutes"` / `"hours"`. |
| `group_operator` | string | Yes | `"and"` / `"or"`. Operator connecting this condition to the next. |
| `interaction` | string | No | `"any"` / `"physical"` / `"programmatic"`. Defaults to `"any"`. |

**The compiler reads `entity_ids` directly. It does not look up a role name in any map.**
`role` is a display label only — it is shown in the editor but never used for compilation.
`role_tokens` is an editor round-trip field only — the compiler must ignore it entirely.

**Multi-device example:**
```json
{
  "id": "cond_b7e2f941",
  "is_trigger": true,
  "role": "Doors",
  "role_tokens": ["binary_sensor.front_door", "binary_sensor.back_door", "binary_sensor.side_door"],
  "entity_ids": ["binary_sensor.front_door", "binary_sensor.back_door", "binary_sensor.side_door"],
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

**Variable/global example** — when a piston variable or global is selected, `role_tokens`
differs from `entity_ids` because it stores the original token, not the resolved IDs:
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

```json
{
  "id": "cond_c1d4e823",
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

`only_on_days` uses ISO weekday numbers: 1=Monday through 7=Sunday.

### Condition Group

A condition array entry is either a flat condition object or a group object.
The renderer and compiler detect which by checking for `"type": "group"`.

```json
{
  "id": "cond_d2e5f894",
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

## Action Node Schema

Action nodes appear in `then`, `else`, `statements`, and `else_ifs[n].statements` arrays.

```json
{
  "id": "stmt_001",
  "type": "action",
  "async": false,
  "role": "Driveway Light",
  "role_tokens": ["light.driveway_main", "light.garage"],
  "entity_ids": ["light.driveway_main", "light.garage"],
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

### Action Node Field Reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Stable ID. Format: `stmt_` + 8 hex chars. |
| `type` | string | Yes | Always `"action"`. |
| `async` | boolean | No | Default `false`. Reserved — not compiled yet. |
| `role` | string | Yes | Human-readable label shown in the editor (e.g. `"Driveway Light"`). Display only — never used for compilation. |
| `role_tokens` | array | Yes | Raw tokens the user selected at commit time — entity_ids for physical devices, variable names for piston variables, `@name` for globals. Stored for edit round-trip hydration only. Compiler ignores this field. Editor must preserve it on every save. |
| `entity_ids` | array | Yes | Array of real HA entity IDs. Always an array. Compiler reads this directly to determine what to control. |
| `tasks` | array | Yes | One or more task objects. See Task Field Reference below. |
| `description` | string | No | Optional note shown in editor. Null if not set. |
| `disabled` | boolean | Yes | Default `false`. If `true`, compiler skips this statement. |

**The compiler reads `entity_ids` directly. It does not look up a role name in any map.**
`role` is a display label only.
`role_tokens` is an editor round-trip field only — the compiler must ignore it entirely.

### Task Field Reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Stable ID. Format: `task_` + 8 hex chars. |
| `command` | string | Yes | Service name without domain (e.g. `"turn_on"`). |
| `domain` | string | Yes | HA domain (e.g. `"light"`, `"switch"`). |
| `ha_service` | string | Yes | Full service call: `domain + "." + command`. Must always be set explicitly. |
| `parameters` | object | No | Service call data fields. Empty object `{}` if none. |
| `description` | string | No | Null if not set. |

---

## Field Lifecycle Rules

This section defines exactly when each key field is written, read, and what happens
to it on Snapshot export. This is the authoritative reference — if another spec
contradicts this table, this table wins and the other spec needs updating.

| Field | Written by | Read by | On Snapshot export |
|---|---|---|---|
| `role` | Wizard at commit time. Generated from selected row labels (count-based for multi). | Editor for display only. Never read by compiler. | Kept — used as the placeholder label in Snapshot format. |
| `role_tokens` | Wizard at commit time. Stores the raw tokens the user selected (entity_ids, variable names, `@globals`). | Editor on re-open for edit — restores `sel.tokens` from this field to re-highlight correct rows. | Stripped — Snapshot format has no concept of tokens. |
| `entity_ids` | Wizard at commit time via `_getFlatEntityIds(sel.tokens)`. Also updated by `_reResolveVariableUses` when a device variable is edited. | Compiler reads this directly. Editor does not re-resolve — it trusts what is on the node. | Stripped — Snapshot format uses role placeholders, not entity IDs. |
| `display_value` | Wizard at commit time. Friendly label for binary values (e.g. `"Open"`). | Editor for display only. Never read by compiler. | Kept — helps the AI mapper understand what the condition means. |
| `compiled_value` | Wizard at commit time. The raw HA state string (e.g. `"on"`). | Compiler reads this. Editor uses it for numeric condition pre-fill to avoid unit suffix rejection. | Stripped — Snapshot format does not include compiled values. |
| `aggregation` | Wizard at commit time. `"any"` / `"all"` / `"none"`. Single-device nodes always get `"any"`. | Compiler reads this to decide trigger/condition template expansion. Editor displays it in the aggregation bar on re-open. | Kept — relevant to the Snapshot mapping step. |

**Resolution rule:** Token-to-entity-id resolution at wizard commit time goes through
`_getFlatEntityIds` only. Read-side walks of `entity_ids` on already-committed nodes
do not re-resolve — they trust what is on the node. If you find yourself wanting to
resolve tokens in a read-side walk, that means a previous commit did not fully resolve.
Fix the commit path, not the read path.

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
  "logic_version": 2,
  "ui_version": 1,
  "compile_target": "native_script",
  "created_at": "2026-05-01T08:00:00Z",
  "modified_at": "2026-05-03T14:22:00Z",
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
          "role": "time",
          "role_tokens": [],
          "entity_ids": [],
          "subject": "time",
          "operator": "happens daily at",
          "value": { "preset": "sunset", "offset": 0, "offset_unit": "minutes", "offset_direction": "+" },
          "group_operator": "and"
        }
      ],
      "condition_operator": "and",
      "then": [
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
      ],
      "else_ifs": [],
      "else": [],
      "description": null,
      "disabled": false
    }
  ]
}
```

---

## What This Format Is Not

- **Not Snapshot JSON** — Snapshot JSON is the export/share format: structured JSON with role name placeholders and no entity IDs. Snapshot is generated on export, not stored internally.
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
