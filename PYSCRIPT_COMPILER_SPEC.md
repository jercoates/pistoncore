# PistonCore — PyScript Compiler Specification

**Version:** 1.0 (Draft — Incomplete)
**Status:** DO NOT CODE FROM THIS DOCUMENT YET — see Section 0 for what is missing
**Last Updated:** May 2026

Read DESIGN.md v1.1, COMPILER_SPEC.md v1.0, PISTON_FORMAT.md v1.0, and WIZARD_SPEC.md v0.6
before this document. This spec is a companion to COMPILER_SPEC.md — that document covers
the native HA YAML compiler. This document covers the PyScript compiler only.

---

## 0. KNOWN GAPS — READ BEFORE USING THIS DOCUMENT

This spec is not complete. The following items are unresolved and must be filled in before
any compiler coding begins. Each gap is flagged inline with a `⚠ GAP N:` marker so you
can find them while reading.

Add these to MISSING_SPECS.md as a new item:
**"PyScript Compiler Spec — Known Gaps (6 items, Section 0)"**

---

### GAP 1 — `on_event` statement JSON schema is undefined
**Blocks:** Section 11.16
**What's needed:** The full structured JSON schema for an `on_event` statement — what
fields it has, how the event type is stored, how the filter condition is stored.
`on_event` is one of the three original PyScript-forcing types and is heavily used.
The compiler cannot handle it without knowing what JSON it receives.
WIZARD_SPEC.md lists it as a statement type but defines no JSON schema.
COMPILER_SPEC.md says it forces PyScript but defines no schema.
**Where to resolve:** Write the schema in STATEMENT_TYPES.md (not yet created),
then update Section 11.16 here.

### GAP 2 — `cancel_pending_tasks` statement JSON schema is unconfirmed
**Blocks:** Section 11.17
**What's needed:** Almost certainly just `{ "id": "stmt_xxx", "type": "cancel_pending_tasks" }`
with no other fields — but this must be confirmed in STATEMENT_TYPES.md before coding.
**Where to resolve:** Confirm in STATEMENT_TYPES.md, update Section 11.17.

### GAP 3 — `for_each` field name for the iterated role is unconfirmed
**Blocks:** Section 11.8
**What's needed:** COMPILER_SPEC.md Section 10.2 uses `"list_role"` as the field name
for the role being iterated in a `for_each` statement. This needs confirmation in
STATEMENT_TYPES.md. If wrong, the compiler will silently fail to find the device list.
**Where to resolve:** Confirm field name in STATEMENT_TYPES.md, update Section 11.8.

### GAP 4 — `repeat/until` — confirm `until_conditions` uses standard condition schema
**Blocks:** Section 11.10
**What's needed:** COMPILER_SPEC.md uses `"until_conditions"` as the field name for the
until block's condition array. Must confirm these condition objects use the same schema
as all other conditions — with `compiled_value`, `is_trigger: false`, `role`, etc.
Assumed yes based on PISTON_FORMAT.md — must be confirmed.
**Where to resolve:** Confirm in STATEMENT_TYPES.md, update Section 11.10.

### GAP 5 — Global variable helper entity ID format must be confirmed
**Blocks:** Section 7 (all global variable examples)
**What's needed:** DESIGN.md Section 7.1 states the helper entity ID is based on the
variable's internal UUID: `input_text.pistoncore_{uuid}`. Earlier draft specs
incorrectly used `pistoncore_global_{name}`. The correct format must be confirmed
against the `global_variables` array in the fat compiler context object
(COMPILER_SPEC.md Section 7) — that is what the compiler reads at runtime.
All examples in Section 7 of this spec use `{uuid}` as a placeholder pending this
confirmation.
**Where to resolve:** Confirm the `global_variables` array structure in COMPILER_SPEC.md
Section 7, update all Section 7 examples with the real format.

### GAP 6 — `switch` statement has no complete PyScript handler
**Blocks:** Section 11.12
**What's needed:** `switch` is in the statement type list (WIZARD_SPEC.md) and is NOT
PyScript-only — the PyScript compiler must handle it. In Python it compiles to an
`if/elif/else` chain. The handler direction is documented in Section 11.12 but the
full implementation is blocked on confirming the `switch` JSON schema from
STATEMENT_TYPES.md.
**Where to resolve:** Define switch JSON schema in STATEMENT_TYPES.md, complete
Section 11.12.

---

## 1. Purpose and Scope

This spec defines the PyScript compiler for PistonCore. The compiler is a pure Python
function: structured JSON in, Python string out. The backend handles all file writing,
hash computation, and HA deployment.

The native YAML compiler (COMPILER_SPEC.md) handles simple pistons. This compiler handles
pistons where `compile_target == "pyscript"`. That field is set automatically by the
compiler's detection logic — the user never sets it manually.

**The compiler reads structured JSON only.** It never parses piston_text. It reads the
`statements` array of typed statement objects and the `device_map` of role → entity ID
lists. See PISTON_FORMAT.md for the complete input schema.

**The compiler calls no HA endpoints.** All data it needs arrives pre-fetched in the
fat compiler context object (COMPILER_SPEC.md Section 7).

---

## 1.1 PyScript-Forcing Patterns

The following patterns force `compile_target = "pyscript"`. This list is authoritative
and expands on `target-boundary.json` in the customize volume (DESIGN.md Section 3.1).

The compiler re-scans the `statements` array on every save. If any pattern is found,
`compile_target` is set to `"pyscript"`. If all forcing patterns are later removed,
the compiler restores `"native_script"` on the next save. The user never manually
overrides the compile target (DESIGN.md Section 3.1 — Compile Target Is Always
Compiler-Owned).

