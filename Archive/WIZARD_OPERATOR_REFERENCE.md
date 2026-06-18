# WebCoRE Operator & Variable Reference
# For wizard.js build — Session 13
# Sourced from wiki.webcore.co, community forums, and source code

---

## CONDITION Operators (no lightning bolt — check current state)

| Operator | Meaning | Extra input needed? |
|---|---|---|
| is | Current state equals value | Value dropdown |
| is any of | Current state matches any value in a list | Multi-value input |
| is not | Current state does not equal value | Value dropdown |
| is not any of | Current state matches none in list | Multi-value input |
| is between | Current state is between two values | Two value inputs |
| is not between | Current state is NOT between two values | Two value inputs |
| is even | Number value is even | None |
| is odd | Number value is odd | None |
| was | State was this value at some recent point | Value + time duration |
| was any of | State was any of these values recently | Multi-value + duration |
| was not | State was not this value recently | Value + duration |
| was not any of | State was not any of these values recently | Multi-value + duration |
| changed | State changed at some point in the last X — NOTE: this is different from "changes to" trigger | Duration input |
| did not change | State did NOT change in the last X | Duration input |
| is equal to | Numeric: equals | Value |
| is not equal to | Numeric: does not equal | Value |
| is less than | Numeric: < | Value |
| is less than or equal to | Numeric: <= | Value |
| is greater than | Numeric: > | Value |
| is greater than or equal to | Numeric: >= | Value |

---

## TRIGGER Operators (lightning bolt ⚡ — fire on event)

| Operator | Meaning | Extra input needed? |
|---|---|---|
| changes | Any change event fires | None |
| changes to | Change event to specific value | Value dropdown |
| changes to any of | Change event to any listed value | Multi-value input |
| changes away from | Change event away from specific value | Value dropdown |
| changes away from any of | Change event away from any listed value | Multi-value input |
| drops | Numeric value drops (decreases) | None |
| drops below | Numeric value drops below threshold | Value |
| drops to or below | Numeric value drops to or below | Value |
| rises | Numeric value rises (increases) | None |
| rises above | Numeric value rises above threshold | Value |
| rises to or above | Numeric value rises to or above | Value |
| stays | State stays same for duration (FUTURE timer) | Value + duration |
| stays equal to | State stays at value for duration | Value + duration |
| stays any of | State stays as any of these for duration | Multi-value + duration |
| stays away from | State stays away from value for duration | Value + duration |
| stays away from any of | State stays away from any of these | Multi-value + duration |
| stays unchanged | State does not change for duration | Duration only (no value) |
| gets | Device receives a specific attribute value (buttons/momentary) | Value input |
| gets any | Device receives any momentary event value | None |
| receives | Attribute receives a specific value | Value input |
| happens daily at | Time-based daily trigger | Time or variable input (supports $sunrise/$sunset) |
| event occurs | Any event fires — used with System Start virtual device | None |
| is any and stays any of | Combined is/stays check | Value + duration |
| is away and stays away from | Combined away/stays check | Value + duration |
| FOLLOWED BY | Sequence trigger — fires when event A is followed by event B | Second event input + optional time window |

---

## Operator HA Compatibility Notes

Most operators compile fine to native HA. Exceptions:

| Operator | Issue | PyScript? |
|---|---|---|
| stays (all variants) | HA has no native "stays" — compiles to `wait_template` + time condition | No — works natively |
| FOLLOWED BY | HA has no event sequence detection | Yes — PyScript only |
| gets / gets any / receives | Button events work in HA via `trigger: event` — needs device class check | Partial |
| Physical vs Programmatic | HA doesn't expose trigger source | Yes — PyScript only |
| happens daily at | Compiles to HA `time` trigger with `at:` | No — works natively |
| is even / is odd | Compiles to Jinja2 `% 2 == 0` template | No — works natively |

**"stays" in HA:** Compiles to `wait_template` with a `timeout` inside the script.
If the template becomes false before timeout, the wait exits early — same behavior as
WebCoRE's stays cancelling when state changes. This works in native HA scripts.

---

## IMPORTANT — Distinction: "changed" condition vs "changes to" trigger

| | changed (condition) | changes to (trigger) |
|---|---|---|
| Lightning bolt | No | Yes |
| Fires piston | Only if no triggers present | Always on state change event |
| Evaluates | Looks back in device history | Checks current event value |
| Use case | "Did this change at some point?" | "Wake me up when this changes" |

