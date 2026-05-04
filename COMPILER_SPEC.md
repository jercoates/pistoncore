# PistonCore Compiler Specification

**Version:** 1.0
**Status:** Authoritative — Primary reference for all compiler coding
**Last Updated:** May 2026

Read DESIGN.md v1.1 before this document.
This document defines exactly how the compiler turns piston structured JSON into native HA files.

---

## 1. What the Compiler Does

The compiler takes a piston's internal structured JSON and produces HA output files.

**Input:** The piston's `statements` array (typed statement objects) plus `device_map` (role → entity ID list).

**Output:** One of the following depending on compile target:
- **Native HA Script:** Two YAML files — an automation wrapper and a script body
- **PyScript:** One Python file

The compiler never reads display text. It never parses piston_text. It reads typed statement objects directly — the same model WebCoRE used internally. This is why the internal format uses structured JSON and not plain text.

The piston JSON is always the source of truth. Compiled files are compiler-owned artifacts — they may be replaced wholesale on any recompile. Users must not hand-edit them.

The compiler never touches any file it did not create. It never writes outside its designated directories.

---

## 2. Compile Target Selection

The compiler selects an output target automatically. The user never chooses manually.

### Detection Logic

1. Walk the `statements` array recursively
2. Check every statement type against `target-boundary.json` (see Section 3)
3. If any statement matches a `forces_pyscript` entry → compile target is PyScript
4. If no matches → compile target is Native HA Script

### Complexity Indicator

The editor shows the current compile target live as the user builds. When any statement
is added that forces PyScript, the indicator updates immediately and shows:

*"This piston now requires PyScript compilation."*  `[Convert — one click]`

The one-click convert button updates `compile_target` in the wrapper and the complexity
indicator. No other changes — piston logic is identical.

---

## 3. Compile Target Boundary — Data-Driven

The boundary between native HA Script and PyScript is not hardcoded in Python. It lives
in an external file in the customize volume:

```
pistoncore-customize/compiler/target-boundary.json
```

The compiler loads this file at startup. The file ships with sensible defaults and is
copied to the customize volume on first launch. Container updates never overwrite it.

### target-boundary.json Format

```json
{
  "version": "1.0",
  "pistoncore_version_min": "1.0",
  "description": "Statement types that force PyScript compilation.",
  "forces_pyscript": [
    {
      "statement_type": "break",
      "reason": "No native HA script equivalent for mid-loop interruption",
      "ha_version_added_native": null
    },
    {
      "statement_type": "on_event",
      "reason": "No native HA script equivalent for event-conditional blocks inside a running script",
      "ha_version_added_native": null
    },
    {
      "statement_type": "cancel_pending_tasks",
      "reason": "No native HA script equivalent for cancelling async tasks",
      "ha_version_added_native": null
    }
  ]
}
```

When HA adds native support for a currently PyScript-only feature, the `ha_version_added_native`
field is filled in and the entry can be removed — no PistonCore code release needed.

---

## 4. Auth — HAClient Abstraction

All HA communication goes through `HAClient`. The compiler never calls HA directly. The
compiler receives data it needs (entity states, services) as part of the fat compiler
context object (Section 7) — pre-fetched by the backend before compile begins.

```python
HAClient(auth_mode="supervisor" | "token", token=None)
```

- **Supervisor mode (addon):** Token injected via SUPERVISOR_TOKEN environment variable
- **Token mode (Docker):** Long-lived token from config.json

The compiler calls no HA endpoints. It is a pure translation function: structured JSON in,
YAML/Python out.

---

## 5. Output File Locations and Naming

All output filenames and HA artifact identifiers derive from the piston UUID. Never from
the piston name. Never from a slug.

### Native HA Script Output

```
<ha_config>/automations/pistoncore/pistoncore_{uuid}.yaml   ← automation wrapper
<ha_config>/scripts/pistoncore/pistoncore_{uuid}.yaml       ← script body
```

### PyScript Output

