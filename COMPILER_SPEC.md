# PistonCore Compiler Specification

**Version:** 0.1
**Status:** Draft — Primary blocker for all backend coding
**Last Updated:** April 2026

Read DESIGN.md v0.9 before this document.
This document defines exactly how the compiler turns piston JSON into native HA files.

---

## 1. What the Compiler Does

The compiler takes a piston JSON object and a device map and produces two YAML files:

1. **Automation file** — triggers, conditions, and a single action that calls the script
2. **Script file** — the full action body (all statements, loops, waits, logic)

The piston JSON is always the source of truth. The two output files are compiler-owned artifacts — they may be replaced wholesale on any recompile. Users must not hand-edit them.

The compiler never touches any file it did not create. It never writes outside its designated directories.

---

## 2. Output File Locations

```
<ha_config>/automations/pistoncore/<slug>.yaml   ← automation wrapper
<ha_config>/scripts/pistoncore/<slug>.yaml       ← script body
```

Where `<slug>` = `slugify(piston.name)` — see Section 4.

Both files carry a signature header (Section 3). The companion manages writing these files. The Docker backend produces the YAML strings; the companion writes them to disk.

---

## 3. File Signature Header

Every compiled file begins with these comment lines:

```yaml
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: <piston.id> | pc_version: <app_version> | pc_hash: <sha256_of_content>
```

The script file adds one additional line:

```yaml
# pc_globals_used: <comma-separated list of global variable names, or "(none)">
```

The hash is computed over the file content below the header lines. On deploy, PistonCore checks this hash against the existing deployed file before overwriting — if they differ, the user sees a diff and must confirm.

---

## 4. Slug Generation

The slug is derived from the piston name and used as both the filename and the script entity ID suffix.

```python
def slugify(name: str) -> str:
    s = name.lower()
    s = s.replace(" ", "_").replace("-", "_")
    s = re.sub(r"[^a-z0-9_]", "", s)
    s = s.strip("_")
    s = s[:50]
    return s
```

**Script entity ID:** `script.pistoncore_<slug>`

**Examples:**
- "Driveway Lights at Sunset" → `driveway_lights_at_sunset` → `script.pistoncore_driveway_lights_at_sunset`
- "Front Door Alert!" → `front_door_alert` → `script.pistoncore_front_door_alert`
- "Motion - Hallway" → `motion_hallway` → `script.pistoncore_motion_hallway`

**Slug collision handling:** If two pistons produce the same slug, append the first 4 characters of the piston ID to disambiguate: `<slug>_<id[:4]>`. Log a warning to the user.

---

## 5. Top-Level Compiler Entry Point

```python
def compile_piston(piston: dict, device_map: dict) -> tuple[str, str]:
    """
    Returns (automation_yaml, script_yaml).
    Raises CompilerError on any unrecoverable problem.
    """
    slug = slugify(piston["name"])
    globals_used = scan_globals(piston)

    automation_yaml = render_automation(piston, slug)
    script_yaml = render_script(piston, slug, device_map, globals_used)

    return automation_yaml, script_yaml
```

`scan_globals(piston)` walks the entire piston JSON and collects the names of every global variable referenced anywhere in triggers, conditions, or actions. Returns a list of strings. Used for the `pc_globals_used` header line and for PistonCore's global variable usage tracking.

---

## 6. Automation File Rendering

The automation file is always simple — triggers, conditions, and one action.

### 6.1 Full Structure

```yaml
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: <id> | pc_version: <ver> | pc_hash: <hash>

- id: pistoncore_<id>
  alias: "<name>"
  description: "<description>"
  mode: <mode>
  triggers:
    <compiled triggers>
  conditions: []         ← or compiled conditions if any
  actions:
    - action: script.pistoncore_<slug>
```

### 6.2 Mode Mapping

| Piston mode | HA automation mode |
|---|---|
| single | single |
| restart | restart |
| queued | queued |
| parallel | parallel |

### 6.3 Trigger Compilation

Each trigger in `piston.triggers[]` is compiled by `compile_trigger(trigger)`.

#### Sun trigger
```json
{ "type": "sun", "event": "sunset", "offset_minutes": 0 }
```
```yaml
- trigger: sun
  event: sunset
  offset: "00:00:00"
```

Offset format: `offset_minutes` → `HH:MM:SS` string.
- 0 → `"00:00:00"`
- 30 → `"+00:30:00"`
- -15 → `"-00:15:00"`

