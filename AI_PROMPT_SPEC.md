# PistonCore AI Prompt Specification

**Version:** 2.0
**Status:** Authoritative — Rewritten for logic_version 2
**Last Updated:** May 2026 (Session 60 / D-S4 Step 9 — complete rewrite; device_map model
  eliminated; entity_ids on nodes; Snapshot format v2 per DESIGN.md Sections 6.10/6.11;
  role label placeholder model)

This document defines requirements for the AI prompt files that help users generate PistonCore
pistons using external AI assistants (ChatGPT, Claude, Gemini, etc.).

The prompts are served from `pistoncore/prompts/` in the backend and displayed to users
via the AI Help modal on the piston list page.

---

## Background

PistonCore pistons are stored as structured JSON (logic_version 2). The Snapshot format
is the share/import format — it has empty `entity_ids` arrays and uses `role` as a
human-readable placeholder. AI assistants generate Snapshot JSON that users import via
the Import dialog, which walks them through device mapping.

**The AI never knows the user's actual entity IDs.** The role name is the placeholder.
The user provides their entity mapping at import time.

---

## What the Old Model Was (DO NOT USE)

The old model (pre-Session 55) used `device_map` at the piston wrapper level:
```json
{
  "device_map": {
    "Front Door": ["binary_sensor.front_door"]
  }
}
```

This model is **eliminated**. Do not reference it anywhere.

---

## Logic Version 2 Snapshot Format

The AI must generate Snapshot JSON per DESIGN.md Sections 6.10 and 6.11.

**Wrapper:**
```json
{
  "name": "piston name",
  "description": "optional",
  "logic_version": 2,
  "ui_version": 1,
  "mode": "single",
  "enabled": true,
  "folder": null,
  "created_at": "2026-01-01T00:00:00Z",
  "modified_at": "2026-01-01T00:00:00Z",
  "variables": [],
  "statements": [ ... ]
}
```

**Condition nodes in Snapshot:** `entity_ids` is always `[]`. `role` is always a
human-readable placeholder (e.g., `"Front Door"`, `"Motion Sensors"`). All other
fields are set as they would be in a real piston.

```json
{
  "id": "cond_a3f8c2d1",
  "is_trigger": true,
  "role": "Front Door",
  "entity_ids": [],
  "aggregation": "any",
  "attribute": "contact",
  "attribute_type": "binary",
  "device_class": "door",
  "operator": "changes to",
  "display_value": "Open",
  "compiled_value": "on",
  "group_operator": "and"
}
```

**Action nodes in Snapshot:** `entity_ids` is always `[]`. `role` is always a placeholder.

```json
{
  "id": "stmt_b7e2f941",
  "type": "action",
  "role": "Announcement Speaker",
  "entity_ids": [],
  "tasks": [
    {
      "id": "task_c8d3e052",
      "command": "play_media",
      "domain": "media_player",
      "ha_service": "media_player.play_media",
      "parameters": {
        "media_content_id": "Welcome home!",
        "media_content_type": "music"
      },
      "description": null
    }
  ],
  "description": null,
  "disabled": false
}
```

---

## v1 Prompts — Two Files

### Prompt 1: write-a-piston.md

**Purpose:** User copies this prompt into any AI assistant, describes what they want
their piston to do, and the AI generates a logic_version 2 Snapshot JSON.

**Endpoint:** `GET /api/prompts/write-a-piston`

**File location:** `pistoncore/prompts/write-a-piston.md`

#### Requirements for write-a-piston.md

The prompt must:

1. **Explain what a piston is** briefly. The AI needs context. 2-3 sentences max.

2. **Define the Snapshot format** — the exact wrapper structure and all field names.

3. **Define condition node structure** with all required fields:
   - `id`, `is_trigger`, `role`, `entity_ids: []`, `aggregation`, `attribute`, `attribute_type`, `device_class`, `operator`, `display_value`, `compiled_value`, `group_operator`
   - Rules: `entity_ids` is always `[]` in a Snapshot; `role` is the placeholder name; `compiled_value` is what the compiler uses (not `display_value`)

4. **Define action node structure** with all required fields:
   - `id`, `type: "action"`, `role`, `entity_ids: []`, `tasks[]` (each with `id`, `command`, `domain`, `ha_service`, `parameters`, `description`), `description`, `disabled`
   - Rules: `ha_service` = `domain + "." + command`; `entity_ids` is always `[]` in a Snapshot