```
<ha_config>/pyscript/pistoncore/pistoncore_{uuid}.py
```

### HA Identifier Formats

| Artifact | Format | Example |
|---|---|---|
| Automation entity ID | `pistoncore_{uuid}` | `pistoncore_a3f8c2d1` |
| Automation filename | `pistoncore_{uuid}.yaml` | `pistoncore_a3f8c2d1.yaml` |
| Script entity ID | `script.pistoncore_{uuid}` | `script.pistoncore_a3f8c2d1` |
| Script filename | `pistoncore_{uuid}.yaml` | `pistoncore_a3f8c2d1.yaml` |
| PyScript filename | `pistoncore_{uuid}.py` | `pistoncore_a3f8c2d1.py` |
| Automation alias | `slugify(piston.name)` | `"Driveway Lights at Sunset"` |

**The slug (name-derived) is used ONLY for the automation `alias:` field** — the human
readable label shown in the HA UI. It has no effect on entity IDs or filenames.

**Slug collision handling for alias:** If two pistons produce the same slug for their alias
field, append the first 4 characters of the UUID to disambiguate: `<slug>_<id[:4]>`.
Log a warning. Slug collision for filenames is impossible — UUIDs are always unique.

### Slug Generation

```python
def slugify(name: str) -> str:
    s = name.lower()
    s = s.replace(" ", "_").replace("-", "_")
    s = re.sub(r"[^a-z0-9_]", "", s)
    s = s.strip("_")
    s = s[:50]
    return s
```

---

## 6. File Signature Header

Every compiled file begins with a signature header:

```yaml
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: <uuid> | pc_version: <app_version> | pc_hash: <sha256_of_content>
```

The PyScript file adds one additional line:

```python
# pc_globals_used: <comma-separated list of global variable names, or "(none)">
```

The hash is computed over file content below the header lines. On deploy, PistonCore checks
this hash against the existing deployed file. If they differ, the user sees a diff and must
confirm before overwriting.

PistonCore only operates on files that contain its own signature header. It never touches
any other file.

---

## 7. Fat Compiler Context Object

Before calling the compiler, the backend pre-fetches all data the compiler needs from HA
and assembles it into a fat context object. The compiler receives this object — it makes no
HA calls of its own.

```python
{
    "piston":             { ... },   # Full piston JSON including statements and device_map
    "entity_states":      { ... },   # entity_id → current state/attributes from HA
    "services":           { ... },   # available services for referenced domains
    "ha_version":         "2025.6",  # detected HA version string
    "pistoncore_version": "1.0",
    "global_variables":   [ ... ],   # all defined globals with type and helper entity_id
    "piston_variables":   [ ... ],   # variables defined in this piston's variables[] array
    "areas":              { ... },   # area_id → area name
    "zones":              [ ... ],   # all HA zones
}
```

Templates receive all of this on every compile. They use what they need and ignore the rest.

---

## 8. Compiler Entry Point

```python
def compile_piston(context: dict) -> CompilerResult:
    """
    context: the fat compiler context object (Section 7)
    Returns CompilerResult with yaml/python output and any errors/warnings.
    Raises CompilerError on any unrecoverable problem.
    """
    piston = context["piston"]
    statements = piston["statements"]
    device_map = piston["device_map"]

    # Determine compile target
    compile_target = detect_compile_target(statements, context)

    if compile_target == "native_script":
        return compile_native(piston, context)
    else:
        return compile_pyscript(piston, context)
```

### Globals Used Scan

`scan_globals(statements)` walks the entire statements array recursively and collects
every global variable name referenced anywhere. Returns a list of strings. Used for:
- The `pc_globals_used` header line in PyScript files
- PistonCore's global variable usage tracking (globals_index.json)

---

## 9. Native HA Script Output — Automation File

The automation file is always simple — triggers, conditions, and one action that calls
the script.

### 9.1 Full Structure

