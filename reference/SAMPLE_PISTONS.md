# PistonCore — Sample Pistons

**Version:** 1.0
**Status:** Authoritative — Required reference for AI prompt work and compiler smoke testing
**Last Updated:** May 2026 (Session 59 / D-S4 — initial creation)

All pistons in this file are valid against PISTON_FORMAT.md v2.1 and STATEMENT_TYPES.md v2.1.
All pistons use `logic_version: 2`. No `device_map`. Entity IDs stored directly on nodes.

These three examples cover the patterns most likely to surface compiler bugs:
- **Simple** — single trigger, single action, native HA script target
- **Multi-device** — multi-entity trigger with aggregation, multi-entity action
- **Global variable** — Devices global, for_each loop, PyScript target

---

## 1. Simple — Door Opens, Light Turns On

**Compile target:** `native_script`
**Globals needed:** None
**Roles:** "Front Door" (binary_sensor, contact), "Entryway Light" (light)
**Patterns:** single trigger, single action, time condition gate

```json
{
  "id": "aa000001",
  "name": "Front Door Light On Open",
  "description": "Turn on entryway light when front door opens, between sunset and midnight.",
  "folder": null,
  "mode": "single",
  "enabled": true,
  "logic_version": 2,
  "ui_version": 1,
  "created_at": "2026-05-01T00:00:00Z",
  "modified_at": "2026-05-01T00:00:00Z",
  "variables": [],
  "statements": [
    {
      "id": "stmt_aa000001",
      "type": "if",
      "async": false,
      "conditions": [
        {
          "id": "cond_aa000001",
          "is_trigger": true,
          "role": "Front Door",
          "entity_ids": ["binary_sensor.front_door"],
          "aggregation": "any",
          "attribute": "contact",
          "attribute_type": "binary",
          "device_class": "door",
          "operator": "changes to",
          "display_value": "Open",
          "compiled_value": "on",
          "value_to": null,
          "duration": null,
          "duration_unit": null,
          "group_operator": "and",
          "interaction": "any"
        },
        {
          "id": "cond_aa000002",
          "is_trigger": false,
          "subject": "time",
          "operator": "is between",
          "value_from": { "preset": "sunset", "offset": 0, "offset_unit": "minutes", "offset_direction": "+" },
          "value_to": "00:00:00",
          "only_on_days": null,
          "group_operator": "and"
        }
      ],
      "condition_operator": "and",
      "then": [
        {
          "id": "stmt_aa000002",
          "type": "action",
          "async": false,
          "role": "Entryway Light",
          "entity_ids": ["light.entryway"],
          "tasks": [
            {
              "id": "task_aa000001",
              "command": "turn_on",
              "domain": "light",
              "ha_service": "light.turn_on",
              "parameters": { "brightness_pct": 100 },
              "description": null
            }
          ],
          "description": null,
          "disabled": false
        }
      ],
      "else_ifs": [],
      "else": [],
      "description": null,
      "disabled": false
    }
  ]
}
```

### Expected Automation Output

```yaml
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: aa000001 | pc_version: 1.0 | pc_hash: [computed on deploy]

- id: pistoncore_aa000001
  alias: "Front Door Light On Open"
  description: "Turn on entryway light when front door opens, between sunset and midnight."
  mode: single
  triggers:
    - trigger: state
      id: cond_aa000001
      entity_id: binary_sensor.front_door
      to: "on"
  conditions:
    - condition: sun
      after: sunset
    - condition: time
      before: "00:00:00"
  actions:
    - action: script.pistoncore_aa000001
```

### Expected Script Output

```yaml
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: aa000001 | pc_version: 1.0 | pc_hash: [computed on deploy]
# pc_globals_used: (none)

pistoncore_aa000001:
  alias: "Front Door Light On Open (PistonCore)"
  description: ""
  mode: single
  sequence:
    - alias: "stmt_aa000002"
      action: light.turn_on
      target:
        entity_id: light.entryway
      data:
        brightness_pct: 100
      continue_on_error: true

    - event: PISTONCORE_RUN_COMPLETE
      event_data:
        piston_id: "aa000001"
        piston_name: "Front Door Light On Open"
        status: "success"
```

---

## 2. Multi-Device — Any Door Opens, All Downstairs Lights On

**Compile target:** `native_script`
**Globals needed:** None
**Roles:** "Exterior Doors" (binary_sensor, contact, multi-device), "Downstairs Lights" (light, multi-device)
**Patterns:** multi-entity trigger (any), multi-entity action, aggregation

