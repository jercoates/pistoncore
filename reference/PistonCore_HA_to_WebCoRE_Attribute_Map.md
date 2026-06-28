# PistonCore — Home Assistant → WebCoRE Attribute Map (Complete)

*All 90 attributes from webcore_vocab.json · v2.0*

## Purpose & Scope

Complete attribute reference for the PistonCore wizard/editor lane. Every WebCoRE attribute
name, type, value set, and unit is taken verbatim from webcore_vocab.json (the locked
completeness target: 90 attributes). The HA source column maps each WebCoRE attribute to the
Home Assistant entity state or attribute it reads from.

Naming/semantics reference only. Does not define JSON structure, compiler behavior, or
service-call YAML. The JSON stores intent using these WebCoRE names; the compiler translates
to HA at execution time.

**Companion file:** `pistoncore_attribute_translation.json` — machine-readable version of
this same mapping, structured for programmatic use.
**Picker file:** `picker_capability_map.json` — REVERSE lookup (HA signal → WebCoRE key),
used by the picker at build time. See `CAPABILITY_DETECTION_TABLE.md` for the spec.

## How to read the Map column

- **verified** — Standard, well-established HA–WebCoRE mapping. Safe to rely on.
- **assumed** — Plausible mapping but not fully verified against HA integration behavior.
  Reconcile before treating as a decision.
- **n/a** — No Home Assistant equivalent. WebCoRE-internal (place math, schedules) or
  location/fitness features with no HA entity attribute. Do not expose as an HA comparison
  surface; passthrough only if ever needed.

*Coverage: 44 verified · 30 assumed · 16 no HA equivalent.*

---

## Attributes by Functional Group

### Switching

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **switch** | enum | off / on | | switch / light / fan / outlet state | verified |

### Lighting

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **color** | color | | | light attr 'rgb_color' / 'hs_color' | verified |
| **colorTemperature** | integer | 1000 … 30000 | °K | light attr 'color_temp_kelvin' | verified |
| **hex** | hexcolor | | | light attr 'rgb_color' → hex | assumed |
| **hue** | integer | 0 … 360 | ° | light attr 'hs_color'[0] | verified |
| **infraredLevel** | integer | 0 … 100 | % | light/camera IR level | assumed |
| **level** | integer | 0 … 100 | % | light 'brightness' / fan 'percentage' / cover 'position' / media 'volume_level' | verified |
| **saturation** | integer | 0 … 100 | % | light attr 'hs_color'[1] | verified |

### Climate

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **coolingSetpoint** | decimal | -127 … 127 | °? | climate attr 'target_temp_high' | verified |
| **heatingSetpoint** | decimal | -127 … 127 | °? | climate attr 'target_temp_low' | verified |
| **humidity** | integer | 0 … 100 | % | sensor (humidity) % | verified |
| **temperature** | decimal | -460 … 10000 | °? | sensor / climate 'current_temperature' | verified |
| **thermostatFanMode** | enum | auto / circulate / on | | climate attr 'fan_mode' | verified |
| **thermostatMode** | enum | auto / cool / emergency heat / heat / off | | climate state 'hvac_mode' | verified |
| **thermostatOperatingState** | enum | cooling / fan only / heating / idle / pending cool / pending heat / vent economizer | | climate attr 'hvac_action' | verified |
| **thermostatSetpoint** | decimal | -127 … 127 | °? | climate attr 'temperature' | verified |

### Closures

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **door** | enum | closed / closing / open / opening / unknown | | cover (garage) state | verified |
| **lock** | enum | locked / unknown / unlocked / unlocked with timeout | | lock state | verified |
| **valve** | enum | closed / open | | valve state / switch (water valve) | verified |
| **windowShade** | enum | closed / closing / open / opening / partially open / unknown | | cover (shade/blind) state | verified |

### Controls

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **button** | enum | pushed / held | | event (button) / sensor 'action' | verified |
| **holdableButton** | enum | held / pushed | | event (button) held | verified |
| **indicatorStatus** | enum | never / when off / when on | | — | n/a |

### Sensors — Binary

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **acceleration** | enum | active / inactive | | binary_sensor (moving / vibration) state | verified |
| **contact** | enum | closed / open | | binary_sensor (door/window/opening) | verified |
| **motion** | enum | active / inactive | | binary_sensor (motion) | verified |
| **shock** | enum | clear / detected | | binary_sensor (vibration / tamper) | assumed |
| **sound** | enum | detected / not detected | | binary_sensor (sound) | assumed |
| **tamper** | enum | clear / detected | | binary_sensor (tamper) | verified |
| **touch** | enum | touched | | binary_sensor (touch) | assumed |
| **water** | enum | dry / wet | | binary_sensor (moisture) | verified |

### Sensors — Environment

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **illuminance** | integer | 0 … ∞ | lux | sensor (illuminance) lux | verified |
| **soundPressureLevel** | integer | 0 … ∞ | dB | sensor (sound_pressure / noise) dB | assumed |
| **ultravioletIndex** | integer | 0 … ∞ | | sensor (uv_index) | verified |

### Sensors — Air

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **carbonDioxide** | decimal | 0 … ∞ | | sensor (carbon_dioxide) ppm | verified |
| **pH** | decimal | 0 … 14 | | sensor (ph) | assumed |