```python
def format_offset(minutes: int) -> str:
    sign = "+" if minutes > 0 else ("-" if minutes < 0 else "")
    m = abs(minutes)
    h, rem = divmod(m, 60)
    return f"{sign}{h:02d}:{rem:02d}:00"
```

#### State trigger
```json
{ "type": "state", "target_role": "front_door", "attribute": "contact",
  "to": "open", "from": null, "for_seconds": null }
```
```yaml
- trigger: state
  entity_id: light.driveway_main     ← device_map[target_role]
  to: "open"
```
With `from`: adds `from: "closed"`.
With `for_seconds`: adds `for: { seconds: 30 }`.

#### Time trigger
```json
{ "type": "time", "at": "07:30:00" }
```
```yaml
- trigger: time
  at: "07:30:00"
```

#### Time pattern trigger
```json
{ "type": "time_pattern", "minutes": "/15" }
```
```yaml
- trigger: time_pattern
  minutes: "/15"
```

#### Numeric state trigger (rises above / drops below)
```json
{ "type": "numeric_state", "target_role": "temp_sensor",
  "above": 80, "below": null }
```
```yaml
- trigger: numeric_state
  entity_id: sensor.bedroom_temp
  above: 80
```

#### HA event trigger
```json
{ "type": "event", "event_type": "MY_CUSTOM_EVENT", "event_data": {} }
```
```yaml
- trigger: event
  event_type: MY_CUSTOM_EVENT
```

#### Webhook trigger
```json
{ "type": "webhook", "webhook_id": "pistoncore_a3f8c2d1" }
```
```yaml
- trigger: webhook
  webhook_id: pistoncore_a3f8c2d1
```

#### Manual only trigger
```json
{ "type": "manual_only" }
```
No trigger compiled. Automation has `triggers: []`. The piston only runs when Test is pressed.

#### Called by another piston trigger
```json
{ "type": "called_by_piston" }
```
No automation trigger compiled. The script is called directly via `script.turn_on` from another piston's compiled output. No automation wrapper needed for this trigger type — the automation file is omitted entirely.

### 6.4 Condition Compilation (Automation File)

Conditions in the automation file are the piston's top-level conditions — checked before the script runs at all. If `piston.conditions` is empty, emit `conditions: []`.

Each condition compiles using the same `compile_condition()` function used in the script body (Section 8.5). At the automation level, conditions are HA native condition blocks.

---

## 7. Script File Rendering

### 7.1 Full Structure

```yaml
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: <id> | pc_version: <ver> | pc_hash: <hash>
# pc_globals_used: <names or "(none)">

pistoncore_<slug>:
  alias: "<name> (PistonCore)"
  description: "<description>"
  mode: <mode>
  sequence:
    <compiled statements>

    # PistonCore run completion event — always last
    - event: PISTONCORE_RUN_COMPLETE
      event_data:
        piston_id: "<id>"
        piston_name: "<name>"
        status: "success"
```

### 7.2 Statement Dispatch

```python
def compile_statement(stmt: dict, device_map: dict, indent: int = 4) -> str:
    dispatch = {
        "with_block":       compile_with_block,
        "wait":             compile_wait,
        "if_block":         compile_if_block,
        "repeat_block":     compile_repeat_block,
        "for_each_block":   compile_for_each_block,
        "while_block":      compile_while_block,
        "for_loop":         compile_for_loop,
        "set_variable":     compile_set_variable,
        "wait_for_state":   compile_wait_for_state,
        "log_message":      compile_log_message,
        "call_piston":      compile_call_piston,
        "control_piston":   compile_control_piston,
        "stop":             compile_stop,
        "switch_block":     compile_switch_block,
        "do_block":         compile_do_block,
        "cancel_pending_tasks": _pyscript_only_error,
        "break":            _pyscript_only_error,
        "on_event":         _pyscript_only_error,
    }
    fn = dispatch.get(stmt["type"])
    if fn is None:
        raise CompilerError(f"Unknown statement type: {stmt['type']}")
    return fn(stmt, device_map, indent)

def _pyscript_only_error(stmt, device_map, indent):
    raise CompilerError(
        f"Statement type '{stmt['type']}' requires PyScript compilation. "
        f"This piston should have been flagged as PyScript-only before reaching the compiler."
    )
```

All compile functions accept `indent` (number of spaces) and return a YAML string with correct indentation.

---

## 8. Statement Compilers — Native Script Target

### 8.1 with_block

A `with_block` has a `target_role` and one or more `tasks`. Each task is a HA service call.

