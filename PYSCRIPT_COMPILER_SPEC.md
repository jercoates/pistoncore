> # ⚠ INTENTIONALLY STALE — DO NOT TREAT AS AUTHORITATIVE
>
> **This compiler spec is frozen on purpose until the piston JSON structure is final.**
>
> The piston JSON format is still stabilizing (Session 69b: device_map fully retired,
> top-level trigger/condition/restriction arrays confirmed, variable field names
> corrected to `var_type`/`initial_value`, logic_version 1 abandoned and all pistons
> regenerated fresh as v2). Updating this compiler spec in parallel with every JSON
> change has produced false confidence and wasted session time.
>
> **Until the JSON structure is locked, this document is directionally correct only.**
> The authoritative sources for the current data model are:
> - **PISTON_FORMAT.md** — wrapper, node schemas, field names, the Data Preservation Invariant
> - **STATEMENT_TYPES.md** — per-statement JSON schemas
> - **REFERENCE_PISTON_V2.json** — a known-good v2 piston covering every device-backed node type
>
> **One rule from this document IS current and load-bearing:** the compiler never resolves
> device tokens or friendly names. The wizard resolves devices to real HA entity IDs at
> selection time and writes them onto every node (`entity_ids`). The compiler reads
> `entity_ids` directly and never performs a role lookup, a variable lookup, or any
> name→entity resolution. Do not add resolution logic to the compiler.
>
> A dedicated session (B-1 / D-S6) will rewrite this document in full against the final
> JSON structure. Do not update compiler output examples here before then — fixing them
> piecemeal against a moving format is what this freeze exists to stop.
>
> ---

# PistonCore — PyScript Compiler Specification

**Version:** 1.1
**Status:** Authoritative
**Last Updated:** May 2026 (Session 57 — device_map eliminated, entity_ids on nodes,
  list_role replaced with entity_ids on for_each, Section 5 rewritten, Section 11
  handlers updated, verification example updated to logic_version 2)

Read DESIGN.md v1.1, COMPILER_SPEC.md v1.0, PISTON_FORMAT.md v1.0, and WIZARD_SPEC.md v0.6
before this document. This spec is a companion to COMPILER_SPEC.md — that document covers
the native HA YAML compiler. This document covers the PyScript compiler only.

---

## 0. KNOWN GAPS — READ BEFORE USING THIS DOCUMENT

All gaps resolved in Session 24. This section is preserved as a resolution log.
The spec is ready to code from.

---

### GAP 1 — RESOLVED (Session 24)
`on_event` JSON schema defined in STATEMENT_TYPES.md Section 10.
Uses standard condition objects (same schema as `if`/`while`/`repeat`) with
`is_trigger: true`. Compiles to blocking `task.wait_until()` — not truly async.
See Section 11.16 for full handler and limitation documentation.

### GAP 2 — RESOLVED (Session 24)
`cancel_pending_tasks` schema confirmed by STATEMENT_TYPES.md Section 18.
It is exactly `{ "id": "stmt_xxx", "type": "cancel_pending_tasks" }` with no other fields.
Gap marker removed from Section 11.17.

### GAP 3 — SUPERSEDED (Session 57)
`list_role` was confirmed as the field name in Session 24, but was eliminated in Session 57.
`for_each` now uses `role` (display label) + `entity_ids` (array, same as action and
condition nodes). See Section 11.8 for the updated handler. `list_role` no longer exists.

### GAP 4 — RESOLVED (Session 24)
`until_conditions` confirmed by STATEMENT_TYPES.md Section 8 and PISTON_FORMAT.md.
These are standard condition objects using the same schema as all other conditions —
with `compiled_value`, `is_trigger: false`, `role`, `operator`, `aggregation`, etc.
Gap marker removed from Section 11.10.

