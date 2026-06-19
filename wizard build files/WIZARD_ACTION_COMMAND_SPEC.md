# Wizard Action Command Picker — Spec

**Scope:** How the action command picker derives commands, presents them, gates them across multiple devices, resolves parameter value inputs, and writes the action node. This spec governs Screen W-6 (Command Picker) and the action commit path (`_saveDeviceCmd`).

**Status:** Codeable. The WebCoRE translation table (Part 4) is built from authoritative source (`ady624/webCoRE/smartapps/ady624/webcore.src/webcore.groovy`, preserved as `webcore_source_reference.groovy`). No invented content.

**Trust order (from project rule):** running code and WebCoRE source first; this spec and the ledgered action specs second; older specs last. Where this spec and code disagree on the **picker selection layer**, the code wins and this spec is flagged for update. Where they disagree on **command sourcing/presentation**, this spec is the intent and the code is to be changed.

---

## Part 1 — Core Principle

The wizard presents **WebCoRE commands**, gated by **live HA device capabilities**. HA service names never appear in the wizard or in the JSON the editor writes. The compiler maps each WebCoRE command to its HA service at compile time.

This makes WebCoRE piston import name-clean: PistonCore uses WebCoRE's exact command and attribute vocabulary (see Part 4), so an imported piston's command names match what the wizard shows.

**Two halves of the command table:**
1. **Device half (generated at runtime):** HA reports each adopted device's capabilities live. The backend already builds this from entity state attributes (`ha_client.get_capabilities`). This is NOT authored — it is generated per-install from HA, exactly as Hubitat/SmartThings generated WebCoRE's device DB.
2. **Vocabulary half (static, from WebCoRE source):** the capability→command→parameter definitions in Part 4. Fixed, authored once from WebCoRE's own source.

The picker joins these two halves at the command screen.

---

## Part 2 — Command Sourcing (the central change)

### Current (wrong) behavior
The action picker calls `API.getServices(entity_id)` and lists raw HA services with their full optional field lists. Because HA collapses commands into services (`light.turn_on` carries `brightness`, `rgb_color`, `color_temp` as optional fields), the menu shows color/brightness on a plain on/off action. **This is the defect.**

### Required behavior
The action command list is derived from **device capabilities** (`API.getCapabilities`), not services.

1. After device picking is complete, fetch capabilities for the selected devices (same call and timing the condition side already uses — see `_loadCapsIntoSelect`).
2. For each capability present, look up its WebCoRE commands from the Part 4 table.
3. Present those WebCoRE commands. `on`/`off` are their own commands with no parameters. `set level`, `set color`, etc. appear only when the backing capability is present.

`get_services` is deprecated for the action command list. (It may remain for other purposes, but the command menu does not read it.)

### Why this is safe for the picker
This change adds a capability→command layer **on top of** the frozen selection. It does not touch device selection. See Part 5 (firewall).

---

## Part 3 — Multi-Device Rule: Intersection-Only

When multiple devices are selected (directly, or via a device variable/global that resolves to multiple devices), a command appears **only if every selected device supports it**. If any selected device lacks the capability, the command does not appear.

There is **no partial group.** WebCoRE's Common/Partial split (WEBCORE_WIZARD_MAP.md Part 30) is intentionally NOT implemented.

**Workaround for subsets:** to act on a subset, split devices into separate device variables/defines — one per capability group. Each variable's intersection then exposes the commands its members share.

> **DEVIATION — see HELP_AND_DEVIATIONS_PROTO.md D-1.** This overrides WebCoRE Part 30. Documented so it is not "fixed" back to WebCoRE behavior. Jeremy never hit the partial case when writing real pistons.

**Implementation note:** the action command path already intersects across selected device groups (`intersectedNames` in `wizard-action.js`). That intersection IS this rule. The change is that it must intersect over **capabilities** (where "set level" is a distinct capability four-of-six devices may have), not over **services** (where all six "have" `turn_on` and the difference is hidden in fields). Pointing the existing intersect at capabilities makes intersection-only correct AND makes the subset workaround function.

---

## Part 4 — WebCoRE Translation Table (authoritative)

Source: `webcore.groovy` capability map (`capabilities()`), attribute map (`attributes()`), command map (`commands()`). Preserved verbatim in `webcore_source_reference.groovy`.

### 4.1 Capability → WebCoRE command list

