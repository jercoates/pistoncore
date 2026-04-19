# PistonCore Wizard Specification

**Version:** 0.1
**Status:** Draft — For Developer Use
**Last Updated:** April 2026

This document defines the capability-driven wizard in full detail.
Read DESIGN.md and FRONTEND_SPEC.md first.
This document closes DESIGN.md Section 8.1 (Wizard Capability Map).

**Guiding rule:** Match WebCoRE's wizard behavior exactly where possible.
Deviation requires a specific documented reason.

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
  ⚡ changes (any value)

CONDITIONS — check current state
  is detected
  is clear
  was detected for at least [duration]
  was clear for at least [duration]
```

The user picks from either group. Their choice determines whether this comparison is a trigger
or a condition. The visual distinction makes this clear without requiring the user to understand
the technical difference.

### At the piston level

In the document, trigger statements are marked with ⚡ and appear in the TRIGGERS section.
Condition statements appear in the CONDITIONS section.

If a user adds a comparison in the TRIGGERS section, the wizard pre-selects the trigger group
in the operator step. If they add one in the CONDITIONS section, the wizard pre-selects the
conditions group. The user can override this.

### The "upgrade" behavior

If the user has built a piston with no triggers at all and tries to save, PistonCore shows a warning:

*"This piston has no triggers. It will never run automatically. Would you like to convert one of
your conditions to a trigger?"*

If the user clicks Yes, PistonCore shows the conditions list and lets them pick one to promote.
The promoted condition moves to the TRIGGERS section and its operator is updated to the
trigger-equivalent (e.g., "is detected" becomes "changes to detected").

This matches WebCoRE's behavior exactly and prevents a common new-user mistake.

---

## Capability Map — The Core Decision Tree

This is the map that drives wizard steps 3, 4, and 5.
Given a device's attribute type, this map defines valid operators and valid value input types.

The wizard reads this map to populate the operator dropdown and determine what input to show
for the right-hand value.

### Attribute Types and Their Operators

---

#### Binary — on/off, open/closed, detected/clear, active/inactive, locked/unlocked, wet/dry, present/not present

These devices have exactly two states. The actual state labels come from HA for the specific device
(do not hardcode "on/off" — fetch the real values).

**Trigger operators (⚡):**
| Operator | Value input |
|---|---|
| ⚡ changes to [state] | Dropdown of native states from HA |
| ⚡ changes from [state] | Dropdown of native states from HA |
| ⚡ changes from [state] to [state] | Two dropdowns of native states |
| ⚡ changes (any) | No value input needed |

**Condition operators:**
| Operator | Value input |
|---|---|
| is [state] | Dropdown of native states from HA |
| is not [state] | Dropdown of native states from HA |
| was [state] for at least [duration] | Dropdown of native states + duration picker |
| was [state] for less than [duration] | Dropdown of native states + duration picker |

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

These devices have more than two named states. The state list comes from HA for the specific device.

**Trigger operators (⚡):**
| Operator | Value input |
|---|---|
| ⚡ changes to [state] | Dropdown of native states from HA |
| ⚡ changes from [state] | Dropdown of native states from HA |
| ⚡ changes from [state] to [state] | Two dropdowns of native states |
| ⚡ changes (any) | No value input needed |

**Condition operators:**
| Operator | Value input |
|---|---|
| is [state] | Dropdown of native states from HA |
| is not [state] | Dropdown of native states from HA |
| is any of [states] | Multi-select dropdown of native states |
| is not any of [states] | Multi-select dropdown of native states |
| was [state] for at least [duration] | Dropdown of native states + duration picker |

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

Note: Geofence is handled naturally through changes-to on person/zone entity. No special geofence operator needed.

---

#### HA Boolean Helper — input_boolean

These are the only devices that use Yes/No language. All other binary devices use their native state labels.

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
"Any of (Smoke Detectors)'s smoke changes to detected"
"All of (Door Contacts) are closed"

This matches WebCoRE's multi-device comparison behavior exactly.

---

## Right-Hand Value Input Types

These are the input types the wizard shows in the final step based on the operator selected:

| Input type | When used | What it shows |
|---|---|---|
| Native state dropdown | Binary, enum operators | Dropdown populated from HA's reported states for that device |
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

**Action wizard steps:**
1. Pick the device — same type-to-filter picker as conditions
2. Pick the command/service — list fetched live from HA for that device
3. Configure parameters — fields generated from HA's service schema for that command

**Parameter input types by command:**

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

All parameter options are fetched from HA's service schema for that specific service.
PistonCore never hardcodes parameter lists — HA is always the source of truth.
If HA returns no schema for a service, show the raw key/value editor as fallback.

---

## Wizard Plain English Sentence — Full Examples

The sentence at the top of the wizard builds as the user selects each step.

**Condition example:**
- Step 1: *"When..."*
- Step 2: *"When Front Door..."*
- Step 3: *"When Front Door's contact..."*
- Step 4: *"When Front Door's contact ⚡ changes to..."*
- Step 5: *"When Front Door's contact ⚡ changes to open"*

**Multi-device condition example:**
- Step 1: *"When..."*
- Step 2: *"When any of (Smoke Detectors)..."*
- Step 3: *"When any of (Smoke Detectors)'s smoke..."*
- Step 4: *"When any of (Smoke Detectors)'s smoke ⚡ changes to..."*
- Step 5: *"When any of (Smoke Detectors)'s smoke ⚡ changes to detected"*

**Action example:**
- Step 1: *"Turn..."*
- Step 2: *"Turn Driveway Main Light..."*
- Step 3: *"Turn Driveway Main Light on at 75% brightness"*

---

## How Attribute Type Is Determined

The wizard determines the attribute type from the HA capability data returned for the device.
This drives which operator set to show.

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

This detection runs in the backend when capability data is fetched from HA.
The frontend receives the attribute type alongside the capability data and uses it to select the operator set.

---

## Wizard Internal State

While the wizard is open, it maintains this state object:

```json
{
  "context": "trigger | condition | action",
  "step": 3,
  "selections": {
    "subject_type": "device",
    "device_id": "abc123",
    "device_label": "Front Door",
    "capability": "contact",
    "attribute_type": "binary",
    "native_states": ["open", "closed"],
    "aggregation": null,
    "operator_group": "trigger",
    "operator": "changes to",
    "value": "open"
  },
  "sentence": "When Front Door's contact changes to open"
}
```

On Done, this state is converted to a condition object or statement node and inserted into the piston tree.
On Cancel, this state is discarded.

---

## Condition Object — Final Output of the Wizard

When the wizard completes a condition or trigger, it produces a condition object:

```json
{
  "id": "cond_001",
  "type": "trigger | condition",
  "subject": {
    "type": "device",
    "role": "front_door",
    "capability": "contact",
    "attribute_type": "binary"
  },
  "aggregation": "any | all | none | null",
  "operator": "changes to",
  "value": "open",
  "duration": null,
  "group_operator": "AND"
}
```

`type: "trigger"` → ⚡ icon, appears in TRIGGERS section, creates HA event subscription
`type: "condition"` → no icon, appears in CONDITIONS section or inside if_block.condition

`group_operator` is `AND` or `OR` — applies to this condition's relationship with the next
condition in the array. Omit on the last condition.

---

## No-Trigger Warning — The Upgrade Flow

If the user saves a piston with no triggers defined:

**Step 1 — Warning banner on status page:**
"⚠ This piston has no triggers. It will never run automatically."

**Step 2 — Offer to upgrade:**
"Would you like to promote one of your conditions to a trigger?"
[Yes — show me] [No — I'll add a trigger manually]

**Step 3 — If Yes:**
Show the piston's conditions. User picks one.
PistonCore converts it:
- Moves it to the TRIGGERS section
- Changes its type from "condition" to "trigger"
- Updates the operator to the trigger-equivalent (e.g., "is open" → "changes to open")
- Shows the updated piston with the promoted trigger highlighted

This matches WebCoRE's behavior exactly.

---

## Simple vs Complex Mode — Wizard Differences

**Simple mode wizard:**
- Does not show piston variable picker in value inputs
- Does not show loop statement types (Repeat, For Each)
- Does not show Wait for State action
- Does not show Call Another Piston action
- Does not show TEP/TCP cog options (cog icon still present but those options are hidden)
- Duration operators are available (they compile to HA native `for:` in YAML)

**Advanced mode wizard:**
- Shows everything

**YAML → PyScript promotion inside the wizard:**
If a user in Simple mode tries to select an operator that forces PyScript (e.g., "was detected for at least"), PistonCore shows a prompt before proceeding:
"This option requires converting your piston to a Complex piston (PyScript). Your logic will be preserved. Continue?"
[Yes, convert] [No, pick something else]

If they confirm, the piston's compile target updates and the wizard continues.

---

## What the Backend Must Provide for the Wizard

The wizard frontend makes these backend calls during the wizard flow:

| Step | Backend call | Returns |
|---|---|---|
| Device picker | `GET /api/devices` | All devices with id, friendly name, area, domain |
| Capability picker | `GET /api/device/{id}/capabilities` | List of capabilities with name, attribute_type, native_states |
| Trigger operators | Derived from attribute_type | No backend call — wizard uses the capability map in this document |
| Condition operators | Derived from attribute_type | No backend call — wizard uses the capability map in this document |
| Value input for native states | Included in capabilities response | native_states array |
| Service picker (actions) | `GET /api/device/{id}/services` | List of services with name, label, schema |
| Service parameters | Included in services response | Parameter schema with types, min, max, options |

The capability map in this document is implemented in the frontend.
The backend provides raw HA data. The frontend applies the map to determine operators and input types.

---

## Open Items

These affect the wizard but are not yet decided:

1. **Collapse/expand for individual conditions inside an if block** — WebCoRE supported this. Include in v1 or defer?
2. **Simulator / step-through dry run** — WebCoRE had this. For PistonCore, the Test button covers most of this need. Full step-through is a v2 feature.
3. **"followed by" sequence operator** — excluded from v1 per DESIGN.md. No HA equivalent exists.
4. **Expression editor for advanced value inputs** — WebCoRE let advanced users type expressions. PistonCore v1 uses structured inputs only. Expression editor is v2.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
