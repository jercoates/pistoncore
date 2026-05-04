# PistonCore Wizard Specification

**Version:** 0.6
**Status:** Draft — For Developer Use
**Last Updated:** May 2026

This document defines the capability-driven wizard in full detail.
Read DESIGN.md and FRONTEND_SPEC.md first.
This document closes DESIGN.md Section 8 (Wizard Capability Map).

**Guiding rule:** Match WebCoRE's wizard behavior exactly where possible.
Deviation requires a specific documented reason.

---

## Wizard Features by Runtime Target

Some wizard options only apply to certain compile targets. The wizard must make this clear rather than silently allowing features that won't work on the current target.

### Available in Both (Native HA Script and PyScript)

All standard triggers, conditions, and actions — device state changes, numeric comparisons, all loop types except break, wait, wait for state, set variable, log message, call another piston (fire-and-forget), control another piston/automation, and all HA service calls.

### PyScript Only — Addon v1 and Docker (permanent)

The following wizard options are only available when the piston compiles to PyScript:
- `break` — interrupt a loop mid-iteration
- `cancel_pending_tasks` — cancel async tasks in flight
- `on_event` — execute a block when a specific event fires inside a running script
- Task Execution Policy (TEP) and Task Cancellation Policy (TCP) cog options
- System variables ($currentEventDevice, $previousEventDevice, etc.)
- Which Interaction — Physical vs Programmatic (PyScript context tracking)

When a user selects a PyScript-only feature and the piston is currently native-script-bound, show the conversion prompt:
*"This option requires converting your piston to a PyScript piston. Your logic will be preserved. Continue?"*
`[Yes, convert]` `[No, pick something else]`

### Native Runtime Only — Addon v2+ (future)

The v2 native runtime will replace PyScript for addon users. Wizard features specific to the native runtime will be documented when v2 design begins. No native runtime features are in scope for v1.

---

## What the Wizard Is

The wizard is a multi-step modal that opens whenever the user clicks a ghost text insertion point
or clicks to edit an existing statement. It guides the user through building a single statement
using dropdowns and context-aware inputs — never free-form code entry.

The wizard is the same modal for triggers, conditions, and actions.
The steps and options it shows change based on context and what the user has selected so far.

---

## Core Wizard Behaviors

These apply to every wizard instance regardless of statement type:

1. **Never show an empty dropdown.** Show a loading spinner until data arrives. Show an error with a Retry button if data fails to load.
2. **Every step changes the next step's options.** Device selection changes the capability list. Capability selection changes the operator list. Operator selection changes the value input type. Nothing is static.
3. **Build a plain English sentence at the top** as the user progresses. This sentence grows with each step and shows what has been selected so far.
4. **Back is always available.** Clicking Back returns to the previous step without losing the current step's selection.
5. **Cancel closes with no changes.** Nothing is written to the piston tree until the user clicks Done on the final step.
6. **Cog icon** in the bottom right expands advanced options (TEP, TCP, Execution Method). Always present, hidden until clicked.

---

## First Step — Condition or Group

When the user clicks to add a condition (in the CONDITIONS section, inside an if_block condition, or in an only_when restriction), the wizard does NOT go straight to the device picker.

The first step presents two choices:

**Condition** — *"a single comparison between two or more operands, the basic building block of a decisional statement"*
`[Add a condition]`

**Group** — *"a collection of conditions, with a logical operator between them, allowing for complex decisional statements"*
`[Add a group]`

Groups are first-class objects, not just chained conditions. This is how WebCoRE handles complex AND/OR logic. A group contains multiple conditions linked by AND or OR. Groups can be nested inside other groups.

This first step does not apply when adding triggers — triggers go directly to the device/event picker.

---

## Triggers vs Conditions — The Lightning Bolt Distinction

This is one of the most important behaviors from WebCoRE and must be replicated exactly.

### What the difference means

**Trigger** — event-based. Creates an event subscription in HA. The piston runs when this event fires.
Shown with a ⚡ lightning bolt icon in the wizard and in the document.

**Condition** — state-based. Evaluated when the piston runs. No event subscription.
Shown with no special icon — plain text only.

### Where this distinction appears

Inside the wizard, when the user reaches the operator selection step, the operator list is
**divided into two groups**:

```
⚡ TRIGGERS — fire when this happens
  ⚡ changes to detected
  ⚡ changes to clear
  ⚡ changes (any)

CONDITIONS — check current state
  is detected
  is clear
  was detected for at least [duration]
  was clear for at least [duration]
```

The user picks from either group. Their choice determines whether this comparison is a trigger
or a condition.

### At the piston level

In the document, trigger statements are marked with ⚡ and appear in the TRIGGERS section.
Condition statements appear in the CONDITIONS section.

If a user adds a comparison in the TRIGGERS section, the wizard pre-selects the trigger group
in the operator step. If they add one in the CONDITIONS section, the wizard pre-selects the
conditions group. The user can override this.

### The "upgrade" behavior

If the user has built a piston with no triggers at all and tries to save, PistonCore shows a warning
on the status page validation banner:

*"⚠ This piston has no triggers. It will never run automatically."*

And offers: *"Would you like to promote one of your conditions to a trigger?"*
`[Yes — show me]` `[No — I'll add a trigger manually]`