| Pattern | Detected by | Why PyScript |
|---|---|---|
| `break` statement | `type == "break"` | No native HA equivalent |
| `on_event` statement | `type == "on_event"` | No native HA equivalent |
| `cancel_pending_tasks` statement | `type == "cancel_pending_tasks"` | No native HA equivalent |
| `$currentEventDevice` system variable | `name == "$currentEventDevice"` in any operand | Requires `var_name` from `@state_trigger` kwargs — native HA cannot pass trigger context into script sequences |
| `repeat_until_state` | `type == "repeat"` with `until_conditions` referencing a device role | Native HA `repeat/until` with live multi-device state checks is unreliable |
| `dynamic_attribute_access` | `type == "for_each"` with attribute access on loop variable | Dynamic entity ID for attribute lookup inside loops is unreliable in native HA templates |
| `loop_string_accumulation` | String variable assigned with append pattern inside any loop | Native HA script variable scoping across `repeat` iterations is unreliable |

---

## 2. Output File Location and Naming

The compiler returns a Python string. The backend writes it to:

```
<ha_config>/pyscript/pistoncore/pistoncore_<uuid>.py
```

Example for piston `d4e2f9a1`:

```
/config/pyscript/pistoncore/pistoncore_d4e2f9a1.py
```

The `pistoncore/` subdirectory is required — files in the root `pyscript/` folder are
not PistonCore-owned. PyScript auto-reloads `.py` files when they change. No HA restart
needed after deploy.

**Piston UUID → function name:** Lowercase, hyphens removed.
UUID `d4e2f9a1` → function name `pistoncore_d4e2f9a1`.

---

## 3. File Header

Every compiled PyScript file begins with this exact header. The format must match
COMPILER_SPEC.md Section 6 — the hash system depends on it.

```python
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: d4e2f9a1 | pc_version: 1.0 | pc_hash: [computed on deploy]
# pc_globals_used: message_of_the_day, last_door_opened
```

- Line 1: Signature — identical wording to native YAML compiler header
- Line 2: Pipe-separated identity fields — same format as native YAML compiler
- Line 3: Comma-separated list of PistonCore global variable names (`@`-prefixed)
  referenced anywhere in this piston, or `(none)`

The hash is computed by the backend over file content below these three header lines.
The compiler emits `[computed on deploy]` as a placeholder — the backend replaces it.

**`pc_globals_used` generation:** The compiler walks the entire `statements` array
recursively via `scan_globals()` (COMPILER_SPEC.md Section 8). It collects every
operand with `type == "global_variable"` and every `set_variable` targeting a `@`-prefixed
name. Returns a sorted deduplicated list of `name` strings.

---

## 4. Compiler Entry Point

The PyScript compiler is called from `compile_piston()` in COMPILER_SPEC.md Section 8
when `compile_target == "pyscript"`. It receives the fat context object:

```python
def compile_pyscript(piston: dict, context: dict) -> CompilerResult:
    """
    piston:  full piston JSON (statements, device_map, device_map_meta, mode, name, id, etc.)
    context: fat compiler context object (COMPILER_SPEC.md Section 7)
    Returns: CompilerResult — see COMPILER_SPEC.md Section 13 for the full contract
    """
```

**Return type is `CompilerResult` with `CompilerMessage` objects.**
The PyScript compiler uses the same contract as the native YAML compiler — see
COMPILER_SPEC.md Section 13. Error codes follow SCREAMING_SNAKE_CASE.
PyScript-specific codes are added in Section 13 of this document.

**The compiler never writes files.** It returns a string. The backend writes atomically
or not at all. Never emit partial output on error — return `CompilerResult` with
`yaml: None` and errors populated.

---

## 5. Reading device_map

The compiler resolves role names to entity IDs using `device_map` from the piston JSON.

```python
# device_map structure — from PISTON_FORMAT.md:
# { "role_name": ["entity_id_1", "entity_id_2", ...] }
# Values are ALWAYS arrays, even for single-device roles.

entity_ids = piston["device_map"].get("Doors", [])
# → ["binary_sensor.front_door_contact", "binary_sensor.back_door_contact"]

# Cardinality comes from device_map_meta:
cardinality = piston["device_map_meta"]["Doors"]["cardinality"]
# → "single" or "multi"
```

**If a role has an empty array** (`[]`), the device is unmapped. Raise `CompilerError`
with code `UNMAPPED_ROLE`. The missing-device handler (DESIGN.md Section 15.6) runs
before compile — if execution reached the compiler, the map should be valid. Treat
an empty array as a bug and fail hard.

**`device_map_meta`** tells the compiler whether a role was originally single or multi.
A role with one entity but `cardinality: "multi"` means other devices are missing.

---

## 6. Reading Conditions — The `is_trigger` Flag

Conditions appear inside `if`, `while`, `repeat`, and `on_event` statement types.
All conditions use the same schema (PISTON_FORMAT.md — Condition Object Schema).

The `is_trigger` flag is the only thing that distinguishes a trigger from a condition.
The wizard sets it based on which operator group the user picked (WIZARD_SPEC.md).

```json
{
  "id": "cond_001",
  "is_trigger": true,
  "aggregation": "any",
  "role": "Doors",
  "attribute": "contact",
  "attribute_type": "binary",
  "device_class": "door",
  "operator": "changes to",
  "display_value": "Open",
  "compiled_value": "on",
  "group_operator": "and"
}
```

