# CAPABILITY_DETECTION_TABLE.md — Picker Capability Detection

**Version:** 1.0 (June 2026)
**Status:** Authoritative spec for how the picker translates HA device signals into
WebCoRE attribute keys to build the capability menu.

**Companion files:**
- `picker_capability_map.json` — the machine-readable lookup table the picker loads at runtime
- `pistoncore_attribute_translation.json` — REVERSE direction (WebCoRE key → HA source) for compiler use
- `PistonCore_HA_to_WebCoRE_Attribute_Map.md` — human-readable version of the attribute map

**Scope:** Build-time only. The picker reads HA declaration data to decide what to OFFER.
This is not about reading current state values (that is the compiler's job using
pistoncore_attribute_translation.json). Detection uses only declaration-surface data:
domain, device_class, supported_color_modes, supported_features, and which attributes
are present on the entity — never transient state values.

---

## The core problem this solves

HA and WebCoRE use completely different names and structures. HA has domains like
`binary_sensor` with a `device_class` of `motion`. WebCoRE calls that capability `motion`.
The picker pulls live capability data from HA, but the menus it builds come from
`webcore_vocab.json` which uses WebCoRE names. This table is the bridge.

---

## Algorithm — how the picker uses this table

For each selected device, the backend forwards all entities linked to that device with
their domain, device_class, supported_color_modes, supported_features, and declaration
attributes. The picker runs this algorithm:

```
collected_keys = []

for each entity in device.entities:
    domain_rules = picker_capability_map.domains[entity.domain]
    if not domain_rules: continue

    // Step 1: always-on keys for this domain
    if domain_rules.always:
        collected_keys += domain_rules.always.attributes

    // Step 2: device_class lookup
    if entity.device_class and domain_rules.by_device_class[entity.device_class]:
        collected_keys += domain_rules.by_device_class[entity.device_class].attributes

    // Step 3: supported_color_modes (lights only — may be a list, union all matches)
    if entity.supported_color_modes and domain_rules.by_supported_color_modes:
        for mode in entity.supported_color_modes:
            if domain_rules.by_supported_color_modes[mode]:
                collected_keys += domain_rules.by_supported_color_modes[mode].attributes

    // Step 4: supported_features integer bits
    if entity.supported_features and domain_rules.by_supported_features:
        for feature_name, rule in domain_rules.by_supported_features:
            if entity.supported_features & rule.bit:
                collected_keys += rule.attributes

    // Step 5: declaration attributes (keys present in entity.attributes)
    if domain_rules.by_declaration_attr:
        for attr_name, rule in domain_rules.by_declaration_attr:
            if attr_name in entity.attributes:
                collected_keys += rule.attributes

device_keys = deduplicate(collected_keys)
```

Then across multiple devices:
```
final_keys = intersection of device_keys across all selected devices
```

`final_keys` drives the menu. Each key maps to a WebCoRE vocab entry in
`webcore_vocab.json`.

---

## Special key: speak_gate

`speak_gate` is returned by `media_player` + `SUPPORT_PLAY_MEDIA (bit 512)`. It is NOT
a WebCoRE attribute and does NOT appear in the picker menu. It is a flag consumed
exclusively by the Speak author-time gate check (EDITOR_WIZARD_SPEC.md §7.5): if all
devices return `speak_gate`, the wizard offers "Speak text" as a task type. Filter it
out before building the attribute menu.

---

## Domain reference

### binary_sensor
Entirely device_class driven. No always-on attributes. If `device_class` is null or
unrecognized, no attributes are offered for this entity. Common classes:

| device_class | WebCoRE keys | status |
|---|---|---|
| motion | motion | verified |
| door, window, opening, garage_door | contact | verified |
| moving | acceleration | verified |
| vibration | acceleration, shock | assumed |
| tamper | tamper, shock | verified / assumed |
| sound | sound | assumed |
| moisture | water | verified |
| smoke | smoke | verified |
| carbon_monoxide, gas | carbonMonoxide | verified |
| touch | touch | assumed |
| sleep | sleeping | assumed |
| battery | battery | verified |

### sensor
Entirely device_class driven. Special case: `lqi` has no standard device_class; match
by unit (`lqi`) as a fallback when device_class is null.