This is one of the most common points of confusion for WebCoRE users.
The wizard should make this distinction visible — show the lightning bolt clearly
on trigger operators, and consider a tooltip explaining the difference.

---

- **"was"** = looks BACKWARD in history. "Was inactive for 15 minutes" = has been
  inactive for the past 15 minutes. This is a CONDITION (no lightning bolt).
- **"stays"** = looks FORWARD in time. "Stays inactive for 15 minutes" = sets a timer,
  fires the piston again in 15 minutes if still inactive. This is a TRIGGER (lightning bolt).
  The piston always continues to the ELSE immediately when stays is used —
  the THEN fires later via timer if the state held.

For the wizard: when "stays" type operator is selected, show the duration row.
When "was" type operator is selected, also show a duration row but label it differently.
  stays: "For the next..." [number] [minutes/hours]
  was:   "In the last..."  [number] [minutes/hours]

---

## Duration Input Row — Appears For These Operators
- was, was any of, was not, was not any of
- changed, did not change
- stays, stays equal to, stays any of, stays away from, stays away from any of
- is any and stays any of, is away and stays away from

Duration row format:
  [Value type: Value/Variable/Expression] | [number input] | [unit: seconds/minutes/hours/days]

---

## Value Types (dropdown before the value input)

| Type | When to use |
|---|---|
| Value | Simple static value (on, off, 70, "hello") |
| Variable | Pick from piston's local variables ($varName) |
| Expression | Full expression field (math, string concat, functions) |
| Device attribute | Another device's attribute as the comparison value |

---

## System Variables (always available in value picker)

| Variable | Type | Description |
|---|---|---|
| $currentEventDevice | device | The device that triggered the piston |
| $previousEventDevice | device | The previous event device |
| $device | device | Same as $currentEventDevice (shorthand) |
| $devices | device list | All devices that match a condition |
| $location | virtual | Location virtual device |
| $now | datetime | Current date and time |
| $date | date | Current date only |
| $time | time | Current time only |
| $hour | integer | Current hour (0-23) |
| $minute | integer | Current minute (0-59) |
| $second | integer | Current second (0-59) |
| $day | integer | Day of month |
| $month | integer | Month (1-12) |
| $year | integer | Year |
| $weekday | integer | Day of week (1=Monday) |
| $sunrise | time | Today's sunrise time |
| $sunset | time | Today's sunset time |
| $sunriseTime | datetime | Today's sunrise datetime |
| $sunsetTime | datetime | Today's sunset datetime |
| $midnight | time | Midnight (00:00:00) |
| $noon | time | Noon (12:00:00) |
| $index | integer | Loop counter in for/for each loops |

---

## $sunrise / $sunset Offset (must build into wizard value picker)

When user picks $sunrise or $sunset as a value, show an offset row:
  [+ / -] [number input] [minutes / hours]

This allows: "$sunset + 30 minutes", "$sunrise - 1 hour"
Store as: { __type: 'system_var', name: '$sunset', offset: 30, offset_unit: 'minutes', offset_direction: '+' }

---

## Which Interaction Row (appears for device subjects only)

When the subject is a physical device, show a "Which interaction" dropdown.
Options:
- Any interaction (default)
- Physical interaction (human triggered — hard in HA, PyScript only)
- Programmatic interaction (automation triggered — hard in HA, PyScript only)

For PistonCore v1: show the row but note Physical/Programmatic require PyScript.
Default to "Any interaction" — compiles fine in native HA.

---

## Aggregation Bar (orange bar — appears when multiple devices)

When more than one device is selected in the device picker, the orange
aggregation bar appears above the device row. Options:
- Any of the selected devices (default)
- All of the selected devices
- None of the selected devices

Store as: aggregation: 'any' | 'all' | 'none'

---

## Common HA Device Capabilities & Their Operators

| Capability | Attribute | Typical Values | Likely Operators |
|---|---|---|---|
| Switch | switch | on, off | is, changes to, stays |
| Motion | motion | active, inactive | changes to, stays |
| Contact | contact | open, closed | changes to, stays |
| Lock | lock | locked, unlocked | changes to, stays |
| Presence | presence | present, not present | changes to |
| Light (dimmer) | level | 0-100 | is, is between, drops below, rises above |
| Thermostat | temperature | number | is between, drops below, rises above |
| Illuminance | illuminance | number (lux) | is less than, is greater than |
| Humidity | humidity | number | is between |
| Door control | door | open, closed, opening, closing | changes to |
| Smoke | smoke | detected, clear, tested | changes to |
| Battery | battery | 0-100 | drops below |
| Mode (HA) | mode | home, away, night, etc. | is, changes to |