### GAP 5 — RESOLVED (Session 24)
Global variable helper entity ID format confirmed. See COMPILER_SPEC.md Section 7
for the full `global_variables` array structure. Format is `input_{domain}.pistoncore_{id}`
where `{id}` is the global variable's own UUID (not the piston UUID).
Device/Devices globals have `helper_entity_id: null` — compile-time expansion only.
All Section 7 examples updated with real format.

### GAP 6 — RESOLVED (Session 24)
`switch` JSON schema confirmed by STATEMENT_TYPES.md Section 4 and COMPILER_SPEC.md
Section 10.2. Fields: `expression` (operand object), `cases` (array with `id`, `case_type`,
`value`/`value_from`/`value_to`, `statements`), `default` (statements array),
`case_traversal_policy` (`"safe"` or `"fallthrough"`).
Section 11.12 updated with full handler.

---

## 1. Purpose and Scope

This spec defines the PyScript compiler for PistonCore. The compiler is a pure Python
function: structured JSON in, Python string out. The backend handles all file writing,
hash computation, and HA deployment.

The native YAML compiler (COMPILER_SPEC.md) handles simple pistons. This compiler handles
pistons where `compile_target == "pyscript"`. That field is set automatically by the
compiler's detection logic — the user never sets it manually.

**The compiler reads structured JSON only.** It never parses piston_text. It reads the
`statements` array of typed statement objects. Entity IDs are stored directly on
condition, action, and for_each nodes — there is no `device_map`. See PISTON_FORMAT.md
v2.1 for the complete input schema.

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

**Detection note:** `repeat_until_state`, `dynamic_attribute_access`, and `loop_string_accumulation`
are pattern detections — they require the compiler to analyze statement content, not just check
`type`. The detection logic for these must be written before the compile target detection function
is coded. See MISSING_SPECS.md item 9 (resolved Session 24) and target-boundary.json format in
COMPILER_SPEC.md Section 3.

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
    piston:  full piston JSON (statements, mode, name, id, etc. — entity_ids are on nodes, no device_map)
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

## 4.1 Template Architecture Decision

**Decision (Session 34 — S1-7 session 3):** The PyScript compiler uses a **hybrid approach**:
Jinja2 templates for structural boilerplate, pure Python string generation for body logic.

This decision was made explicitly here because MISSING_SPECS.md Item 16 flagged that
PYSCRIPT_COMPILER_SPEC.md was written assuming pure string generation throughout without
comparing it against the template approach used by the native YAML compiler.

### What gets Jinja2 templates

Structural boilerplate that changes with PyScript API versions goes in templates stored
in the customize volume. When PyScript changes a decorator signature or service call
pattern, only the template needs updating — no Python code release required. This is
the same rationale as the native YAML compiler's template system (DESIGN.md Section 14).

**Template location:** `pistoncore-customize/compiler-templates/pyscript/snippets/`

**The five boilerplate templates:**

| Template file | What it generates |
|---|---|
| `pyscript_state_trigger.j2` | `@state_trigger(...)` decorator block |
| `pyscript_time_trigger.j2` | `@time_trigger(...)` decorator block |
| `pyscript_task_unique.j2` | `task.unique(...)` mode enforcement block |
| `pyscript_service_call.j2` | `service.call(...)` action pattern |
| `pyscript_completion_event.j2` | `event.fire("PISTONCORE_RUN_COMPLETE", ...)` |

These five patterns have changed across PyScript versions and are the most likely
to change again. Everything else is stable enough to generate directly in Python.

### What stays as pure Python string generation

Body logic — `if`, `while`, `for`, `repeat`, `set_variable`, `log_message`,
`call_piston`, `switch`, `do`, `for_each`, `wait`, `on_event`, `break`,
`cancel_pending_tasks` — is generated by Python string building, not templates.