| device_class | WebCoRE keys | status |
|---|---|---|
| humidity | humidity | verified |
| temperature | temperature | verified |
| illuminance | illuminance | verified |
| battery | battery | verified |
| carbon_dioxide | carbonDioxide | verified |
| energy | energy | verified |
| power | power | verified |
| voltage | voltage | verified |
| sound_pressure | soundPressureLevel | assumed |
| uv_index | ultravioletIndex | verified |
| ph | pH | assumed |
| signal_strength | rssi | assumed |
| distance | distance, distanceMetric | assumed |
| speed | speedMetric, speed | assumed |
| orientation | orientation | assumed |

### light
Always: `switch`. Then use `supported_color_modes` list (preferred, HA 2022.5+). If
`supported_color_modes` is absent or empty, fall back to `supported_features` integer bits.
A light may list multiple color modes — union all matching attribute sets.

| signal | WebCoRE keys | status |
|---|---|---|
| always | switch | verified |
| mode: brightness | level | verified |
| mode: color_temp | level, colorTemperature | verified |
| mode: hs | level, color, hue, saturation, hex | verified |
| mode: rgb | level, color, hex | verified |
| mode: rgbw | level, color, hex | verified |
| mode: rgbww | level, color, hex | verified |
| mode: xy | level, color, hex | assumed |
| mode: white | level | verified |
| mode: onoff | (none beyond switch) | verified |
| legacy bit 1 (BRIGHTNESS) | level | assumed |
| legacy bit 2 (COLOR_TEMP) | colorTemperature | assumed |
| legacy bit 16 (COLOR) | color, hue, saturation, hex | assumed |

### switch
Always: `switch`. No sub-rules.

### fan
Always: `switch`. `supported_features bit 1` (SUPPORT_SET_SPEED) → `level`.

### cover
device_class determines the primary attribute. `supported_features bit 4`
(SUPPORT_SET_POSITION) → `level` regardless of class.

| device_class | WebCoRE keys | status |
|---|---|---|
| garage, gate, door | door | verified / assumed |
| shade, blind, curtain, awning, shutter | windowShade | verified / assumed |
| + SUPPORT_SET_POSITION (bit 4) | level | verified |

### valve
Always: `valve`.

### lock
Always: `lock`.

### climate
Always: `thermostatMode`, `thermostatOperatingState`. Declaration attributes add more:

| declaration attr present | WebCoRE keys | status |
|---|---|---|
| current_temperature | temperature | verified |
| fan_mode | thermostatFanMode | verified |
| target_temp_high | coolingSetpoint | verified |
| target_temp_low | heatingSetpoint | verified |
| temperature | thermostatSetpoint | verified |
| current_humidity | humidity | verified |

### media_player
Always: `status`. Supported_features bits add more:

| signal | WebCoRE keys | status |
|---|---|---|
| always | status | verified |
| bit 4 (VOLUME_SET) | level | verified |
| bit 8 (VOLUME_MUTE) | mute | verified |
| bit 512 (PLAY_MEDIA) | speak_gate (not a menu item) | verified |
| media_title in attrs | trackDescription, trackData | verified |

### device_tracker / person
Always: `presence`. If `latitude` is in declaration attributes, offer the GPS group.

### alarm_control_panel / siren
Always: `alarm` (assumed).

### timer
Always: `sessionStatus`, `timeRemaining` (assumed).

### event
button class → `button`. doorbell class → `button` (assumed).

### camera
Always: `image` (assumed).

---

## Assumed-row reconciliation checklist

These mappings need behavioral verification on deploy. Mark verified once confirmed:

- `vibration` binary_sensor → `shock` (is vibration device_class used for shock in practice?)
- `tamper` → `shock` in addition to `tamper` (does it map to both?)
- `sound` binary_sensor → `sound`
- `touch` binary_sensor → `touch`
- `sleep` binary_sensor → `sleeping`
- Light `xy` mode → `color, hex`
- Light legacy supported_features bits (older HA only — prefer supported_color_modes)
- `alarm_control_panel` / `siren` → `alarm`
- `timer` → `sessionStatus`, `timeRemaining`
- `fan` SUPPORT_SET_SPEED bit value (confirm it is bit 1 in current HA)
- `input_boolean` → `switch`
- `input_number` → `level`
- GPS group on device_tracker (confirm latitude presence is the right gate)

---

## n/a attributes — not offered in picker

These 16 WebCoRE attributes have no HA entity source and must not appear in the picker
menu as device comparison surfaces. They are passthrough-only if ever needed:

activities, currentActivity, indicatorStatus, phraseSpoken, eta, floor, arrivingAtPlace,
leavingAtPlace, closestPlace, closestPlaceDistance, closestPlaceDistanceMetric,
previousPlace, places, goal, steps, schedule
