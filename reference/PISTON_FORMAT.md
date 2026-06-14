# PistonCore — Canonical Piston JSON Format

**Version:** 2.4
**Status:** Authoritative — Single source of truth for piston data structure
**Last Updated:** June 2026 (Session 73 — task model reconciled to code + WITH_BLOCK_TASK_FRAMEWORK.md:
  Task Field Reference now documents device-vs-virtual tasks and the proposed `kind`
  discriminator (ASSUMED); task order documented as load-bearing; statement-vs-task duality
  for wait/set_variable/log_message/call_piston documented; `tasks[]` documented as the
  universal ordered task container with the `insertStatement` task seam as the add/replace
  path. See WITH_BLOCK_TASK_FRAMEWORK.md for the container contract and current code gaps.)
**Prior:** May 2026 (Session 69 — D-S5/D-S5b: role_tokens added to Condition and
  Action schemas (GAP-S64-1); Field Lifecycle Rules section added; render invariant
  language softened per SPEC_AUDIT.md finding #1; single-resolution-path rule clarified
  per finding #2. Session 69b — CODE_FINDINGS reconciliation (Path A, code is
  authoritative): triggers/conditions/restrictions documented as top-level wrapper
  arrays; variable schema corrected to actual code field names (var_type, initial_value,
  initial_value as device-name list); logic_version 1 / device_map fully retired — no migration path,
  all pistons regenerated fresh as v2. Session 69c — device variable model corrected
  (this was the hard-won fix): variables and globals are DEVICE LISTS (friendly names)
  and NEVER hold entity IDs; only nodes hold resolved attribute-bearing entity IDs, one
  per device for the chosen function; attribute-bearing resolution rule added (GAP-S69-9).)

This document defines the canonical internal JSON format for a PistonCore piston.
This is the format the wizard writes, the editor renders from, the backend stores,
and the compiler reads. Every component that touches piston data must conform to
this document.

Read DESIGN.md Section 6 before this document.
For statement-level schemas, see STATEMENT_TYPES.md.
For compiler output from this format, see COMPILER_SPEC.md.
For editor rendering from this format, see FRONTEND_SPEC.md.

---

## ⭐ THE LOAD-BEARING RULE — Device → Entity Resolution

**Read this before anything else. If this is wrong, nothing works — the editor shows
pretty text that compiles to nothing.** This is the single most important contract in
PistonCore and the hardest part of the project to get right.

### The two layers

**Layer 1 — Variables and globals are DEVICE LISTS.** They store device references
(friendly names — the exact strings HA uses to identify a device). They NEVER store
entity IDs. The friendly name is not a display convenience; **it is the lookup key.**
Asking HA about a device by its friendly name is how PistonCore gets that device's
current entity IDs. Storing entity IDs on a variable would be redundant (HA already has
them, keyed by name) and would go stale when a device is reconfigured. So variables hold
names, and entity IDs are pulled live from HA whenever needed.

**Layer 2 — Nodes (condition / action / for_each / trigger) store ENTITY IDs.** At the
moment the wizard commits a statement, it knows which attribute the user chose. It
resolves the device list to the **entity that carries that attribute — one per physical
device** — and writes those entity IDs to the node. The compiler reads these directly.

### Why resolution can only happen at the node

The same variable feeds multiple statements, each using a different attribute. There is
no single "entity_ids for this variable" — the correct entities depend entirely on what
each consuming statement does. So the variable stays a name list, and each node resolves
independently.

### Worked example (real devices)

A device variable `Outdoor_Sensors` containing two physical devices:

```json
{
  "type": "variable",
  "id": "var_outdoor01",
  "name": "Outdoor_Sensors",
  "var_type": "devices",
  "initial_value": ["Outdoor Motion", "Zooz outdoor"]
}
```

`initial_value` holds two **device names** — no entity IDs. The friendly-name array is both
the stored data and the display source (the editor reads `initial_value` directly). "Outdoor
Motion" is a physical
device exposing `sensor.outdoor_motion_illuminance`, `binary_sensor.outdoor_motion_motion`,
plus battery/temperature/tamper. "Zooz outdoor" exposes `sensor.zooz_outdoor_illuminance`,
`binary_sensor.zooz_outdoor_motion`, `binary_sensor.zooz_outdoor_tamper`.