```yaml
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: <uuid> | pc_version: <ver> | pc_hash: <hash>

- id: pistoncore_<uuid>
  alias: "<slug>"
  description: "<description>"
  mode: <mode>
  triggers:
    <compiled triggers>
  conditions: []
  actions:
    - action: script.pistoncore_<uuid>
```

**Two identifiers — do not confuse them:**

- `id: pistoncore_<uuid>` — uses the **piston UUID**. This is HA's internal stable
  identifier. It must never change across recompiles, even if the piston is renamed.

- `alias: "<slug>"` — uses the **slug** (derived from piston name). Human-readable label
  in HA UI. Changes if piston is renamed. This is expected behavior and must be documented:
  renaming a piston causes HA to show an updated alias — the automation entity itself
  is unchanged because the UUID-based `id:` field is stable.

### 9.2 Mode Mapping

| Piston mode | HA automation mode |
|---|---|
| single | single |
| restart | restart |
| queued | queued |
| parallel | parallel |

### 9.3 Trigger Compilation

Triggers are condition objects in the statements array where `"is_trigger": true`.
The compiler walks the statements array and collects all condition objects marked
as triggers — regardless of position. Triggers can appear in any if block anywhere
in the piston, not just the first one.

Each trigger object contains all data needed for compilation — no text parsing required.

#### State trigger

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
  "value": "open",
  "for_seconds": null
}
```

Compiles to (for each entity in device_map["Doors"]):
```yaml
- trigger: state
  entity_id: binary_sensor.front_door
  to: "on"
```

Binary state values are translated from friendly display values to HA state strings
using the device_class lookup table in WIZARD_SPEC.md. "Open" → "on" for door class.

With `for_seconds`: adds `for: { seconds: 30 }`.

#### Time trigger — happens daily at

```json
{
  "is_trigger": true,
  "subject": "time",
  "operator": "happens daily at",
  "value": "07:30:00"
}
```

```yaml
- trigger: time
  at: "07:30:00"
```

#### Time trigger — sunrise/sunset with offset

```json
{
  "is_trigger": true,
  "subject": "time",
  "operator": "happens daily at",
  "value": { "preset": "sunset", "offset": 30, "offset_unit": "minutes", "offset_direction": "+" }
}
```

```yaml
- trigger: sun
  event: sunset
  offset: "+00:30:00"
```

Offset format: `offset_minutes` → `HH:MM:SS` string.
- 0 → `"00:00:00"`, 30 → `"+00:30:00"`, -15 → `"-00:15:00"`

#### Numeric state trigger

```json
{
  "is_trigger": true,
  "role": "lumen_sensor",
  "attribute": "illuminance",
  "operator": "drops below",
  "value": 800
}
```

```yaml
- trigger: numeric_state
  entity_id: sensor.lumen_sensor
  below: 800
```

`rises above` → `above:`, `drops below` → `below:`

#### System Start trigger

```json
{
  "is_trigger": true,
  "subject": "system_start",
  "operator": "event occurs"
}
```

```yaml
- trigger: homeassistant
  event: start
```

---

## 10. Native HA Script Output — Script File

The script file contains the full action body — all statements compiled to a sequence.

### 10.1 Full Structure

```yaml
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: <uuid> | pc_version: <ver> | pc_hash: <hash>

pistoncore_<uuid>:
  alias: "<name> (PistonCore)"
  description: "<description>"
  mode: <mode>
  sequence:
    <compiled sequence>

    # PistonCore run completion event — always last
    - event: PISTONCORE_RUN_COMPLETE
      event_data:
        piston_id: "<uuid>"
        piston_name: "<name>"
        status: "success"
```

### 10.2 Statement Compilation — All Types

The compiler walks the `statements` array and calls the appropriate compile function
for each statement type. Statements are always typed objects — no text matching needed.

#### action (with/do block)

```json
{
  "id": "stmt_001",
  "type": "action",
  "devices": ["Lights"],
  "tasks": [
    {
      "id": "task_001",
      "command": "turn_on",
      "domain": "light",
      "ha_service": "light.turn_on",
      "parameters": { "brightness_pct": 75 }
    }
  ]
}
```

Compiles to (for each entity in device_map["Lights"]):
```yaml
- alias: "stmt_001"
  action: light.turn_on
  target:
    entity_id: light.living_room
  data:
    brightness_pct: 75
  continue_on_error: true