**Single task — most common case:**
```json
{
  "id": "stmt_001",
  "type": "with_block",
  "target_role": "driveway_light",
  "tasks": [
    { "type": "call_service", "service": "light.turn_on",
      "data": { "brightness_pct": 100 } }
  ]
}
```
```yaml
- alias: "stmt_001"
  action: light.turn_on
  target:
    entity_id: light.driveway_main
  data:
    brightness_pct: 100
```

**No data** (e.g. light.turn_off):
```yaml
- alias: "stmt_003"
  action: light.turn_off
  target:
    entity_id: light.driveway_main
```
Omit `data:` block entirely when `task.data` is empty or absent.

**Multiple tasks** in one with_block — compile as a `sequence` parallel block:
```yaml
- alias: "stmt_004"
  parallel:
    - action: light.turn_on
      target:
        entity_id: light.driveway_main
      data:
        brightness_pct: 100
    - action: notify.mobile_app
      data:
        message: "Lights on"
```

**Devices variable as target** (multiple entities):
```yaml
- alias: "stmt_005"
  action: light.turn_on
  target:
    entity_id: "{{ states.group.all_lights.attributes.entity_id }}"
  data:
    brightness_pct: 50
```
When `target_role` resolves to a Devices variable (a group entity), the entity_id uses a Jinja2 template to read the group's member list.

### 8.2 wait

**Wait until a specific time:**
```json
{ "id": "stmt_002", "type": "wait", "until": "23:00:00" }
```
```yaml
- alias: "stmt_002"
  wait_for_trigger:
    - trigger: time
      at: "23:00:00"
```
Note: if the target time has already passed today when this step is reached, HA will wait until that time tomorrow. This is documented behavior — document it in the UI tooltip on the wait statement.

**Wait a fixed duration:**
```json
{ "id": "stmt_002", "type": "wait", "duration_seconds": 300 }
```
```yaml
- alias: "stmt_002"
  delay:
    seconds: 300
```
Durations under 60 seconds use `seconds:`. 60–3599 use `minutes:` (rounded). 3600+ use `hours:` with remainder as `minutes:`. Always emit the most readable unit.

```python
def format_delay(seconds: int) -> str:
    if seconds < 60:
        return f"seconds: {seconds}"
    elif seconds < 3600:
        return f"minutes: {seconds // 60}"
    else:
        h = seconds // 3600
        m = (seconds % 3600) // 60
        if m:
            return f"hours: {h}\n    minutes: {m}"
        return f"hours: {h}"
```

### 8.3 wait_for_state

```json
{
  "id": "stmt_006",
  "type": "wait_for_state",
  "target_role": "garage_door",
  "capability": "state",
  "operator": "is",
  "value": "closed",
  "timeout_seconds": 120
}
```
```yaml
- alias: "stmt_006"
  wait_for_trigger:
    - trigger: state
      entity_id: cover.garage_door
      to: "closed"
  timeout:
    seconds: 120
  continue_on_timeout: true
```
`continue_on_timeout: true` — the script continues after timeout. The compiler always emits this. If the piston author wants to stop on timeout, they add an `if` block after the wait checking `wait.completed`.

### 8.4 if_block

```json
{
  "id": "stmt_007",
  "type": "if_block",
  "condition": { "...condition object..." },
  "true_branch": [ "...statements..." ],
  "false_branch": [ "...statements..." ]
}
```

**Simple if/then (no else):**
```yaml
- alias: "stmt_007"
  if:
    - <compiled condition>
  then:
    <compiled true_branch statements>
```

**if/then/else:**
```yaml
- alias: "stmt_007"
  if:
    - <compiled condition>
  then:
    <compiled true_branch statements>
  else:
    <compiled false_branch statements>
```

**else if** — represented as the first node in `false_branch` being another `if_block`. Compiles naturally via recursion:
```yaml
  else:
    - alias: "stmt_008"
      if:
        - <condition>
      then:
        <statements>
```

**Multiple conditions (AND):** Multiple condition objects in `if_block.condition` (when `condition` is an array) — compile as a list of HA conditions (HA AND-combines conditions in an `if:` list by default).

**OR groups:** When a condition group has `operator: OR`, use HA's `condition: or` block:
```yaml
- alias: "stmt_007"
  if:
    - condition: or
      conditions:
        - <condition_a>
        - <condition_b>
  then:
    <statements>
```

### 8.5 Condition Compilation