5. **Define all other statement types** the AI might generate. At minimum:
   - `if` block: `type: "if"`, `conditions: []`, `then: []`, `else_if: []`, `else: []`
   - `repeat` loop: `type: "repeat"`, `until_conditions: []`, `statements: []`
   - `for_each` loop: `type: "for_each"`, `role`, `entity_ids: []`, `variable`, `statements: []`
   - `set_variable`: `type: "set_variable"`, `variable`, `value` (operand object)
   - `log_message`: `type: "log_message"`, `message` (operand object)
   - Reference STATEMENT_TYPES.md for the full list of types and their schemas

6. **Define operand/value types:**
   - `{ "type": "literal", "data": "value" }`
   - `{ "type": "variable", "name": "$var_name" }`
   - `{ "type": "system_variable", "name": "$sunrise", "offset": 30, "offset_unit": "minutes", "offset_direction": "+" }`
   - `{ "type": "expression", "expression": "$count + 1" }`

7. **Define role naming rules:**
   - Role names must be unique within the piston if they refer to different physical device groups
   - Role names that match are treated as the same device group at import time
   - Role names should be human-readable: `"Front Door"`, `"Motion Sensors"`, `"Bedroom Lights"`
   - If referencing a PistonCore global: use the global name with `@` prefix as the role: `"@Smoke_Detectors"`

8. **State the output rule clearly:** Generate only valid JSON. No prose before or after the JSON block. No explanations inside the JSON. No comments.

9. **Give examples** — at minimum one simple trigger-and-action piston, one piston with a condition. Full valid JSON.

10. **State what entity_ids must be:** Always `[]` (empty array). Never fill in real entity IDs. The user will map them on import.

#### What the Prompt Must NOT Include

- Any reference to `device_map`
- Any reference to `piston_text`
- Any reference to logic_version 1
- Any instructions to fill in real entity IDs
- Any suggestion to use `has_missing_devices`

---

### Prompt 2: migrate-from-webcore.md (Future — Not v1)

**Purpose:** User uploads a WebCoRE piston screenshot or piston JSON export and asks
an AI assistant to convert it to a PistonCore Snapshot.

**Status:** Deferred to v2. Migration requires a dedicated prompt with WebCoRE schema
documentation. Will be written after write-a-piston.md is proven.

**When this is written, it must:**
- Define the WebCoRE piston format the AI is converting FROM
- Define the PistonCore Snapshot format the AI is converting TO
- Map WebCoRE statement types to PistonCore statement types
- Handle WebCoRE device type/capability model to PistonCore role + entity_ids model
- Handle WebCoRE `$currentEventDevice` to PistonCore `$currentEventDevice` (same name, same compiler handling)

---

## ID Generation Rules

All `id` fields must be unique strings. The AI should generate random-looking hex strings:
- Statement IDs: `stmt_` + 8 hex chars (e.g., `stmt_a3f8c2d1`)
- Condition IDs: `cond_` + 8 hex chars (e.g., `cond_b7e2f941`)
- Task IDs: `task_` + 8 hex chars (e.g., `task_c8d3e052`)

The exact values do not matter — they just need to be unique within the piston. PistonCore
regenerates all IDs on import anyway.

---

## Serving the Prompt

The backend serves prompt files from `pistoncore/prompts/` via:
```
GET /api/prompts/{prompt_name}
```

Returns the raw Markdown content of the prompt file. The frontend displays it in the
AI Help modal (read-only, scrollable text area with a Copy button).

If the prompt file is not found: return 404. The frontend shows:
*"Prompt unavailable — check your connection and try again."*

Prompt files are bundled with PistonCore (not in the customize volume). They cannot be
user-edited. If the user wants a custom prompt, they copy the content from the modal and
modify it themselves before pasting into the AI assistant.

---

## What Changed from the Old Spec

The old AI_PROMPT_SPEC.md (pre-Session 55) defined output format around `device_map`:

```json
{
  "device_map": {
    "Front Door": ["binary_sensor.front_door"]
  },
  "statements": [ ... ]
}
```

This is completely eliminated. The new model:
- No `device_map` anywhere
- `entity_ids: []` on every condition and action node in a Snapshot
- `role` on every node is the human-readable placeholder
- Import dialog walks the user through mapping roles to real devices (DESIGN.md Section 6.11)

The import flow for logic_version 2 Snapshots (DESIGN.md Section 6.11) handles all the
role-to-entity mapping. The AI never needs to know the user's entity IDs.