```

`continue_on_error: true` is added to every service call — a single device failure
must not stop the piston.

#### if block

```json
{
  "id": "stmt_002",
  "type": "if",
  "conditions": [ ... ],
  "condition_operator": "and",
  "then": [ ... ],
  "else_ifs": [],
  "else": [ ... ]
}
```

```yaml
- alias: "stmt_002"
  if:
    - condition: template
      value_template: "<compiled condition template>"
  then:
    <compiled then statements>
  else:
    <compiled else statements>
```

Conditions compile to HA template conditions. See Section 11 for condition compilation.

#### while loop

```json
{
  "id": "stmt_003",
  "type": "while",
  "conditions": [ ... ],
  "condition_operator": "and",
  "statements": [ ... ]
}
```

```yaml
- alias: "stmt_003"
  repeat:
    while:
      - condition: template
        value_template: "<compiled condition>"
    sequence:
      <compiled statements>
```

#### repeat loop (do/until)

```json
{
  "id": "stmt_004",
  "type": "repeat",
  "statements": [ ... ],
  "until_conditions": [ ... ],
  "condition_operator": "and"
}
```

```yaml
- alias: "stmt_004"
  repeat:
    sequence:
      <compiled statements>
    until:
      - condition: template
        value_template: "<compiled until condition>"
```

#### for loop

```json
{
  "id": "stmt_005",
  "type": "for",
  "start": 1,
  "end": 10,
  "step": 1,
  "counter_variable": "$count",
  "statements": [ ... ]
}
```

```yaml
- alias: "stmt_005"
  repeat:
    count: 10
    sequence:
      <compiled statements>
```

Note: Native HA script `repeat: count:` does not support arbitrary start/step values.
If start != 1 or step != 1, emit a CompilerWarning and compile with count only.
For full for-loop control, compile target must be PyScript.

#### for_each loop

```json
{
  "id": "stmt_006",
  "type": "for_each",
  "variable": "$device",
  "list_role": "SmokeDetectors",
  "statements": [ ... ]
}
```

```yaml
- alias: "stmt_006"
  repeat:
    for_each: <entity list from device_map["SmokeDetectors"]>
    sequence:
      <compiled statements>
```

#### switch

```json
{
  "id": "stmt_007",
  "type": "switch",
  "expression": { "type": "variable", "name": "$count" },
  "cases": [
    { "value": 1, "statements": [ ... ] },
    { "value": 2, "statements": [ ... ] }
  ],
  "default": [ ... ]
}
```

```yaml
- alias: "stmt_007"
  choose:
    - conditions:
        - condition: template
          value_template: "{{ states('input_number.pistoncore_count') | int == 1 }}"
      sequence:
        <compiled case 1 statements>
    - conditions:
        - condition: template
          value_template: "{{ states('input_number.pistoncore_count') | int == 2 }}"
      sequence:
        <compiled case 2 statements>
  default:
    <compiled default statements>
```

#### do block

```json
{
  "id": "stmt_008",
  "type": "do",
  "statements": [ ... ]
}
```

```yaml
- alias: "stmt_008"
  sequence:
    <compiled statements>
```

#### set_variable

```json
{
  "id": "stmt_009",
  "type": "set_variable",
  "variable": "$message",
  "value": { "type": "literal", "data": "Hello" }
}
```

```yaml
- alias: "stmt_009"
  variables:
    message: "Hello"
```

For global variables (@ prefix), calls the HA input helper service:
```yaml
- action: input_text.set_value
  target:
    entity_id: input_text.pistoncore_message
  data:
    value: "Hello"
```

#### wait (fixed duration)

```json
{
  "id": "stmt_010",
  "type": "wait",
  "duration": 300,
  "duration_unit": "seconds"
}
```

```yaml
- alias: "stmt_010"
  delay:
    seconds: 300