**`compiled_value` drives all state comparisons — never `display_value`.**
`display_value` is for the editor renderer only. The compiler always uses `compiled_value`.
For binary sensors: `compiled_value` is always `"on"` or `"off"`.
For enum/multi-state entities: `compiled_value` and `display_value` are the same.

**`is_trigger: true`** → condition becomes a `@state_trigger` decorator argument.
**`is_trigger: false`** → condition becomes an `if` check inside the function body.

The compiler walks the entire `statements` array and collects ALL conditions where
`is_trigger == true` to build the decorator(s). Triggers can appear in any `if` block
anywhere in the piston — not just the first one (COMPILER_SPEC.md Section 9.3).

---

## 7. Global Variables

⚠ **GAP 5 applies to all examples in this section.** The entity ID format shown
uses `{uuid}` as a placeholder. The real format comes from the `global_variables`
array in the fat context object — confirm before coding.

PistonCore global variables use two mechanisms depending on type (DESIGN.md Section 7.1):

### 7.1 Device / Devices Globals — Compile-Time Only

Device globals are baked into the compiled file at deploy time. The compiler expands
entity IDs from `device_map` directly into trigger decorators and service call targets.
No runtime lookup occurs.

```python
# Global @Doors — entity IDs baked in from device_map["Doors"] at compile time
@state_trigger(
    "binary_sensor.front_door_contact == 'on'",
    "binary_sensor.back_door_contact == 'on'",
)
```

When a device global changes, the piston is flagged stale and must be redeployed.
`pc_globals_used` in the header enables the backend to find all affected pistons
without a database (DESIGN.md Section 7.1).

### 7.2 Non-Device Globals (Text, Number, Boolean, DateTime) — HA Input Helpers

Non-device globals are backed by HA input helpers. The compiler reads the
`global_variables` array from the fat context object to get the helper entity ID
for each named global.

```python
# Read a global text variable  ⚠ GAP 5: confirm entity ID format from fat context
msg = state.get("input_text.pistoncore_{uuid}")

# Write it
input_text.set_value(
    entity_id="input_text.pistoncore_{uuid}",   # ⚠ GAP 5
    value="Garage door was left open"
)

# Read a global number  ⚠ GAP 5
threshold = float(state.get("input_number.pistoncore_{uuid}") or 0)
```

**If the helper doesn't exist** (global deleted or not yet created by backend):

```python
val = state.get("input_text.pistoncore_{uuid}")   # ⚠ GAP 5
if val is None:
    log.error("pistoncore_d4e2f9a1: Global 'message_of_the_day' not found — redeploy may be needed")
    event.fire("PISTONCORE_RUN_COMPLETE", piston_id="d4e2f9a1", status="error")
    return
```

### 7.3 Device Global Used in a Loop — Dynamic Attribute Access Pattern

This is the `dynamic_attribute_access` PyScript-forcing pattern. The device list is
compile-time (baked in). The dynamic part is attribute access on a loop variable:

```python
# Device list baked in from device_map["BatteryDevices"] at compile time
_battery_devices = [
    "sensor.front_door_battery",
    "sensor.back_door_battery",
    "sensor.motion_sensor_battery"
]

message = ""
for device in _battery_devices:
    battery_level = float(state.get(device) or 100)
    if battery_level < 20:
        friendly = state.getattr(device).get("friendly_name", device)
        message += f"{friendly} is low ({int(battery_level)}%)\n"
```

`state.get(device)` where `device` is a loop variable — this is what native HA
templates cannot handle reliably, hence the PyScript requirement.

---

## 8. Piston Mode → task.unique()

Piston mode is in the piston wrapper (`piston["mode"]`). It compiles to a
`task.unique()` call as the **first statement** in the function body, before any logic.

| Piston mode | Compiled behavior |
|---|---|
| `restart` (default) | `task.unique("pistoncore_{uuid}", kill_me=True)` |
| `single` | `task.unique("pistoncore_{uuid}", kill_me=False)` |
| `queued` | No `task.unique()` call |
| `parallel` | No `task.unique()` call |

`task.unique()` MUST be the first statement inside the function. If it runs after any
logic, a prior instance could partially execute before being killed.

---

## 9. Full Compiled File Structure

Every compiled PyScript piston follows this structure:

```python
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: {uuid} | pc_version: {version} | pc_hash: [computed on deploy]
# pc_globals_used: {comma-separated list, or "(none)"}

@state_trigger(...)       # one or more trigger decorators built from is_trigger conditions
@time_trigger(...)        # only if piston has a time-based trigger
@event_trigger(...)       # only if piston has an event trigger

def pistoncore_{uuid}(trigger_type=None, var_name=None, value=None, old_value=None, **kwargs):
    """{piston name}"""

    # Mode handling — always first
    task.unique("pistoncore_{uuid}", kill_me=True)  # restart mode example

    # [day-of-week restriction check, if any — always before any other logic]

    # [compiled statement body]

    # Completion event — always last
    event.fire("PISTONCORE_RUN_COMPLETE",
               piston_id="{uuid}",
               piston_name="{piston name}",
               status="success")
```

The completion event is always the final statement. Every exit path through the function
must fire it before returning — see `exit` statement in Section 11.13.

---

## 10. Trigger Decorators

Trigger decorators are built from all conditions where `is_trigger == true` anywhere
in the `statements` array. All such conditions are collected first, then grouped by
trigger type, before any function body is written.

### 10.1 @state_trigger — State/Attribute Change