If the user clicks Yes, PistonCore shows the piston's conditions. User picks one.
PistonCore converts it:
- Moves it to the TRIGGERS section
- Changes its type from `condition` to `trigger`
- Updates the operator to the trigger-equivalent (e.g., "is open" → "changes to open")
- Shows the updated piston with the promoted trigger highlighted

This matches WebCoRE's behavior exactly.

---

## Which Interaction Step — Physical vs Programmatic

After selecting a device and attribute in the condition wizard, the wizard may show an optional step:

**Which interaction:**
- Any interaction
- Physical interaction — state change caused by a person physically using the device
- Programmatic interaction — state change caused by an automation or app

This distinguishes between a person flipping a light switch vs an automation turning the light on.

**Implementation note:** This is implementable in PyScript via HA context tracking (`context.id`, `context.parent_id` on state changes). Evaluate feasibility in sandbox before committing to this wizard step. If not feasible in the sandbox environment, omit this step from v1.

This step only appears when the selected operator is a trigger-type (⚡) and the device supports context tracking. It does not appear for condition operators.

---

## Capability Map — The Core Decision Tree

This is the map that drives wizard steps for operator selection and value input.
Given a device's attribute type, this map defines valid operators and valid value input types.

The capability map lives in the frontend. The backend provides raw HA data.
The frontend applies the map to determine operators and input types.

### How Attribute Type Is Determined

The backend determines attribute type from HA capability data and includes it in the capabilities response. Detection runs in the backend before data reaches the wizard.

**Detection logic (in priority order):**

1. If the capability's `device_class` is a known binary class (motion, door, window, smoke, moisture, occupancy, plug, outlet, lock) → **Binary**
2. If the capability's `device_class` is a known numeric class (temperature, humidity, battery, illuminance, power, energy, signal_strength, pm25, co2, voltage, current) → **Numeric**
3. If the capability has a `unit_of_measurement` → **Numeric**
4. If the capability has a defined `options` list (input_select, enum) → **Enum / Multi-state**
5. If the capability's domain is `cover` and attribute is `current_position` → **Numeric with Position**
6. If the capability's domain is `light` and attribute is `brightness` → **Numeric with Position**
7. If the capability's domain is `input_boolean` → **HA Boolean Helper**
8. If the capability's domain is `person` or `device_tracker` → **Location / Presence**
9. If the capability's domain is `sensor` with no unit → **Enum / Multi-state** (use reported states)
10. If none of the above match → **Unknown / Ambiguous** — show fallback operators

### Attribute Types and Their Operators

---

#### Binary — door, window, motion, smoke, moisture, lock, and all other binary_sensor device classes

**Critical implementation note:** Home Assistant binary sensors ALWAYS report `"on"` or `"off"` as
their actual state value — regardless of device_class or what the UI displays. A door sensor with
`device_class: door` shows "Open/Closed" in the HA frontend but its real state is `"on"` or `"off"`.

**This is different from WebCoRE on Hubitat/SmartThings**, where drivers return named states like
`"open"`, `"closed"`, `"detected"` directly. In HA, those named labels are display-only.

**The wizard shows friendly labels (Open/Closed, Detected/Clear, etc.) to the user.**
**The piston JSON stores both the display label AND the compiled value separately.**
**The compiler always uses the compiled value — never the display label.**

The friendly label pairs shown in the wizard come from PistonCore's own device_class lookup table,
NOT from HA. HA does not return these labels as state values.

**Device_class → friendly label pairs (wizard display only):**

| device_class | "on" label | "off" label |
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

**Trigger operators (⚡):**
| Operator | Value input |
|---|---|
| ⚡ changes to [label] | Dropdown showing friendly labels — compiles to "on" or "off" |
| ⚡ changes from [label] | Dropdown showing friendly labels — compiles to "on" or "off" |
| ⚡ changes from [label] to [label] | Two dropdowns — each compiles to "on" or "off" |
| ⚡ changes (any) | No value input needed |

**Condition operators:**
| Operator | Value input |
|---|---|
| is [label] | Dropdown showing friendly labels — compiles to "on" or "off" |
| is not [label] | Dropdown showing friendly labels — compiles to "on" or "off" |
| was [label] for at least [duration] | Dropdown + duration picker — label compiles to "on" or "off" |
| was [label] for less than [duration] | Dropdown + duration picker — label compiles to "on" or "off" |

---

#### Numeric — temperature, humidity, battery level, illuminance, power, energy, CO2, PM2.5, voltage, current, any sensor with a unit of measurement

**Trigger operators (⚡):**
| Operator | Value input |
|---|---|
| ⚡ rises above [value] | Number input + unit label |
| ⚡ drops below [value] | Number input + unit label |
| ⚡ changes by at least [value] | Number input + unit label |
| ⚡ changes (any) | No value input needed |

**Condition operators:**
| Operator | Value input |
|---|---|
| is equal to [value] | Number input + unit label |
| is not equal to [value] | Number input + unit label |
| is greater than [value] | Number input + unit label |
| is less than [value] | Number input + unit label |
| is greater than or equal to [value] | Number input + unit label |
| is less than or equal to [value] | Number input + unit label |
| is between [value] and [value] | Two number inputs + unit label |
| is not between [value] and [value] | Two number inputs + unit label |
| was above [value] for at least [duration] | Number input + duration picker |
| was below [value] for at least [duration] | Number input + duration picker |

---

#### Enum / Multi-state — media player state (playing/paused/idle/off), cover position (open/closed/opening/closing), HVAC mode (heat/cool/auto/off), alarm state, scene, input_select