```

Duration unit → HA field: seconds → `seconds:`, minutes → `minutes:`, hours → `hours:`

#### wait (until time)

```json
{
  "id": "stmt_011",
  "type": "wait",
  "until": "23:00:00"
}
```

```yaml
- alias: "stmt_011"
  wait_for_trigger:
    - trigger: time
      at: "23:00:00"
```

Always emit a CompilerWarning for time-based waits — see Section 13.

#### wait_for_state

```json
{
  "id": "stmt_012",
  "type": "wait_for_state",
  "conditions": [ ... ],
  "timeout_seconds": 300,
  "continue_on_timeout": true
}
```

```yaml
- alias: "stmt_012"
  wait_template: "<compiled condition template>"
  timeout:
    seconds: 300
  continue_on_timeout: true
```

#### log_message

```json
{
  "id": "stmt_013",
  "type": "log_message",
  "message": { "type": "literal", "data": "Piston ran successfully" }
}
```

```yaml
- alias: "stmt_013"
  event: PISTONCORE_LOG
  event_data:
    piston_id: "<uuid>"
    message: "Piston ran successfully"
    level: "info"
```

#### exit (stop)

```json
{
  "id": "stmt_014",
  "type": "exit",
  "value": "true"
}
```

```yaml
- alias: "stmt_014"
  stop: "exit"
```

#### call_piston

```json
{
  "id": "stmt_015",
  "type": "call_piston",
  "target_piston_id": "b7e2a1f4",
  "wait_for_completion": false
}
```

```yaml
- alias: "stmt_015"
  action: script.pistoncore_b7e2a1f4
```

If `wait_for_completion: true` and compile target is native script, emit CompilerError —
waiting for a called piston requires PyScript. The wizard must have already prompted the
user to convert before allowing this combination.

#### every (timer)

```json
{
  "id": "stmt_016",
  "type": "every",
  "interval": 5,
  "interval_unit": "minutes",
  "statements": [ ... ]
}
```

The `every` statement compiles as a trigger in the automation wrapper (a `time_pattern`
trigger), not as a statement in the script body. The compiler must detect `every` statements
at the top level and route them to trigger compilation instead.

```yaml
- trigger: time_pattern
  minutes: "/5"
```

#### break and on_event and cancel_pending_tasks

These statement types force PyScript compilation (see target-boundary.json). If the
compiler encounters them with compile_target == "native_script", raise CompilerError.
This should not happen in normal flow — the wizard prevents it. Treat it as a bug.

---

## 11. Condition Compilation

Conditions compile to HA template conditions. The compiler builds Jinja2 template
expressions from the typed condition objects.

Each condition object has all data needed — no text parsing:

```json
{
  "id": "cond_001",
  "is_trigger": false,
  "aggregation": "any",
  "role": "Doors",
  "attribute": "contact",
  "attribute_type": "binary",
  "device_class": "door",
  "operator": "is",
  "value": "open"
}
```

### Operator → Template Mapping

| Operator | Template pattern |
|---|---|
| is | `states('entity_id') == 'value'` |
| is not | `states('entity_id') != 'value'` |
| is any of | `states('entity_id') in ['v1','v2']` |
| is not any of | `states('entity_id') not in ['v1','v2']` |
| is between | `float(states('entity_id')) >= min and float(states('entity_id')) <= max` |
| is less than | `float(states('entity_id')) < value` |
| is less than or equal to | `float(states('entity_id')) <= value` |
| is greater than | `float(states('entity_id')) > value` |
| is greater than or equal to | `float(states('entity_id')) >= value` |
| is even | `float(states('entity_id')) % 2 == 0` |
| is odd | `float(states('entity_id')) % 2 != 0` |

### Aggregation

- `any` → `any([ <template> for entity_id in [list] ])`
- `all` → `all([ <template> for entity_id in [list] ])`

### Binary Value Translation

Binary display values → HA state strings using WIZARD_SPEC.md device_class table.
Example: device_class=door, display value "Open" → HA state "on"

### Multiple Conditions

Multiple conditions combined with `condition_operator`:
- `and` → all conditions must be true
- `or` → any condition must be true

Compiled as a single template condition using `and` / `or` in the Jinja2 expression.

---

## 12. Variable Compilation

### Piston Variables ($ prefix)

Piston variables compile to HA script `variables:` action at the top of the sequence:

```yaml
- variables:
    count: 0
    message: ""