Used in both the automation file (top-level conditions) and script body (if_block conditions).

**State condition — binary sensor:**
```json
{ "subject": { "type": "device", "role": "front_door", "capability": "state" },
  "operator": "is", "display_value": "Open", "compiled_value": "on" }
```
```yaml
- condition: state
  entity_id: binary_sensor.front_door
  state: "on"
```

**Critical:** Binary sensors in HA always report `"on"` or `"off"` as their actual state value — regardless of what device_class displays in the UI. A door sensor showing "Open" in the HA frontend has a real state of `"on"`. The compiler always uses `compiled_value` (the HA state) not `display_value` (the friendly label). See the Binary State Values section below.

**State condition — non-binary entity (e.g. media player):**
```json
{ "subject": { "type": "device", "role": "living_room_speaker", "capability": "state" },
  "operator": "is", "display_value": "Playing", "compiled_value": "playing" }
```
```yaml
- condition: state
  entity_id: media_player.living_room
  state: "playing"
```

For non-binary entities, `display_value` and `compiled_value` are the same string — HA returns the real named state.

**Numeric condition:**
```json
{ "subject": { "type": "device", "role": "temp_sensor", "capability": "temperature" },
  "operator": "is greater than", "value": 75 }
```
```yaml
- condition: numeric_state
  entity_id: sensor.bedroom_temp
  above: 75
```

**Template condition (variable comparison):**
```json
{ "subject": { "type": "variable", "name": "$count" },
  "operator": "is greater than", "value": 3 }
```
```yaml
- condition: template
  value_template: "{{ count > 3 }}"
```

**Time condition:**
```json
{ "subject": { "type": "time" },
  "operator": "is after", "value": "08:00:00" }
```
```yaml
- condition: time
  after: "08:00:00"
```

**AND group:**
```yaml
- condition: and
  conditions:
    - <condition_a>
    - <condition_b>
```

**OR group:**
```yaml
- condition: or
  conditions:
    - <condition_a>
    - <condition_b>
```

### 8.6 repeat_block (repeat/do/until)

```json
{
  "id": "stmt_008",
  "type": "repeat_block",
  "condition": { "...until condition..." },
  "body": [ "...statements..." ]
}
```
```yaml
- alias: "stmt_008"
  repeat:
    sequence:
      <compiled body statements>
    until:
      - <compiled condition>
```

### 8.7 for_each_block

```json
{
  "id": "stmt_009",
  "type": "for_each_block",
  "variable_name": "$device",
  "collection_role": "smoke_detectors",
  "body": [ "...statements..." ]
}
```

**When collection_role resolves to a Devices global variable:**

Devices globals are resolved at compile time. The compiler looks up the device_map entry for the Devices global and emits a literal list of entity IDs — not a runtime group lookup. This produces self-contained compiled YAML with no external dependencies.

```yaml
- alias: "stmt_009"
  repeat:
    for_each:
      - binary_sensor.smoke_detector_kitchen
      - binary_sensor.smoke_detector_hallway
      - binary_sensor.smoke_detector_bedroom
    sequence:
      <compiled body statements, where $device → repeat.item>
```

**How the compiler resolves the list:**
1. Look up `collection_role` in the piston's `device_map` — this gives the variable's internal ID
2. Look up the Devices global by that ID in PistonCore's globals store
3. Resolve each device in the global to its entity ID via the device registry
4. Emit as a YAML list under `for_each:`

**Variable name substitution inside body:** Anywhere the piston JSON references `$device` (the loop variable), the compiler substitutes `{{ repeat.item }}` in the compiled output.

**When a Devices global changes:** PistonCore flags all pistons that reference it as stale. The user redeployes them to pick up the new list. The stale tracking and redeploy banner are defined in DESIGN.md Section 19.

**When collection_role resolves to a piston-local Devices variable (not a global):** Same behavior — resolve to literal list at compile time from whatever devices the user assigned to that variable within the piston.

**Jinja2 namespace note removed:** The previous note about namespace patterns for loop variable accumulation is superseded by Section 8.9, which documents that the compiler emits a warning and PyScript is the correct solution for cross-loop accumulation.

### 8.8 while_block

```json
{
  "id": "stmt_010",
  "type": "while_block",
  "condition": { "...condition..." },
  "body": [ "...statements..." ]
}
```
```yaml
- alias: "stmt_010"
  repeat:
    while:
      - <compiled condition>
    sequence:
      <compiled body statements>
```

### 8.9 for_loop (counted)