The SAME variable used in two statements with two different attributes resolves
differently on each node:

**Motion trigger** — resolves to the motion entity of each device:
```json
{
  "role": "Outdoor_Sensors",
  "role_tokens": ["Outdoor_Sensors"],
  "attribute": "motion",
  "entity_ids": ["binary_sensor.outdoor_motion_motion", "binary_sensor.zooz_outdoor_motion"]
}
```

**Illuminance condition** — resolves to the illuminance entity of each device:
```json
{
  "role": "Outdoor_Sensors",
  "role_tokens": ["Outdoor_Sensors"],
  "attribute": "illuminance",
  "entity_ids": ["sensor.outdoor_motion_illuminance", "sensor.zooz_outdoor_illuminance"]
}
```

Two devices → two attribute-bearing entity IDs per node, one per device. The battery,
temperature, and tamper entities NEVER appear — the compiler testing illuminance has no
use for them. The variable itself never changes and never holds any of these entity IDs.

### The rules in one line each

1. Variables and globals store device names (friendly names). Never entity IDs.
2. Nodes store entity IDs — the attribute-bearing entity, one per device, for the chosen function.
3. Resolution happens at the node, at commit time, because the attribute is only known there.
4. `role` / `role_tokens` on the node keep the variable/device name so the editor can display it and the node can be re-resolved if the variable's device list changes.
5. The picker's transient `sel.tokens` may hold ALL entities of a device (needed for the capability intersection that decides which attributes to offer) — but only the attribute-bearing entity per device is written to the node.

The complete worked piston is in REFERENCE_PISTON_V2.json. That file is the diff anchor:
a real save that resolves device data correctly looks like that.

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
| `logic_version` | integer | Yes | Tracks statement schema version. Current version: 2. |
| `ui_version` | integer | Yes | Tracks editor layout version. Start at 1. Changes independently of logic_version. |
| `compile_target` | string | Yes | `"native_script"` or `"pyscript"`. Always set by compiler — never by user. |
| `created_at` | string | Yes | ISO 8601 UTC timestamp. |
| `modified_at` | string | Yes | ISO 8601 UTC timestamp. Updated on every save. |
| `variables` | array | Yes | Piston-local variable definitions (defines). Empty array if none. |
| `triggers` | array | Yes | Top-level trigger condition objects (`is_trigger: true`). Empty array if none. See Trigger/Condition/Restriction Storage below. |
| `conditions` | array | Yes | Top-level restriction-style condition objects checked before the action tree runs. Empty array if none. |
| `restrictions` | array | Yes | Top-level restriction condition objects. Empty array if none. |
| `statements` | array | Yes | The action tree — top-level statement objects. Empty array if none. |

**Note:** `device_map` is eliminated as of logic_version 2. Entity IDs are stored
directly on condition, action, and for_each nodes. There is no role-to-entity lookup
table anywhere. See Condition Object Schema and Action Node Schema below.

### Trigger / Condition / Restriction Storage

Triggers, conditions, and restrictions are stored as **top-level arrays on the piston
wrapper** — `triggers`, `conditions`, `restrictions` — not nested inside `if` blocks in
the `statements` array. This matches the editor's TRIGGERS / CONDITIONS / RESTRICTIONS
section layout (FRONTEND_SPEC.md) and the frontend's storage model (editor.js routes
each by wizard context to its array).

- Each entry is a condition object (same schema as the Condition Object Schema below).
- Trigger entries carry `is_trigger: true`. Condition and restriction entries carry `is_trigger: false`.
- The `statements` array is the action tree only. `if` blocks inside `statements` carry
  their own inline `conditions` array for branch logic — that is separate from the
  top-level `conditions` array, which holds piston-level gating conditions.

The compiler reads `triggers` to build the automation trigger block, `conditions` and
`restrictions` to build the entry guard, and `statements` for the action sequence. It
does not walk `statements` looking for `is_trigger` nodes — triggers live in the
top-level `triggers` array.

### Mode Values

| PistonCore mode | HA automation mode | Behavior |
|---|---|---|
| `single` | `single` | Only one run at a time. New trigger ignored if already running. |
| `restart` | `restart` | New trigger cancels current run and starts fresh. |
| `queued` | `queued` | New trigger queued. Runs in order. |
| `parallel` | `parallel` | Each trigger starts an independent run. |