**Single entity, changes to a specific value:**

Input condition:
```json
{
  "is_trigger": true, "role": "FrontDoor", "attribute": "contact",
  "operator": "changes to", "compiled_value": "on", "aggregation": null
}
```

```python
@state_trigger(
    "binary_sensor.front_door_contact == 'on' and binary_sensor.front_door_contact.old == 'off'"
)
```

The `.old` guard on the expression ensures "changes to" fires only on the rising edge,
not while already in that state.

**Multi-device role, aggregation "any" — OR across all entities in the role:**

Input condition:
```json
{
  "is_trigger": true, "role": "Doors", "attribute": "contact",
  "operator": "changes to", "compiled_value": "on", "aggregation": "any"
}
```

```python
@state_trigger(
    "binary_sensor.front_door_contact == 'on' and binary_sensor.front_door_contact.old == 'off'",
    "binary_sensor.back_door_contact == 'on' and binary_sensor.back_door_contact.old == 'off'",
    "binary_sensor.garage_door_contact == 'on' and binary_sensor.garage_door_contact.old == 'off'"
)
```

Each entity in `device_map["Doors"]` becomes a separate string argument. PyScript OR's
multiple string arguments — any one firing runs the function.

**Multi-role OR trigger** (e.g., `{Doors}` OR `{Windows}` — two separate is_trigger conditions):

All entities from all triggering roles are expanded as separate string arguments on
one `@state_trigger` decorator:

```python
@state_trigger(
    # role: Doors
    "binary_sensor.front_door_contact == 'on' and binary_sensor.front_door_contact.old == 'off'",
    "binary_sensor.back_door_contact == 'on' and binary_sensor.back_door_contact.old == 'off'",
    # role: Windows
    "binary_sensor.living_room_window_contact == 'on' and binary_sensor.living_room_window_contact.old == 'off'",
    "binary_sensor.bedroom_window_contact == 'on' and binary_sensor.bedroom_window_contact.old == 'off'"
)
```

**Operator → `@state_trigger` expression mapping:**

| Wizard operator | `compiled_value` | Expression pattern |
|---|---|---|
| `changes to` | `"on"` | `"entity == 'on' and entity.old == 'off'"` |
| `changes from` | `"on"` | `"entity.old == 'on' and entity == 'off'"` |
| `changes` (any) | — | `"entity_id"` (bare string — any change) |
| `rises above` | `800` | `"float(entity) > 800 and float(entity.old) <= 800"` |
| `drops below` | `800` | `"float(entity) < 800 and float(entity.old) >= 800"` |

**Trigger function signature — always use this:**
```python
def pistoncore_{uuid}(trigger_type=None, var_name=None, value=None, old_value=None, **kwargs):
```

- `var_name`: entity_id of the entity that triggered — used for `$currentEventDevice`
- `value`: new state value (string)
- `old_value`: prior state value (string)
- `trigger_type`: `"state"` / `"time"` / `"event"` — used when piston has multiple trigger types

### 10.2 @time_trigger — Time-Based Triggers

Input condition (from PISTON_FORMAT.md time condition schema):
```json
{
  "is_trigger": true,
  "subject": "time",
  "operator": "happens daily at",
  "value": { "preset": "sunset", "offset": 30, "offset_unit": "minutes", "offset_direction": "+" }
}
```

```python
@time_trigger("once(sunset + 30m)")
```

**Operator → @time_trigger mapping:**

| Wizard operator | `value` field content | Compiled |
|---|---|---|
| `happens daily at` (fixed time) | `"08:30:00"` | `"once(08:30:00)"` |
| `happens daily at` (sunrise, no offset) | `{ "preset": "sunrise", "offset": 0 }` | `"once(sunrise)"` |
| `happens daily at` (sunrise + offset) | `{ "preset": "sunrise", "offset": 30, "offset_unit": "minutes", "offset_direction": "+" }` | `"once(sunrise + 30m)"` |
| `happens daily at` (sunset - offset) | `{ "preset": "sunset", "offset": 15, "offset_unit": "minutes", "offset_direction": "-" }` | `"once(sunset - 15m)"` |
| `every N minutes` | `{ "interval": 5, "interval_unit": "minutes" }` | `"period(now, 5m)"` |
| `every N hours` | `{ "interval": 1, "interval_unit": "hours" }` | `"period(now, 1h)"` |
| HA startup | (no value field) | `"startup"` |

### 10.3 @event_trigger — Event Triggers

Used when `on_event` is the piston's PRIMARY trigger (not nested inside logic body).

```python
@event_trigger("PISTONCORE_CALL_PISTON", "target_piston_id == 'd4e2f9a1'")
```

⚠ **GAP 1:** The `on_event` statement JSON schema is undefined. This decorator pattern
is the correct output direction — the input schema that drives it is unknown.

### 10.4 Day-of-Week Time Condition

Day-of-week restrictions are NOT triggers — they compile to an inline check inside
the function body, NOT to a decorator.

Input condition (from PISTON_FORMAT.md):
```json
{
  "is_trigger": false,
  "subject": "time",
  "operator": "is on",
  "only_on_days": [1, 2, 3, 4, 5]
}
```

`only_on_days` uses ISO weekday numbers: 1=Monday through 7=Sunday.

```python
# Day-of-week restriction — emitted immediately after task.unique()
import datetime
if datetime.datetime.now().isoweekday() not in [1, 2, 3, 4, 5]:
    return  # wrong day — exit without firing completion event
```

