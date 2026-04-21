# AI Update Guide — Native HA Script Compiler Templates

**Folder:** `/pistoncore-customize/compiler-templates/native-script/`
**Last updated for:** Home Assistant 2023.1+
**PistonCore version:** 0.9

---

## What This Folder Is

This folder contains the Jinja2 template files that the PistonCore compiler uses to generate
native Home Assistant automation and script YAML. When Home Assistant changes its YAML syntax,
you update the files in this folder — you do not touch the Python compiler code.

The Python compiler makes all the decisions (what to emit, in what order, with what values).
These templates hold only the HA-specific syntax — the exact YAML keys and structure that
the current version of Home Assistant expects.

---

## How to Use This Guide

If Home Assistant has changed its YAML syntax and PistonCore is generating YAML that HA rejects,
paste this entire file into any AI assistant (Claude, ChatGPT, Gemini, etc.) and describe the
problem. The AI has everything it needs to suggest the correct template changes.

After making changes, always test with a simple piston (like the driveway lights example at
the bottom of this file) before deploying to your real HA instance.

---

## Files in This Folder

```
automation.yaml.j2          Automation wrapper (triggers + conditions + script call)
script.yaml.j2              Script body wrapper (mode, alias, sequence container)
snippets/
  with_block.yaml.j2        Service call action
  wait_until.yaml.j2        Wait until a specific time
  wait_duration.yaml.j2     Wait a fixed duration
  wait_for_state.yaml.j2    Wait for an entity to reach a state (with timeout)
  if_block.yaml.j2          If/then/else branching
  repeat_until.yaml.j2      Repeat/do/until loop
  for_each.yaml.j2          For each loop over a list
  while_loop.yaml.j2        While loop
  for_loop.yaml.j2          Counted loop
  switch_block.yaml.j2      Switch/choose pattern matching
  set_variable.yaml.j2      Set a local piston variable
  set_global.yaml.j2        Write a value to a global variable helper
  log_message.yaml.j2       Fire a PISTONCORE_LOG event
  call_piston.yaml.j2       Call another piston's script
  control_piston.yaml.j2    Start/stop/enable/disable/trigger a piston or automation
  stop.yaml.j2              Stop the script
  completion_event.yaml.j2  PISTONCORE_RUN_COMPLETE event (always last in sequence)
  trigger_sun.yaml.j2       Sun rise/set trigger
  trigger_state.yaml.j2     Entity state change trigger
  trigger_time.yaml.j2      Time-of-day trigger
  trigger_time_pattern.yaml.j2  Time pattern trigger
  trigger_numeric.yaml.j2   Numeric state trigger
  trigger_event.yaml.j2     HA event trigger
  trigger_webhook.yaml.j2   Webhook trigger
  condition_state.yaml.j2   State condition
  condition_numeric.yaml.j2 Numeric state condition
  condition_template.yaml.j2 Template condition
  condition_time.yaml.j2    Time condition
  condition_and.yaml.j2     AND group
  condition_or.yaml.j2      OR group
```

---

## Variables Available in Each Template

### automation.yaml.j2
- `piston.id` — piston UUID
- `piston.name` — human-readable name
- `piston.description` — optional description string
- `piston.mode` — single / restart / queued / parallel
- `slug` — slugified piston name (used in file name and script entity ID)
- `app_version` — PistonCore version string
- `compiled_triggers` — pre-rendered YAML string, already indented 4 spaces
- `compiled_conditions` — pre-rendered YAML string, or the string `"[]"`

### script.yaml.j2
- `piston.id`, `piston.name`, `piston.description`, `piston.mode`
- `slug`
- `app_version`
- `globals_used` — comma-separated string of global variable names, or `"(none)"`
- `compiled_sequence` — pre-rendered YAML string of all statements, already indented 4 spaces

### Snippet templates — common variables
- `stmt_id` — the statement ID from the piston JSON (e.g. `"stmt_001"`)
- `indent` — number of spaces for the current indentation level (always a multiple of 2)
- Additional variables specific to each snippet type — see the Current Template Content
  section below for each snippet's variable list.

---

## Current Template Content

These are the current templates. If HA has changed syntax, compare these against the new
HA documentation and update as needed.