```json
{
  "id": "bb000001",
  "name": "Any Door Opens — Downstairs Lights On",
  "description": "When any exterior door opens after sunset, turn on all downstairs lights.",
  "folder": null,
  "mode": "single",
  "enabled": true,
  "logic_version": 2,
  "ui_version": 1,
  "created_at": "2026-05-01T00:00:00Z",
  "modified_at": "2026-05-01T00:00:00Z",
  "variables": [],
  "statements": [
    {
      "id": "stmt_bb000001",
      "type": "if",
      "async": false,
      "conditions": [
        {
          "id": "cond_bb000001",
          "is_trigger": true,
          "role": "Exterior Doors",
          "entity_ids": [
            "binary_sensor.front_door",
            "binary_sensor.back_door",
            "binary_sensor.garage_door"
          ],
          "aggregation": "any",
          "attribute": "contact",
          "attribute_type": "binary",
          "device_class": "door",
          "operator": "changes to",
          "display_value": "Open",
          "compiled_value": "on",
          "value_to": null,
          "duration": null,
          "duration_unit": null,
          "group_operator": "and",
          "interaction": "any"
        },
        {
          "id": "cond_bb000002",
          "is_trigger": false,
          "subject": "sun",
          "operator": "is below horizon",
          "group_operator": "and"
        }
      ],
      "condition_operator": "and",
      "then": [
        {
          "id": "stmt_bb000002",
          "type": "action",
          "async": false,
          "role": "Downstairs Lights",
          "entity_ids": [
            "light.living_room",
            "light.kitchen",
            "light.hallway",
            "light.dining_room"
          ],
          "tasks": [
            {
              "id": "task_bb000001",
              "command": "turn_on",
              "domain": "light",
              "ha_service": "light.turn_on",
              "parameters": { "brightness_pct": 80 },
              "description": null
            }
          ],
          "description": null,
          "disabled": false
        }
      ],
      "else_ifs": [],
      "else": [],
      "description": null,
      "disabled": false
    }
  ]
}
```

### Expected Automation Output

```yaml
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: bb000001 | pc_version: 1.0 | pc_hash: [computed on deploy]

- id: pistoncore_bb000001
  alias: "Any Door Opens — Downstairs Lights On"
  description: "When any exterior door opens after sunset, turn on all downstairs lights."
  mode: single
  triggers:
    - trigger: state
      id: cond_bb000001
      entity_id:
        - binary_sensor.front_door
        - binary_sensor.back_door
        - binary_sensor.garage_door
      to: "on"
  conditions:
    - condition: sun
      after: sunset
  actions:
    - action: script.pistoncore_bb000001
```

### Expected Script Output

```yaml
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: bb000001 | pc_version: 1.0 | pc_hash: [computed on deploy]
# pc_globals_used: (none)

pistoncore_bb000001:
  alias: "Any Door Opens — Downstairs Lights On (PistonCore)"
  description: ""
  mode: single
  sequence:
    - alias: "stmt_bb000002"
      action: light.turn_on
      target:
        entity_id:
          - light.living_room
          - light.kitchen
          - light.hallway
          - light.dining_room
      data:
        brightness_pct: 80
      continue_on_error: true

    - event: PISTONCORE_RUN_COMPLETE
      event_data:
        piston_id: "bb000001"
        piston_name: "Any Door Opens — Downstairs Lights On"
        status: "success"
```

**Compiler note:** Multi-entity trigger uses `entity_id` list — HA fires when any entity
in the list changes to "on". Multi-entity action uses `entity_id` list — HA applies the
service to all entities simultaneously. Neither is expanded into multiple blocks.

---

## 3. Global Variable + for_each — Announce Battery Low

**Compile target:** `pyscript` (for_each with dynamic attribute access forces PyScript)
**Globals needed:** `@Battery_Devices` (type: Devices), `@Announcement_Speaker` (type: Device)
**Roles:** Uses global variables — no local device roles
**Patterns:** daily time trigger, for_each over a Devices global, attribute read,
             conditional action, log statement