Returning without firing `PISTONCORE_RUN_COMPLETE` is correct here — no run occurred.

### 10.5 Multiple Trigger Types on One Function

State trigger + time trigger → two separate decorators on the same function:

```python
@state_trigger("binary_sensor.front_door_contact == 'on'")
@time_trigger("cron(0 22 * * *)")
def pistoncore_d4e2f9a1(trigger_type=None, var_name=None, **kwargs):
    # Use trigger_type to know which fired: "state" or "time"
    ...
```

### 10.6 Multiple Top-Level if Blocks as Separate Triggers

A piston with multiple `if` blocks each having `is_trigger: true` conditions compiles
to one function with all triggers combined in the decorator. The body branches on `var_name`:

```python
@state_trigger(
    # trigger block 1
    "binary_sensor.water_sensor_kitchen == 'on'",
    # trigger block 2
    "binary_sensor.water_sensor_away == 'on'",
)
def pistoncore_d4e2f9a1(trigger_type=None, var_name=None, value=None, **kwargs):
    task.unique("pistoncore_d4e2f9a1", kill_me=True)

    if var_name == "binary_sensor.water_sensor_kitchen":
        # trigger block 1 body
        pass
    elif var_name == "binary_sensor.water_sensor_away":
        # trigger block 2 body
        pass
```

---

## 11. Statement Type Handlers

The compiler builds a lookup map from the flat `statements` array before walking the
tree, then resolves `then`, `else`, and `statements` child arrays by ID reference
(PISTON_FORMAT.md — Statement References Inside Blocks).

Every handler emits Python with a comment identifying the statement ID:
`# stmt_001 — {type}: {brief description}`

### 11.1 if / else if / else

Input:
```json
{
  "id": "stmt_001",
  "type": "if",
  "conditions": [{
    "id": "cond_001",
    "is_trigger": false,
    "role": "FrontDoor",
    "attribute": "contact",
    "attribute_type": "binary",
    "operator": "is",
    "compiled_value": "on",
    "aggregation": null,
    "group_operator": "and"
  }],
  "condition_operator": "and",
  "then": ["stmt_002"],
  "else_ifs": [],
  "else": []
}
```

**Important:** Conditions with `is_trigger: true` were already consumed for decorators.
Inside the function body, a trigger condition check uses `value` and `var_name` from
the function kwargs — not `state.get()`. This is the key difference between trigger
conditions and non-trigger conditions in the body.

```python
# stmt_001 — if
# Non-trigger condition (is_trigger: false) — reads current state:
if state.get("binary_sensor.front_door_contact") == "on":
    # [compiled then statements]

# Trigger condition in body (is_trigger: true) — uses decorator-provided kwargs:
if value == "on" and old_value == "off":
    # [compiled then statements]
```

**Condition → Python expression mapping:**

| Operator | Aggregation | Python expression |
|---|---|---|
| `is` | null/single | `state.get("entity") == "compiled_value"` |
| `is not` | null/single | `state.get("entity") != "compiled_value"` |
| `is greater than` | null/single | `float(state.get("entity") or 0) > value` |
| `is less than` | null/single | `float(state.get("entity") or 0) < value` |
| `is between` | null/single | `low <= float(state.get("entity") or 0) <= high` |
| `is` | `"any"` | `any(state.get(e) == "compiled_value" for e in [entity_list])` |
| `is` | `"all"` | `all(state.get(e) == "compiled_value" for e in [entity_list])` |
| `is` | `"none"` | `not any(state.get(e) == "compiled_value" for e in [entity_list])` |
| `changes to` (body check) | `"any"` | `value == "compiled_value" and var_name in [entity_list]` |

**`condition_operator`** connects multiple conditions: `"and"` → `and`, `"or"` → `or`.
**`else_ifs`** compile to `elif` blocks. **`else`** compiles to an `else` block.

### 11.2 action (Service Calls)

Input:
```json
{
  "id": "stmt_002",
  "type": "action",
  "devices": ["KitchenLight"],
  "tasks": [{
    "id": "task_001",
    "command": "turn_on",
    "domain": "light",
    "ha_service": "light.turn_on",
    "parameters": { "brightness_pct": 75 }
  }]
}
```

Single entity:
```python
# stmt_002 — action: KitchenLight → light.turn_on
light.turn_on(entity_id="light.kitchen_main", brightness_pct=75)
```

Multiple entities from a multi-device role:
```python
# stmt_002 — action: Lights → light.turn_on
light.turn_on(entity_id=["light.kitchen_main", "light.dining_room"], brightness_pct=75)
```

Dynamic service call (when domain/service must be computed at runtime):
```python
service.call("light", "turn_on", entity_id="light.kitchen_main", brightness_pct=75)
```

### 11.3 set_variable

Input:
```json
{
  "id": "stmt_003",
  "type": "set_variable",
  "variable": "message",
  "value": { "type": "literal", "data": "Garage door opened" }
}
```

Piston variable (no `@` prefix in the stored name) → Python local variable:
```python
# stmt_003 — set_variable: message
message = "Garage door opened"
```

Global variable (`@` prefix in the stored name) → HA input helper service call:
```python
# stmt_003 — set_variable: @message (global)  ⚠ GAP 5: confirm entity ID format
input_text.set_value(entity_id="input_text.pistoncore_{uuid}", value="Garage door opened")
```

**Operand type → Python value (from PISTON_FORMAT.md Operand/Value Schema):**