Each row: WebCoRE capability key, display name (`n`), backing attribute (`a`), commands (`c`). The HA-capability column is the join key from the backend's `get_capabilities` output. (HA mapping is by attribute/domain; verify against live backend output per Part 6.)

| WebCoRE capability | Display name | Attribute | Commands |
|---|---|---|---|
| `switch` / `light` / `bulb` / `outlet` / `relaySwitch` | Switch / Light / Bulb / Outlet | `switch` | `on`, `off` |
| `switchLevel` | Switch Level | `level` | `setLevel` |
| `colorControl` | Color Control | `color` | `setColor`, `setHue`, `setSaturation` |
| `colorTemperature` | Color Temperature | `colorTemperature` | `setColorTemperature` |
| `infraredLevel` | Infrared Level | `infraredLevel` | `setInfraredLevel` |
| `lock` | Lock | `lock` | `lock`, `unlock` |
| `lockOnly` | Lock Only | `lock` | `lock` |
| `doorControl` / `garageDoorControl` | Door / Garage Door Control | `door` | `close`, `open` |
| `valve` | Valve | `valve` | `close`, `open` |
| `windowShade` | Window Shade | `windowShade` | `close`, `open`, `presetPosition` |
| `alarm` | Alarm | `alarm` | `off`, `strobe`, `siren`, `both` |
| `momentary` | Momentary | — | `push` |
| `tone` | Tone | — | `beep` |
| `imageCapture` | Image Capture | `image` | `take` |
| `thermostat` | Thermostat | `thermostatMode` | `auto`, `cool`, `emergencyHeat`, `fanAuto`, `fanCirculate`, `fanOn`, `heat`, `off`, `setCoolingSetpoint`, `setHeatingSetpoint`, `setSchedule`, `setThermostatFanMode`, `setThermostatMode` |
| `thermostatCoolingSetpoint` | Thermostat Cooling Setpoint | `coolingSetpoint` | `setCoolingSetpoint` |
| `thermostatHeatingSetpoint` | Thermostat Heating Setpoint | `heatingSetpoint` | `setHeatingSetpoint` |
| `thermostatFanMode` | Thermostat Fan Mode | `thermostatFanMode` | `fanAuto`, `fanCirculate`, `fanOn`, `setThermostatFanMode` |
| `thermostatMode` | Thermostat Mode | `thermostatMode` | `auto`, `cool`, `emergencyHeat`, `heat`, `off`, `setThermostatMode` |
| `musicPlayer` | Music Player | `status` | `mute`, `nextTrack`, `pause`, `play`, `playTrack`, `previousTrack`, `restoreTrack`, `resumeTrack`, `setLevel`, `setTrack`, `stop`, `unmute` |
| `audioNotification` | Audio Notification | — | `playText`, `playTextAndResume`, `playTextAndRestore`, `playTrack`, `playTrackAndResume`, `playTrackAndRestore` |
| `speechSynthesis` | Speech Synthesis | — | `speak` |
| `notification` | Notification | — | `deviceNotification` |
| `mediaController` | Media Controller | `currentActivity` | `startActivity`, `getAllActivities`, `getCurrentActivity` |
| `timedSession` | Timed Session | `sessionStatus` | `cancel`, `pause`, `setTimeRemaining`, `start`, `stop` |
| `indicator` | Indicator | `indicatorStatus` | `indicatorNever`, `indicatorWhenOn`, `indicatorWhenOff` |
| `consumable` | Consumable | `consumableStatus` | `setConsumableStatus` |
| `configuration` | Configuration | — | `configure` |
| `refresh` | Refresh | — | `refresh` |
| `polling` | Polling | — | `poll` |

Sensor-only capabilities (no `c:` array — `motionSensor`, `contactSensor`, `temperatureMeasurement`, `presenceSensor`, `waterSensor`, `smokeDetector`, `battery`, `illuminanceMeasurement`, etc.) expose **no commands** — they are condition subjects only, not action targets.

### 4.2 Attribute definitions (value types / options / ranges / units)

These define how a command's parameter value input renders (Part 5 tier resolution), and the value set for enum attributes. From `attributes()`.