---

## Location Virtual Device — System Commands

In WebCoRE, "Location" is a virtual device that acts as a catch-all for system-level
commands that don't belong to any real physical device. When the user picks "Location"
in the device picker, the command list shows these instead of hardware commands.

PistonCore should keep this pattern — Location appears first in the device picker
(Virtual devices section) and its commands are the system command list.

### Additional Virtual Devices in the Device Picker

Beyond Location, WebCoRE has other virtual devices that appear at the top of the picker:

| Virtual Device | Purpose |
|---|---|
| Location | System commands (set variable, wait, notify, etc.) |
| System Start | Used with "event occurs" trigger — fires when hub restarts |
| Time | Used for time-based conditions ("time is between 10pm and 6am") |
| Date | Used for date-based conditions |
| Mode | Used to check or trigger on HA mode changes |

**"happens daily at"** — this trigger belongs to the Time virtual device, not a physical
device. When user selects Time as the subject, the operator list changes to time-specific
operators including "happens daily at". Input is a time value or variable ($sunrise/$sunset
with optional offset).

### Location Commands — HA Compatibility

| Command | HA Native? | How it compiles | PyScript only? |
|---|---|---|---|
| Set variable | ✅ Yes | `variables:` block in script or inline template | No |
| Execute piston | ✅ Yes | `service: script.pistoncore_<name>` | No |
| Set timezone | ⚠️ Partial | Store as variable, use in Jinja2 — HA has no per-script TZ | No — just limited |
| Send push notification | ✅ Yes | `service: persistent_notification.create` | No |
| Log to console | ✅ Yes | `service: system_log.write` with level | No |
| Make HTTP request | ✅ Yes | `service: rest_command.<name>` — requires pre-config in HA | Partial — needs setup |
| Send email | ✅ Yes | `service: notify.<notifier>` — requires notify integration | No — needs config |
| Wait (duration) | ✅ Yes | `delay:` in script | No |
| Wait until (time) | ✅ Yes | `wait_template:` in script | No |
| Pause execution | ⚠️ Not needed | HA scripts don't have CPU concerns — omit silently | No |
| Set HA mode | ✅ Yes | `service: input_select.select_option` or `zone.set` | No |
| Raise event | ✅ Yes | `service: event.fire` | No |
| Write/Read/Append/Delete file | ❌ No | HA has no local file system access from automations | PyScript only |

**Note on HTTP request:** HA requires `rest_command` entries pre-defined in configuration.yaml.
PistonCore should either auto-generate these or use a workaround via shell_command.
Flag to user if HTTP request is used — may need manual HA config step.

---

## PyScript-Only Features

These features cannot be compiled to native HA script and require the PyScript integration.
When a piston uses any of these, the red warning bar appears in the editor.

| Feature | Why it needs PyScript | HA workaround exists? |
|---|---|---|
| `break` out of a loop | HA scripts have no break statement | No |
| `exit` piston immediately | HA scripts run to completion | No |
| `on event` block | HA can't subscribe to events mid-script | No |
| Physical vs Programmatic interaction | HA doesn't expose trigger source reliably | No |
| Read from file / Write to file | HA has no local file access | No |
| Cancel pending tasks | HA can't cancel a running script instance mid-execution | No |
| `pause execution` | Not needed in HA — scripts are async already | Omit silently |
| Complex string manipulation in conditions | HA Jinja2 is limited vs WebCoRE expressions | Partial — simple cases work |
| `FOLLOWED BY` sequence trigger | HA has no native event sequence detection | No |
| Per-piston timezone override | HA uses system timezone only | No — store as var only |

**Rule of thumb for the compiler:**
- If it can be expressed as HA service calls, delays, templates, or conditions → Native
- If it requires program flow control (break, exit, cancel) → PyScript
- If it requires mid-execution event subscription → PyScript
- If it requires file system access → PyScript

### Set Variable wizard layout (confirmed from screenshot 39)
When user picks Location → Set variable:
- "With..." row shows: Location
- "Do..." blue bar shows: "location Set variable..."
- "Variable" section:
  - Left dropdown: Variable type (Variable / Global)
  - Right dropdown: picks from defined piston variables (shows type + name e.g. "string Message")
- "Value" section:
  - Left dropdown: Expression / Value / Variable
  - Large text area for expression input