### automation.yaml.j2
```jinja2
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: {{ piston.id }} | pc_version: {{ app_version }} | pc_hash: {{ hash }}

- id: pistoncore_{{ piston.id }}
  alias: "{{ piston.name }}"
  description: "{{ piston.description }}"
  mode: {{ piston.mode }}
  triggers:
{{ compiled_triggers }}
  conditions: {{ compiled_conditions }}
  actions:
    - action: script.pistoncore_{{ slug }}
```

### script.yaml.j2
```jinja2
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: {{ piston.id }} | pc_version: {{ app_version }} | pc_hash: {{ hash }}
# pc_globals_used: {{ globals_used }}

pistoncore_{{ slug }}:
  alias: "{{ piston.name }} (PistonCore)"
  description: "{{ piston.description }}"
  mode: {{ piston.mode }}
  sequence:
{{ compiled_sequence }}
```

### snippets/with_block.yaml.j2
Variables: `stmt_id`, `service`, `entity_id`, `data` (dict or None)
```jinja2
- alias: "{{ stmt_id }}"
  action: {{ service }}
  target:
    entity_id: {{ entity_id }}
{% if data %}
  data:
{% for key, value in data.items() %}
    {{ key }}: {{ value }}
{% endfor %}
{% endif %}
```

### snippets/wait_until.yaml.j2
Variables: `stmt_id`, `at_time` (HH:MM:SS string)
```jinja2
- alias: "{{ stmt_id }}"
  wait_for_trigger:
    - trigger: time
      at: "{{ at_time }}"
```

### snippets/wait_duration.yaml.j2
Variables: `stmt_id`, `delay_yaml` (pre-formatted string like `seconds: 300`)
```jinja2
- alias: "{{ stmt_id }}"
  delay:
    {{ delay_yaml }}
```

### snippets/wait_for_state.yaml.j2
Variables: `stmt_id`, `entity_id`, `to_state`, `timeout_seconds`
```jinja2
- alias: "{{ stmt_id }}"
  wait_for_trigger:
    - trigger: state
      entity_id: {{ entity_id }}
      to: "{{ to_state }}"
  timeout:
    seconds: {{ timeout_seconds }}
  continue_on_timeout: true
```

### snippets/completion_event.yaml.j2
Variables: `piston_id`, `piston_name`
```jinja2
- event: PISTONCORE_RUN_COMPLETE
  event_data:
    piston_id: "{{ piston_id }}"
    piston_name: "{{ piston_name }}"
    status: "success"
```

### snippets/log_message.yaml.j2
Variables: `stmt_id`, `piston_id`, `level`, `message`
```jinja2
- alias: "{{ stmt_id }}"
  event: PISTONCORE_LOG
  event_data:
    piston_id: "{{ piston_id }}"
    stmt_id: "{{ stmt_id }}"
    level: "{{ level }}"
    message: "{{ message }}"
```

### snippets/stop.yaml.j2
Variables: `stmt_id`
```jinja2
- alias: "{{ stmt_id }}"
  stop: "Stopped by piston logic"
```

### snippets/trigger_sun.yaml.j2
Variables: `event` (sunrise/sunset), `offset` (formatted HH:MM:SS string with sign)
```jinja2
- trigger: sun
  event: {{ event }}
  offset: "{{ offset }}"
```

### snippets/trigger_state.yaml.j2
Variables: `entity_id`, `to` (optional), `from_state` (optional), `for_seconds` (optional)
```jinja2
- trigger: state
  entity_id: {{ entity_id }}
{% if to %}
  to: "{{ to }}"
{% endif %}
{% if from_state %}
  from: "{{ from_state }}"
{% endif %}
{% if for_seconds %}
  for:
    seconds: {{ for_seconds }}
{% endif %}
```

### snippets/trigger_time.yaml.j2
Variables: `at_time`
```jinja2
- trigger: time
  at: "{{ at_time }}"
```

### snippets/condition_state.yaml.j2
Variables: `entity_id`, `state`, `attribute` (optional)
```jinja2
- condition: state
  entity_id: {{ entity_id }}
{% if attribute %}
  attribute: {{ attribute }}
{% endif %}
  state: "{{ state }}"
```