| `type` | Python |
|---|---|
| `"literal"` | The `data` value directly |
| `"variable"` | Python variable name (the stored `name` field, `$` prefix is display-only) |
| `"global_variable"` | `state.get("input_{domain}.pistoncore_{uuid}")` ⚠ GAP 5 |
| `"system_variable"` | See Section 11.3a |
| `"expression"` | The `expression` string evaluated as Python |

#### 11.3a System Variable Compilation

| PistonCore variable | Python equivalent |
|---|---|
| `$now` | `datetime.datetime.now()` |
| `$sunrise` | `state.getattr("sun.sun").get("next_rising")` |
| `$sunset` | `state.getattr("sun.sun").get("next_setting")` |
| `$hour` | `datetime.datetime.now().hour` |
| `$minute` | `datetime.datetime.now().minute` |
| `$second` | `datetime.datetime.now().second` |
| `$weekday` | `datetime.datetime.now().isoweekday()` |
| `$index` | `_loop_index` (loop counter — set by for/for_each handler) |
| `$currentEventDevice` | `var_name` (from trigger function kwargs) |

### 11.4 wait (Fixed Duration)

Input:
```json
{ "id": "stmt_004", "type": "wait", "duration": 300, "duration_unit": "seconds" }
```

```python
# stmt_004 — wait: 300 seconds
task.sleep(300)
```

Duration unit → seconds: `seconds` × 1, `minutes` × 60, `hours` × 3600.

### 11.5 wait (Until Time)

Input:
```json
{ "id": "stmt_005", "type": "wait", "until": "23:00:00" }
```

```python
# stmt_005 — wait until 23:00:00
result = task.wait_until(
    time_trigger="once(23:00:00)",
    timeout=3600
)
if result.get("trigger_type") == "timeout":
    log.warning("pistoncore_{uuid}: wait until 23:00:00 timed out — target time may have passed")
```

A timeout is always required (COMPILER_SPEC.md Section 10.2 — wait_for_trigger note).
Default when user provides none: 3600 seconds (1 hour). Always emit CompilerWarning
with code `WAIT_UNTIL_PAST_TIME`.

### 11.6 wait_for_state

⚠ Note: `wait_for_state` and `wait` are two distinct statement types. Do not conflate them.

Input:
```json
{
  "id": "stmt_006",
  "type": "wait_for_state",
  "conditions": [{
    "role": "MotionSensor", "attribute": "motion",
    "operator": "is", "compiled_value": "off", "aggregation": null
  }],
  "timeout_seconds": 300,
  "continue_on_timeout": true
}
```

```python
# stmt_006 — wait_for_state: MotionSensor is Clear
result = task.wait_until(
    state_trigger="binary_sensor.back_motion_sensor == 'off'",
    timeout=300
)
if result.get("trigger_type") == "timeout":
    log.warning("pistoncore_{uuid}: wait_for_state timed out after 300s")
```

For multi-device aggregation in wait_for_state, build a combined expression:
- `"any"` → `"entity_a == 'off' or entity_b == 'off'"`
- `"all"` → `"entity_a == 'off' and entity_b == 'off'"`

### 11.7 for loop

Input:
```json
{
  "id": "stmt_007",
  "type": "for",
  "start": 1, "end": 10, "step": 1,
  "counter_variable": "count",
  "statements": ["stmt_008"]
}
```

```python
# stmt_007 — for: count from 1 to 10 step 1
for count in range(1, 11, 1):
    # [compiled child statements]
```

Python's `range()` supports arbitrary start and step — no compiler warning needed in
PyScript (unlike the native YAML compiler which must warn on non-standard start/step).

### 11.8 for_each loop

⚠ **GAP 3 applies here.** Field name `"list_role"` is from COMPILER_SPEC.md but
unconfirmed in STATEMENT_TYPES.md. Handler assumes that field name.

Input:
```json
{
  "id": "stmt_009",
  "type": "for_each",
  "variable": "device",
  "list_role": "BatteryDevices",
  "statements": ["stmt_010"]
}
```

```python
# stmt_009 — for_each: device in BatteryDevices  ⚠ GAP 3: confirm list_role field name
# Entity list baked in from device_map["BatteryDevices"] at compile time
_battery_devices_list = [
    "sensor.front_door_battery",
    "sensor.back_door_battery"
]
for device in _battery_devices_list:
    # [compiled child statements]
    # $device in child statements compiles to the 'device' loop variable
```

### 11.9 while loop

Input:
```json
{
  "id": "stmt_011",
  "type": "while",
  "conditions": [{
    "role": null, "attribute": null,
    "operator": "is less than",
    "compiled_value": "10"
  }],
  "condition_operator": "and",
  "statements": ["stmt_012"]
}
```

```python
# stmt_011 — while: count < 10
while count < 10:
    # [compiled child statements]
```

For device-state conditions in while: use `state.get()` pattern from Section 11.1.

### 11.10 repeat / until (do-while)

⚠ **GAP 4 applies here.** `until_conditions` field name and schema assumed correct —
must confirm these are standard condition objects with `compiled_value`, `role`, etc.

Input:
```json
{
  "id": "stmt_013",
  "type": "repeat",
  "statements": ["stmt_014"],
  "until_conditions": [{
    "role": "WaterSensors", "attribute": "moisture",
    "operator": "is", "compiled_value": "off", "aggregation": "all"
  }],
  "condition_operator": "and"
}
```

```python
# stmt_013 — repeat/until: all WaterSensors are Dry  ⚠ GAP 4: confirm until_conditions schema
while True:
    # [compiled body statements]
    if all(state.get(e) == "off" for e in ["binary_sensor.water_1", "binary_sensor.water_2"]):
        break
```

