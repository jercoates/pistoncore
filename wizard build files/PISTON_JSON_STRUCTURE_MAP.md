# PISTONCORE PISTON JSON — STRUCTURE MAP (LOCKED)

**Purpose:** The single authoritative data dictionary for the PistonCore piston JSON.
Answers "what does the JSON store and how is it shaped" so it is a lookup, not a guess.

**Scope — STORAGE ONLY.** This document describes what the JSON *holds* and what *order*
matters. It says NOTHING about where a value goes, how it compiles, or native-vs-PyScript
routing. Those are COMPILER SPEC concerns and live there. The JSON does not care where a
value goes — it only stores it.

**Authority:** Shapes read from actual wizard write paths and editor read paths.
Completeness checked against WebCoRE source (piston.module.html.txt) as a checklist only.

**Labeling convention (mandatory on every claim):**
- `[VERIFIED: <source>]` — read directly from code, sample JSON, or WebCoRE source.
- `[ASSUMED: Claude — basis, RISK, where-to-check]` — inference, not confirmed.
- `[DECISION: Claude — rationale, RISK, verify-by-deploy]` — an owned ruling on a gap;
  consistent with the verified map but not yet behaviorally tested.

**Freshness note:** HA-behavior confirmations are dated. HA updates frequently;
re-check dated claims on major HA releases.

---

## ROUTING IS NOT IN THIS DOCUMENT

Several field values (e.g. `case_traversal_policy: "fallthrough"`, `condition_operator: "xor"`,
`interval_unit: "n"/"y"`, the `on_event`/`break`/`cancel_pending_tasks` types) cause the COMPILER
to route to PyScript instead of native HA. **That routing knowledge is real and verified
(June 2026) but it is FILED IN THE COMPILER SPEC, not here.** The JSON stores these values
plainly and does not know or care that they force PyScript. Do not add routing properties to
this map. (Recovered routing table held separately for the compiler spec.)

---

## 1. PISTON ROOT
Top-level container. Not a statement node.

```
{
  "id": "uuid", "name": "string", "description": "string|null", "folder": "string|null",
  "mode": "single", "enabled": true, "logic_version": 2, "ui_version": 1,
  "compile_target": "native_script", "created_at": "ISO8601", "modified_at": "ISO8601",
  "variables": [], "triggers": [], "conditions": [], "restrictions": [], "statements": []
}
```
`[VERIFIED: editor.js _normalizePiston, _renderDocument; sample pistons]`

Note: `compile_target` is written by the compiler, never the user. It is stored here but
its *value* is a compiler decision. `[VERIFIED: PISTON_FORMAT line 121]`

Array order:
- `variables[]` — **ordered: YES** — declaration/initialization sequence. `[VERIFIED: editor.js renders variables first]` `[ASSUMED: init ordering significant, RISK low]`
- `triggers[]` — **ordered: NO** — all triggers OR together; any one fires the piston. `[VERIFIED: HA_LIMITATIONS §3 — one trigger block fires when any entity matches, as of 2026.6]`
- `conditions[]` — **ordered: YES** — left-to-right; each item's `group_operator` connects it to the PREVIOUS item. `[VERIFIED: editor.js condition rendering + WebCoRE flat-collection model]`
- `restrictions[]` — **ordered: YES** — same left-to-right model as conditions. `[VERIFIED: editor.js restrictions.forEach same group_operator logic]`
- `statements[]` — **ordered: YES** — execution sequence = editor top-to-bottom. `[VERIFIED: editor.js _actionLines in array order]`

---

## 2. VARIABLE  (in piston.variables[])

Scalar:
```
{ "type":"variable", "id":"stmt_xxxx", "name":"DoorsOpen", "var_type":"string", "initial_value":"" }
```
Single device:
```
{ "type":"variable", "id":"stmt_xxxx", "name":"Keypad", "var_type":"device",
  "initial_value":["Keypad Friendly Name"], "initial_value_type":"device" }
```
Multi device:
```
{ "type":"variable", "id":"stmt_xxxx", "name":"Door_locks", "var_type":"devices",
  "initial_value":["Front Door Lock","Back Door Lock"], "initial_value_type":"device" }
```
`[VERIFIED: claude_alarm_checks_faithful.json var_0006/var_0007; wizard-variable.js save()]`

- `initial_value[]` (device/devices) — **ordered: NO** — a device list, not a sequence. `[VERIFIED: wizard-variable.js Set keyed by friendly name]`

**LOAD-BEARING:** for device/devices, `initial_value` holds **friendly names only, never entity IDs.**
`[VERIFIED: wizard-variable.js _readDeviceSelection; CLAUDE.md guardrail]`