### Version Fields

- `logic_version` — bump when the statement schema changes. **Version 2 = device_map
  eliminated, entity_ids stored directly on condition/action/for_each nodes, top-level
  trigger/condition/restriction arrays.**
- `ui_version` — bump when editor rendering structure changes
- These change independently — never collapse into one field
- **Logic_version 1 is retired.** PistonCore no longer reads or migrates v1 pistons
  (which used `device_map`). All pistons are v2. A file without `logic_version: 2`
  should be rejected with a clear message, not silently migrated. There is no v1→v2
  migration path — early sandbox pistons were regenerated fresh as v2.
- If `logic_version` is from the future, warn and refuse to load — never silently corrupt

---

## variables (Piston Variables)

Piston variables are local to a single piston run. They are forgotten when the piston
finishes. They compile to the native HA script `variables:` action.

```json
"variables": [
  {
    "type": "variable",
    "id": "var_a3f8c2d1",
    "name": "message",
    "var_type": "string",
    "initial_value": ""
  },
  {
    "type": "variable",
    "id": "var_b7e2f941",
    "name": "count",
    "var_type": "number",
    "initial_value": 0
  }
]
```

### Variable Field Reference

These field names match the actual frontend code (editor.js, wizard-core.js). Earlier
spec drafts used `type`/`default_value`; the code uses `type: "variable"` as a node-kind
marker and `var_type`/`initial_value` for the variable's own type and value. The code
is authoritative — the field names below are what the wizard writes and the editor reads.

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | string | Yes | Always `"variable"` — the node-kind marker, same role as `type` on statements. |
| `id` | string | Yes | Stable UUID. Format `var_` + 8 hex. Never changes even if variable is renamed. |
| `name` | string | Yes | Internal name used in statements. The `$`/`@` prefix is part of how it's referenced. |
| `var_type` | string | Yes | The variable's data type. See type table below. |
| `initial_value` | any | No | Initial value when piston starts. For scalar types, a scalar matching `var_type`. For `device`/`devices` types, a **list of device references (friendly names) — NEVER entity IDs** (see below). Serves as both the stored data and the editor display source. `null` or omitted if "Nothing selected". |
| `initial_value_type` | string | No | Set by the wizard alongside `initial_value` to record how the value was entered (`device` / `value` / `variable` / `expression`). Omitted for "Nothing selected". |
| `initial_device_names` | array | No | **Not written by current code.** Optional/aspirational — current code uses the `initial_value` friendly-name array for both data and display, so a separate names field is redundant. Documented here only so a reader who sees it in older files knows it duplicates `initial_value`. Do not add it without a reason. |

### Device Variables and Globals — Entity IDs Live on NODES, Never on Variables

This is the single most important rule for device data, and it was the hardest part of
the project to get right. Read it carefully.

**A device variable (a "define") and a global are a LIST OF DEVICES — friendly names /
device references. They NEVER store entity IDs. Not at save, not resolved, not anywhere.**

Why variables can never hold entity IDs:

1. **The same variable feeds many statements, each using a different attribute.** A
   variable `Motion_sensors` (3 physical motion devices) might be used in an illuminance
   condition (→ 3 illuminance entity IDs), a motion trigger (→ 3 motion entity IDs), and a
   battery condition (→ 3 battery entity IDs) — all in the same piston. There is no single
   correct "entity_ids for this variable" — the right entities depend entirely on what
   attribute each consuming statement uses. So resolution can only happen at the node,
   where the attribute is known.

2. **Live accuracy.** Because the variable stays a device list, the picker re-grabs the
   device's current entities live from HA every time it is used. Entity IDs stored on a
   variable would go stale when devices are reconfigured. Device references don't.

3. **Globals are shared across pistons.** Same reasoning — a global is a device list;
   each consuming node resolves it to the attribute-bearing entities it needs.

**Therefore:**
- **Variables / globals** → `initial_value` (variable) or `value` (global) holds the device
  list (friendly names). This array is both the data and the display source. No entity IDs, ever.
- **Nodes (condition / action / for_each)** → `entity_ids` holds the resolved
  attribute-bearing entity IDs, written by the wizard at commit time for that specific
  statement. `role` / `role_tokens` holds the variable/global name (or friendly name) so
  the editor can display it and so the node can be re-resolved when the variable changes.