| Attribute | Type | Options / Range | Unit |
|---|---|---|---|
| `level` | integer | 0–100 | % |
| `hue` | integer | 0–360 | ° |
| `saturation` | integer | 0–100 | % |
| `colorTemperature` | integer | 1000–30000 | °K |
| `infraredLevel` | integer | 0–100 | % |
| `switch` | enum | `on`, `off` | — |
| `contact` | enum | `closed`, `open` | — |
| `door` | enum | `closed`, `closing`, `open`, `opening`, `unknown` | — |
| `lock` | enum | `locked`, `unlocked`, `unknown`, `unlocked with timeout` | — |
| `motion` | enum | `active`, `inactive` | — |
| `alarm` | enum | `both`, `off`, `siren`, `strobe` | — |
| `mute` | enum | `muted`, `unmuted` | — |
| `carbonMonoxide` | enum | `clear`, `detected`, `tested` | — |
| `consumableStatus` | enum | `good`, `maintenance_required`, `missing`, `order`, `replace` | — |
| `color` | color | (color picker) | — |
| `thermostatMode` | enum | (device-reported modes) | — |

### 4.3 Command parameter definitions

Each command's parameters (`p:`) and display string (`d:`). Parameter types reference 4.2 attributes for their input rendering and range. From `commands()`.

| Command | Display | Parameters (name : type) |
|---|---|---|
| `on` / `off` | Turn on / Turn off | *(none)* |
| `setLevel` | Set level to {0}%{1} | Level : `level` (0–100 %); *opt* Only if switch is : enum on/off |
| `setColor` | Set color to {0}{1} | Color : `color`; *opt* Only if switch is : enum on/off |
| `setHue` | Set hue to {0}°{1} | Hue : `hue` (0–360°); *opt* Only if switch is : enum on/off |
| `setSaturation` | Set saturation to {0}{1} | Saturation : `saturation` (0–100 %); *opt* Only if switch is : enum on/off |
| `setColorTemperature` | Set color temperature to {0}°K{1} | Color Temperature : `colorTemperature` (1000–30000); *opt* Only if switch is : enum on/off |
| `setInfraredLevel` | Set infrared level to {0}%{1} | Level : `infraredLevel`; *opt* Only if switch is : enum on/off |
| `lock` / `unlock` | Lock / Unlock | *(none)* |
| `open` / `close` | Open / Close | *(none)* |
| `setCoolingSetpoint` | Set cooling point at {0} | Desired temperature : `thermostatSetpoint` |
| `setHeatingSetpoint` | Set heating point at {0} | Desired temperature : `thermostatSetpoint` |
| `setThermostatMode` | Set thermostat mode to {0} | Thermostat mode : `thermostatMode` (enum) |
| `setThermostatFanMode` | Set fan mode to {0} | Fan mode : `thermostatFanMode` (enum) |
| `speak` | Speak "{0}" | Message : string |
| `playText` | Speak text "{0}" | Text : string; *opt* Volume : `level` |
| `playTrack` | Play track {0}{1} | Track URL : uri; *opt* Volume : `level` |
| `deviceNotification` | (notification) | Message : string |
| `startActivity` | Start activity "{0}" | Activity : string |
| `setTimeRemaining` | Set remaining time to {0}s | Remaining time [seconds] : number |
| `presetPosition` | Preset position | *(none)* |
| `push` / `beep` / `take` / `configure` / `refresh` / `poll` | (momentary) | *(none)* |

**Decision (resolved from source):** command parameters use **fixed ranges from WebCoRE's attribute defs** (4.2), NOT live per-device ranges. WebCoRE itself used fixed ranges (`level` always 0–100). The wizard does the same.

The full command set (including advanced/transition commands like `fadeLevel`, `setAdjustedColor`, `toggleLevel`, `setAdjustedHSLColor`) is in `webcore_source_reference.groovy`. The table above covers the v1 device-command surface; advanced commands are added from the same source as needed without re-deriving.

---

## Part 5 — Value Input Resolution (three-tier, for command params AND condition values)

For any value the user must supply (a command parameter, a condition comparison value), the input widget is resolved in three tiers, keyed to HA's universal entity shape (state + attributes):

**Tier 1 — Enumerated by source or HA.** If the parameter's type maps to a 4.2 attribute with an options list, OR the live entity carries a companion list attribute (`hvac_modes`, `preset_modes`, `options`, `effect_list`, `source_list`, the `*_list` convention), render a **dropdown** of those options.

**Tier 2 — Inferred type.** Numeric with range → number widget with min/max/unit from 4.2. Binary → on/off. Color → color picker. Duration → number + unit.

**Tier 3 — Unknown (escape hatch — mandatory).** If neither a known option list nor an inferable type is present, render a **free operand input** (the WebCoRE "everything else → plain text" fallthrough). Seed it with the entity's **current `state` value** as a hint (e.g. "currently: person"). This guarantees no attribute is ever uncompletable.