```json
{
  "id": "stmt_011",
  "type": "for_loop",
  "variable_name": "$i",
  "from": 1,
  "to_expression": "10",
  "step": 1,
  "body": [ "...statements..." ]
}
```
```yaml
- alias: "stmt_011"
  repeat:
    count: 10
    sequence:
      <compiled body statements, where $i → repeat.index (1-based)>
```
`repeat.index` is 1-based in HA. `repeat.index0` is 0-based. Compiler uses whichever matches `from` (1 → `repeat.index`, 0 → `repeat.index0`).

When `from` is not 0 or 1, or `step` is not 1, the compiler emits a `variables:` block inside the loop body to compute the correct value:
```yaml
    sequence:
      - variables:
          i: "{{ from + (repeat.index0 * step) }}"
      <rest of body>
```

### 8.9 set_variable — Scope Caveat and Compiler Behavior

**Simple set (outside any loop or if block):**
```json
{ "id": "stmt_012", "type": "set_variable",
  "variable_name": "$light_was_on", "value_expression": "true" }
```
```yaml
- alias: "stmt_012"
  variables:
    light_was_on: true
```

**Set variable inside a loop or if block (scope caveat applies):**

HA's `variables:` action does not reliably propagate a value set inside a loop body back to the outer scope. This is a known HA limitation as of 2023–2026.

**What the compiler does when a variable is set inside a loop and read outside it:**

1. Emits the `variables:` action anyway — it is the closest native equivalent and works correctly within the same scope level
2. Raises a `CompilerWarning` that appears in the validation banner after save
3. Does NOT silently rewrite the user's logic

**Warning text emitted:**
```
Variable '$count' is set inside a loop (stmt_009) and used outside it (stmt_015).
Home Assistant cannot reliably carry this value out of the loop. Your piston may
not behave as expected. Consider restructuring this logic, or convert to PyScript
which handles cross-loop variable scope natively.
```

**Why not the Jinja2 namespace pattern:** The `{% set ns = namespace(count=0) %}` pattern works inside a single Jinja2 template expression rendered at once. It does not work across multiple sequential HA `variables:` action steps because each `variables:` action is a separate execution step, not a single template render. There is no compiler-emittable fix for cross-loop-boundary variable accumulation in native HA scripts. PyScript is the correct solution for this pattern.

**Set variable inside an if block (reading after the if):** The same limitation applies. A variable set in a `then:` branch may not be visible after the `if:` block in all HA versions. The compiler emits the same warning when it detects this pattern.

**Future:** If HA resolves this scope limitation in a future version, the AI-UPDATE-GUIDE.md for the native-script template folder describes the update needed.

### 8.10 switch_block

```json
{
  "id": "stmt_013",
  "type": "switch_block",
  "subject": { "type": "device", "role": "hvac_mode", "capability": "hvac_mode" },
  "cases": [
    { "value": "heat", "body": [...] },
    { "value": "cool", "body": [...] }
  ],
  "default_body": [...]
}
```
```yaml
- alias: "stmt_013"
  choose:
    - conditions:
        - condition: state
          entity_id: climate.living_room
          attribute: hvac_mode
          state: "heat"
      sequence:
        <compiled heat body>
    - conditions:
        - condition: state
          entity_id: climate.living_room
          attribute: hvac_mode
          state: "cool"
      sequence:
        <compiled cool body>
  default:
    <compiled default_body>
```
`default:` block omitted if `default_body` is empty.

### 8.11 do_block

Groups statements. Compiled as an inline sequence comment — HA has no direct "block" concept, so do_block statements just compile in order with a comment label.

```json
{ "id": "stmt_014", "type": "do_block", "label": "Notify and log", "body": [...] }
```
```yaml
# do_block: Notify and log (stmt_014)
<compiled body statements>
```

### 8.12 log_message

```json
{ "id": "stmt_015", "type": "log_message",
  "level": "info", "message": "Motion detected" }
```
```yaml
- alias: "stmt_015"
  event: PISTONCORE_LOG
  event_data:
    piston_id: "<piston.id>"
    stmt_id: "stmt_015"
    level: "info"
    message: "Motion detected"
```

The companion listens for `PISTONCORE_LOG` events and routes them to the PistonCore run log.

### 8.13 call_piston

**Fire and forget:**
```json
{ "id": "stmt_016", "type": "call_piston",
  "target_piston_id": "b7e2a1f4", "wait_for_completion": false }
```
```yaml
- alias: "stmt_016"
  action: script.turn_on
  target:
    entity_id: script.pistoncore_<target_slug>
```