### snippets/condition_numeric.yaml.j2
Variables: `entity_id`, `above` (optional), `below` (optional)
```jinja2
- condition: numeric_state
  entity_id: {{ entity_id }}
{% if above is not none %}
  above: {{ above }}
{% endif %}
{% if below is not none %}
  below: {{ below }}
{% endif %}
```

### snippets/condition_template.yaml.j2
Variables: `template_expression`
```jinja2
- condition: template
  value_template: "{{ template_expression }}"
```

### snippets/condition_time.yaml.j2
Variables: `after` (optional), `before` (optional), `weekday` (optional list)
```jinja2
- condition: time
{% if after %}
  after: "{{ after }}"
{% endif %}
{% if before %}
  before: "{{ before }}"
{% endif %}
{% if weekday %}
  weekday:
{% for day in weekday %}
    - {{ day }}
{% endfor %}
{% endif %}
```

---

## Known HA Syntax Changes to Watch For

Home Assistant occasionally renames YAML keys or restructures blocks. The most common
changes that would require template updates:

- **`service:` → `action:`** — HA renamed this key in 2024.8. Current templates use `action:`.
  If you are on an older HA version, change `action:` back to `service:` in all snippets.
- **`trigger:` key in trigger blocks** — HA added this as the explicit key for trigger type
  in recent versions. Older versions used `platform:`. Current templates use `trigger:`.
  If you see errors about unknown keys, try changing `trigger:` to `platform:` in trigger snippets.
- **Automation `triggers:` vs `trigger:`** — HA renamed the plural form. Current templates
  use `triggers:` (plural). If HA rejects this, try `trigger:` (singular).

---

## Test Piston — Use This to Verify After Any Template Change

After updating any template, verify with this minimal piston JSON.
Feed it through PistonCore and confirm the deployed automation and script load without errors.

```json
{
  "pistoncore_version": "1.0",
  "id": "test0001",
  "name": "Template Test Piston",
  "description": "Used to verify compiler templates after updates",
  "mode": "single",
  "compile_target": "native_script",
  "roles": {
    "test_light": {
      "label": "Test Light",
      "domain": "light",
      "required": true
    }
  },
  "device_map": {
    "test_light": "light.your_test_light"
  },
  "variables": [],
  "triggers": [
    { "type": "time", "at": "12:00:00" }
  ],
  "conditions": [],
  "actions": [
    {
      "id": "stmt_001",
      "type": "with_block",
      "target_role": "test_light",
      "tasks": [
        { "type": "call_service", "service": "light.turn_on", "data": {} }
      ]
    },
    {
      "id": "stmt_002",
      "type": "wait",
      "duration_seconds": 5
    },
    {
      "id": "stmt_003",
      "type": "with_block",
      "target_role": "test_light",
      "tasks": [
        { "type": "call_service", "service": "light.turn_off", "data": {} }
      ]
    }
  ]
}
```

Expected automation output:
```yaml
- id: pistoncore_test0001
  alias: "Template Test Piston"
  mode: single
  triggers:
    - trigger: time
      at: "12:00:00"
  conditions: []
  actions:
    - action: script.pistoncore_template_test_piston
```

Expected script output:
```yaml
pistoncore_template_test_piston:
  alias: "Template Test Piston (PistonCore)"
  mode: single
  sequence:
    - alias: "stmt_001"
      action: light.turn_on
      target:
        entity_id: light.your_test_light
    - alias: "stmt_002"
      delay:
        seconds: 5
    - alias: "stmt_003"
      action: light.turn_off
      target:
        entity_id: light.your_test_light
    - event: PISTONCORE_RUN_COMPLETE
      event_data:
        piston_id: "test0001"
        piston_name: "Template Test Piston"
        status: "success"
```

---

## What NOT to Change in This Folder

- Do not change the variable names passed into templates (e.g. `stmt_id`, `entity_id`).
  Those are defined by the Python compiler. Only the HA-facing YAML syntax belongs here.
- Do not add new template files without also updating the Python compiler to call them.
  New snippet files that the compiler does not know about have no effect.
- Do not change `PISTONCORE_RUN_COMPLETE` or `PISTONCORE_LOG` event names.
  The companion is listening for exactly those strings.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
