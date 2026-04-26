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
| was | State was this value at some recent point | Value + time duration |
| was any of | State was any of these values recently | Multi-value + duration |
| was not | State was not this value recently | Value + duration |
| was not any of | State was not any of these values recently | Multi-value + duration |
| changed | State changed at some point in the last X | Duration input |
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
| stays | State stays same for duration (FUTURE timer) | Duration input |
| stays equal to | State stays at value for duration | Value + duration |
| stays any of | State stays as any of these for duration | Multi-value + duration |
| stays away from | State stays away from value for duration | Value + duration |
| stays away from any of | State stays away from any of these | Multi-value + duration |
| event occurs | Any event from device fires piston | None |
| is any and stays any of | Combined is/stays check | Value + duration |
| is away and stays away from | Combined away/stays check | Value + duration |

---

## IMPORTANT — "stays" vs "was" (common confusion point)

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

### Location Commands (what appears in "Do..." dropdown when Location is selected)

| Command | What it does | Parameters |
|---|---|---|
| Set variable | Set a local piston variable to a value | Variable picker + Value input |
| Set global variable | Set a global HA helper variable | Global picker + Value input |
| Execute piston | Run another PistonCore piston | Piston picker |
| Wait | Pause execution for a duration | Duration input |
| Wait until | Pause until a specific time | Time/datetime input |
| Send push notification | Send HA persistent notification | Message text input |
| Log to console | Write to PistonCore log | Message text input |
| Set HA mode | Change HA mode (home/away/night etc.) | Mode picker |
| Raise event | Fire a custom HA event | Event name + data |
| HTTP request | Make a web request | URL + method + body |

### Why Location exists
SmartThings/WebCoRE required every command to be attached to a device.
System-level commands needed a "fake" device to hang them on — that's Location.
PistonCore keeps this pattern because WebCoRE migrants will recognize it immediately.

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