These entities have named states that ARE the real HA state values — not display labels over on/off.
The state list is fetched from HA: `options` attribute for input_select/select, `hvac_modes` attribute
for climate, current state + known domain states for media_player and cover.

**Trigger operators (⚡):**
| Operator | Value input |
|---|---|
| ⚡ changes to [state] | Dropdown of real state values from HA |
| ⚡ changes from [state] | Dropdown of real state values from HA |
| ⚡ changes from [state] to [state] | Two dropdowns of real state values |
| ⚡ changes (any) | No value input needed |

**Condition operators:**
| Operator | Value input |
|---|---|
| is [state] | Dropdown of real state values from HA |
| is not [state] | Dropdown of real state values from HA |
| is any of [states] | Multi-select dropdown of real state values |
| is not any of [states] | Multi-select dropdown of real state values |
| was [state] for at least [duration] | Dropdown of real state values + duration picker |

---

#### Numeric with Position — cover/blind position (0–100), light brightness (0–100 or 0–255), volume (0–1 or 0–100)

These are numeric but with a known range. Show a slider as the primary input, number input as secondary.

**Trigger operators (⚡):**
| Operator | Value input |
|---|---|
| ⚡ rises above [value] | Slider + number input |
| ⚡ drops below [value] | Slider + number input |
| ⚡ changes (any) | No value input needed |

**Condition operators:**
| Operator | Value input |
|---|---|
| is equal to [value] | Slider + number input |
| is greater than [value] | Slider + number input |
| is less than [value] | Slider + number input |
| is between [value] and [value] | Two sliders + number inputs |

---

#### Time / Clock

**Trigger operators (⚡):**
| Operator | Value input |
|---|---|
| ⚡ reaches [time] | Time picker |
| ⚡ reaches sunrise | Offset picker (minutes before/after) |
| ⚡ reaches sunset | Offset picker (minutes before/after) |
| ⚡ every [pattern] | Pattern picker (every X minutes/hours) |

**Condition operators:**
| Operator | Value input |
|---|---|
| is before [time] | Time picker |
| is after [time] | Time picker |
| is between [time] and [time] | Two time pickers |
| is on [day(s) of week] | Day multi-select |

---

#### Date

**Condition operators only** (date is not a useful trigger type in most cases):
| Operator | Value input |
|---|---|
| is before [date] | Date picker |
| is after [date] | Date picker |
| is between [date] and [date] | Two date pickers |

---

#### Location / Presence — person entity, zone entity

**Trigger operators (⚡):**
| Operator | Value input |
|---|---|
| ⚡ enters [zone] | Dropdown of zones from HA |
| ⚡ leaves [zone] | Dropdown of zones from HA |
| ⚡ changes zone | No value input needed |

**Condition operators:**
| Operator | Value input |
|---|---|
| is in [zone] | Dropdown of zones from HA |
| is not in [zone] | Dropdown of zones from HA |
| is home | No value input needed |
| is away | No value input needed |

Note: Geofence is handled naturally through changes-to on person/zone entity.

---

#### HA Boolean Helper — input_boolean

These are the only devices that use Yes/No language. All other binary devices use the friendly
label system described in the Binary section above.

**Trigger operators (⚡):**
| Operator | Value input |
|---|---|
| ⚡ turns on | No value input needed |
| ⚡ turns off | No value input needed |
| ⚡ changes | No value input needed |

**Condition operators:**
| Operator | Value input |
|---|---|
| is on | No value input needed |
| is off | No value input needed |

---

#### Variable — piston variable or global variable

**Condition operators only** (variables are not triggers):
| Operator | Value input |
|---|---|
| equals [value] | Text/number input matching variable type |
| does not equal [value] | Text/number input matching variable type |
| is greater than [value] | Number input (numeric variables only) |
| is less than [value] | Number input (numeric variables only) |
| contains [value] | Text input (text variables only) |
| does not contain [value] | Text input (text variables only) |
| is empty | No value input needed |
| is not empty | No value input needed |

---

#### Unknown / Ambiguous Capability

If PistonCore cannot determine the attribute type from HA data:

Show a simplified operator set:
- ⚡ changes (trigger)
- ⚡ changes to [value] — free text input
- is [value] — free text input
- is not [value] — free text input

And show a note: *"We couldn't determine all valid options for this capability.
You can define this device manually in My Device Definitions."*

This is the graceful degradation path — always show something useful rather than failing.

---

## Multi-Device Comparisons

When the user selects multiple devices (via a Devices variable or by selecting multiple in the picker),
the wizard adds an aggregation step before the operator step:

```
How many of these devices must match?
  ○ Any of these devices
  ○ All of these devices
  ○ None of these devices
```

The selected aggregation becomes part of the plain English sentence:
- "Any of (Smoke Detectors)'s smoke changes to detected"
- "All of (Door Contacts) are closed"
- "None of (Motion Sensors) are active"

This matches WebCoRE's multi-device comparison behavior exactly.

---

## System Variables — Runtime Context

PistonCore pistons have access to runtime context variables injected at compile time.
These appear in the device picker under a "System Variables" section alongside physical devices and user-defined variables.

System variables available in compiled pistons:

| Variable | Type | Description |
|---|---|---|
| $currentEventDevice | Device | The device that triggered the piston |
| $previousEventDevice | Device | The device that triggered the previous piston run |
| $device | Device | Current device in a for_each loop |
| $devices | Devices | Full collection in a for_each loop |
| $triggerValue | Text | The value that caused the trigger to fire |
| $previousValue | Text | The previous value before the trigger |