**Wait for completion:**
```json
{ "wait_for_completion": true }
```
```yaml
- alias: "stmt_016"
  action: script.pistoncore_<target_slug>
```
Direct script call (without `script.turn_on`) causes the calling script to wait for the called script to finish. This is native HA behavior — documented in HA script docs.

**Target slug lookup:** The compiler must be given (or must look up) the slug of the target piston by its ID. The backend resolves `target_piston_id` → target piston name → slug before calling the compiler. If the target piston does not exist, compile raises a CompilerError.

### 8.14 control_piston

```json
{ "id": "stmt_017", "type": "control_piston",
  "target_type": "piston", "target_id": "b7e2a1f4", "action": "trigger" }
```

| PistonCore action | HA service emitted |
|---|---|
| trigger | `automation.trigger` or `script.turn_on` |
| start | `automation.turn_on` or `script.turn_on` |
| stop | `automation.turn_off` or `script.turn_off` |
| enable | `automation.turn_on` |
| disable | `automation.turn_off` |

For `target_type: "piston"`, the target is a script entity (`script.pistoncore_<slug>`).
For `target_type: "ha_automation"`, the target is an automation entity.

```yaml
- alias: "stmt_017"
  action: script.turn_on
  target:
    entity_id: script.pistoncore_<target_slug>
```

### 8.15 stop

```json
{ "id": "stmt_018", "type": "stop" }
```
```yaml
- alias: "stmt_018"
  stop: "Stopped by piston logic"
```

### 8.16 only_when (restrictions)

`only_when` appears on `with_block`, `if_block`, and loop blocks as an array of condition objects. It compiles to a `condition:` action at the top of the relevant block's sequence, which stops execution of that block if the conditions are not met.

```yaml
- alias: "stmt_001_restriction"
  condition: state
  entity_id: binary_sensor.someone_home
  state: "on"
- alias: "stmt_001"
  action: light.turn_on
  ...
```

---

## 9. Trigger Compilation — Complete Reference

Defined in Section 6.3. Additional trigger types not covered there:

**Button / momentary event:**
```json
{ "type": "device_event", "target_role": "doorbell", "event_type": "pressed" }
```
```yaml
- trigger: device
  device_id: <device_id from HA>
  domain: doorbell
  type: pressed
```
Note: device triggers require the HA device ID, not the entity ID. The compiler must receive device IDs (not just entity IDs) for device-event triggers. This is a backend responsibility — the backend resolves role → device ID before compiling.

**Webhook:**
```json
{ "type": "webhook", "webhook_id": "pistoncore_a3f8c2d1" }
```
```yaml
- trigger: webhook
  webhook_id: pistoncore_a3f8c2d1
  allowed_methods:
    - GET
    - POST
```

**Called by another piston** — no automation trigger. Script called directly. Automation file omitted.

---

## 10. Variable Name Mapping

Inside compiled YAML, piston variable names are transformed:

| Piston JSON | Compiled YAML template |
|---|---|
| `$light_was_on` | `light_was_on` (strip `$`) |
| `@temp_sensor` | `states('input_text.pistoncore_<var_id>')` (global, text) |
| `@brightness` | `states('input_number.pistoncore_<var_id>') \| int` (global, number) |
| `@is_home` | `is_state('input_boolean.pistoncore_<var_id>', 'on')` (global, yes/no) |
| `repeat.item` | `repeat.item` (for_each loop variable, unchanged) |
| `repeat.index` | `repeat.index` (loop counter, 1-based) |

**Local variable syntax in templates:** `{{ light_was_on }}`
**Global variable read syntax:** depends on helper type — see table above.
**Global variable write syntax:** compiled as a service call to the helper:
- input_text: `action: input_text.set_value / data: value: "..."`
- input_number: `action: input_number.set_value / data: value: ...`
- input_boolean: `action: input_boolean.turn_on` or `turn_off`
- input_datetime: `action: input_datetime.set_datetime / data: ...`

Global variable writes compile to HA service actions inside the script sequence — not to `variables:` assignments.

---

## 11. Binary State Values — Critical Compiler Rule

**Home Assistant binary sensors always report `"on"` or `"off"` as their actual state value.** This is true regardless of device_class or what the HA frontend displays. A door sensor with `device_class: door` shows "Open/Closed" in the UI but its state in HA's state engine is always `"on"` or `"off"`.