### 11.11 break

```python
# stmt_015 — break
break
```

Only valid inside a loop. Raises `CompilerError` with code `BREAK_OUTSIDE_LOOP` if
encountered outside a loop context. The compiler tracks loop nesting depth.

### 11.12 switch

⚠ **GAP 6 — handler not yet fully designed.** JSON schema unconfirmed.

`switch` is NOT PyScript-only. It compiles to a Python `if/elif/else` chain.
See COMPILER_SPEC.md Section 10.2 for the statement JSON schema (`switch`, `cases`,
`default` fields) and native YAML `choose:` output. Python equivalent direction:

```python
# stmt_016 — switch  ⚠ GAP 6: confirm JSON schema from STATEMENT_TYPES.md
_switch_val = count   # compile the switch expression to a Python value
if _switch_val == 1:
    pass  # [case 1 statements]
elif _switch_val == 2:
    pass  # [case 2 statements]
else:
    pass  # [default statements]
```

### 11.13 exit / stop piston

Input:
```json
{ "id": "stmt_017", "type": "exit", "value": "true" }
```

```python
# stmt_017 — exit
event.fire("PISTONCORE_RUN_COMPLETE",
           piston_id="{uuid}",
           piston_name="{piston name}",
           status="exited")
return
```

The completion event always fires before `return`. This applies to every early exit
path in the piston — the compiler must ensure no code path returns without this.

### 11.14 log_message

Input:
```json
{
  "id": "stmt_018",
  "type": "log_message",
  "message": { "type": "literal", "data": "Motion detected" }
}
```

```python
# stmt_018 — log_message
log.info("pistoncore_{uuid}: Motion detected")
```

All log messages are prefixed with `pistoncore_{uuid}:` for easy filtering in HA logs.
Log level defaults to `info`. The message operand follows the same operand schema as
`set_variable` — can be literal, variable, expression, etc.

### 11.15 call_piston

Input:
```json
{
  "id": "stmt_019",
  "type": "call_piston",
  "target_piston_id": "b7e2a1f4",
  "wait_for_completion": false
}
```

```python
# stmt_019 — call_piston: b7e2a1f4
event.fire("PISTONCORE_CALL_PISTON", target_piston_id="b7e2a1f4")
```

The target piston must have an `@event_trigger("PISTONCORE_CALL_PISTON")` decorator.
If `wait_for_completion: true`:

```python
event.fire("PISTONCORE_CALL_PISTON", target_piston_id="b7e2a1f4")
result = task.wait_until(
    event_trigger=["PISTONCORE_RUN_COMPLETE", "piston_id == 'b7e2a1f4'"],
    timeout=300
)
```

### 11.16 on_event

⚠ **GAP 1 — JSON schema undefined. This handler cannot be written yet.**

`on_event` nested inside logic body (not as primary trigger) compiles to
`task.wait_until` with an `event_trigger`. The output direction is correct —
the input JSON schema that drives it is undefined.

When GAP 1 is resolved, implement:
```python
# stmt_020 — on_event  ⚠ GAP 1: input JSON schema unknown
result = task.wait_until(
    event_trigger=["EVENT_TYPE_FROM_JSON", "filter_expression_from_JSON"],
    timeout=300    # timeout from JSON, or default
)
```

Until GAP 1 is resolved: raise `CompilerError` with code `ON_EVENT_SCHEMA_MISSING`
if this statement type is encountered.

### 11.17 cancel_pending_tasks

⚠ **GAP 2 — JSON schema unconfirmed.** Assumed trivial — no extra fields.

Input (assumed):
```json
{ "id": "stmt_021", "type": "cancel_pending_tasks" }
```

```python
# stmt_021 — cancel_pending_tasks  ⚠ GAP 2: confirm no extra fields
task.unique("pistoncore_{uuid}", kill_me=True)
```

### 11.18 do block

A grouping container — no compiled output of its own. The compiler walks the child
`statements` array and emits them inline. Adds an indented comment for readability:

```python
# stmt_022 — do block
# [child statements emitted inline]
```

### 11.19 every (timer — as piston primary trigger)

The `every` statement at the top level compiles as a trigger decorator, NOT as a
statement in the function body (same rule as COMPILER_SPEC.md Section 10.2 for
native YAML):

```python
@time_trigger("period(now, 5m)")    # every 5 minutes
@time_trigger("cron(0 8 * * *)")    # every day at 8:00 AM
@time_trigger("once(sunset)")       # every day at sunset
```

If `every` appears nested inside logic body (not as primary trigger): emit
`CompilerWarning` with code `EVERY_INSIDE_BODY` and skip.

---

## 12. $currentEventDevice

`$currentEventDevice` in any operand compiles to `var_name` — the entity ID passed
into the function by `@state_trigger`. This is one of the PyScript-forcing patterns.

```python
# set_variable: message = $currentEventDevice + " was opened"
message = f"{var_name} was opened"

# action: Turn off $currentEventDevice
# Domain extracted from var_name to build service call dynamically:
if var_name:
    _domain = var_name.split(".")[0]
    service.call(_domain, "turn_off", entity_id=var_name)
```

**Known limitation:** Domain extraction only works when the service name matches the
entity domain (e.g., `light.turn_off` on a light). This fails for binary sensors
(no `turn_off` service). See Section 14 open item 2.

---

## 13. Error and Warning Contract