`var_type` scalar values: `"string","number","boolean","datetime","dynamic"`
`[ASSUMED: Claude — basis: wizard filter uses integer|decimal|dynamic (alt spellings), RISK medium, check wizard-variable.js full]`

---

## 3. TRIGGER  (in piston.triggers[])
Identical shape to CONDITION (§4), distinguished by `is_trigger: true`. May omit `interaction`.
`[VERIFIED: sample pistons]` `[ASSUMED: interaction optional, RISK low]`

---

## 4. CONDITION
Stored in: piston.conditions[], piston.restrictions[], if.conditions[], while.conditions[],
repeat.until_conditions[], on_event.conditions[], each else_ifs[N].conditions[].

4a. Device/attribute (most common):
```
{ "id":"cond_xxxx", "is_trigger":false, "role":"Kitchen Light", "role_tokens":["light.kitchen_1"],
  "entity_ids":["light.kitchen_1"], "aggregation":"any", "attribute":"brightness",
  "attribute_type":"numeric", "device_class":null, "operator":"is greater than",
  "display_value":"50", "compiled_value":"50", "value_to":null, "duration":null,
  "duration_unit":null, "interaction":"any", "group_operator":"and" }
```
4b. Expression: `{ "id":..., "is_trigger":false, "subject":"expression", "operator":"is any of", "value":{"type":"expression","expression":"..."}, "group_operator":"and" }`
4c. Variable (test loop var): `{ "id":..., "is_trigger":false, "subject":"variable", "variable":"$device", "attribute":"lock", "operator":"is not", "display_value":"locked", "compiled_value":"locked", "group_operator":"and" }`
`[VERIFIED: REFERENCE_PISTON_V2.json; claude_alarm_checks_faithful.json; wizard-condition.js _buildConditionNode]`

Key fields: `role`=display label; `role_tokens`=picker re-population on edit; `entity_ids`=resolved
HA ids for compiler; `display_value`=shown; `compiled_value`=compiler value; `group_operator`=connects
to previous condition.

- `role_tokens[]` — **ordered: NO** — picker tokens, no positional meaning. `[VERIFIED]`
- `entity_ids[]` — **ordered: NO** — HA applies as a set. `[VERIFIED: HA_LIMITATIONS §3, as of 2026.6]`

**LOAD-BEARING:** `entity_ids` holds exactly one entity id per physical device for the chosen
attribute (written at commit from `_capEntityMap`); `role_tokens` holds friendly-name tokens for
edit. Different fields, different jobs. `[VERIFIED: wizard-condition.js + CLAUDE.md]`

---

## 5. RESTRICTION  (in piston.restrictions[])
Identical shape to CONDITION. Same `_condLine()` renderer. `is_trigger` always false.
`[VERIFIED: editor.js restrictions.forEach _condLine]` `[ASSUMED: is_trigger false, RISK low]`

---

## 6. IF
```
{ "type":"if", "id":"stmt_xxxx", "async":false, "conditions":[], "condition_operator":"and",
  "then":[], "else_ifs":[], "else":[], "description":"opt|null", "disabled":false }
```
`[VERIFIED: wizard-statement.js if handler; editor.js renders all five arrays]`
- `conditions[]` **ordered: YES** (group_operator). `then[]` **ordered: YES** (exec seq).
  `else_ifs[]` **ordered: YES** (first match wins). `else[]` **ordered: YES** (exec seq).
`[VERIFIED: editor.js]`

## 7. ELSE_IF  (embedded in if.else_ifs[], NOT a standalone type, no `type` field)
```
{ "id":"stmt_xxxx", "conditions":[], "condition_operator":"and", "statements":[] }
```
**NAMING NOTE:** main if branch uses `then[]`; each else_if branch uses `statements[]`.
This inconsistency exists in the actual code. `[VERIFIED: editor.js]`
- `conditions[]` **ordered: YES**; `statements[]` **ordered: YES**. `[VERIFIED: editor.js]`

## 8. DO
```
{ "type":"do", "id":"stmt_xxxx", "async":false, "statements":[], "description":null, "disabled":false }
```
`statements[]` **ordered: YES**. `[VERIFIED: wizard-statement.js; editor.js]`

## 9. ON_EVENT
```
{ "type":"on_event", "id":"stmt_xxxx", "async":false, "conditions":[], "condition_operator":"and",
  "statements":[], "description":null, "disabled":false }
```
`conditions[]` here are trigger-type events to listen for. Both arrays **ordered: YES**.
`[VERIFIED: wizard-statement.js nextContext trigger_or_condition; editor.js]`