This is fundamentally different from Hubitat/SmartThings (which WebCoRE was built for), where drivers return named states like `"open"`, `"closed"`, `"detected"` directly.

**Rule:** The piston JSON stores two values for binary sensor conditions and triggers:
- `display_value` — the friendly label shown in the wizard UI ("Open", "Closed", "Detected", "Clear")
- `compiled_value` — the actual HA state value used in compiled output ("on", "off")

The compiler always uses `compiled_value`. Never `display_value`.

**The display_value → compiled_value mapping for binary sensors is always:**
- "on" state label → `"on"`
- "off" state label → `"off"`

Regardless of which friendly labels (Open/Closed, Detected/Clear, etc.) the wizard showed.

**Device_class display label table** (wizard reference only — compiler ignores these):

| device_class | "on" displays as | "off" displays as |
|---|---|---|
| door / window / opening / garage | Open | Closed |
| motion / occupancy / presence | Detected | Clear |
| smoke / gas / carbon_monoxide / carbon_dioxide | Detected | Clear |
| moisture / wet | Wet | Dry |
| lock | Unlocked | Locked |
| battery | Low | Normal |
| plug / outlet | Plugged in | Unplugged |
| light | Light detected | No light |
| sound / vibration | Detected | Clear |
| heat / cold | Hot / Cold | Normal |
| connectivity | Connected | Disconnected |
| problem / safety | Problem / Unsafe | OK / Safe |
| tamper | Tampered | Clear |
| update | Update available | Up to date |
| running | Running | Not running |
| (none / default) | On | Off |

**Non-binary entities** (media_player, climate, cover, input_select, select, sensor with named states): their state values ARE the real strings HA returns. `display_value` and `compiled_value` are the same. The compiler uses the value directly.

---

## 12. Run Completion Event

Always the last action in every compiled script:

```yaml
- event: PISTONCORE_RUN_COMPLETE
  event_data:
    piston_id: "<piston.id>"
    piston_name: "<piston.name>"
    status: "success"
```

**On failure:** Native HA scripts do not have a try/catch. If any action fails and `continue_on_error` is not set, HA stops the script at that action. The completion event is never fired. The companion treats a missing completion event as a timeout/failure and updates the run log accordingly after a configurable timeout (default: 60 seconds after the automation fired).

**Future:** Wrapping individual actions in `continue_on_error: true` with explicit failure events is a v2 feature. For now, failure = no completion event received.

---

## 13. Jinja2 Template Files

The Jinja2 templates in `/pistoncore-customize/compiler-templates/native-script/` are NOT used to render the entire output file. They are used for **statement-level snippets** — small reusable patterns that the Python compiler assembles. This keeps the compiler logic in Python (where it can make decisions) while keeping the HA-specific syntax in the template files (where the community can update them when HA changes).

### Template File: `automation.yaml.j2`

Contains the automation wrapper structure. The Python compiler calls this template once per piston, passing:
- `piston` — the full piston dict
- `slug` — the computed slug
- `compiled_triggers` — pre-rendered trigger YAML string
- `compiled_conditions` — pre-rendered condition YAML string or `"[]"`

### Template File: `script.yaml.j2`

Contains the script wrapper structure. The Python compiler calls this template once per piston, passing:
- `piston` — the full piston dict
- `slug` — the computed slug
- `compiled_sequence` — pre-rendered sequence YAML string (all statements)
- `globals_used` — comma-separated string

### Template File: `snippets/with_block.yaml.j2`

Statement-level template. Python calls it per with_block, passing:
- `stmt_id`, `service`, `entity_id`, `data` (dict or None)

### Template File: `snippets/wait_until.yaml.j2`

```jinja2
- alias: "{{ stmt_id }}"
  wait_for_trigger:
    - trigger: time
      at: "{{ at_time }}"
```

### Template File: `snippets/wait_duration.yaml.j2`

```jinja2
- alias: "{{ stmt_id }}"
  delay:
    {{ delay_yaml }}
```

One snippet file per statement type. The Python compiler renders the appropriate snippet for each statement in the sequence, then concatenates the results and passes the final string to `script.yaml.j2`.

### AI-UPDATE-GUIDE.md

Each template folder contains `AI-UPDATE-GUIDE.md` explaining:
- What each template file does
- Which variables are passed into it
- What HA version the templates target
- How to update them when HA changes syntax
- What to test after making changes

The guide is written so that anyone can paste it into an AI assistant and ask for help updating the templates without needing to understand the Python compiler.