- "Only during these modes" orange dropdown (optional restriction)
- Buttons: Cancel | Delete (red) | ⚙ | Save

Note: Task wizard buttons are Cancel/Delete/Save — NOT Back/Add more/Add.
That button set is only for the condition wizard.

1. Operator list is split into two groups in the dropdown:
   SECTION HEADER "Conditions" → all condition operators
   SECTION HEADER "Triggers" → all trigger operators
   No icons on items — just the section labels

2. When a trigger operator is selected → add ⚡ bolt to the condition line in document

3. Duration row appears BELOW the operator dropdown when needed — not a new step

4. Aggregation bar appears ABOVE the device row when multiple devices selected

5. "Which interaction" row appears BETWEEN device row and operator row

6. The "Add more" button adds the current condition and reopens the wizard immediately

7. Conditions within a group are joined by "and" or "or" — shown as a small
   dropdown between conditions when there are two or more

8. Group operator (and/or/xor) appears at the top of a condition group

---

## What We Are NOT Building in V1 (note for wizard — skip these)
- Physical vs Programmatic interaction (show option, note it needs PyScript)
- XOR group operator (too rare — and/or only for now)
- Weather variables ($weather.xxx) — not in HA natively
- IFTTT / Twilio / AskAlexa integrations — not applicable
- TCP/TEP — not applicable

---

## Expression Builder — How It Works

Appears when user picks "Expression" from the value type dropdown.

- Opens a textarea
- Real-time evaluation shows result below input as user types (v2 feature — stub for v1)
- Shows warnings if syntax wrong
- Common use: `{$variable} + 1` to increment a counter
- Supports all system variables and functions inline

### Expression functions
Math: sin, asin, cos, tan, atan2, log, toRadians, toDegrees, roundTimeToMinutes
List/Array: sort, min, max, avg, median, least, most, sum, variance, stdev, count, size
System: isPistonPaused(name), parseDateTime(string), exists(filename), exists(device:attribute)

### For PistonCore v1
- Show the textarea for expressions
- Show a small "Result: (save to evaluate)" stub below it
- Real-time evaluation is a v2 feature

---

## "Only During These Modes" Restriction — Confirmed Behavior

- Dropdown contains HA modes (Home, Away, Night, etc.) — pull from HA at runtime
- Applied PER TASK — not per piston, not per action block
- Each individual task inside a Then block can have its own mode restriction
- Acts as a gatekeeper: condition met but hub in wrong mode → that task is skipped
- Piston-level restrictions are separate (the "only when" block at top of piston)
- Compiles to: wrap the service call in an HA condition checking current mode

---

## Additional System Variables (confirmed from expression builder)

| Variable | Description | HA equivalent? |
|---|---|---|
| $utc | Current UTC time | Yes — now() in UTC |
| $longitude | Hub location longitude | Yes — zone.home |
| $latitude | Hub location latitude | Yes — zone.home |
| $zipCode | Hub location zip code | No direct equivalent |
| $tzId | Timezone ID string | Yes — HA config |
| $tzName | Timezone name | Yes — HA config |
| $tzOffset | Timezone UTC offset | Yes — HA config |
| $tzInDST | Is daylight saving time active | Yes — template |
| $weather | Weather forecast data object | Requires weather integration |

---

## Value Section — Three Modes (confirmed)

The value input in condition wizard has THREE modes selectable via dropdown:

1. **Value** — static text or dropdown input
2. **Variable** — shows picker for piston local variables + system variables ($sunset, $now, etc.)
   - When $sunrise or $sunset selected: offset row appears (+ or - number + unit)
3. **Expression** — freeform textarea with result preview below

The Variable mode needs TWO sub-sections:
- Piston variables ($varName — defined in the define block)
- System variables ($now, $sunrise, $sunset, $date, $time, etc.)

---

## Confirmed: Save Button Behavior

From NotebookLM — "Save (Final Step): Located in top right, saves entire piston to hub
and exits to the Piston View page."

This confirms our decision: Save in editor → goes to status page. Correct.

---

## What We Are NOT Building in V1 — Updated List
- Physical vs Programmatic interaction (show option, note PyScript only)
- XOR group operator (and/or only)
- $weather variables (requires HA weather integration — note it, don't block)
- $zipCode (no HA equivalent)
- IFTTT / Twilio / AskAlexa integrations
- TCP/TEP advanced options
- Real-time expression evaluation (v2)
- File system commands (Hubitat-specific)
- isPistonPaused() function (v2)