## 10. WHILE
```
{ "type":"while", "id":"stmt_xxxx", "async":false, "conditions":[], "condition_operator":"and",
  "statements":[], "description":null, "disabled":false }
```
Both arrays **ordered: YES**. `[VERIFIED: wizard-statement.js; editor.js]`

## 11. REPEAT  (do-until)
```
{ "type":"repeat", "id":"stmt_xxxx", "async":false, "statements":[], "until_conditions":[],
  "condition_operator":"and", "description":null, "disabled":false }
```
**CRITICAL NAMING:** the until array is `until_conditions[]`, NOT `conditions[]`. Only this type
uses that name. `[VERIFIED: editor.js:430,809,1334,1400]`
`statements[]` **ordered: YES**; `until_conditions[]` **ordered: YES**. `[VERIFIED]`

## 12. EVERY (timer)
```
{ "type":"every", "id":"stmt_xxxx", "async":false, "interval":5, "interval_unit":"minutes",
  "at_minute":null, "at_time":null, "only_on_days":[1,3,5], "only_on_dom":[],
  "only_on_months":[1,6,12], "statements":[], "description":null, "disabled":false }
```
`[VERIFIED: wizard-loops.js timer save]`
`interval_unit`: ms/s/min/hours/days/weeks/months/years. `at_minute` (hours only); `at_time` (days+).
- `only_on_days[]` / `only_on_months[]` / `only_on_dom[]` — **ordered: NO** (sets). `[VERIFIED]`
- `statements[]` — **ordered: YES**. `[VERIFIED: editor.js]`

## 13. SWITCH
```
{ "type":"switch", "id":"stmt_xxxx", "async":false,
  "expression":{"type":"expression","expression":"$myVar"},
  "case_traversal_policy":"safe", "cases":[], "default":[], "description":null, "disabled":false }
```
`case_traversal_policy`: `"safe"` (auto-break) or `"fallthrough"`. `[VERIFIED: wizard-loops.js; editor.js]`
- `cases[]` **ordered: YES** (first match wins in safe mode); `default[]` **ordered: YES**. `[VERIFIED]`

## 14. CASE  (embedded in switch.cases[], NOT standalone, no `type`)

Single value:
```
{ "id":"stmt_xxxx", "value":"someValue", "statements":[] }
```
Range (RESOLVES GAP-MAP-1):
```
{ "id":"stmt_xxxx", "case_type":"range", "value_from":5, "value_to":10, "statements":[] }
```
`[VERIFIED single: editor.js reads c.id,c.value,c.statements]`
`[DECISION: Claude — add case_type/value_from/value_to to STORE WebCoRE range cases
(piston.module.html shows case.t=='r' with two operands). Mirrors the condition value/value_to
pattern already in this map. The JSON must be able to HOLD a range; what the compiler does with
it is the compiler's problem. RISK: medium — verify by authoring a range case and deploying.]`
- `statements[]` — **ordered: YES**. `[VERIFIED]`

## 15. FOR
```
{ "type":"for", "id":"stmt_xxxx", "async":false, "start":1, "end":10, "step":1,
  "counter_variable":"$index", "statements":[], "description":null, "disabled":false }
```
`statements[]` **ordered: YES**. `[VERIFIED: wizard-loops.js for save]`

## 16. FOR_EACH
```
{ "type":"for_each", "id":"stmt_xxxx", "async":false, "variable":"$device",
  "role":"Smoke Detectors", "list_role":"Smoke Detectors", "role_tokens":["@smoke_detectors"],
  "entity_ids":["sensor.smoke_basement","sensor.smoke_kitchen"], "statements":[],
  "description":null, "disabled":false }
```
`[VERIFIED: wizard-loops.js for_each save; sample pistons]`
- `role_tokens[]` — **ordered: NO**. `entity_ids[]` — **ordered: NO**. `statements[]` — **ordered: YES**. `[VERIFIED]`

**LOAD-BEARING:** `entity_ids` holds ALL entity ids for the full device list (no attribute filter —
for_each iterates whole devices); `role_tokens` holds friendly tokens. `[VERIFIED: wizard-loops.js _getFlatEntityIds]`

## 17. BREAK
```
{ "type":"break", "id":"stmt_xxxx", "description":null, "disabled":false }
```
No child arrays. `[VERIFIED: wizard-statement.js]`