**Only nodes ever hold entity IDs. Variables and globals never do. One rule, no exceptions.**

#### Attribute-Bearing Resolution at the Node

When the wizard commits a condition or action that uses a device, variable, or global,
it resolves to the **entity that carries the selected attribute — one per physical device**,
not the device's whole entity cluster.

- 1 device, illuminance condition → 1 illuminance entity ID
- 3 devices (or a variable/global containing 3 devices), illuminance condition → 3
  illuminance entity IDs
- An action `light.turn_on` on 2 light devices → the 2 controllable `light.` entity IDs

The battery, temperature, and motion entities of a device are NOT written to an
illuminance condition node. The compiler reading an illuminance value has no use for the
battery entity — so it never appears on that node. (This is the bug GAP-S69-9 tracks: the
v1 path dumped the entire device cluster onto the node with blank values.)

Note the division of labor inside the wizard: `sel.tokens` (transient) tracks ALL entities
of a selected device group — that is correct and necessary for the capability intersection
that decides which attributes/operators to offer. But at commit, only the attribute-bearing
entity per device is written to the node's `entity_ids`. The picker sees everything; the
node keeps only what the chosen function needs.

```json
{
  "type": "variable",
  "id": "var_e0e51804",
  "name": "Motion_sensors",
  "var_type": "devices",
  "initial_value": ["Kitchen Motion", "Hall Motion", "Garage Motion"]
}
```

The variable above is a device list. A condition using it for illuminance would write,
on its OWN node, `entity_ids: ["sensor.kitchen_motion_illuminance",
"sensor.hall_motion_illuminance", "sensor.garage_motion_illuminance"]` and
`role_tokens: ["Motion_sensors"]`. The variable itself never changes and never holds
those entity IDs.

### Variable Types (`var_type` values)

| `var_type` value | Description | HA compile target |
|---|---|---|
| `"string"` | Text value | `variables:` with string value |
| `"number"` | Numeric value (integer or decimal) | `variables:` with numeric value |
| `"boolean"` | True/false | `variables:` with boolean value |
| `"datetime"` | Date and time | `variables:` with datetime string |
| `"device"` | Single device reference (a device list of one) | resolved to attribute-bearing entity IDs at each consuming node |
| `"devices"` | List of device references | resolved to attribute-bearing entity IDs at each consuming node |

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

The `tasks[]` array is the **universal ordered task container** — the "do …" list of a
WebCoRE `with {devices} do … end with` block. It holds an ordered, possibly heterogeneous
list of tasks: device service calls and virtual (non-device) actions, interleaved. Order =
execution order (load-bearing — see Task Field Reference). A task is appended/edited/removed
in place by its `task_` id; the editor's `insertStatement` task path (context `'task'` +
the action node's id) is the canonical add/replace seam. See
`WITH_BLOCK_TASK_FRAMEWORK.md` for the full container contract and the current
implementation gaps.

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

