# PistonCore — AI Prompt Specification

**Version:** 1.0
**Status:** Draft — Defines requirements before prompts are written
**Last Updated:** May 2026

This document specifies what the AI prompt files must accomplish and contain.
The actual prompts are not written until the Snapshot JSON import flow is
tested end-to-end. Write the prompts against this spec, not against
assumptions about what works.

Read DESIGN.md Section 6 and PISTON_FORMAT.md before this document.

---

## Why Prompts, Not a Parser

PistonCore v1 does not parse text input from AI. Instead, AI assistants
are given a prompt that teaches them to generate Snapshot JSON directly.
The user pastes that JSON into the standard import dialog. Role mapping
happens through the existing device picker — no special parser needed.

This approach:
- Works with any large LLM (ChatGPT, Grok, Claude, Gemini, etc.)
- Produces reliable structured output — LLMs generate JSON accurately
  when given a clear schema
- Requires zero parser code in PistonCore
- Uses the same import path for AI-generated, community-shared, and
  WebCoRE-migrated pistons

---

## Two Prompt Files

### 1. write-a-piston.md

**Purpose:** User pastes this into any AI, describes what they want,
gets a Snapshot JSON back, imports it into PistonCore.

**Entry point in UI:** AI Help button → Write a Piston option →
read-only prompt text → Copy to Clipboard button.

### 2. migrate-from-webcore.md

**Purpose:** User pastes this into any AI that supports image input
(ChatGPT, Grok, Gemini), attaches a WebCoRE screenshot, gets a
Snapshot JSON back, imports it into PistonCore.

**Entry point in UI:** AI Help button → Migrate from WebCoRE option →
read-only prompt text → Copy to Clipboard button.
(UI entry point is v1 — second tab in AI Help modal, see FRONTEND_SPEC.md)

---

## Output Format — Both Prompts

Both prompts must instruct the AI to produce Snapshot JSON format.
See DESIGN.md Section 6.2 and PISTON_FORMAT.md for the full schema.

**Key rules the AI must follow:**
- `device_map` keys are role names, values are always empty arrays `[]`
- `device_map_meta` includes cardinality for each role
- `statements` array uses the typed statement schemas from STATEMENT_TYPES.md
- `id` is an 8-character hex string — AI generates a random one
- `logic_version` and `ui_version` are both `1`
- `compile_target` is `"native_script"` unless the piston uses PyScript-only
  statement types (`on_event`, `break`, `cancel_pending_tasks`)
- Entity IDs never appear anywhere in the output
- HA YAML syntax never appears anywhere in the output
- `compiled_value` for binary sensors is always `"on"` or `"off"` —
  never the friendly label
- `display_value` for binary sensors is the friendly label (Open, Closed,
  Detected, Clear, etc.) — never `"on"` or `"off"`

---

## write-a-piston.md — Required Content

### Section 1 — What you are doing
Brief plain English explanation: generating a Snapshot JSON piston for
PistonCore. Tell the AI it will receive a description and must output JSON.

### Section 2 — Output format
The complete Snapshot JSON wrapper with all fields. Show a minimal skeleton
with annotations. Reference PISTON_FORMAT.md field definitions.

### Section 3 — Statement types
The complete statement type list from STATEMENT_TYPES.md. For each type,
include:
- The `type` field value
- The required fields
- A short JSON example
Priority order: `if`, `action`, `set_variable`, `wait`, `log_message`,
`call_piston`, `exit` — these cover 95% of pistons. Include the rest
(`for`, `for_each`, `while`, `repeat`, `do`, `switch`, `every`) but
mark them as less common.

### Section 4 — Condition object schema
The complete condition object from PISTON_FORMAT.md including:
- All fields with types
- The `is_trigger: true` vs `is_trigger: false` distinction
- The `display_value` / `compiled_value` split for binary sensors
- The device_class → friendly label table (Open/Closed, Detected/Clear etc.)
- The aggregation field (any/all/none)

### Section 5 — Operator reference
The complete operator list from WIZARD_SPEC.md, divided into:
- Trigger operators (is_trigger: true)
- Condition operators (is_trigger: false)

### Section 6 — Role rules
- Role names are strings used as device_map keys
- Role names appear in `devices` arrays and `role` fields in conditions
- Every role referenced in statements must have an entry in device_map
- device_map values are always `[]` in Snapshot format
- device_map_meta.cardinality is `"single"` or `"multi"`

### Section 7 — compile_target rules
- Use `"native_script"` for most pistons
- Use `"pyscript"` if the piston contains: `on_event`, `break`,
  `cancel_pending_tasks`, or system variables like `$currentEventDevice`

### Section 8 — System variables
The system variables table from WIZARD_SPEC.md. Note which are
PyScript-only.

### Section 9 — Complete example
A full working Snapshot JSON example. Must be non-trivial — at least
one trigger condition, one if block with then/else, one action block.
The chicken lights or door chime example from DESIGN.md works well.