These variables are only available in PyScript pistons. They are not available in native script pistons.
If a user adds a system variable reference to a native-script-bound piston, the compile-target conversion prompt appears.

---

## Right-Hand Value Input Types

These are the input types the wizard shows in the final step based on the operator selected:

| Input type | When used | What it shows |
|---|---|---|
| Binary label dropdown | Binary sensor operators | Friendly labels (Open/Closed etc.) from device_class table — compiles to "on"/"off" |
| Real state dropdown | Enum/multi-state operators | Actual state values from HA (playing, heat, open, etc.) |
| Number input | Numeric operators | Number field with unit label from HA |
| Slider + number | Position/range operators | Slider with min/max from HA + number input |
| Time picker | Time operators | HH:MM AM/PM selector |
| Date picker | Date operators | Calendar or date input |
| Duration picker | "for at least" operators | Number input + unit selector (seconds/minutes/hours) |
| Day selector | Day-of-week operators | Mon/Tue/Wed/Thu/Fri/Sat/Sun checkboxes |
| Zone dropdown | Location operators | Dropdown of zones from HA |
| Free text | Unknown/fallback | Plain text input with a note |
| Variable picker | Any operator | Dropdown of defined piston and global variables |
| Device attribute | Comparison operators | Secondary device picker + capability picker (compare device A to device B) |
| No input | Self-evident operators | "is on", "is home", "changes (any)" — no right-hand value needed |

---

## Action Wizard — Device Commands

The action wizard follows the same device-first pattern but ends with a command and parameters
instead of an operator and value.

**Action philosophy:** PistonCore never maintains its own integration or command list. The action
wizard pulls live services from HA's service registry. If the user has Twilio installed — SMS
appears. If they have the mobile app — push notification appears. PistonCore only defines
explicitly the system commands that are NOT HA services.

**Action wizard steps:**
1. Pick the device (or system command) — same type-to-filter picker as conditions
2. Pick the command/service — list fetched live from HA for that device
3. Configure parameters — fields generated from HA's service schema for that command

### Device Picker Sections (Action Wizard)

The action device picker has five sections, matching WebCoRE's structure:

1. **System commands** — PistonCore location/system commands not tied to a specific device
2. **Physical devices** — full device list from HA
3. **Local variables** — Device-type variables defined in this piston
4. **Global variables** — Device-type global variables
5. **System variables** — $currentEventDevice, $device, $devices, etc.

### System Commands (non-HA-service actions)

These are PistonCore-defined commands that appear in the action wizard for every piston.
They are NOT pulled from HA's service registry — PistonCore defines them:

| Command | Description | Notes |
|---|---|---|
| Wait | Pause for a fixed duration or until a time | Always available |
| Wait for state | Pause until an entity reaches a state, with timeout | Native script + PyScript |
| Wait randomly | Pause for a random duration within a range | PyScript only |
| Set variable | Assign or modify a piston or global variable | |
| Cancel all pending tasks | Cancel any pending async tasks in this piston | PyScript only |
| Execute piston | Trigger another piston | Same as call_piston statement |
| Control piston | Start/Stop/Enable/Disable/Trigger a piston or HA automation | |
| Log to console | Write a message to the piston log | |
| No operation | Does nothing — placeholder | Useful for stub branches |
| Make a web request | HTTP GET/POST to any URL | PyScript only |
| Wake a LAN device | Send a WOL packet | |

All other commands (notifications, device control, scripts, scenes, etc.) come from HA's
service registry for the selected device. PistonCore inherits every HA integration automatically.

### Parameter Input Types by Command

| Command type | Parameter inputs |
|---|---|
| turn_on (light) | Brightness slider (0–100%), Color picker (if supported), Color temp slider (if supported), Transition duration |
| turn_on (switch) | No parameters |
| turn_off | No parameters |
| set_cover_position | Position slider (0–100%) |
| media_play / media_pause | No parameters |
| media_volume_set | Volume slider (0–100%) |
| set_hvac_mode | Mode dropdown (from HA) |
| set_temperature | Temperature input + unit |
| lock / unlock | No parameters |
| notify | Message text input, optional title input |
| input_select.select_option | Option dropdown (from HA) |
| input_number.set_value | Number input with min/max/step from HA |
| script.turn_on | No parameters (or variables if the script accepts them) |
| scene.turn_on | No parameters |
| Unknown service | Raw parameter editor — key/value pairs |

All parameter options are fetched from HA's service schema. PistonCore never hardcodes parameter lists. If HA returns no schema for a service, show the raw key/value editor as fallback.

---

## Wizard Plain English Sentence — Full Examples

**Trigger example (binary sensor — door):**
- Step 1: *"When..."*
- Step 2: *"When Front Door..."*
- Step 3: *"When Front Door's contact..."*
- Step 4: *"When Front Door's contact ⚡ changes to..."*
- Step 5: *"When Front Door's contact ⚡ changes to Open"*

The wizard shows "Open" (friendly label). The piston JSON stores `display_value: "Open"` and
`compiled_value: "on"`. The compiled YAML uses `to: "on"`.

**Trigger example (enum — media player):**
- Step 5: *"When Living Room Speaker ⚡ changes to Playing"*