---

## 14. Error Handling

### CompilerError

Raised for unrecoverable problems. Message must be plain English, never a stack trace.

Examples:
- `"Piston 'Driveway Lights' has no triggers defined."`
- `"Statement stmt_009 references role 'smoke_detector' but no device is mapped to that role."`
- `"Statement type 'break' requires PyScript compilation but this piston is compiled as native HA script."`
- `"Target piston 'b7e2a1f4' not found. The called piston may have been deleted."`

CompilerErrors surface in the PistonCore validation banner with the raw message plus a plain English explanation from `error-translations.json`.

### CompilerWarning

Non-fatal. Compilation continues. Warning added to the validation banner after save.

Examples:
- Variable set inside a loop referenced outside it (Section 8.9)
- Slug collision resolved by appending piston ID
- `wait until` time may wait until tomorrow if target time has already passed today

---

## 15. What Is NOT Compiled Here

These items are NOT part of the native script compiler. They are handled elsewhere or are pending:

- **PyScript compilation** — separate compiler, not yet designed. PyScript only needed for `break`, `cancel_pending_tasks`, `on_event`.
- **Global variable helper creation/deletion** — companion responsibility, not compiler.
- **File writing to HA** — companion responsibility. Compiler only returns YAML strings.
- **Hash computation** — compiler returns content; the backend computes and inserts the hash.
- **settings / end settings block** — contents undefined. Not compiled until defined.
- **Which-interaction (physical vs programmatic)** — feasibility not yet confirmed. Not compiled in v1 until validated.

---

## 16. Minimum HA Version

**Required: Home Assistant 2023.1 or later.**

All features used by this compiler (if/then/else, for_each, while, until, wait_for_trigger inside scripts, parallel, stop, continue_on_error) are stable from 2023.1 onward.

Document the minimum version in the README and show it during companion setup.

---

## 17. Hand-Written Verification Example

The following is the hand-written target output for the driveway lights piston (DESIGN.md Section 18), verified to match the compiler logic defined in this document.

**Source piston JSON:** See DESIGN.md Section 18.

**Automation file output:**
```yaml
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: a3f8c2d1 | pc_version: 0.9 | pc_hash: [computed on deploy]

- id: pistoncore_a3f8c2d1
  alias: "Driveway Lights at Sunset"
  description: "Turns on driveway lights at sunset and off at 11pm"
  mode: single
  triggers:
    - trigger: sun
      event: sunset
      offset: "00:00:00"
  conditions: []
  actions:
    - action: script.pistoncore_driveway_lights_at_sunset
```

**Script file output:**
```yaml
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: a3f8c2d1 | pc_version: 0.9 | pc_hash: [computed on deploy]
# pc_globals_used: (none)

pistoncore_driveway_lights_at_sunset:
  alias: "Driveway Lights at Sunset (PistonCore)"
  description: "Turns on driveway lights at sunset and off at 11pm"
  mode: single
  sequence:

    # stmt_001 — with_block: driveway_light → light.turn_on
    - alias: "stmt_001"
      action: light.turn_on
      target:
        entity_id: light.driveway_main
      data:
        brightness_pct: 100

    # stmt_002 — wait until 23:00:00
    - alias: "stmt_002"
      wait_for_trigger:
        - trigger: time
          at: "23:00:00"

    # stmt_003 — with_block: driveway_light → light.turn_off
    - alias: "stmt_003"
      action: light.turn_off
      target:
        entity_id: light.driveway_main

    # PistonCore run completion event — always last
    - event: PISTONCORE_RUN_COMPLETE
      event_data:
        piston_id: "a3f8c2d1"
        piston_name: "Driveway Lights at Sunset"
        status: "success"
```

**Paper verification:** Fed the piston JSON through the compiler logic defined in this document. Output matches the hand-written files above. ✓

---

## 18. Open Items — Compiler Not Yet Complete

These affect the compiler but are not yet resolved. Do not implement them until they are:

1. **settings / end settings block** — contents undefined. Compiler ignores this block for now. See DESIGN.md Section 26.
2. **PyScript compiler** — separate spec needed. Not started.
3. **Device event trigger (button/momentary)** — requires HA device ID, not entity ID. Backend device ID resolution flow not yet designed.
4. **Devices variable storage format** — need to confirm whether Devices globals are stored as a group entity or another format before finalizing for_each compilation.
5. **which-interaction step** — physical vs programmatic context filtering. Feasibility not confirmed. Not compiled until validated.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