```json
{
  "id": "cc000001",
  "name": "Daily Battery Check",
  "description": "Each morning, check all battery devices. Announce any below 20%.",
  "folder": null,
  "mode": "single",
  "enabled": true,
  "logic_version": 2,
  "ui_version": 1,
  "created_at": "2026-05-01T00:00:00Z",
  "modified_at": "2026-05-01T00:00:00Z",
  "variables": [
    {
      "id": "var_cc000001",
      "name": "low_battery_found",
      "display_name": "Low Battery Found",
      "type": "boolean",
      "default_value": false
    }
  ],
  "statements": [
    {
      "id": "stmt_cc000001",
      "type": "if",
      "async": false,
      "conditions": [
        {
          "id": "cond_cc000001",
          "is_trigger": true,
          "role": "time",
          "entity_ids": [],
          "subject": "time",
          "operator": "happens daily at",
          "value": "08:00:00",
          "group_operator": "and"
        }
      ],
      "condition_operator": "and",
      "then": [
        {
          "id": "stmt_cc000002",
          "type": "for_each",
          "async": false,
          "role": "@Battery_Devices",
          "entity_ids": [],
          "global_source": "Battery_Devices",
          "loop_variable": "$device",
          "statements": [
            {
              "id": "stmt_cc000003",
              "type": "if",
              "async": false,
              "conditions": [
                {
                  "id": "cond_cc000002",
                  "is_trigger": false,
                  "role": "@Battery_Devices",
                  "entity_ids": [],
                  "global_source": "Battery_Devices",
                  "attribute": "battery",
                  "attribute_type": "numeric",
                  "operator": "is less than",
                  "display_value": "20",
                  "compiled_value": "20",
                  "value_to": null,
                  "duration": null,
                  "duration_unit": null,
                  "group_operator": "and",
                  "interaction": "any"
                }
              ],
              "condition_operator": "and",
              "then": [
                {
                  "id": "stmt_cc000004",
                  "type": "action",
                  "async": false,
                  "role": "@Announcement_Speaker",
                  "entity_ids": [],
                  "global_source": "Announcement_Speaker",
                  "tasks": [
                    {
                      "id": "task_cc000001",
                      "command": "play_media",
                      "domain": "media_player",
                      "ha_service": "media_player.play_media",
                      "parameters": {
                        "media_content_type": "music",
                        "media_content_id": "Battery low on {{ $device }}"
                      },
                      "description": null
                    }
                  ],
                  "description": null,
                  "disabled": false
                },
                {
                  "id": "stmt_cc000005",
                  "type": "set_variable",
                  "async": false,
                  "variable": "$low_battery_found",
                  "value": { "type": "literal", "data": true },
                  "description": null,
                  "disabled": false
                }
              ],
              "else_ifs": [],
              "else": [],
              "description": null,
              "disabled": false
            }
          ],
          "description": null,
          "disabled": false
        },
        {
          "id": "stmt_cc000006",
          "type": "if",
          "async": false,
          "conditions": [
            {
              "id": "cond_cc000003",
              "is_trigger": false,
              "subject": "variable",
              "variable": "$low_battery_found",
              "operator": "is false",
              "group_operator": "and"
            }
          ],
          "condition_operator": "and",
          "then": [
            {
              "id": "stmt_cc000007",
              "type": "log_message",
              "async": false,
              "message": { "type": "literal", "data": "Battery check complete — all devices OK." },
              "level": "info",
              "description": null,
              "disabled": false
            }
          ],
          "else_ifs": [],
          "else": [],
          "description": null,
          "disabled": false
        }
      ],
      "else_ifs": [],
      "else": [],
      "description": null,
      "disabled": false
    }
  ]
}
```

### Notes for Compiler

- `for_each` node uses `global_source: "Battery_Devices"` — compiler looks up `@Battery_Devices`
  in `global_variables` array, reads `entity_ids`, iterates over them.
- Action node inside the loop uses `global_source: "Announcement_Speaker"` — entity_ids
  resolved from the global at compile time.
- `entity_ids: []` on global-sourced nodes is correct — they are never populated in the
  stored format. The compiler resolves them from the global at compile time.
- This piston forces PyScript because `for_each` with dynamic attribute access
  (`battery` level varies per device) requires runtime evaluation.
- `pc_globals_used` header line will list: `Battery_Devices, Announcement_Speaker`

### Snapshot Format

When exported as a Snapshot, this piston is identical to the stored format — global-sourced
nodes already have `entity_ids: []`, so no stripping is needed. Role labels preserve the
`@` prefix to signal global source to the import dialog.

---

## Global Name Reference for These Pistons

| Global Name | Type | Used By |
|---|---|---|
| `@Battery_Devices` | Devices | Piston 3 (Daily Battery Check) |
| `@Announcement_Speaker` | Device | Piston 3 (Daily Battery Check) |

Piston 1 and Piston 2 use no globals — all entity_ids are stored directly on nodes.

---

## Using These Pistons for Compiler Testing

**Smoke test order:**
1. Piston 1 — verify native_script output for single trigger + time condition gate
2. Piston 2 — verify multi-entity trigger list and multi-entity action target list
3. Piston 3 — verify PyScript target detection, global variable expansion, for_each loop

If Pistons 1 and 2 compile and deploy correctly, the native_script compiler is solid
for the most common patterns. Piston 3 tests the PyScript path and global resolution.

**What to check in each compiled output:**
- File signature header present and correctly formatted
- Trigger `entity_id` is a list (not scalar) when multiple entities present
- Action `target.entity_id` is a list (not scalar) when multiple entities present
- No `device_map` references anywhere in output
- `pc_globals_used` header correct for PyScript files
- `PISTONCORE_RUN_COMPLETE` event always last in sequence

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