**The reason:** Python indentation is load-bearing. A Jinja2 template that generates
indented Python code inside another block cannot know how deep it is being nested.
The native YAML compiler does not have this problem because YAML indentation is
cosmetic — the structure is expressed by keys, not whitespace. In Python, wrong
indentation is a syntax error. Generating nested Python with templates reliably
requires passing indent levels into every template, which is more complexity than
it eliminates. Pure Python string building with an explicit `indent` parameter
(same pattern as the native compiler's `_compile_sequence`) is the right approach.

### How templates are loaded

The PyScript compiler uses the same Jinja2 `Environment` / `FileSystemLoader` pattern
as the native compiler, pointed at the pyscript template directory:

```python
env = Environment(
    loader=FileSystemLoader(
        "/pistoncore-customize/compiler-templates/pyscript/"
    ),
    trim_blocks=True,
    lstrip_blocks=True,
)
```

Templates are loaded by name: `env.get_template("snippets/pyscript_state_trigger.j2")`.

### Impact on PYSCRIPT_COMPILER_SPEC.md

Sections that describe boilerplate output (triggers, task.unique, service calls,
completion event) should be understood as describing what the corresponding template
produces, not what the Python compiler emits as a string literal. The compiler
renders those templates; the template content matches what the spec shows.

---

## 5. Reading Entity IDs — Directly From Nodes

Entity IDs are stored directly on condition, action, and for_each nodes. There is no
`device_map` or role lookup. The compiler reads `entity_ids` from each node directly.

```python
# Condition node — entity_ids read directly
entity_ids = condition["entity_ids"]
# → ["binary_sensor.front_door", "binary_sensor.back_door"]

# Action node — entity_ids read directly
entity_ids = stmt["entity_ids"]
# → ["light.living_room", "light.kitchen"]

# for_each node — entity_ids read directly
entity_ids = stmt["entity_ids"]
# → ["sensor.smoke_1", "sensor.smoke_2"]
```

**If `entity_ids` is empty** on a node that requires entities, raise `CompilerError`
with code `MISSING_ENTITY`. The entity validation pass (COMPILER_SPEC.md Section 8)
runs before compilation and should have caught this — treat it as a bug if it reaches
the compiler.

**`role`** on every node is a display label only. The compiler never reads it for
compilation logic. It may be included in comments for readability.

```python
role = stmt.get("role", "device")  # display label for comment only
entity_ids = stmt["entity_ids"]    # this is what the compiler actually uses
```

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

PistonCore global variables use two mechanisms depending on type (DESIGN.md Section 7.1).
The compiler reads global variable definitions from the `global_variables` array in the
fat context object (COMPILER_SPEC.md Section 7). It looks up globals by `name` after
stripping the `@` prefix from any reference.

### 7.1 Device / Devices Globals — Compile-Time Only

Device globals are baked into the compiled file at deploy time. The compiler expands
entity IDs from the global's `entity_ids` array directly into trigger decorators and
service call targets. No runtime lookup occurs.

```python
# Global @announcement_speakers — entity IDs baked in from global entity_ids at compile time
# global_variables entry: { "name": "announcement_speakers", "type": "Devices",
#                           "entity_ids": ["media_player.kitchen_sonos", "media_player.living_room_sonos"] }
media_player.volume_set(
    entity_id=["media_player.kitchen_sonos", "media_player.living_room_sonos"],
    volume_level=0.7
)
```

When a device global changes, the piston is flagged stale and must be redeployed.
`pc_globals_used` in the header enables the backend to find all affected pistons
without a database (DESIGN.md Section 7.1).

### 7.2 Non-Device Globals (Text, Number, Yes/No, Date/Time) — HA Input Helpers

Non-device globals are backed by HA input helpers. The helper entity ID format is
`input_{domain}.pistoncore_{global_id}` where `{global_id}` is the global variable's
own UUID from the `global_variables` array — never name-based, so renaming a global
never breaks deployed pistons.

```python
# Read a global Text variable
# global entry: { "name": "message_of_the_day", "type": "Text",
#                 "helper_entity_id": "input_text.pistoncore_a3f8c2d1" }
msg = state.get("input_text.pistoncore_a3f8c2d1")

# Write it
input_text.set_value(
    entity_id="input_text.pistoncore_a3f8c2d1",
    value="Garage door was left open"
)

# Read a global Number variable
# global entry: { "name": "motion_count", "type": "Number",
#                 "helper_entity_id": "input_number.pistoncore_b7e2f941" }
threshold = float(state.get("input_number.pistoncore_b7e2f941") or 0)
```

**If the helper doesn't exist** (global deleted or not yet created by backend):

```python
val = state.get("input_text.pistoncore_a3f8c2d1")
if val is None:
    log.error("pistoncore_d4e2f9a1: Global '@message_of_the_day' not found — redeploy may be needed")
    event.fire("PISTONCORE_RUN_COMPLETE", piston_id="d4e2f9a1", status="error")
    return
```

### 7.3 Device Global Used in a Loop — Dynamic Attribute Access Pattern

This is the `dynamic_attribute_access` PyScript-forcing pattern. The device list is
compile-time (baked in). The dynamic part is attribute access on a loop variable:

```python
# Entity list baked in from entity_ids on the for_each node at compile time
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

**Multi-device, aggregation "any" — OR across all entities in entity_ids:**

Input condition:
```json
{
  "is_trigger": true, "role": "Doors", "attribute": "contact",
  "entity_ids": ["binary_sensor.front_door", "binary_sensor.back_door", "binary_sensor.garage_door"],
  "operator": "changes to", "compiled_value": "on", "aggregation": "any"
}
```

```python
@state_trigger(
    "binary_sensor.front_door == 'on' and binary_sensor.front_door.old == 'off'",
    "binary_sensor.back_door == 'on' and binary_sensor.back_door.old == 'off'",
    "binary_sensor.garage_door == 'on' and binary_sensor.garage_door.old == 'off'"
)
```

Each entity in `entity_ids` becomes a separate string argument to `@state_trigger`.
PyScript OR's multiple string arguments — any one firing runs the function.
The entity list is read directly from `condition["entity_ids"]` — no role lookup.

**Multi-role OR trigger** (e.g., `{Doors}` OR `{Windows}` — two separate is_trigger conditions):

All entities from all triggering condition `entity_ids` arrays are expanded as separate
string arguments on one `@state_trigger` decorator:

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

The compiler walks the nested `statements` tree recursively. Control flow nodes
(`if`, `while`, `repeat`, `for`, `for_each`, `do`, `switch`, `on_event`, `every`)
own their children directly — `then`, `else`, `statements`, `else_ifs`, and `cases`
contain embedded child statement objects. No lookup map is built. No ID resolution is
needed. Insert means add to the owning array. Remove means splice from it.

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
    "role": "Front Door",
    "entity_ids": ["binary_sensor.front_door"],
    "attribute": "contact",
    "attribute_type": "binary",
    "operator": "is",
    "compiled_value": "on",
    "aggregation": "any",
    "group_operator": "and"
  }],
  "condition_operator": "and",
  "then": [ { ... embedded child statements ... } ],
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
  "role": "Kitchen Light",
  "entity_ids": ["light.kitchen_main"],
  "tasks": [{
    "id": "task_001",
    "command": "turn_on",
    "domain": "light",
    "ha_service": "light.turn_on",
    "parameters": { "brightness_pct": 75 }
  }]
}
```

Single entity — string:
```python
# stmt_002 — action: Kitchen Light → light.turn_on
light.turn_on(entity_id="light.kitchen_main", brightness_pct=75)
```

Multiple entities — Python list. PyScript passes the list directly to the HA service,
which handles all entities simultaneously (same as the native YAML array):
```python
# stmt_002 — action: Lights → light.turn_on
light.turn_on(
    entity_id=["light.kitchen_main", "light.dining_room"],
    brightness_pct=75
)
```

The compiler reads `entity_ids` directly from the action node. If `len(entity_ids) == 1`,
emit a string. If `len(entity_ids) > 1`, emit a list. Never loop over entities.

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

Input:
```json
{
  "id": "stmt_009",
  "type": "for_each",
  "variable": "$device",
  "role": "Battery Devices",
  "entity_ids": ["sensor.front_door_battery", "sensor.back_door_battery"],
  "statements": [ ... ]
}
```

```python
# stmt_009 — for_each: $device in Battery Devices
# Entity list captured from live HA picker at wizard commit time
_battery_devices_list = [
    "sensor.front_door_battery",
    "sensor.back_door_battery"
]
for device in _battery_devices_list:
    # [compiled child statements]
    # $device in child statements compiles to the 'device' loop variable
```

The compiler reads `entity_ids` directly from the node. The list variable name is
derived from the role label for readability: `_` + slugify(role) + `_list`.
Child statement actions targeting `$device` compile to `entity_id=device`.

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

Input:
```json
{
  "id": "stmt_013",
  "type": "repeat",
  "statements": ["stmt_014"],
  "until_conditions": [{
    "id": "cond_001",
    "is_trigger": false,
    "role": "Water Sensors",
    "entity_ids": ["binary_sensor.water_1", "binary_sensor.water_2"],
    "attribute": "moisture",
    "attribute_type": "binary",
    "operator": "is",
    "compiled_value": "off",
    "aggregation": "all",
    "group_operator": "and"
  }],
  "condition_operator": "and"
}
```

```python
# stmt_013 — repeat/until: all WaterSensors are Dry
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

`switch` is NOT PyScript-only. It compiles to a Python `if/elif/else` chain.

Input:
```json
{
  "id": "stmt_016",
  "type": "switch",
  "expression": { "type": "variable", "name": "$count" },
  "case_traversal_policy": "safe",
  "cases": [
    { "id": "case_001", "case_type": "single", "value": 1, "statements": ["stmt_017"] },
    { "id": "case_002", "case_type": "range", "value_from": 5, "value_to": 10, "statements": ["stmt_018"] }
  ],
  "default": ["stmt_019"]
}
```

```python
# stmt_016 — switch: $count
_switch_val = count
if _switch_val == 1:
    # [case 1 statements]
elif 5 <= _switch_val <= 10:
    # [case 2 statements — range]
else:
    # [default statements]
```

**`case_type` handling:**
- `"single"` → `_switch_val == value`
- `"range"` → `value_from <= _switch_val <= value_to`

**`case_traversal_policy`:**
- `"safe"` (default) — each case breaks automatically (standard `if/elif/else`)
- `"fallthrough"` — emit a note; Python has no native fallthrough. Compiler emits
  `CompilerWarning` with code `SWITCH_FALLTHROUGH_UNSUPPORTED` and compiles as `"safe"`.

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

**HA Limitation — Blocking Wait, Not Async**

`on_event` in PistonCore compiles to a **blocking** `task.wait_until()`. The piston
pauses at this point until one of the specified device events fires. True async behavior
(piston body continues running while listening in background) is not possible in HA.
This is an HA platform limitation, not a PistonCore limitation.

**Always emit** `CompilerWarning` with code `ON_EVENT_BLOCKING` when compiling this
statement type. This warning must also surface in the wizard UI and user documentation.

Input:
```json
{
  "id": "stmt_020",
  "type": "on_event",
  "conditions": [{
    "id": "cond_001",
    "is_trigger": true,
    "aggregation": "any",
    "role": "Doors",
    "attribute": "contact",
    "attribute_type": "binary",
    "operator": "changes to",
    "compiled_value": "on",
    "group_operator": "and"
  }],
  "condition_operator": "and",
  "statements": ["stmt_021"]
}
```

```python
# stmt_020 — on_event: any of Doors changes to Open
# ⚠ BLOCKING: piston pauses here until event fires (HA limitation — not truly async)
result = task.wait_until(
    state_trigger=[
        "binary_sensor.front_door_contact == 'on' and binary_sensor.front_door_contact.old != 'on'",
        "binary_sensor.back_door_contact == 'on' and binary_sensor.back_door_contact.old != 'on'"
    ],
    timeout=None
)
var_name = result.get("var_name")
value = result.get("value")

# [compiled child statements]
# $currentEventDevice → var_name
# $currentEventValue  → value
```

**Building the state_trigger expression** follows the same logic as `@state_trigger`
decorator compilation (Section 10.1) — read entity IDs directly from `condition["entity_ids"]`,
build one expression string per entity, pass as a list to `task.wait_until()`.

**`condition_operator`** with multiple conditions: build expressions for each condition
and pass all as separate strings (PyScript OR's them — any firing resumes the wait).

### 11.17 cancel_pending_tasks

Input:
```json
{ "id": "stmt_021", "type": "cancel_pending_tasks" }
```

```python
# stmt_021 — cancel_pending_tasks
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
| `ON_EVENT_SCHEMA_MISSING` | error | `on_event` encountered — GAP 1 not resolved, cannot compile (retired — GAP 1 resolved Session 24) |
| `ON_EVENT_BLOCKING` | warning | `on_event` compiled as blocking wait — always emitted. True async not available in HA. |
| `SWITCH_FALLTHROUGH_UNSUPPORTED` | warning | `switch` with `case_traversal_policy: "fallthrough"` — Python has no native fallthrough, compiled as safe (auto-break) |
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
- **Entity validation** — backend validates all entity_ids exist in HA before calling compiler (COMPILER_SPEC.md Section 8 — MISSING_ENTITY error).
- **PyScript installation detection** — backend checks before deploying (DESIGN.md Section 3.2).
- **Piston enable/disable** — backend renames the `.py` file (prepends `#` to filename).
- **settings block** — contents undefined. Compiler ignores it.

---

## 16. Hand-Written Verification Example

**Input piston JSON (door chime — triggers $currentEventDevice, forces PyScript):**

Logic version 2 format — entity_ids on nodes, no device_map:

```json
{
  "id": "d4e2f9a1",
  "name": "New Door / Window Chime",
  "mode": "restart",
  "logic_version": 2,
  "compile_target": "pyscript",
  "variables": [{ "id": "var_001", "name": "message", "type": "string", "default_value": "" }],
  "statements": [
    {
      "id": "stmt_001", "type": "if",
      "conditions": [{
        "id": "cond_001", "is_trigger": true,
        "role": "Doors",
        "entity_ids": ["binary_sensor.back_door", "binary_sensor.front_door"],
        "aggregation": "any",
        "attribute": "contact", "attribute_type": "binary",
        "device_class": "door", "operator": "changes to",
        "display_value": "Open", "compiled_value": "on", "group_operator": "and"
      }],
      "condition_operator": "and",
      "then": [
        {
          "id": "stmt_002", "type": "set_variable",
          "variable": "message",
          "value": { "type": "system_variable", "name": "$currentEventDevice" }
        },
        {
          "id": "stmt_003", "type": "log_message",
          "message": { "type": "variable", "name": "message" }
        }
      ],
      "else_ifs": [], "else": []
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
    "binary_sensor.back_door == 'on' and binary_sensor.back_door.old == 'off'",
    "binary_sensor.front_door == 'on' and binary_sensor.front_door.old == 'off'"
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

Note: entity_ids from `cond_001["entity_ids"]` are used directly to build the
`@state_trigger` strings. No device_map lookup. The children of stmt_001 are
embedded objects in `stmt_001["then"]` — no ID resolution needed.

---

*End of PYSCRIPT_COMPILER_SPEC.md*

*All gaps resolved Session 24. list_role updated to entity_ids on nodes Session 57.*