> Tier 3 is the unknowns lock. Any integration — seen or unseen — lands in one of the three tiers because every HA entity is a state object with attributes. Example: UniFi camera `smartDetectType` with no option list → Tier 3, user types/selects `person`, hinted by current state.
>
> **Note (HA is nicer than WebCoRE here):** UniFi Protect in HA exposes per-object detection as separate binary_sensors (`binary_sensor.<cam>_detections_person`). So person-detection is usually a plain binary_sensor condition, not a typed-string match. Capture for help — see HELP_AND_DEVIATIONS_PROTO.md.

---

## Part 6 — Backend Requirement (ha_client.py)

For Tier 1 to be broad, the backend must **forward HA's companion list attributes** to the wizard. This is pure HA-truth reporting (within the "backend reports, never editorializes" rule).

**Current gap (identified in `ha_client._fetch_capabilities`):** the per-attribute capability walk hard-codes `"options": None` and **skips list-valued attributes** (`isinstance(attr_value, list) → continue`). This drops `hvac_modes`, `preset_modes`, `effect_list`, `source_list`, so only the primary state cap gets options.

**Required change:** when an attribute has a companion list (e.g. `<x>` paired with `<x>_modes`/`<x>_list`/`options`), attach that list as the capability's `options` instead of skipping it. The current `state` value is already returned and is used for the Tier 3 hint.

This is the only backend change this spec requires.

---

## Part 7 — Picker Firewall (do not break)

The change in Parts 2–3 is a read/derive layer **on top of** the frozen device-selection core. The following are **frozen** — callable, not modifiable:

- `sel.tokens` — selection tracking
- `_groupDevices` — grouping by HA device_id, primary-entity-by-domain-priority
- `_getGroupedEntityIdsForTokens` — tokens → entity_ids per device group
- `_getFlatEntityIds` — flat resolution
- `_capEntityMap` model — attribute → correct entity_id per device group
- the row `data-id` (comma-joined) / `ids.some(id => selTokens.has(id))` highlight / click contract
- `role` / `role_tokens` / `entity_ids` write separation

The capability/command derivation runs at command-screen open over the **already-final** grouped selection — exactly the position `_loadCapsIntoSelect` occupies for conditions. It consumes the frozen result; it never re-resolves devices or alters selection.

**If a task seems to require changing a frozen item:** stop, state in plain English what and why, confirm the rationale does not apply, before proceeding.

---

## Part 8 — Commit (`_saveDeviceCmd`)

The action node is written by the editor (editor owns the JSON; compiler only reads).

- **Command:** the WebCoRE command name (Part 4), NOT an HA service string. No `ha_service` field is written by the wizard — the compiler derives the HA service at compile time.
- **Parameters:** per Part 4.3, values captured from the rendered widgets (Part 5).
- **entity_ids:** because intersection-only (Part 3) guarantees every selected device supports the chosen command, **all selected devices' entity_ids are written** (the per-command domain-filter the current code does via `_findCommandDomain`/`getServices` is no longer needed — intersection already guarantees validity). Resolve via the frozen grouped result.
  - **Decision (resolved):** write all-selected entity_ids, not per-command-filtered. Intersection-only makes them equivalent; all-selected is simpler and removes the service-derived domain filter.
- **role / role_tokens:** unchanged from current behavior — friendly label and raw tokens preserved for edit round-trip.

---

## Part 9 — Round-Trip Gate (acceptance test)

Before/after any change in this spec, verify the load-bearing invariant for the cases that broke before:

1. Single device action — on/off shows NO color/level fields.
2. Color-capable light — `set color` / `set level` appear and render correct widgets.
3. Multi-device (mixed capability) — only intersection commands appear; subset reachable via two device variables.
4. Variable/global device selection — commands derive correctly from resolved devices.
5. Save → reopen each in editor → re-highlight correct, written `entity_ids` / `role` / `role_tokens` byte-identical, no ghost/duplicated nodes.

This gate specifically protects the picker per Part 7.

---

## Open Items

- **None blocking.** Translation table (Part 4) is real and sourced. Both commit decisions resolved from source (Part 4.3, Part 8). Backend change (Part 6) is identified and located.
- **Follow-on (not blocking this spec):** populate advanced/transition commands (Part 4.3) from `webcore_source_reference.groovy` as features require; confirm the HA-capability ↔ WebCoRE-capability join keys against live backend output (Part 4.1) during implementation.