The wizard shows "Playing". The piston JSON stores `display_value: "Playing"` and
`compiled_value: "playing"`. Both are the same for non-binary entities.

**Multi-device trigger example:**
- Step 5: *"When any of (Smoke Detectors)'s smoke ⚡ changes to Detected"*

**Condition example:**
- Step 5: *"Check if Front Door's contact is Open"*

Display: "Open". Compiles to `state: "on"`.

**Action example:**
- Step 3: *"Turn Driveway Main Light on at 75% brightness"*

---

## Wizard Internal State

While the wizard is open, it maintains this state object:

```json
{
  "context": "trigger | condition | action",
  "step": 3,
  "selections": {
    "statement_class": "condition | group",
    "subject_type": "device",
    "device_id": "abc123",
    "device_label": "Front Door",
    "capability": "contact",
    "attribute_type": "binary",
    "display_states": ["Open", "Closed"],
    "compiled_states": ["on", "off"],
    "aggregation": null,
    "interaction": "any",
    "operator_group": "trigger",
    "operator": "changes to",
    "display_value": "Open",
    "compiled_value": "on"
  },
  "sentence": "When Front Door's contact ⚡ changes to Open"
}
```

Note the separation of `display_states`/`compiled_states` and `display_value`/`compiled_value`.
For non-binary entities these pairs are identical. For binary sensors they differ — display uses
friendly labels, compiled uses `"on"`/`"off"`.

On Done, this state is converted to a typed statement or condition object and inserted
into the piston's `statements` array as structured JSON. The editor then renders the
display text from that structured data using render functions.
On Cancel, this state is discarded. Nothing is written to the piston.

---

## Condition Object — Final Output of the Wizard

When the wizard completes a condition or trigger, it produces a typed condition object
and inserts it into the piston's `statements` array. The wizard writes structured JSON
directly — it never writes display text. The editor renders display text from the
structured data using render functions.

```json
{
  "id": "cond_001",
  "is_trigger": false,
  "aggregation": "any | all | none | null",
  "role": "front_door",
  "attribute": "contact",
  "attribute_type": "binary",
  "device_class": "door",
  "operator": "changes to",
  "display_value": "Open",
  "compiled_value": "on",
  "duration": null,
  "duration_unit": null,
  "group_operator": "and"
}
```

**`is_trigger`** — `true` for trigger operators (⚡), `false` for condition operators.
This flag is how the compiler and editor know a condition is a trigger. Not position,
not operator name — this flag. The wizard sets it based on which operator group the
user picked.

**`display_value`** — shown in the PistonCore editor. For binary sensors this is the
friendly label ("Open", "Detected"). For all other types same as compiled_value.

**`compiled_value`** — used by the compiler when generating HA YAML. For binary sensors
this is always `"on"` or `"off"`. The compiler ALWAYS uses `compiled_value`. Never `display_value`.

**`group_operator`** — `"and"` or `"or"`. Applies to this condition's relationship with
the next condition in the array. Omit on the last condition in a group.

**`aggregation`** — applies when multiple devices are selected: `"any"`, `"all"`, `"none"`.
Null for single device conditions.

**`interaction`** — `"any"`, `"physical"`, `"programmatic"`. Defaults to `"any"`.
Only relevant for trigger-type conditions on PyScript pistons. If omitted or `"any"`,
no context filtering is applied.

---

## No-Trigger Warning — The Upgrade Flow

If the user saves a piston with no triggers defined:

**Step 1 — Warning on status page validation banner:**
*"⚠ This piston has no triggers. It will never run automatically."*

**Step 2 — Offer to upgrade:**
*"Would you like to promote one of your conditions to a trigger?"*
`[Yes — show me]` `[No — I'll add a trigger manually]`

**Step 3 — If Yes:**
Show the piston's conditions list. User picks one to promote.
PistonCore converts it:
- Moves it to the TRIGGERS section
- Changes type from `condition` to `trigger`
- Updates the operator to the trigger-equivalent (e.g., "is Open" → "changes to Open")
- Shows the updated piston with the promoted trigger highlighted

This matches WebCoRE's behavior exactly.

---

## Simple vs Complex Mode — Wizard Differences

**Simple mode wizard:**
- Does not show piston variable picker in value inputs
- Does not show loop statement types (Repeat, For Each, While, For Loop)
- Does not show Wait for State action
- Does not show Call Another Piston action
- Does not show Cancel All Pending Tasks, Break, Switch, Do Block, On Event
- Does not show TEP/TCP cog options (cog icon still present but those options are hidden)
- Duration operators are available (they compile to HA native `for:` syntax)
- System variables not shown

**Advanced mode wizard:**
- Shows everything

**Native Script → PyScript promotion inside the wizard:**
If a user selects an operator or feature that forces PyScript compilation, PistonCore shows a prompt before proceeding:
*"This option requires converting your piston to a PyScript piston. Your logic will be preserved. Continue?"*
`[Yes, convert]` `[No, pick something else]`

If they confirm, the piston's compile target updates and the wizard continues.

---

## What the Backend Must Provide for the Wizard

The wizard frontend makes these backend calls during the wizard flow:

| Step | Backend call | Returns |
|---|---|---|
| Device picker | `GET /api/devices` | All devices with id, friendly name, area, domain |
| Capability picker | `GET /api/device/{id}/capabilities` | List of capabilities with name, attribute_type, device_class |
| Binary label lookup | Frontend only — no backend call | Friendly label pairs from device_class table in this document |
| Enum state list | `GET /api/device/{id}/state` | Current state + options attribute if present |
| Trigger operators | Derived from attribute_type | No backend call — wizard uses the capability map in this document |
| Condition operators | Derived from attribute_type | No backend call — wizard uses the capability map in this document |
| Service picker (actions) | `GET /api/device/{id}/services` | List of services with name, label, schema |
| Service parameters | Included in services response | Parameter schema with types, min, max, options |
| Zones (location operators) | `GET /api/zones` | List of zones with id and label |

The capability map in this document is implemented in the frontend.
The backend provides raw HA data. The frontend applies the map to determine operators and input types.
Binary sensor friendly labels come from the device_class table in this document — not from HA.

---

---

## "was" vs "stays" — Critical Distinction

This is one of the most important behavioral differences in WebCoRE and must be implemented exactly. The wizard must make the distinction visible.

| | `was` (condition) | `stays` (trigger) |
|---|---|---|
| Lightning bolt | No ⚡ | Yes ⚡ |
| Direction | Looks **backward** in history | Looks **forward** in time |
| Meaning | "Has this been true for the past X?" | "If this stays true for the next X, fire again" |
| Use case | Check recent history | Set a forward-looking timer |

**`was`** — evaluates device history. "Was inactive for 15 minutes" means the device has been inactive for the past 15 minutes. This is a CONDITION — no lightning bolt. The piston checks this and continues or stops.

**`stays`** — sets a forward-looking timer. "Stays inactive for 15 minutes" means: start a timer, and if the device is still inactive when the timer fires, run the piston again. This is a TRIGGER — lightning bolt. The piston always continues to the ELSE branch immediately when stays is evaluated. The THEN branch fires later if the state held.

### Duration Row Labels — Different for was vs stays

When a `was`-type operator is selected, show the duration row labeled:
> "In the last..." `[number]` `[seconds / minutes / hours / days]`

When a `stays`-type operator is selected, show the duration row labeled:
> "For the next..." `[number]` `[seconds / minutes / hours / days]`

The input widget is the same — only the label differs. This distinction matters because it tells the user which direction in time they are measuring.

### Operators That Show a Duration Row

**`was`-type (backward-looking — CONDITION):**
`was` / `was any of` / `was not` / `was not any of` / `changed` / `did not change`

**`stays`-type (forward-looking — TRIGGER):**
`stays` / `stays equal to` / `stays any of` / `stays away from` / `stays away from any of` / `stays unchanged` / `is any and stays any of` / `is away and stays away from`

### HA Compilation — stays

`stays`-type operators compile to `wait_template` with a `timeout` inside the native HA script. If the template becomes false before the timeout, the wait exits early — same behavior as WebCoRE's stays cancelling when state changes. This works in native HA scripts — no PyScript needed.

---

## Virtual Devices — Device Picker Sections

The device picker is not just physical HA devices. It has a virtual devices section at the top that provides system-level subjects for conditions, triggers, and actions. These match WebCoRE's pattern exactly.

### Virtual Device List

| Virtual Device | Purpose | Appears in |
|---|---|---|
| Location | System commands (set variable, wait, notify, etc.) | Actions only |
| System Start | Fires when HA restarts — used with "event occurs" trigger | Triggers only |
| Time | Time-based conditions and triggers | Conditions, Triggers |
| Date | Date-based conditions | Conditions only |
| Mode | Check or trigger on HA input_select / zone mode changes | Conditions, Triggers |

**Location** appears first in the action device picker. When selected, the command list shows system commands (set variable, wait, log, call another piston, etc.) instead of hardware service calls. This is how WebCoRE structured system-level actions and PistonCore follows the same pattern.

**System Start** is the subject for the "event occurs" trigger — fires when HA restarts. User selects System Start as the device, operator is "event occurs", no value needed.

**Time** is the subject for time-based triggers and conditions:
- Trigger: "happens daily at" `[time value or $sunrise/$sunset with offset]`
- Condition: "is before", "is after", "is between" with time picker

**Date** is the subject for date-based conditions only:
- "is before", "is after", "is between" with date picker

**Mode** is the subject for HA mode checks:
- Reads from HA input_select or zone entities
- Operators: "is", "is not", "changes to"

### Device Picker Section Order

```
─ Virtual Devices ──────────────────
  Location
  System Start
  Time
  Date
  Mode
─ Physical Devices ─────────────────
  [area grouped device list]
─ Local Variables (Device type) ────
  [$varName — defined in this piston]
─ Global Variables (Device type) ───
  [@globalName]
─ System Variables ─────────────────
  [$currentEventDevice]
  [$device]
  [$devices]
```

### $sunrise / $sunset Offset

When a user picks `$sunrise` or `$sunset` as a value anywhere in the wizard, an offset row appears immediately below:

> `[+ / -]` `[number input]` `[minutes / hours]`

This allows expressions like "$sunset + 30 minutes" or "$sunrise - 1 hour".

Store as:
```json
{
  "__type": "system_var",
  "name": "$sunset",
  "offset": 30,
  "offset_unit": "minutes",
  "offset_direction": "+"
}
```

---

## Value Types — Three Modes

The value input in the condition/trigger wizard has three modes, selectable via a dropdown before the value input:

| Mode | When to use | What shows |
|---|---|---|
| Value | Simple static value (on, off, 70, "hello") | Dropdown or text input depending on attribute type |
| Variable | Reference a piston variable or system variable | Two-section picker: piston variables + system variables |
| Expression | Math, string concat, comparisons | Freeform textarea with result stub below |