## 18. EXIT
```
{ "type":"exit", "id":"stmt_xxxx", "value":{"type":"expression","expression":"true"},
  "description":null, "disabled":false }
```
`value` is null when no state value specified. `[VERIFIED: wizard-loops.js exit save; editor.js]`
(Whether the compiler can preserve the value is a COMPILER decision — not stored here.)

## 19. ACTION
```
{ "type":"action", "id":"stmt_xxxx", "async":false, "role":"Kitchen Light",
  "role_tokens":["light.kitchen_1"], "entity_ids":["light.kitchen_1"], "tasks":[],
  "description":null, "disabled":false }
```
`[VERIFIED: wizard-action.js _saveDeviceCmd; sample pistons]`
- `role_tokens[]` **ordered: NO**; `entity_ids[]` **ordered: NO** (HA applies as set). `[VERIFIED: HA_LIMITATIONS §3]`
- `tasks[]` — **ordered: YES** — execution sequence within the action; the position of a virtual
  task (e.g. a wait or set_variable embedded as a task) is **load-bearing**.
  `[VERIFIED: CLAUDE.md guardrail; alarm piston stmt_with0501 = media_stop → volume_set → speak in intentional order]`

## 20. TASK  (embedded in action.tasks[]) — one real HA service call
```
{ "id":"task_xxxx", "command":"turn_on", "domain":"light", "ha_service":"light.turn_on",
  "parameters":{"brightness_pct":100}, "description":null }
```
`parameters` is `{}` when no params. `[VERIFIED: REFERENCE_PISTON_V2.json; sample pistons]`

## 21. VIRTUAL TASK  (entry in action.tasks[]) — piston-level op, not an HA service
Same shape as TASK; distinguished by `domain`.
```
{ "id":"task_xxxx", "command":"set_variable", "domain":"variable", "ha_service":"variable.set",
  "parameters":{"variable":"$SystemStatus","value":"..."}, "description":"..." }
```
`[VERIFIED: claude_alarm_checks_faithful.json task_0402a]`
Known virtual domain: `variable`/`set_variable`. Other virtual domains
`[ASSUMED: Claude — WebCoRE precedent, RISK medium, check wizard-action.js]`

## 22. SET_VARIABLE  (standalone)
```
{ "type":"set_variable", "id":"stmt_xxxx", "variable":"$DoorsOpen",
  "value":{"type":"literal","data":""}, "description":null, "disabled":false }
```
`value` is a Value Object (§28). `[VERIFIED: wizard-action.js _saveLocationCmd; sample pistons]`

## 23. WAIT  (standalone) — CANONICAL SHAPE
```
{ "type":"wait", "id":"stmt_xxxx", "wait_type":"duration", "duration":5, "duration_unit":"s",
  "description":null, "disabled":false }
```
`wait_type` variants:
- `"duration"` — `duration` (int), `duration_unit` (ms/s/m/h)
- `"duration"` from variable — `duration_variable` ("$var"), `duration: null`
- `"until"` — `until` (expression string)
`[VERIFIED duration: wizard-action.js; duration_variable: alarm piston stmt_wait0402; until: editor.js renders]`

**RESOLVES GAP-MAP-2 — one canonical "wait for state" shape:**
`[DECISION: Claude — the singular-`condition` `wait`/`wait_type:"state"` form is a DEPRECATED
ARTIFACT (a single-device leftover; `condition` singular is the lone exception to plural
`conditions[]` everywhere else). Canonical "wait until a state" is the WAIT_FOR_STATE node (§24)
with plural `conditions[]`. Normalize the deprecated form to WAIT_FOR_STATE on import. RISK: medium —
verify by importing an old piston with the singular form and confirming it round-trips as WAIT_FOR_STATE.]`

## 24. WAIT_FOR_STATE  (standalone) — canonical state-wait
```
{ "type":"wait_for_state", "id":"stmt_xxxx", "conditions":[], "condition_operator":"and",
  "timeout_seconds":null, "description":null, "disabled":false }
```
`[VERIFIED: editor.js renders conditions + timeout_seconds]`
`[ASSUMED: condition_operator/description/disabled present by consistency, RISK low]`
- `conditions[]` — **ordered: YES**. `[ASSUMED: same renderer, RISK low]`

## 25. LOG_MESSAGE  (standalone)
```
{ "type":"log_message", "id":"stmt_xxxx", "message":{"type":"literal","data":"text"},
  "level":"info", "description":null, "disabled":false }
```
`level`: info/warn/error. `[VERIFIED: wizard-action.js; sample pistons]`