### Section 10 — User instructions
After generating the JSON:
1. Copy the JSON
2. In PistonCore, click Import on the main menu
3. Paste the JSON
4. PistonCore will walk you through mapping each device role to a real
   device from your Home Assistant
5. Save and deploy

State any assumptions made so the user knows what to verify.

---

## migrate-from-webcore.md — Required Content

### Section 1 — What you are doing
You are given a WebCoRE piston screenshot. Convert it to PistonCore
Snapshot JSON format. The output format is the same as write-a-piston.md.

### Section 2 — Output format
Reference write-a-piston.md output format (or include inline if the
prompts are used independently).

### Section 3 — WebCoRE → PistonCore statement type mapping

| WebCoRE | PistonCore type | Notes |
|---|---|---|
| `if / then / else if / else / end if` | `if` | Direct equivalent |
| `with {device} do ... end with` | `action` | Direct equivalent |
| `do Set variable` | `set_variable` | Direct equivalent |
| `do Wait X minutes` | `wait` (duration) | Direct equivalent |
| `do Wait until HH:MM` | `wait` (until) | Direct equivalent |
| `do Log message` | `log_message` | Direct equivalent |
| `do Execute piston` | `call_piston` | Direct equivalent |
| `for each ... in ... do` | `for_each` | Direct equivalent |
| `while ... do` | `while` | Direct equivalent |
| `repeat ... until` | `repeat` | Direct equivalent |
| `for (X to Y) do` | `for` | Direct equivalent |
| `switch` | `switch` | Direct equivalent |
| `do` (grouping) | `do` | Direct equivalent |
| `every X minutes` | `every` | Direct equivalent |
| `break` | `break` | PyScript only |
| `exit` | `exit` | Direct equivalent |
| `stop` | `exit` | WebCoRE name — map to exit |
| `on events from` | `on_event` | PyScript only |
| TCP/TEP settings | — | Not in PistonCore v1 — omit silently |
| `$hub` variables | — | No equivalent — omit, add comment |
| `httpGet` / `httpPost` | — | Not in v1 — add comment |
| File read/write | — | Not in PistonCore — omit, add comment |

### Section 4 — Role extraction rules
- Every `{Device Name}` in curly braces in the WebCoRE screenshot becomes
  a role name in PistonCore
- Strip curly braces, preserve the name as-is for the role key
- Add the role to device_map with empty array `[]`
- Set cardinality to `"single"` unless the role appears with "Any of" or
  "All of" aggregation — then `"multi"`
- `@GlobalVariable` devices become global variable references — add `@`
  prefix to the role name, set cardinality based on usage

### Section 5 — Condition extraction rules
- Trigger conditions (⚡ lightning bolt in WebCoRE) → `is_trigger: true`
- Regular conditions → `is_trigger: false`
- Extract operator from WebCoRE display text and map to WIZARD_SPEC.md operator
- Binary sensor values: map WebCoRE friendly labels to display_value/compiled_value
  pairs per the device_class table in WIZARD_SPEC.md

### Section 6 — Unsupported features
If the WebCoRE piston uses features with no PistonCore equivalent, add a
`log_message` statement at the top of the piston with a note explaining
what was omitted. Never silently drop logic.

### Section 7 — User instructions
Same as write-a-piston.md Section 10.

---

## Test Criteria — Before Prompts Are Finalized

Before write-a-piston.md is considered complete, test with at least
three AI models (ChatGPT, Grok, one other):

1. Simple piston: single trigger, single action → imports cleanly
2. Multi-condition piston: AND/OR conditions, else branch → imports cleanly
3. Variable piston: set_variable, wait, log → imports cleanly
4. Binary sensor piston: door contact trigger → display_value/compiled_value
   correct, role mapping step appears correctly
5. Edge case: PyScript-required piston → compile_target set correctly

Before migrate-from-webcore.md is considered complete, test with the
WebCoRE bathroom light screenshot (the one shown in the design discussions)
and at least one other screenshot.

Import is considered successful when:
- JSON validates without errors
- Role mapping step appears with correct role names
- After mapping, piston renders correctly in the editor
- No statement types are missing or unknown

---

## Open Items

1. AI Help modal UI — second tab for WebCoRE migration needs to be
   added to FRONTEND_SPEC.md when the modal is built
2. Image input requirement — migrate-from-webcore.md requires an AI
   with vision capability. The UI should note this (ChatGPT, Grok, Gemini)
3. Prompt versioning — prompts are served from the container and updated
   when the format changes. Version number or format version should be
   included in the prompt so outdated cached copies are detectable
4. Rate of change — once the Snapshot JSON format stabilizes (logic_version
   stops changing), the prompts become stable. Early v1 may need prompt
   updates with each format change.

---

*This spec is the authority for prompt content. Do not write the actual
prompt files until the import flow is tested. Do not update this spec
without updating the corresponding sections in DESIGN.md Section 6.*