**Variable mode** shows two sub-sections:
- Piston variables — defined in the define block (`$varName`)
- System variables — `$now`, `$sunrise`, `$sunset`, `$date`, `$time`, `$hour`, `$minute`, `$index`, etc.

When `$sunrise` or `$sunset` is selected in Variable mode, the offset row appears (see above).

**Expression mode** — v1 shows the textarea and a static "Result: (save to evaluate)" stub below. Real-time evaluation is a v2 feature.

---

## System Variables Reference

Available in the Variable picker and in expressions. All are read-only at runtime.

| Variable | Type | Description | HA equivalent |
|---|---|---|---|
| $currentEventDevice | device | Device that triggered the piston | Trigger entity_id |
| $previousEventDevice | device | Device that triggered the previous run | — |
| $device | device | Same as $currentEventDevice (shorthand) | Trigger entity_id |
| $devices | device list | All devices matching a condition | — |
| $now | datetime | Current date and time | `now()` |
| $date | date | Current date only | `now().date()` |
| $time | time | Current time only | `now().time()` |
| $hour | integer | Current hour (0–23) | `now().hour` |
| $minute | integer | Current minute (0–59) | `now().minute` |
| $second | integer | Current second (0–59) | `now().second` |
| $day | integer | Day of month | `now().day` |
| $month | integer | Month (1–12) | `now().month` |
| $year | integer | Year | `now().year` |
| $weekday | integer | Day of week (1=Monday) | `now().isoweekday()` |
| $sunrise | time | Today's sunrise time | `states.sun.sun.attributes.next_rising` |
| $sunset | time | Today's sunset time | `states.sun.sun.attributes.next_setting` |
| $midnight | time | Midnight (00:00:00) | Literal |
| $noon | time | Noon (12:00:00) | Literal |
| $index | integer | Loop counter in for/for each loops | Loop variable |
| $utc | datetime | Current UTC time | `utcnow()` |
| $longitude | number | Hub location longitude | `zone.home` attribute |
| $latitude | number | Hub location latitude | `zone.home` attribute |

**Note:** `$currentEventDevice`, `$previousEventDevice`, `$device`, `$devices` are PyScript-only in v1. They require runtime context tracking that native HA scripts cannot provide. If a user references these in a native-script-bound piston, show the PyScript conversion prompt.

---

## Complete Statement Type Reference

This is the authoritative list of all statement types PistonCore supports in v1.
Derived from the WebCoRE source code (piston.module.html). Every statement the wizard
can produce must appear here. The compiler handles exactly this list — no more, no less.

| Statement type | Editor keyword | Description | PyScript only? |
|---|---|---|---|
| `action` | `with {devices}` / `do` / `end with` | Execute one or more commands on a device or group | No |
| `do` | `do` / `end do` | A container block for grouping statements | No |
| `if` | `if` / `then` / `else if` / `else` / `end if` | Conditional execution with optional else branches | No |
| `switch` | `switch ({expr})` / `case` / `default` / `end switch` | Compare an expression against a list of values | No |
| `for` | `for ({start} to {end} step {step})` / `do` / `end for` | Repeat for a fixed number of iterations | No (simplified) |
| `for_each` | `for each ({var} in {list})` / `do` / `end for each` | Repeat for each device in a device group | No |
| `while` | `while` / `conditions` / `do` / `end while` | Repeat while a condition is true | No |
| `repeat` | `repeat` / `do` / `until` / `conditions` / `end repeat` | Repeat until a condition is true | No |
| `every` | `every {timer}` / `do` / `end every` | Execute on a time interval or schedule | No |
| `on_event` | `on events from` / `do` / `end on` | Execute when specific events fire inside a running script | **Yes** |
| `break` | `break` | Exit a loop early | **Yes** |
| `exit` | `exit {value}` | Stop piston execution, set piston state | No |
| `set_variable` | `do Set variable {name} = {value}` | Assign a value to a piston or global variable | No |
| `wait` | `do Wait {duration}` or `do Wait until {time}` | Pause execution | No |
| `wait_for_state` | `do Wait for state` | Pause until an entity reaches a state, with timeout | No |
| `log_message` | `do Log message {text}` | Write a message to the piston log | No |
| `call_piston` | `do Execute piston {name}` | Trigger another piston | No |
| `cancel_pending_tasks` | `do Cancel all pending tasks` | Cancel async tasks in flight | **Yes** |

**Note on `for` loop:** Native HA script `repeat: count:` supports count-based loops only.
Start ≠ 1 or step ≠ 1 forces a compiler warning and simplified output. For full for-loop
control the piston must compile to PyScript.

**Note on `every` statement:** The `every` statement compiles as a trigger in the
automation wrapper (time_pattern or cron-style trigger), not as a statement in the script
body. The compiler detects `every` at the top level and routes it to trigger compilation.

---

## Complete Operator Reference

This is the definitive operator list for PistonCore v1. Pulled from the WebCoRE source
and confirmed against the operator research done in Session 18. This list drives the
wizard's operator dropdown — the wizard shows exactly these operators, grouped and ordered
as specified.

### Condition Operators (no ⚡ — check current state)