The PyScript compiler uses the same `CompilerResult` / `CompilerMessage` contract
as the native YAML compiler. See COMPILER_SPEC.md Section 13 for the full dataclass
definitions, error code conventions, and base error codes.

**PyScript-specific codes** (additions to COMPILER_SPEC.md base codes):

| Code | Level | Condition |
|---|---|---|
| `BREAK_OUTSIDE_LOOP` | error | `break` statement outside a loop context |
| `EVERY_INSIDE_BODY` | warning | `every` statement nested inside logic, not as piston trigger |
| `WAIT_UNTIL_PAST_TIME` | warning | `wait until [time]` with no user timeout — defaulting to 1 hour |
| `ON_EVENT_SCHEMA_MISSING` | error | `on_event` encountered — GAP 1 not resolved, cannot compile |
| `PYSCRIPT_REQUIRED` | error | PyScript-forcing statement in a native_script piston — should not happen in normal flow, treat as bug |

---

## 14. Known Open Items

In addition to the six gaps in Section 0:

1. **TTS service selection** — Action handlers hardcode TTS service names. The actual
   TTS service depends on what the user has installed. Should come from PistonCore
   settings, passed in via the fat context object.

2. **$currentEventDevice domain extraction** — Section 12 extracts domain from
   `var_name` to build dynamic service calls. Fails for binary sensors and other
   entities whose domain has no matching `turn_off` / `turn_on` service. The wizard
   should prevent nonsensical commands on trigger-device references — not a compiler
   fix but needs coordination with WIZARD_SPEC.md.

3. **call_piston wait_for_completion event filter** — Section 11.15 uses
   `"piston_id == 'b7e2a1f4'"` as the filter expression on `PISTONCORE_RUN_COMPLETE`.
   Needs confirmation that the event actually fires with a `piston_id` field in that
   format. Pending DESIGN.md Section 21 (run status reporting).

4. **every statement inside logic body** — Section 11.19 warns and skips. Correct
   behavior (if any) is undefined. Also flagged in COMPILER_SPEC.md Section 20.

---

## 15. What This Compiler Does NOT Handle

- **Native YAML compilation** — COMPILER_SPEC.md
- **File writing to HA** — backend responsibility. Compiler returns string only.
- **Global variable helper creation/deletion** — backend responsibility.
- **Hash computation** — backend computes after compiler returns the string.
- **Device mapping validation** — backend validates `device_map` before calling compiler.
- **PyScript installation detection** — backend checks before deploying (DESIGN.md Section 3.2).
- **Piston enable/disable** — backend renames the `.py` file (prepends `#` to filename).
- **settings block** — contents undefined. Compiler ignores it.

---

## 16. Hand-Written Verification Example

**Input piston JSON (door chime — triggers $currentEventDevice, forces PyScript):**

```json
{
  "id": "d4e2f9a1",
  "name": "New Door / Window Chime",
  "mode": "restart",
  "compile_target": "pyscript",
  "device_map": {
    "Doors": ["binary_sensor.back_door_contact", "binary_sensor.front_door_contact"],
    "KitchenSpeaker": ["media_player.kitchen_sonos"]
  },
  "device_map_meta": {
    "Doors": { "cardinality": "multi" },
    "KitchenSpeaker": { "cardinality": "single" }
  },
  "variables": [{ "id": "var_001", "name": "message", "type": "string", "default_value": "" }],
  "statements": [
    {
      "id": "stmt_001", "type": "if",
      "conditions": [{
        "id": "cond_001", "is_trigger": true, "aggregation": "any",
        "role": "Doors", "attribute": "contact", "attribute_type": "binary",
        "device_class": "door", "operator": "changes to",
        "display_value": "Open", "compiled_value": "on", "group_operator": "and"
      }],
      "condition_operator": "and",
      "then": ["stmt_002", "stmt_003"],
      "else_ifs": [], "else": []
    },
    {
      "id": "stmt_002", "type": "set_variable",
      "variable": "message",
      "value": { "type": "system_variable", "name": "$currentEventDevice" }
    },
    {
      "id": "stmt_003", "type": "log_message",
      "message": { "type": "variable", "name": "message" }
    }
  ]
}
```

**Expected compiled output:**

```python
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: d4e2f9a1 | pc_version: 1.0 | pc_hash: [computed on deploy]
# pc_globals_used: (none)

@state_trigger(
    "binary_sensor.back_door_contact == 'on' and binary_sensor.back_door_contact.old == 'off'",
    "binary_sensor.front_door_contact == 'on' and binary_sensor.front_door_contact.old == 'off'"
)
def pistoncore_d4e2f9a1(trigger_type=None, var_name=None, value=None, old_value=None, **kwargs):
    """New Door / Window Chime"""

    # Mode: restart
    task.unique("pistoncore_d4e2f9a1", kill_me=True)

    # stmt_001 — if: any of Doors changes to Open
    # is_trigger: true — uses value/old_value/var_name from decorator, not state.get()
    if value == "on" and old_value == "off":

        # stmt_002 — set_variable: message = $currentEventDevice
        message = var_name

        # stmt_003 — log_message
        log.info(f"pistoncore_d4e2f9a1: {message}")

    # Completion event — always last
    event.fire("PISTONCORE_RUN_COMPLETE",
               piston_id="d4e2f9a1",
               piston_name="New Door / Window Chime",
               status="success")
```

---

*End of PYSCRIPT_COMPILER_SPEC.md*

*Gaps to resolve before coding: see Section 0 — six items.*
*When all gaps are resolved, remove the "DO NOT CODE" status line at the top of this document.*