```

### Global Variables (@ prefix, non-device)

Global variables are HA input helpers. Reference them in templates via `states()`:
- Text → `states('input_text.pistoncore_{uuid}')`
- Number → `states('input_number.pistoncore_{uuid}') | float`
- Boolean → `is_state('input_boolean.pistoncore_{uuid}', 'on')`

Setting a global variable compiles to the appropriate input helper service call.

### Device Variables — Compile-Time Expansion

Device and Devices variables are expanded at compile time. The compiler looks up the
role name in `device_map` and bakes entity IDs directly into the compiled YAML.

For a role "Doors" mapped to ["binary_sensor.front_door", "binary_sensor.back_door"]:
```yaml
entity_id:
  - binary_sensor.front_door
  - binary_sensor.back_door
```

No runtime group lookup. No shared external file. Entity IDs baked inline.

### System Variables

| PistonCore variable | HA template equivalent |
|---|---|
| `$now` | `now()` |
| `$sunrise` | `state_attr('sun.sun', 'next_rising')` |
| `$sunset` | `state_attr('sun.sun', 'next_setting')` |
| `$hour` | `now().hour` |
| `$minute` | `now().minute` |
| `$second` | `now().second` |
| `$index` | `repeat.index` (inside repeat loops) |
| `$weekday` | `now().isoweekday()` |

---

## 13. Compiler Error and Warning Contract

The compiler always returns a structured result — never a raw exception:

```python
@dataclass
class CompilerResult:
    yaml: str | None          # compiled output, None if error
    errors: list[CompilerMessage]
    warnings: list[CompilerMessage]

@dataclass
class CompilerMessage:
    level: str                # "error" | "warning" | "info"
    code: str                 # SCREAMING_SNAKE_CASE error code
    message: str              # plain English, shown directly to user
    context: str | None       # which statement caused this, optional