## 26. CALL_PISTON  (standalone)
```
{ "type":"call_piston", "id":"stmt_xxxx", "target_piston_id":"uuid",
  "target_piston_name":"Name", "description":null, "disabled":false }
```
`[VERIFIED: wizard-action.js; editor.js]`

## 27. CANCEL_PENDING_TASKS  (standalone)
```
{ "type":"cancel_pending_tasks", "id":"stmt_xxxx", "description":null, "disabled":false }
```
`[VERIFIED: editor.js renders]` `[ASSUMED: description/disabled by consistency, RISK low]`
(GAP-MAP-3 was mis-framed earlier as a structure gap. It is NOT — the JSON stores it fine.
"No wizard creates it yet" is a BUILD task. "It forces PyScript" is a COMPILER fact. Neither is
a structure-map concern.)

## 28. VALUE OBJECT (operand) — inline sub-object, not a node
Appears in: set_variable.value, exit.value, switch.expression, expression-condition.value.
```
{ "type":"literal",    "data":"someValue" }
{ "type":"expression", "expression":"$var + 1" }
{ "type":"variable",   "name":"$varName" }
```
`[VERIFIED: wizard-action.js; sample pistons]`
NOTE: task `parameters` values are NOT wrapped in value objects — plain strings/numbers.
`[VERIFIED: sample pistons]`

## 29. CONDITION GROUP — no standalone node type
Expressed by the flat `conditions[]` array + `condition_operator` on the enclosing block +
`group_operator` per condition. Matches WebCoRE's flat collection model.
`[VERIFIED: piston.module.html flat collection.c array]`

---

## SUMMARY — ALL ARRAY ORDER

| Array | Location | Ordered | Meaning |
|---|---|---|---|
| variables[] | root | YES | declaration/init sequence |
| triggers[] | root | NO | all OR; any fires |
| conditions[] | root, if, while, on_event, else_if | YES | group_operator connects each to PREVIOUS |
| until_conditions[] | repeat | YES | same as conditions |
| restrictions[] | root | YES | same left-to-right as conditions |
| statements[] | do/on_event/while/repeat/every/for/for_each/else_if/case | YES | exec seq = editor top-to-bottom |
| then[] | if | YES | exec seq |
| else_ifs[] | if | YES | first match wins |
| else[] | if | YES | exec seq |
| cases[] | switch | YES | first match wins (safe mode) |
| default[] | switch | YES | exec seq |
| tasks[] | action | YES | exec seq; virtual task position load-bearing |
| role_tokens[] | condition/trigger/action/for_each | NO | lookup tokens |
| entity_ids[] | condition/trigger/action/for_each | NO | HA applies as set |
| initial_value[] | variable (device/devices) | NO | device list |
| only_on_days[]/only_on_months[]/only_on_dom[] | every | NO | sets |

---

## RESOLVED GAPS (storage decisions only)

- **GAP-MAP-1 (switch case ranges):** RESOLVED — add `case_type`/`value_from`/`value_to` to CASE
  (§14) so the JSON can store a range. `[DECISION: Claude]`
- **GAP-MAP-2 (wait state shape):** RESOLVED — one canonical shape (WAIT_FOR_STATE, plural
  `conditions[]`); the singular-`condition` form is deprecated and normalized on import. `[DECISION: Claude]`
- **GAP-MAP-3 (cancel_pending_tasks):** NOT a structure gap. JSON stores it. "No wizard path" = build
  task; "forces PyScript" = compiler fact. Out of scope for this map.
- **GAP-MAP-4 (on_event subscription model):** NOT a structure gap. `on_event` with `conditions[]`
  is sufficient. Complex WebCoRE event-subscription imports may not round-trip perfectly — accepted
  limitation, noted, no structure change.

## OPEN ITEMS NOT OWNED HERE (filed elsewhere — do NOT resolve in this map)
- All native-vs-PyScript ROUTING → COMPILER SPEC (recovered routing table held for it).
- Wizard creation paths for cancel_pending_tasks, wait_for_state → BUILD task list.
- `target-boundary.json` existence → unverified; a coding session must confirm in code.
- exit `value` preservation (drop vs helper entity) → D-S6 compiler design decision.
- Single-device missing-entity deploy behavior → unvalidated (HA_LIMITATIONS §9); test before implementing.

---
*Map authority: wizard-*.js + editor.js (storage truth); sample pistons (verified shapes);
piston.module.html.txt (completeness checklist); HA_LIMITATIONS.md (HA behavior, as of 2026.6).
Routing data recovered from PISTON_FORMAT_MERGED PyScript section, cross-confirmed with
HA_LIMITATIONS — filed separately for the compiler spec, NOT here.*