A task is one entry in an action node's `tasks[]` array. There are two kinds: a **device
task** (a service call against the with-block's `entity_ids`) and a **virtual task** (a
non-device action — Wait, Set variable, notify, log — that ignores the block's devices).
The two are distinguished so the compiler can route them. See
`WITH_BLOCK_TASK_FRAMEWORK.md` for the authoritative task-container contract; this table
is the field-level schema.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Stable ID. Format: `task_` + 8 hex chars. |
| `kind` | string | No | **ASSUMED (Session 73) — proposed, not yet in code.** `"device"` (default if absent) or `"virtual"`. Distinguishes a device service call from a non-device action so the compiler routes correctly. The framework requirement is only that a task is unambiguously classifiable device-vs-virtual; the exact mechanism (this `kind` field, or detecting a virtual task by a reserved `domain`) is a coding-session choice — see WITH_BLOCK_TASK_FRAMEWORK.md §2.3. Override freely. |
| `command` | string | Yes | Service name without domain (e.g. `"turn_on"`) for a device task; the virtual command id (e.g. `"wait"`, `"set_variable"`) for a virtual task. |
| `domain` | string | Device tasks only | HA domain (e.g. `"light"`, `"switch"`). Present on device tasks. Omitted on virtual tasks — the compiler resolves a virtual task's HA mapping from `command`. |
| `ha_service` | string | Device tasks only | Full service call: `domain + "." + command`. Set explicitly on device tasks. Omitted on virtual tasks. |
| `parameters` | object | No | For device tasks: service call data fields. For virtual tasks: the command payload, reusing the same shapes the standalone statement form uses (e.g. wait → `{duration, duration_unit}`, set_variable → `{variable, value:{type,…}}`, log → `{message, level}`). Empty object `{}` if none. |
| `description` | string | No | Null if not set. |

**Task order is load-bearing.** Tasks execute top to bottom in array order, not
concurrently — `Set Volume` then `Speak text` means volume first. Array position IS
execution order. Round-trip and compile must preserve it exactly. (Decided, Session 73.)

**Virtual-task example** (a Wait inside a device with-block — ASSUMED shape):
```json
{
  "id": "task_a1b2c3d4",
  "kind": "virtual",
  "command": "wait",
  "parameters": { "duration": 5, "duration_unit": "minutes" },
  "description": null
}
```

**Statement-vs-task duality:** `wait`, `set_variable`, `log_message`, and `call_piston`
exist BOTH as top-level statement nodes (see STATEMENT_TYPES.md) AND as virtual tasks
inside an action node's `tasks[]`. WebCoRE allows the same command as a standalone step or
as a task inside a `with`. Both forms are valid and must round-trip. Which one is produced
depends on where the user added it: from the statement picker → standalone statement; from
`+ add a new task` inside a device block → virtual task.

---

## Field Lifecycle Rules

This section defines exactly when each key field is written, read, and what happens
to it on Snapshot export. This is the authoritative reference — if another spec
contradicts this table, this table wins and the other spec needs updating.

| Field | Written by | Read by | On Snapshot export |
|---|---|---|---|
| `role` | Wizard at commit time. Generated from selected row labels (count-based for multi). | Editor for display only. Never read by compiler. | Kept — used as the placeholder label in Snapshot format. |
| `role_tokens` | Wizard at commit time. Stores the raw tokens the user selected (entity_ids, variable names, `@globals`). | Editor on re-open for edit — restores `sel.tokens` from this field to re-highlight correct rows. | Intended to be stripped — but verify before implementing: stripping `role_tokens` may erase variable names and authored content (e.g. message text in Speak tasks) that the user needs to survive import. Only resolved device identity data should be stripped, not authored content. See GAP-S74-4 / S2-3. |
| `entity_ids` | Wizard at commit time via `_getFlatEntityIds(sel.tokens)`. Also updated by `_reResolveVariableUses` when a device variable is edited. | Compiler reads this directly. Editor does not re-resolve — it trusts what is on the node. | Stripped — Snapshot format uses role placeholders, not entity IDs. Not yet implemented correctly; see GAP-S74-4 / S2-3. |
| `display_value` | Wizard at commit time. Friendly label for binary values (e.g. `"Open"`). | Editor for display only. Never read by compiler. | Kept — helps the AI mapper understand what the condition means. |
| `compiled_value` | Wizard at commit time. The raw HA state string (e.g. `"on"`). | Compiler reads this. Editor uses it for numeric condition pre-fill to avoid unit suffix rejection. | Stripped — Snapshot format does not include compiled values. Not yet implemented correctly; see GAP-S74-4 / S2-3. |
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

A simple single-trigger piston with one action. Note that the trigger lives in the top-level
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

- **Not Snapshot JSON** — Snapshot JSON is the export/share format: structured JSON with role name placeholders and no entity IDs. Snapshot is generated on export, not stored internally.
- **Not compiled YAML** — that is produced by the compiler from this format. Never stored here.
- **Not a UI state object** — wizard context, selected statement, scroll position etc. are transient UI state, not part of the piston format.

---

## Keeping This Document In Sync

This document must stay in sync with:
- **WITH_BLOCK_TASK_FRAMEWORK.md** — the authoritative task-container contract (with-blocks, device/virtual tasks, ordering, the three current code gaps)
- **STATEMENT_TYPES.md** — statement-level JSON schemas
- **COMPILER_SPEC.md** — how the compiler reads this format
- **FRONTEND_SPEC.md** — how the editor renders and wizard writes this format
- **WIZARD_SPEC.md** — operator and value lists that appear in condition objects

If any field is added, removed, or changed, update all five documents and bump
`logic_version` or `ui_version` as appropriate.