### Sensors — Motion/Position

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **axisX** | integer | -1024 … 1024 | | sensor (3-axis) x | assumed |
| **axisY** | integer | -1024 … 1024 | | sensor (3-axis) y | assumed |
| **axisZ** | integer | -1024 … 1024 | | sensor (3-axis) z | assumed |
| **orientation** | enum | rear side up / down side up / left side up / front side up / up side up / right side up | | sensor (orientation) | assumed |
| **threeAxis** | vector3 | | | sensor (3-axis vector) | assumed |

### Power & Energy

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **battery** | integer | 0 … 100 | % | sensor (battery) / attr 'battery_level' | verified |
| **energy** | decimal | 0 … ∞ | kWh | sensor (energy) kWh | verified |
| **power** | decimal | | W | sensor (power) W | verified |
| **powerSource** | enum | battery / dc / mains / unknown | | sensor / attr 'power_source' | assumed |
| **voltage** | decimal | | V | sensor (voltage) V | verified |

### Media / Activity

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **activities** | object | | | — | n/a |
| **currentActivity** | string | | | — | n/a |
| **image** | image | | | camera snapshot / image entity | assumed |
| **mute** | enum | muted / unmuted | | media_player attr 'is_volume_muted' | verified |
| **status** | string | | | media_player state | verified |
| **trackData** | object | | | media_player media_* attrs (object) | assumed |
| **trackDescription** | string | | | media_player attr 'media_title' | verified |

### Voice

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **phraseSpoken** | string | | | — | n/a |

### Location & Presence

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **altitude** | decimal | | ft | device_tracker attr 'altitude' (ft) | assumed |
| **altitudeMetric** | decimal | | m | device_tracker attr 'altitude' (m) | verified |
| **arrivingAtPlace** | string | | | — | n/a |
| **bearing** | decimal | 0 … 360 | ° | device_tracker attr 'bearing'/'course' | assumed |
| **closestPlace** | string | | | — | n/a |
| **closestPlaceDistance** | decimal | | mi | — | n/a |
| **closestPlaceDistanceMetric** | decimal | | km | — | n/a |
| **currentPlace** | string | | | device_tracker / person state (zone) | assumed |
| **distance** | decimal | | mi | sensor (distance, mi) / proximity | assumed |
| **distanceMetric** | decimal | | km | sensor (distance, km) / proximity | assumed |
| **eta** | datetime | | | — | n/a |
| **floor** | integer | | | — | n/a |
| **horizontalAccuracy** | decimal | | ft | device_tracker attr 'gps_accuracy' (ft) | assumed |
| **horizontalAccuracyMetric** | decimal | | m | device_tracker attr 'gps_accuracy' (m) | verified |
| **latitude** | decimal | | ° | device_tracker attr 'latitude' | verified |
| **leavingAtPlace** | string | | | — | n/a |
| **longitude** | decimal | | ° | device_tracker attr 'longitude' | verified |
| **places** | string | | | — | n/a |
| **presence** | enum | not present / present | | device_tracker / person / zone state | verified |
| **previousPlace** | string | | | — | n/a |
| **speed** | decimal | | ft/s | device_tracker attr 'speed' (ft/s) | assumed |
| **speedMetric** | decimal | | m/s | device_tracker attr 'speed' (m/s) | verified |
| **verticalAccuracy** | decimal | | ft | device_tracker vertical accuracy (ft) | assumed |
| **verticalAccuracyMetric** | decimal | | m | device_tracker vertical accuracy (m) | verified |

### Health & Fitness

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **goal** | integer | 0 … ∞ | | sensor (step goal) | n/a |
| **sleeping** | enum | not sleeping / sleeping | | binary_sensor (sleep) / sensor | assumed |
| **steps** | integer | 0 … ∞ | | sensor (steps) | n/a |

### Maintenance

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **consumableStatus** | enum | good / maintenance_required / missing / order / replace | | sensor (consumable / filter) | assumed |
| **schedule** | object | | | — | n/a |
| **sessionStatus** | enum | canceled / paused / running / stopped | | timer state | assumed |
| **timeRemaining** | integer | 0 … ∞ | s | timer attr 'remaining' (s) | assumed |

### Safety & Sirens

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **alarm** | enum | both / off / siren / strobe | | siren state / alarm_control_panel | assumed |
| **carbonMonoxide** | enum | clear / detected / tested | | binary_sensor (carbon_monoxide / gas) | verified |
| **smoke** | enum | clear / detected / tested | | binary_sensor (smoke) | verified |

### Diagnostics

| WebCoRE attribute | Type | Values / range | Unit | HA source | Map |
|---|---|---|---|---|---|
| **lqi** | integer | 0 … 255 | | sensor (zigbee lqi) | assumed |
| **rssi** | integer | 0 … 100 | % | sensor (rssi / signal_strength) | assumed |

---

## Backend Forwarding Note

Companion capability lists that back several of these attributes — hvac_modes,
fan/climate preset_modes, source_list, effect_list — plus supported_features / PLAY_MEDIA
per entity and tts.* / notify.* registry data, are stripped by ha_client.py before the
frontend sees them. These must be forwarded intact so the picker can resolve capabilities
correctly. See EDITOR_WIZARD_SPEC.md §8.6.

---

## Reconciliation Checklist

The **assumed** and **n/a** rows need sign-off:
- **assumed** rows have a plausible HA source that should be checked against the actual
  integration before treating as verified.
- **n/a** rows are WebCoRE-origin attributes (SmartThings location/place math, fitness,
  LED indicators) with no HA entity behind them — confirm whether the wizard should hide
  them entirely rather than expose dead comparison surfaces.