| Operator | Extra input needed | Notes |
|---|---|---|
| is | Value | |
| is any of | Multi-value | |
| is not | Value | |
| is not any of | Multi-value | |
| is between | Two values | |
| is not between | Two values | |
| is even | None | Numeric only |
| is odd | None | Numeric only |
| was | Value + duration "In the last..." | |
| was any of | Multi-value + duration | |
| was not | Value + duration | |
| was not any of | Multi-value + duration | |
| changed | Duration only | |
| did not change | Duration only | |
| is equal to | Value | Numeric — same as "is" for non-numeric |
| is not equal to | Value | |
| is less than | Value | Numeric only |
| is less than or equal to | Value | Numeric only |
| is greater than | Value | Numeric only |
| is greater than or equal to | Value | Numeric only |

### Trigger Operators (⚡ — subscribe to events)

| Operator | Extra input needed | Notes |
|---|---|---|
| ⚡ changes | None | Any state change |
| ⚡ changes to | Value | |
| ⚡ changes to any of | Multi-value | |
| ⚡ changes away from | Value | |
| ⚡ changes away from any of | Multi-value | |
| ⚡ drops | None | Numeric — any drop |
| ⚡ drops below | Value | Numeric only |
| ⚡ drops to or below | Value | Numeric only |
| ⚡ rises | None | Numeric — any rise |
| ⚡ rises above | Value | Numeric only |
| ⚡ rises to or above | Value | Numeric only |
| ⚡ stays | Value + duration "For the next..." | |
| ⚡ stays equal to | Value + duration | |
| ⚡ stays any of | Multi-value + duration | |
| ⚡ stays away from | Value + duration | |
| ⚡ stays away from any of | Multi-value + duration | |
| ⚡ stays unchanged | Duration only | |
| ⚡ gets | Value | Button/event — receives a specific event |
| ⚡ gets any | None | Button/event — any event |
| ⚡ receives | Value | |
| ⚡ happens daily at | Time or $sunrise/$sunset + offset | Time virtual device |
| ⚡ event occurs | None | System Start virtual device |
| ⚡ is any and stays any of | Value + duration | |
| ⚡ is away and stays away from | Value + duration | |

### Duration Row Labels

- **`was`-type operators** (backward-looking — CONDITION): label = **"In the last..."**
- **`stays`-type operators** (forward-looking — TRIGGER): label = **"For the next..."**

This distinction is critical. See the `was` vs `stays` section for full behavioral detail.

---

## Location Virtual Device Commands

When the user selects "Location" in the action device picker, these system commands appear
instead of HA services. These are PistonCore-defined — not pulled from the HA service registry.

| Command | Parameters | HA native? | PyScript only? |
|---|---|---|---|
| Set variable | Variable picker + Value/Expression | ✅ Yes | No |
| Execute piston | Piston picker + optional Arguments | ✅ Yes | No |
| Set timezone | Timezone ID text input | ⚠️ Partial | No |
| Send push notification | Message + optional Title + optional Device | ✅ Yes | No |
| Log to console | Message + level (info/warn/error) | ✅ Yes | No |
| Make HTTP request | Method + URL + Content Type + optional Body | ⚠️ Partial | No |
| Send email | To + Subject + Body | ✅ Yes | No |
| Wait | Duration (ms/seconds/minutes/hours) | ✅ Yes | No |
| Set HA mode | Mode picker | ✅ Yes | No |
| Raise event | Event name + optional data | ✅ Yes | No |

**File system commands (Skip v1 — Hubitat specific):**
Write to file, Read from file, Append to file, Delete file — do not implement.

---

## Not Building in V1 — Wizard Skip List

These appear in WebCoRE but are explicitly excluded from v1. Do not build them:

| Feature | Reason | Future? |
|---|---|---|
| Physical vs Programmatic interaction | PyScript only, sandbox validation needed first | v2 |
| XOR group operator | Too rare — AND/OR only | Maybe v2 |
| `FOLLOWED BY` sequence trigger | No HA native equivalent | v2 PyScript |
| $weather variables | Requires HA weather integration — complex | v2 |
| $zipCode | No HA equivalent | No |
| Real-time expression evaluation | v2 feature | v2 |
| File read/write commands | Hubitat-specific, no HA equivalent | No |
| isPistonPaused() function | v2 | v2 |
| TCP/TEP advanced options | Not applicable to HA runtime | v2 |

## Open Items

These affect the wizard but are not yet decided:

1. **Which-interaction step feasibility** — requires sandbox validation before implementing. PyScript context tracking needs to be confirmed as reliable. See DESIGN.md Section 8.6.
2. **Collapse/expand for individual conditions inside an if block** — WebCoRE supported this. Include in v1 or defer?
3. **System variable availability in native script pistons** — currently defined as PyScript-only. Confirm whether any system variables are expressible in native YAML triggers/templates.
4. **Timer statement type** — WebCoRE had a Timer statement. May overlap with HA scheduler. Evaluate before implementing. See DESIGN.md Section 22.
5. **Simulator / step-through dry run** — WebCoRE had this. PistonCore v1 uses Test button. Full step-through is v2.
6. **"followed by" sequence operator** — excluded from v1 per DESIGN.md. No HA equivalent exists.
7. **Expression editor for advanced value inputs** — WebCoRE let advanced users type expressions. PistonCore v1 uses structured inputs only. Expression editor is v2.
8. **WIZARD_SPEC.md needs full update** — wizard output model still partially references old concepts. Full update to reflect structured JSON output model needed before wizard coding resumes.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