```

### CompilerError — Unrecoverable

Raised for problems that prevent valid output. Compilation stops. Examples:

- `"Piston has no triggers defined. It will never run automatically."`
  code: `NO_TRIGGERS`

- `"Statement stmt_009 references role 'smoke_detector' but no device is mapped to that role."`
  code: `UNMAPPED_ROLE`

- `"Statement type 'break' requires PyScript but this piston is set to native HA script."`
  code: `PYSCRIPT_REQUIRED`

- `"Called piston 'b7e2a1f4' not found. It may have been deleted."`
  code: `CALLED_PISTON_NOT_FOUND`

### CompilerWarning — Non-Fatal

Compilation continues. Warning added to the validation banner after save.

**Variable scope warning** — local variable set inside a loop and used outside:
```
Variable '$count' is set inside a loop (stmt_009) and used outside it (stmt_015).
Home Assistant cannot reliably carry this value out of the loop. Your piston may
not behave as expected. Consider restructuring or converting to PyScript.
```
code: `VARIABLE_SCOPE_WARNING`

**Time-based wait warning** — always emitted for `wait until [time]` statements:
```
'Wait until [time]' will pause until that time today. If this step is reached after
that time has already passed, the piston will wait until tomorrow. Structure your
piston so this step is reached before the target time, or use a fixed delay instead.
```
code: `WAIT_UNTIL_PAST_TIME`

**For loop start/step warning** — when for loop has non-standard start or step:
```
Native HA script repeat only supports count-based loops. The start value and step
value have been ignored. Use PyScript if you need full for-loop control.
```
code: `FOR_LOOP_SIMPLIFIED`

---

## 14. Test Compile Endpoint

Test Compile returns compiled output for preview without deploying to HA.

**Endpoint:** `POST /api/piston/{id}/test_compile`

**Returns:**
```json
{
  "automation_yaml": "...",
  "script_yaml": "...",
  "pyscript": null,
  "errors": [],
  "warnings": [],
  "compile_target": "native_script"
}
```

For PyScript pistons, `pyscript` contains the Python output and `automation_yaml` /
`script_yaml` are null.

This is the only place compiled output is ever shown to users. The editor and status
page always show PistonCore's visual format, never raw YAML or Python.

---

## 15. Pre-Deploy Validation Pipeline

### Stage 1 — Internal Validation (on save, no HA involvement)

Runs against the structured JSON. Checks:
- No triggers defined (warning, not error)
- Required role referenced but not in device_map (error)
- Global variable referenced but not in globals.json (error)
- Call another piston + wait for completion + native script target (error)

Results appear on the status page validation banner immediately after save.

### Stage 2 — Compile (in memory, not written to disk)

Compiler runs. Errors and warnings collected.

### Stage 3 — Syntax Check

- Native HA Script: `yamllint` against compiled strings
- PyScript: `py_compile` syntax check

### Stage 4 — Deploy and Validate

- Write compiled files to production directories
- Call `automation.reload` and `script.reload`
- If HA rejects on reload: catch error, return to PistonCore
- Old deployed version remains active — HA does not swap in a broken file

### Stage 5 — Decision

- Reload succeeded → hash written to header, user sees success
- Reload failed → HA error shown in validation banner in plain English, old version still running

---

## 16. Extensible Output Target Routing

The compiler output target list is designed to be extended without rewrites.
Adding a new output target is an addition, not a rewrite. The piston JSON never changes
when a new output target is added.

### Current v1 Targets

| Deployment | Piston type | Output target |
|---|---|---|
| Addon | Simple | Native HA Script |
| Addon | Complex | PyScript |
| Docker | Simple | Native HA Script |
| Docker | Complex | PyScript (permanent) |

### Future Planned Target — Docker Native Runtime

Docker version should eventually support an opt-in native runtime as an alternative to
PyScript for complex pistons. The routing logic must accommodate this from the start.

Config: `runtime_mode: "pyscript" | "native"` in Docker config.json.

The compile target routing function checks `deployment_type` + `runtime_mode`:

```python
def select_output_target(piston, context, boundary):
    is_complex = detect_complexity(piston["statements"], boundary)
    deployment = context["deployment_type"]   # "addon" | "docker"
    runtime_mode = context.get("runtime_mode", "pyscript")  # docker only

    if not is_complex:
        return "native_script"
    if deployment == "addon":
        return "pyscript"  # v1. v2 will return "native_runtime"
    if deployment == "docker":
        return runtime_mode  # "pyscript" | "native" (future)
```

Piston JSON does not change between targets — same structured JSON, different output.
When the native Docker runtime is built, it will read the same statements array the
current compiler reads. No piston migration needed.

---

## 17. Minimum HA Version

**Required: Home Assistant 2023.1 or later.**

Features establishing this floor: `repeat: for_each:`, `if: / then: / else:` in scripts,
`parallel:`, `continue_on_error:`, `stop:`, `wait_for_trigger:` inside scripts,
`choose:` in scripts.

Document the minimum version in the README and check it on HA connect.

---

## 18. Hand-Written Verification Example

The following is the hand-written target output for a simple driveway lights piston,
verified against the compiler logic defined in this document.

### Source Piston (internal structured JSON)

```json
{
  "id": "a3f8c2d1",
  "name": "Driveway Lights at Sunset",
  "logic_version": 1,
  "ui_version": 1,
  "compile_target": "native_script",
  "device_map": {
    "driveway_light": ["light.driveway_main"]
  },
  "variables": [],
  "statements": [
    {
      "id": "stmt_001",
      "type": "if",
      "conditions": [
        {
          "id": "cond_001",
          "is_trigger": true,
          "subject": "time",
          "operator": "happens daily at",
          "value": { "preset": "sunset", "offset": 0 }
        }
      ],
      "then": ["stmt_002", "stmt_003", "stmt_004"],
      "else": []
    },
    {
      "id": "stmt_002",
      "type": "action",
      "devices": ["driveway_light"],
      "tasks": [{ "command": "turn_on", "ha_service": "light.turn_on", "parameters": { "brightness_pct": 100 } }]
    },
    {
      "id": "stmt_003",
      "type": "wait",
      "until": "23:00:00"
    },
    {
      "id": "stmt_004",
      "type": "action",
      "devices": ["driveway_light"],
      "tasks": [{ "command": "turn_off", "ha_service": "light.turn_off", "parameters": {} }]
    }
  ]
}
```

### Automation File Output

```yaml
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: a3f8c2d1 | pc_version: 1.0 | pc_hash: [computed on deploy]

- id: pistoncore_a3f8c2d1
  alias: "Driveway Lights at Sunset"
  description: ""
  mode: single
  triggers:
    - trigger: sun
      event: sunset
      offset: "00:00:00"
  conditions: []
  actions:
    - action: script.pistoncore_a3f8c2d1
```

### Script File Output

```yaml
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: a3f8c2d1 | pc_version: 1.0 | pc_hash: [computed on deploy]
# pc_globals_used: (none)

pistoncore_a3f8c2d1:
  alias: "Driveway Lights at Sunset (PistonCore)"
  description: ""
  mode: single
  sequence:

    # stmt_002 — action: driveway_light → light.turn_on
    - alias: "stmt_002"
      action: light.turn_on
      target:
        entity_id: light.driveway_main
      data:
        brightness_pct: 100
      continue_on_error: true

    # stmt_003 — wait until 23:00:00
    - alias: "stmt_003"
      wait_for_trigger:
        - trigger: time
          at: "23:00:00"

    # stmt_004 — action: driveway_light → light.turn_off
    - alias: "stmt_004"
      action: light.turn_off
      target:
        entity_id: light.driveway_main
      continue_on_error: true

    # PistonCore run completion event — always last
    - event: PISTONCORE_RUN_COMPLETE
      event_data:
        piston_id: "a3f8c2d1"
        piston_name: "Driveway Lights at Sunset"
        status: "success"
```

Note: `stmt_001` (the if block containing the sunset trigger) does not appear in the
script body — triggers compile to the automation wrapper only. The then-branch statements
(stmt_002, stmt_003, stmt_004) compile directly into the sequence.

---

## 19. What Is NOT Compiled Here

- **PyScript compilation** — separate compiler, not yet designed. PyScript output is needed
  for `break`, `cancel_pending_tasks`, `on_event` statement types.
- **Global variable helper creation/deletion** — backend responsibility, not compiler.
- **File writing to HA** — backend responsibility. Compiler returns YAML/Python strings only.
- **Hash computation** — compiler returns content; backend computes and inserts the hash.
- **settings block** — contents not yet defined. Compiler ignores this block for now.
- **Which-interaction step** — feasibility not confirmed. Not compiled until validated.
- **every statement with complex scheduling** — day-of-week, month-of-year filters on
  every statements are not yet compiled. Emit CompilerWarning and compile with basic
  time_pattern only.

---

## 20. Open Items

1. **PyScript compiler** — separate spec needed. Not started. Required for break,
   cancel_pending_tasks, on_event.
2. **settings block contents** — undefined. Do not implement until defined.
3. **Which-interaction step** — physical vs programmatic context filtering.
   Feasibility not confirmed. Not compiled until validated.
4. **every statement advanced scheduling** — day/month filters not yet compiled.
5. **Statement type reference document (STATEMENT_TYPES.md)** — must be created before
   compiler coding begins. Defines full structured JSON schema for every statement type,
   the render function output, and the HA YAML emitted. WebCoRE source in Session 14
   chat is the reference.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
