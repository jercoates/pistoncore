# EDITOR_WIZARD_SPEC.md — PistonCore Editor and Wizard

**Version:** 2.3 (added §9.6 dialog field contracts — full scratch-buffer field tables for all 11 dialogs + comparison template + page navigation model; EDITOR-GAP-6 resolved)
**Status:** Complete — 10 approved source files only.

---

## Implementation Language

**PistonCore is vanilla JS/HTML/CSS — no framework, no build step.** This spec was derived from WebCoRE's Angular source (`piston.module.html.txt`). Angular terms that appear throughout (`ng-model`, `$scope`, `ng-if`, `ng-repeat`, `designer.$new`, etc.) are **verification citations only** — they trace a claim back to its source. They are never implementation instructions. When building PistonCore, translate the described behavior into plain DOM/JS; ignore the Angular syntax entirely.

---

## Tag Convention

Every factual claim carries one of:
- `[VERIFIED: source file + section/line]` — confirmed directly from an approved source
- `[ASSUMED: basis — RISK — what to check]` — inference, unconfirmed
- `[DECISION: rationale]` — deliberate design choice deviating from WebCoRE default

Absence of a tag is an error. A `[VERIFIED]` tag citing any current PistonCore `.js` file is a contamination error.

---

## §0 Foundational Invariants

These govern all editor and wizard behavior. A violation anywhere is a bug.

### §0.1 Load-Bearing Rule
Variables and globals store device **friendly names** — never entity IDs. Nodes (condition, action, trigger, for_each, restriction) store **entity IDs** — the attribute-bearing entity for the chosen function, one per device, resolved at commit time.
`[VERIFIED: PISTON_JSON_STRUCTURE_MAP.md §1; WIZARD_ACTION_COMMAND_SPEC.md Part 7]`

### §0.2 Capability-Organized Picker Rule
The picker compares devices by **capability keys** — never by entity IDs. Backend forwards capability signals (supported_features flags + declaration attributes) per device; the wizard translates those signals to WebCoRE capability keys and intersects the keys across all selected devices. Entity IDs appear ONLY at commit, as the output of selection — one per device for the chosen capability. The comparison step and the commit step use entirely different data; they must never be collapsed.
`[DECISION: PICKER_STRUCTURE_SPEC.md §1–§3 — old entity-ID-organized picker discarded as structurally not feasible]`

### §0.3 Pure-Projection Invariant
The editor renders JSON → display text in one direction only. Display text is never stored or parsed back. `role`/`device_label` are always friendly names; `entity_ids` are always real HA entity IDs; `role_tokens` is edit-round-trip only and the compiler ignores it.

`role_tokens` entries beginning with `@` are global variable references (e.g. `["@Exterior_Doors"]`). The backend scans these at piston save to maintain each global's `used_by` reference list — the `@`-prefix is the discriminator. See FRONTEND_SPEC.md "Global Variables Section — Reference tracking" for the full mechanism.
`[VERIFIED: FRONTEND_SPEC.md — Editor Rendering Rules; WIZARD_ACTION_COMMAND_SPEC.md Part 7]`
`[DECISION: @-prefix in role_tokens is the global-reference discriminator used by the save-time reference tracking scan]`

### §0.4 Edit-Isolation Contract
Every dialog edits a scratch buffer (`$scope.designer`), never the live node directly. Built fresh on open. Discarded on Cancel. Written back on commit (Save/Add).
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §1, §2, §3]`

### §0.5 Commit Bracket
Every commit calls `autoSave()` BEFORE writing to the live tree — snapshot taken before the change so the pre-change state is always undoable.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §4, §8]`

### §0.6 Vocab-as-Runtime-Data Rule
`webcore_vocab.json` ships with PistonCore and is the runtime data source the wizard loads to populate ALL menus.

### §0.7 Integration Settings — Editor Load
When the editor opens, it fetches `GET /api/settings/integrations` and stores the result locally. The TTS engine id (`settings.tts_engine`) is passed into the wizard so the Speak task dialog does not need a per-command engine picker — the engine is already known from settings. If the fetch fails or returns null, the Speak task falls back to showing a picker inline. The alarm panel id is compiler-only and not needed by the wizard.
`[DECISION: FRONTEND_SPEC.md — Integration Settings API; TTS engine pre-loaded at editor open eliminates per-command picker in Speak dialog]` The wizard is a lookup engine over this file, not hardcoded menu logic. The capability list, attribute types, enum options, value ranges, command render-format strings, command parameters, operator lists, and the type→operator-group mapping are **read from this file at runtime** — never hardcoded in JS. The capability→attribute→type→operator→value cascade (the "fall engine") is mechanically a series of lookups into this file. Building the wizard means building the reader/cascade over this data; the menu contents come from the file, not from code.

Sections of the file and their counts: `capabilities` (71) — name `n`, plural `d`, primary attribute `a`, optional commands `c`; `attributes` (90) — type `t`, enum options `o`, range `r`, unit `u`; `commands` (73) and `virtualCommands` (59) — name `n`, display format `d` with `{N}` placeholders, parameters `p`; `comparisons` (conditions + triggers) — operator display `d`/`dd`, type group `g`, param/timed/multi flags `p`/`t`/`m`; `attributeTypeToOperatorGroup` (15) — the type→operator-group lookup table.
`[VERIFIED: webcore_vocab.json — capabilities/attributes/commands/virtualCommands/comparisons/attributeTypeToOperatorGroup sections confirmed present]`

---

## §1 Editor Layout

### §1.1 Three-Page SPA
Piston List → Status Page → Editor. No URL navigation.
`[VERIFIED: FRONTEND_SPEC.md — Three pages section]`

### §1.2 Editor Canvas — Top to Bottom
1. Piston header (name, description, folder, mode, enabled toggle, simple/advanced toggle)
2. **PISTON VARIABLES** block — `▼ PISTON VARIABLES` with `[+ Add]` (Advanced mode only)
3. **TRIGGERS** block — `▼ TRIGGERS` with `+ add a new trigger`
4. **CONDITIONS** block — `▼ CONDITIONS` with `+ add a new condition`
5. **RESTRICTIONS** block — `only when` header with `+ add a new restriction`
6. **EXECUTE** block — `execute` … `end execute;` with action tree and `+ add a new statement`
7. Editor footer: `[▶ Test]` `[💾 Save to PistonCore]` `[🚀 Deploy to HA]` `[📷 Snapshot]` `[📷 Backup]` + compile status indicator
`[VERIFIED: FRONTEND_SPEC.md — Page 3 Editor Layout ASCII and button labels]`

### §1.3 Simple / Advanced Toggle
Single global toggle. **Default is Advanced.** Preference saved to localStorage key `pc_simpleMode`. Switching modes never destroys data. Simple mode hides piston variables block and advanced options inside dialogs.
`[VERIFIED: FRONTEND_SPEC.md — Simple / Advanced Mode Toggle]`

### §1.4 editor-doc div
The scrollable action tree container (`#editor-doc`) must have these inline styles applied directly — do not rely on stylesheet rules alone:
```
flex: 1;
overflow-y: auto;
min-height: 0;
```
`[VERIFIED: FRONTEND_SPEC.md — editor-doc div section]`

### §1.5 Two Distinct Save Operations
- **Save to PistonCore** `[💾 Save to PistonCore]` — writes piston JSON to volume; runs Stage 1 internal validation; no HA involvement; returns to status page on success.
- **Deploy to HA** `[🚀 Deploy to HA]` — compiles piston; writes HA files; only available after at least one successful Save to PistonCore.

These are different operations with different buttons. The UI must make this unmistakable.
`[VERIFIED: FRONTEND_SPEC.md — Two Distinct Save Operations]`

### §1.6 Compile Status Indicator
Footer shows: `Compiling...` / `Compiled ✓` / `Error ✗` (click to view). Background compilation runs on a 2-second debounce after the last change. Never blocks the UI.
`[VERIFIED: FRONTEND_SPEC.md — Compile Status Indicator]`

### §1.7 PyScript Requirement Indicator
If the backend returns `compile_target` as `"pyscript"` in the API response and PyScript is not detected in HA, show a subtle warning: *"PyScript required — install via HACS before deploying. [Learn more →]"*
The editor reads `compile_target` from the backend API response — it is computed on demand, not stored in the piston JSON. **The editor does NOT determine what forces PyScript — that is the backend's job.**
`[VERIFIED: FRONTEND_SPEC.md — PyScript Requirement Indicator]`

### §1.8 Corrupt / Invalid Piston Loading
- `logic_version` higher than supported: full-editor banner, render read-only if possible.
- `logic_version` 1 (legacy): banner with `[Migrate]` / `[Leave as-is]`.
- Statement node missing required fields: render placeholder row `⚠ Unknown statement [stmt_id] — edit to repair`. Do not crash or skip siblings.
- Empty `statements[]`: valid. Render empty editor with ghost prompt.
- `entity_ids` absent: treat as `[]` — no flag, normal building state.
- `entity_ids: []`: valid, normal building state — no flag. ⚠ fires only on assigned-but-offline devices per §8.4 and §8.7.
`[VERIFIED: FRONTEND_SPEC.md — Corrupt or Invalid Piston Loading]`

---

## §2 Render Function Reference

**Note on `[VERIFIED: webcore_vocab.json ...]` citations throughout this spec:** every such citation means the named value is **read from the shipped data file at runtime** — it is not merely a fact the author confirmed. These citations mark live data dependencies: the wizard reads this field from `webcore_vocab.json` to produce the result described. See §0.6.

Call signatures are VERIFIED from EDITOR_REFERENCE.md (which read `piston_module_html.txt`). Output formats are VERIFIED from WEBCORE_WIZARD_MAP.md and webcore_vocab.json where available; ASSUMED from structure map fields where not.

### §2.1 renderComparison(lo, co, ro, ro2, to, to2)
**Call site:** `[VERIFIED: EDITOR_REFERENCE.md §4, piston_module_html.txt line 823]`

**Output format:** `{left-operand} {operator} {right-operand} [{for/within} {duration}]`
- `lo` → left operand (device+attribute text or literal)
- `co` → operator key; renders as `comparison.d` (singular) or `comparison.dd` (plural when multiple devices selected)
- `ro` → right operand; `ro2` used for range comparisons (`p:2` operators)
- `to` / `to2` → timed duration operands; appended for operators with `t:1` or `t:2` codes

`[VERIFIED: WEBCORE_WIZARD_MAP.md Part 16 — output is "[device/operand] [operator] [value]"; Part 27 — d/dd/g/p/t/m fields on each operator; webcore_vocab.json comparisons section — all d/dd/p/t/m values present]`

### §2.2 renderTask(task)
**Call site:** `[VERIFIED: EDITOR_REFERENCE.md §20, piston_module_html.txt line 901]`

**Output format:**
- Command with `d` field → `d` string with `{0}`, `{1}`, `{2}`... replaced by parameter values. Optional params use their own per-param `d` template (e.g., `" at volume {v}"`).
- Command without `d` field → `command.n` (e.g., "Turn on", "Close", "Pause").

`[VERIFIED: webcore_vocab.json commands section — each command has optional "d" (display format) and "n" (name) fields; WEBCORE_WIZARD_MAP.md Part 29 — command.d is the display format string]`

Examples (directly from webcore_vocab.json):
- `on` → "Turn on" (no `d` field, uses `n`)
- `setLevel` → "Set level to {0}%{1}" (`{0}` = level value, `{1}` = optional "if already on/off")
- `playText` → `Speak text "{0}"` (`{0}` = text, optional volume via param `d`)
- `setColor` → "Set color to {0}{1}"
`[VERIFIED: webcore_vocab.json commands.on, commands.setLevel, commands.playText, commands.setColor]`

### §2.3 renderOperand(operand)
**Call sites:** `[VERIFIED: EDITOR_REFERENCE.md §18 line 754 (EXIT); §13 line 594 (SWITCH expression); §9 line 784 (ON_EVENT)]`

**Output format:** renders the operand value as readable text per its type:
- Constant (`c`) → literal value string/number/date
- Variable (`x`) → `$variableName`
- Device + attribute (`p`) → friendly device name + attribute name
- Expression (`e`) → expression string
`[ASSUMED: output format inferred from operand type codes in EDITOR_REFERENCE.md Appendix B — RISK low — standard across all WebCoRE editors]`

### §2.4 renderDeviceNameList(devices)
**Call sites:** `[VERIFIED: EDITOR_REFERENCE.md §19, piston_module_html.txt line 495 (ACTION header); §20 line 2126 (task dialog header)]`

**Output format:** device friendly names wrapped in `{ }` delimiters.
`[ASSUMED: standard WebCoRE device name display format — RISK low — confirm curly-brace wrapping against status page "Devices used:" list]`

### §2.5 renderTimer(statement)
**Call site:** `[VERIFIED: EDITOR_REFERENCE.md §12 EVERY, piston_module_html.txt line 720]`

**Output format** (inferred from EVERY node fields in structure map):
- Base: `{interval} {interval_unit}` (e.g., "5 minutes")
- Hours with at_minute: `{interval} hour[s] at :{at_minute}` (e.g., "1 hour at :30")
- Days+ with at_time: `{interval} day[s] at {at_time}` (e.g., "1 day at 08:00")
- Day restrictions appended as qualifier

`[ASSUMED: inferred from PISTON_JSON_STRUCTURE_MAP.md §12 EVERY node fields (interval, interval_unit, at_minute, at_time, days_of_week, days_of_month, weeks_of_month, months_of_year) — RISK medium — confirm exact format at build time; see EDITOR-GAP-3]`

### §2.6 renderForOperands(statement)
**Call site:** `[VERIFIED: EDITOR_REFERENCE.md §15 FOR, piston_module_html.txt line 629]`

**Output format** (inferred from FOR node fields):
`i={start} to {end}[; step {step}][; using {counter_var}]`

`[ASSUMED: inferred from PISTON_JSON_STRUCTURE_MAP.md §15 FOR node fields (start, end, step, counter) — RISK medium — confirm at build time; see EDITOR-GAP-3]`

### §2.7 renderForEachOperands(statement)
**Call site:** `[VERIFIED: EDITOR_REFERENCE.md §16 FOR_EACH, piston_module_html.txt line 651]`

**Output format** (inferred from FOR_EACH node fields):
`{counter_var} in {device_list}`

`[ASSUMED: inferred from PISTON_JSON_STRUCTURE_MAP.md §16 FOR_EACH node fields (counter, devices) — RISK medium — confirm at build time; see EDITOR-GAP-3]`

---

## §3 Node Type Catalog

For each node: (a) rendered code-line format, (b) click handler, (c) edit surface fields.
JSON shapes are in PISTON_JSON_STRUCTURE_MAP.md — not restated here.

---

### §3.1 PISTON ROOT — `PISTON_JSON_STRUCTURE_MAP.md §1`
**Render:**
```
/*** {name} ***/
/* Author: ... | Created: ... | Modified: ... */
settings
  enable/disable ...;
end settings;
define
  {variables}
end define;
only when
  {restrictions}
execute
  {statements}
end execute;
```
`settings` block only when non-default options set.
`[VERIFIED: EDITOR_REFERENCE.md §1, piston_module_html.txt lines 407–461]`

**Click:** piston name → `editSettings()`
`[VERIFIED: piston_module_html.txt line 413]`

**Edit Surface:** `dialog-edit-settings`
- Name (text input), description (textarea), automatic piston state (Enabled/Disabled)
- Advanced: parallelism, command optimizations, condition traversal optimizations, event subscriptions, SSL ignore, command execution delay
`[VERIFIED: EDITOR_REFERENCE.md §1, piston_module_html.txt lines 2364–2445]`

---

### §3.2 VARIABLE — `PISTON_JSON_STRUCTURE_MAP.md §2`
**Render:** `[const] {var_type} {name} [= {initial_value}]; /* current value */`
`[VERIFIED: EDITOR_REFERENCE.md §2, piston_module_html.txt lines 466–475]`
`const` keyword when assignment type is constant. `/* current value */` is live runtime value.

**Click:** variable line → `editVariable(variable)` | `+ add a new variable` → `addVariable()`
`[VERIFIED: piston_module_html.txt lines 471, 474]`

**Edit Surface:** `dialog-edit-variable`
- Type dropdown (Basic: Dynamic/String/Boolean/Number integer/Number decimal/Large number/Date and Time/Date/Time/Device; Advanced: list variants of each)
- Name text input
- Initial value (optional, operand widget; non-list types only)
- Assignment type: Dynamic / Constant (shown when initial value is set and type ≠ device)
- Advanced: description
`[VERIFIED: EDITOR_REFERENCE.md §2, piston_module_html.txt lines 2213–2278]`
Footer includes **Add more** (re-arm) — see §10.1.

---

### §3.3 TRIGGER — `PISTON_JSON_STRUCTURE_MAP.md §3`
**Render:** `[ASSUMED: renders via same renderComparison path as CONDITION — RISK medium — EDITOR-GAP-1; no trigger-specific render in WebCoRE source — EDITOR_REFERENCE.md §3]`

**Click:** `[ASSUMED: opens editTrigger() or equivalent — RISK medium — EDITOR-GAP-1]`

**Edit Surface:** `[ASSUMED: same dialog as CONDITION (§3.4) with trigger-specific handling — RISK medium — EDITOR-GAP-1]`

---

### §3.4 CONDITION — `PISTON_JSON_STRUCTURE_MAP.md §4`
**Render:** `{renderComparison(condition.lo, condition.co, condition.ro, condition.ro2, condition.to, condition.to2)}`
`[VERIFIED: EDITOR_REFERENCE.md §4, piston_module_html.txt line 823]`

- If `condition.lo.dm`: "Save matching devices to variable" annotation shown `[VERIFIED: line 827]`
- If `condition.c` sub-array: renders as a condition group `[VERIFIED: line 820]`
- `ts[]` (when-true) and `fs[]` (when-false) sub-statement arrays supported `[VERIFIED: WEBCORE_WIZARD_MAP.md Part 32; PISTON_JSON_STRUCTURE_MAP.md §4]`

**Click:** `editCondition(condition, collection.c, null, null, collection.o)`
`[VERIFIED: piston_module_html.txt line 823]`

**Edit Surface:** `dialog-edit-condition` — two pages
- Page 0 (type picker): Condition card / Group card / Clipboard section
- Page 1 Condition: left operand (operand widget), operator dropdown (filtered by data type), right operand(s), timed duration field, day-of-week multi-select, day-of-month (1–31 ordinals), week-of-month (1–5 ordinals), month-of-year
- Page 1 Group: logical operator (and/or/xor/followed-by), whole-group negation, "followed by" timing (within + matching method)
- Advanced (gear): save-matching-devices variable, store-non-matching-devices variable, subscription method, description
`[VERIFIED: EDITOR_REFERENCE.md §4, piston_module_html.txt lines 1313–1509]`
Footer includes **Add more** (re-arm) — see §10.1.

---

### §3.5 RESTRICTION — `PISTON_JSON_STRUCTURE_MAP.md §5`
**Render:** `{renderComparison(restriction.lo, restriction.co, restriction.ro, restriction.ro2, restriction.to, restriction.to2)}`
`[VERIFIED: EDITOR_REFERENCE.md §5, piston_module_html.txt line 878]`
Group operator on collection: `collection.rop` `[VERIFIED: line 859]`
`only when` section header wraps the block.

**Click:** `editRestriction(restriction, collection.r)`
`[VERIFIED: piston_module_html.txt line 878]`

**Edit Surface:** `dialog-edit-restriction` — same structure as condition dialog.
Alert on page 0: *"Restrictions DO NOT subscribe to events and will not cause the piston to run."*
`[VERIFIED: EDITOR_REFERENCE.md §5, piston_module_html.txt lines 1516–1648]`

---

### §3.6 IF — `PISTON_JSON_STRUCTURE_MAP.md §6`
**Render:**
```
[async] if [policy badges]
  [conditions]
then
  [statements — statement.then[]]
else if
  [else_if[N].conditions]
then
  [else_if[N].statements]
...
else
  [else statements — statement.e[]]
end if;
```
`else if` blocks iterate `statement.ei[]`. `[VERIFIED: line 573]`
`+ add else if` → `addCondition(statement.ei, true, null, statement.o)` `[VERIFIED: line 579]`
`[VERIFIED: EDITOR_REFERENCE.md §6, piston_module_html.txt lines 554–584]`

**Click:** `if` line → `editStatement(statement, statements)` `[VERIFIED: line 560]`

**Edit Surface:** `dialog-edit-statement` — two pages
- Page 0: type picker
- Page 1: Condition card / Group card
- Advanced: description, TEP, TCP, async, disable
`[VERIFIED: EDITOR_REFERENCE.md §6, piston_module_html.txt lines 966–1281]`

---

### §3.7 ELSE_IF — `PISTON_JSON_STRUCTURE_MAP.md §7`
Rendered within the IF block as successive `else if ... then ...` blocks from `statement.ei[]`.
`[VERIFIED: EDITOR_REFERENCE.md §7, piston_module_html.txt lines 573–577]`
No dedicated else_if dialog — conditions within edited via §3.4.
`[VERIFIED: EDITOR_REFERENCE.md §7]`

---

### §3.8 DO — `PISTON_JSON_STRUCTURE_MAP.md §8`
**Render:**
```
/* {description} */
[async] do [policy badges]
  {statements}
end do;
```
`[VERIFIED: EDITOR_REFERENCE.md §8, piston_module_html.txt lines 516–534]`

**Click:** `do` line → `editStatement(statement, statements)` `[VERIFIED: line 522]`

**Edit Surface:** `dialog-edit-statement`
Page 1: info text only — *"A DO block simply groups statements together and runs them all."*
Advanced: description, TEP, TCP, async, disable
`[VERIFIED: EDITOR_REFERENCE.md §8, piston_module_html.txt lines 1051–1053]`

---

### §3.9 ON_EVENT — `PISTON_JSON_STRUCTURE_MAP.md §9`
**Render:**
```
/* {description} */
on events from [policy badges]
  {events — each: renderOperand(event.lo)}
do
  {statements}
end on;
```
Events joined with "or".
`[VERIFIED: EDITOR_REFERENCE.md §9, piston_module_html.txt lines 538–551, 772, 786]`

**Click:** `on events from` line → `editStatement()` `[VERIFIED: line 544]`
Individual event line → `editEvent(event, collection.c)` `[VERIFIED: line 784]`

**Edit Surface:** `dialog-edit-statement`
Events sub-dialog uses `comparison` template with `comparison.event=true` — no operator dropdown shown; label changes to "What event to expect".
`[VERIFIED: EDITOR_REFERENCE.md §9, piston_module_html.txt lines 1691, 1694]`
Footer includes **Add more** (re-arm) for the event add-dialog — see §10.1.

---

### §3.10 WHILE — `PISTON_JSON_STRUCTURE_MAP.md §10`
**Render:**
```
/* {description} */
[async] while [policy badges]
  [conditions]
do
  {statements}
end while;
```
`[VERIFIED: EDITOR_REFERENCE.md §10, piston_module_html.txt lines 667–687]`

**Click:** `while` line → `editStatement()` `[ASSUMED: same pattern as other block statements — RISK low — confirm line number]`

**Edit Surface:** `dialog-edit-statement`. Page 1: info text only.
`[VERIFIED: EDITOR_REFERENCE.md §10]`

---

### §3.11 REPEAT — `PISTON_JSON_STRUCTURE_MAP.md §11`
**Render:**
```
/* {description} */
[async] repeat [policy badges]
do
  {statements}
until
  [until_conditions]
end repeat;
```
Conditions rendered AFTER `until` keyword. `[VERIFIED: piston_module_html.txt line 708]`
PistonCore uses `until_conditions[]` (not `conditions[]`) for this node. `[VERIFIED: PISTON_JSON_STRUCTURE_MAP.md §11]`
`[VERIFIED: EDITOR_REFERENCE.md §11, piston_module_html.txt lines 690–711]`

**Click:** `repeat` line → `editStatement()` `[ASSUMED: same pattern — RISK low]`

**Edit Surface:** `dialog-edit-statement`. Page 1: info text only.
`[VERIFIED: EDITOR_REFERENCE.md §11]`

---

### §3.12 EVERY (timer) — `PISTON_JSON_STRUCTURE_MAP.md §12`
**Render:**
```
every {renderTimer(statement)} [policy badges]
do
  {statements}
end every;
```
`[VERIFIED: EDITOR_REFERENCE.md §12, piston_module_html.txt lines 714–733]`

**Click:** `every` line → `editStatement()` `[VERIFIED: piston_module_html.txt line 720]`

**Edit Surface:** `dialog-edit-statement`
Page 1: interval operand, at_minute (hours intervals only), at_time (days/weeks/months/years), day-of-week multi-select, day-of-month (1–31 ordinals; mutually exclusive with week-of-month), week-of-month (1–5 ordinals; mutually exclusive with day-of-month), month-of-year (January–December).
`[VERIFIED: EDITOR_REFERENCE.md §12, piston_module_html.txt lines 1080–1186]`

---

### §3.13 SWITCH — `PISTON_JSON_STRUCTURE_MAP.md §13`
**Render:**
```
[async] switch ({renderOperand(statement.lo)}) [fall-through badge if ctp=='e']
  case {value}:
    {statements}
  ...
  default:
    {statements}
end switch;
```
Cases from `statement.cs[]`. Default from `statement.e`.
`[VERIFIED: EDITOR_REFERENCE.md §13, piston_module_html.txt lines 587–620]`

**Click:** `switch` line → `editStatement()` `[VERIFIED: line 594]`
`case` line → `editCase(case, statement.cs)` `[VERIFIED: line 609]`

**Edit Surface:** `dialog-edit-statement`
Page 1: switch expression operand field.
Advanced: description, TEP, TCP, case traversal policy (safe auto-break / fallthrough), subscription method, async, disable.
`[VERIFIED: EDITOR_REFERENCE.md §13, piston_module_html.txt lines 987–989, 1187–1258]`

---

### §3.14 CASE — `PISTON_JSON_STRUCTURE_MAP.md §14`
**Render:**
- Single: `case {value}:`
- Range: `case {value_from} to {value_to}:`

Single-value render: `[VERIFIED: EDITOR_REFERENCE.md §14, piston_module_html.txt line 609]`
Range format ("to" keyword between operands): `[ASSUMED: RISK medium — two operands verified; exact text unconfirmed; confirm at build time]`

**Click:** `editCase(case, statement.cs)` `[VERIFIED: line 609]`

**Edit Surface:** `dialog-edit-case`
- Case type: Single value / Range
- "Switch expression matches" — operand widget
- If range: "and" — second operand widget
- Advanced: description
`[VERIFIED: EDITOR_REFERENCE.md §14, piston_module_html.txt lines 1651–1686]`

---

### §3.15 FOR — `PISTON_JSON_STRUCTURE_MAP.md §15`
**Render:**
```
[async] for ({renderForOperands(statement)})
do
  {statements}
end for;
```
`[VERIFIED: EDITOR_REFERENCE.md §15, piston_module_html.txt lines 623–642]`

**Click:** `for` line → `editStatement()` `[VERIFIED: line 629]`

**Edit Surface:** `dialog-edit-statement`
Page 1: start operand, end operand, step operand, counter variable dropdown (integer/decimal/dynamic variables only).
`[VERIFIED: EDITOR_REFERENCE.md §15, piston_module_html.txt lines 996–1024]`

---

### §3.16 FOR_EACH — `PISTON_JSON_STRUCTURE_MAP.md §16`
**Render:**
```
[async] for each ({renderForEachOperands(statement)})
do
  {statements}
end for each;
```
`[VERIFIED: EDITOR_REFERENCE.md §16, piston_module_html.txt lines 645–664]`

**Click:** `for each` line → `editStatement()` `[VERIFIED: line 651]`

**Edit Surface:** `dialog-edit-statement`
Page 1: counter variable dropdown (DEVICE variables only), device list operand.
`[VERIFIED: EDITOR_REFERENCE.md §16, piston_module_html.txt lines 1025–1045]`

---

### §3.17 BREAK — `PISTON_JSON_STRUCTURE_MAP.md §17`
**Render:** `break`
`[VERIFIED: EDITOR_REFERENCE.md §17, piston_module_html.txt lines 736–745]`

**Click:** `editStatement()` `[VERIFIED: line 742]`

**Edit Surface:** `dialog-edit-statement`
Page 1: no break-specific content block found in dialog template.
`[ASSUMED: page 1 shows only advanced options panel — RISK low — EDITOR-GAP-5]`
Advanced: description, async, disable.
`[VERIFIED: EDITOR_REFERENCE.md §17]`

---

### §3.18 EXIT — `PISTON_JSON_STRUCTURE_MAP.md §18`
**Render:** `exit {renderOperand(statement.lo)};`
`[VERIFIED: EDITOR_REFERENCE.md §18, piston_module_html.txt line 754]`
Exit value from `statement.lo` (NOT `statement.value`). `[VERIFIED: line 754]`

**Click:** `editStatement()` `[VERIFIED: line 754]`

**Edit Surface:** `dialog-edit-statement`
Page 1: "New piston state" — operand widget.
`[VERIFIED: EDITOR_REFERENCE.md §18, piston_module_html.txt lines 1046–1050]`

---

### §3.19 ACTION (with-block) — `PISTON_JSON_STRUCTURE_MAP.md §19`
**Render:**
```
/* {description} */
only when [restrictions]
[async] with [policy badges]
  {renderDeviceNameList(statement.d)}
do
  {tasks — each: do {renderTask(task)}}
end with;
```
Keyword is `with` not `action`. `[VERIFIED: line 495]`
In compact (non-edit) mode: tasks render inline without `with...end with` wrapper. `[VERIFIED: lines 490–492]`
`[VERIFIED: EDITOR_REFERENCE.md §19, piston_module_html.txt lines 489–513]`

**Click:** device name list → `editStatement()` `[VERIFIED: lines 495/506]`

**Edit Surface:** `dialog-edit-statement`
Page 1: device selector — see §8 for full device picker architecture.
Groups: Virtual Location device, physical devices, local device variables, global device variables.
Advanced: description, TEP, TCP, TSP (action statements only), async, disable.
`[VERIFIED: EDITOR_REFERENCE.md §19, piston_module_html.txt lines 1057–1079, 1219]`

---

### §3.20 TASK — `PISTON_JSON_STRUCTURE_MAP.md §20`
**Render:** `do {renderTask(task)}`
`[VERIFIED: EDITOR_REFERENCE.md §20, piston_module_html.txt line 901]`
`+ add a new task` → `addTask(statement)` `[VERIFIED: line 890]`

**Click:** `editTask(task, statement)` `[VERIFIED: line 901]`

**Edit Surface:** `dialog-edit-task`
- Header: `renderDeviceNameList(designer.parent.d)` — parent action's device list
- Existing tasks above insert point (edit mode)
- "Do..." — command dropdown grouped as Common / Partial / Virtual — see §7.2
- Parameter operand widgets per command parameter
- "Only during these modes" — mode multi-select (shown when command selected)
- Remaining tasks below insert point (edit mode)
- Clipboard section
- Advanced: description
`[VERIFIED: EDITOR_REFERENCE.md §20, piston_module_html.txt lines 2118–2207]`
Footer includes **Add more** (re-arm) — see §10.1.

---

### §3.21 VIRTUAL TASK — `PISTON_JSON_STRUCTURE_MAP.md §21`
**Render:** `do {renderTask(task)}`
`[ASSUMED: same render path as TASK; distinguished by domain value — RISK low — EDITOR_REFERENCE.md §21]`

**Click / Edit:** Same task dialog. Virtual commands appear in the "Location commands (non-device)" group.
`[VERIFIED: EDITOR_REFERENCE.md §21, piston_module_html.txt line 2144]`

---

### §3.22 SET_VARIABLE — `PISTON_JSON_STRUCTURE_MAP.md §22`
**Render:** `set {variable} = {value}`
Derived from documented fields: `variable` (variable name string, e.g. `$DoorsOpen`) + `value` (Value Object §28 — literal, expression, or variable reference).
`[DECISION: render derived from PISTON_JSON_STRUCTURE_MAP.md §22 documented fields]`

**Click:** `editStatement()` or equivalent.

**Edit Surface:**
- Variable name picker (populates `variable` field)
- Value operand widget (Value Object §28 — type: literal / expression / variable)
- Advanced: description, disable
`[DECISION: dialog fields derived from PISTON_JSON_STRUCTURE_MAP.md §22 documented fields]`

---

### §3.23 WAIT — `PISTON_JSON_STRUCTURE_MAP.md §23`
**Render:** three forms depending on `wait_type`:
- `wait_type:"duration"` with literal → `wait {duration} {duration_unit}` (e.g., `wait 5 s`)
- `wait_type:"duration"` from variable → `wait {duration_variable}` (e.g., `wait $MyDuration`)
- `wait_type:"until"` → `wait until {until}` (e.g., `wait until {expression}`)

Derived from documented fields: `wait_type`, `duration`, `duration_unit` (ms/s/m/h), `duration_variable`, `until`.
`[DECISION: render derived from PISTON_JSON_STRUCTURE_MAP.md §23 documented fields]`

**Click:** `editStatement()` or equivalent.

**Edit Surface:**
- `wait_type` picker: duration / duration from variable / until expression
- If duration: `duration` number input + `duration_unit` selector (ms / s / m / h)
- If duration from variable: variable picker (populates `duration_variable`)
- If until: expression input (populates `until`)
- Advanced: description, disable
`[DECISION: dialog fields derived from PISTON_JSON_STRUCTURE_MAP.md §23 documented fields]`

---

### §3.24 WAIT_FOR_STATE — `PISTON_JSON_STRUCTURE_MAP.md §24`
**Render:** block structure — `conditions[]` is a sub-array:
```
wait for state [; timeout {timeout_seconds}s]
  [conditions]
end wait;
```
Derived from documented fields: `conditions[]`, `condition_operator` ("and" default), `timeout_seconds` (null = no timeout).
`[DECISION: render derived from PISTON_JSON_STRUCTURE_MAP.md §24 documented fields; block format chosen because conditions[] is a sub-array, consistent with WHILE/REPEAT pattern]`

**Click:** `editStatement()` or equivalent.

**Edit Surface:**
- Conditions list (via condition builder §3.4; `condition_operator` controls group logic)
- Optional `timeout_seconds` number input (null = wait indefinitely)
- Advanced: description, disable
`[DECISION: dialog fields derived from PISTON_JSON_STRUCTURE_MAP.md §24 documented fields]`

---

### §3.25 LOG_MESSAGE — `PISTON_JSON_STRUCTURE_MAP.md §25`
**Render:** `log [{level}]: {message}` (e.g., `log [warn]: Door left open`)
Derived from documented fields: `level` (info/warn/error) + `message` (Value Object §28).
`[DECISION: render derived from PISTON_JSON_STRUCTURE_MAP.md §25 documented fields]`

**Click:** `editStatement()` or equivalent.

**Edit Surface:**
- `level` picker: info / warn / error
- `message` Value Object widget (literal, expression, or variable reference)
- Advanced: description, disable
`[DECISION: dialog fields derived from PISTON_JSON_STRUCTURE_MAP.md §25 documented fields]`

---

### §3.26 CALL_PISTON — `PISTON_JSON_STRUCTURE_MAP.md §26`
**Render:** `call piston {target_piston_name}`
Derived from documented fields: `target_piston_name` (human-readable display string); `target_piston_id` is stored as the lookup key but not shown in the render.
`[DECISION: render derived from PISTON_JSON_STRUCTURE_MAP.md §26 documented fields]`

**Click:** `editStatement()` or equivalent.

**Edit Surface:**
- Piston picker from available pistons list (populates both `target_piston_id` and `target_piston_name`)
- Advanced: description, disable
`[DECISION: dialog fields derived from PISTON_JSON_STRUCTURE_MAP.md §26 documented fields]`

---

### §3.27 CANCEL_PENDING_TASKS — `PISTON_JSON_STRUCTURE_MAP.md §27`
**Render:** `cancel pending tasks`
No variable fields — the type name is the full content of the render. Derived from documented fields: `id`, `description`, `disabled` (no functional payload fields).
`[DECISION: render derived from PISTON_JSON_STRUCTURE_MAP.md §27 documented fields — type name is the complete render because there are no payload fields]`

**Click:** `editStatement()` or equivalent.

**Edit Surface:**
- Advanced only: description, disable
`[DECISION: dialog fields derived from PISTON_JSON_STRUCTURE_MAP.md §27 documented fields — no payload fields exist]`

---

### §3.28 VALUE OBJECT (operand) — `PISTON_JSON_STRUCTURE_MAP.md §28`
Not a rendered node — inline sub-object within parent nodes. Rendered wherever the parent uses `renderOperand(value)`.
`[VERIFIED: EDITOR_REFERENCE.md §28, piston_module_html.txt line 754 et al.]`
Edit surface uses the `operand` template — see §4.
`[VERIFIED: EDITOR_REFERENCE.md §28, piston_module_html.txt lines 1804–2031]`

---

### §3.29 CONDITION GROUP — `PISTON_JSON_STRUCTURE_MAP.md §29`
Not a distinct JSON node — a condition with a `c` sub-array.
**Render:** nested conditions block within the parent conditions list.
`[VERIFIED: EDITOR_REFERENCE.md §29, piston_module_html.txt line 820]`

**Edit Surface:** `dialog-edit-condition-group`
- Logical operator: and / or / xor / followed-by
- Whole group negation: Not negated / Negated
- If "followed by": Within (operand widget) + Matching method (Loose/Strict/Negated)
- Advanced: description
`[VERIFIED: EDITOR_REFERENCE.md §29, piston_module_html.txt lines 1454–1509]`

---

## §4 Operand Widget

The operand widget is the reusable UI for entering any value. Appears in condition left/right operands, restriction operands, task parameter slots, switch expression, exit value, case value, and for/each loop fields. An unresolved variable reference offers inline creation — see §10.2.

### §4.1 Operand Source Types
`[VERIFIED: EDITOR_REFERENCE.md Appendix B, piston_module_html.txt lines 1831–1842]`

| Code | Source | What it picks |
|---|---|---|
| `d` | Device token | Physical device(s) as variable/token |
| `p` | Device + attribute | Physical device + attribute picker; aggregation option for multiple devices |
| `v` | Virtual device | Virtual/system device single-select |
| `s` | Preset | Sunrise/Noon/Sunset/Midnight (time/datetime); color presets |
| `c` | Constant | Literal text/number/date/time input; dropdown if enum options defined |
| `x` | Variable | Local/global/system variable; list-index field for list types |
| `e` | Expression | Expression textarea + rendered preview |
| `u` | Argument | Argument text input |

### §4.2 Three-Tier Value Resolution (right operands and task parameters)
`[VERIFIED: WIZARD_ACTION_COMMAND_SPEC.md Part 5]`

- **Tier 1 — Enumerated dropdown:** shown when the attribute has a known option list (`o` field in webcore_vocab.json attributes). `[VERIFIED: webcore_vocab.json attributes — enum types have "o" array]`
- **Tier 2 — Inferred type widget:** widget type from attribute `t` field. `[VERIFIED: webcore_vocab.json attributes — "t" field; WEBCORE_WIZARD_MAP.md Part 17]`
- **Tier 3 — Free operand escape hatch:** user overrides to any operand type; seeded with current HA state. `[VERIFIED: WIZARD_ACTION_COMMAND_SPEC.md Part 5]`

### §4.3 Attribute Types (webcore_vocab.json `t` field values)
enum / integer / decimal / string / object / color / hexcolor / datetime / image / vector3
`[VERIFIED: webcore_vocab.json attributes section — t field values across all entries]`

### §4.4 Parameter Widget Types (WEBCORE_WIZARD_MAP.md Part 17)
color / text / range / number / boolean / enum / duration
`[VERIFIED: WEBCORE_WIZARD_MAP.md Part 17]`

### §4.5 Duration Unit Selector
Duration operands show: ms / s / min / hours / days / weeks / months / years
`[VERIFIED: EDITOR_REFERENCE.md §28, piston_module_html.txt lines 1990–2001]`

### §4.6 Physical Device Aggregation
When multiple devices selected in a `p`-type operand: aggregation option shown (any / all / avg / count / max / min / etc.)
`[VERIFIED: EDITOR_REFERENCE.md §28, piston_module_html.txt lines 885–887]`

### §4.7 Operand Data Shape

Every operand is an object with these fields (defaults from `validateOperand()`):

| Field | Type | Purpose |
|---|---|---|
| `t` | string | Selected source type: `p` / `v` / `d` / `x` / `s` / `c` / `e` / `u` — or `""` (nothing selected) |
| `a` | string | Attribute key (for `p`-type physical device operands) |
| `c` | string | Constant value (for `c`-type) |
| `v` | string | Virtual device id (for `v`-type) |
| `e` | string | Expression string (for `e`-type) |
| `x` | string | Variable name (for `x`-type) |
| `d` | array | Device id array (for `d`-type and `p`-type) |
| `g` | string | Aggregation function: `any` / `all` / `avg` / `count` / `least` / `max` / `median` / `min` / `most` / `stdev` / `sum` / `variance` — default `"any"` |
| `f` | string | Timed comparison direction: `l`=less than / `g`=at least — default `"l"` |

`[VERIFIED: WEBCORE_WIZARD_MAP.md Part 22 — validateOperand() default data shape]`

### §4.8 Allow Flags — Source Types Suppressed by DataType

Which source-type options appear in the type dropdown depends on the operand's `dataType`. Rules from `validateOperand()`:

| Source type | Suppressed when dataType is… |
|---|---|
| `p` (physical device) | datetime, date, time, device, variable, boolean (strict), duration |
| `v` (virtual device) | datetime, date, time, device, variable, decimal, integer, number, boolean, enum, color, duration |
| `s` (preset) | Shown ONLY for: datetime, time, color |
| `c` (constant) | device, variable |
| `x` (variable) | device (unless multiple=true), boolean (strict) |
| `e` (expression) | variable, boolean (strict), events |

**`onlyAllowConstants` mode:** active in edit-local-variable, edit-global-variable, and every-timer interval operands. In this mode only `c` (constant) or `d` (device list) is available — physical, virtual, variable, and expression types are all hidden.

`[VERIFIED: WEBCORE_WIZARD_MAP.md Part 23 — validateOperand() allow-flag logic]`

### §4.9 DataType Normalizations

Before allow-flag processing, plural and variant dataType strings are normalized to their canonical singular form. The normalizations also set `operand.multiple = true` for list contexts:

| Raw dataType | Normalized to | Sets `multiple` |
|---|---|---|
| `variables` | `variable` | yes |
| `devices` | `device` | yes |
| `pistons` | `piston` | yes |
| `routines` | `routine` | yes |
| `rules` | `rule` | yes |
| `attributes` | `attribute` | yes |
| `modes` | `mode` | yes |
| `alarmsystemstatuses` | `alarmSystemStatus` | yes |
| `enums` | `enum` | yes |
| `lifxScenes` | `lifxScene` | yes |
| `contacts` | `contact` | yes |
| `number` | `decimal` | no |
| `bool` | `boolean` | no |
| `alarmsystemstatus` | `alarmSystemStatus` | no |
| `lifxscene` | `lifxScene` | no |
| `lifxselector` | `lifxSelector` | no |

`[VERIFIED: WEBCORE_WIZARD_MAP.md Part 24 — validateOperand() normalization switch block]`

### §4.10 Constant-Type Options Population

For `c`-type (constant) operands, the options dropdown is populated from:

| dataType | Options source |
|---|---|
| `boolean` | Hardcoded: `['false', 'true']` |
| `mode` | `instance.virtualDevices['mode'].o` |
| `powerSource` | `instance.virtualDevices['powerSource'].o` |
| `alarmSystemStatus` | `instance.virtualDevices['alarmSystemStatus'].o` |
| `rule` | `instance.virtualDevices['rule'].o` |
| `routine` | `instance.virtualDevices['routine'].o` |
| `attribute` | `listAvailableAttributeNames(parent.d)` |
| `piston` | `listAllPistons()` |
| `contact` | contacts list |
| `lifxScene` | `instance.lifx.scenes` |
| `lifxSelector` | Empty array — uses custom grouped select widget (LIFX-specific) |
| `integer`, `decimal`, `duration` | null — plain number input, no dropdown |
| everything else | null — plain text input, no dropdown |

`[VERIFIED: WEBCORE_WIZARD_MAP.md Part 25 — validateOperand() options-population switch block]`

---

## §5 Statement Type Picker

`dialog-edit-statement` page 0 shows available statement types as cards. Simple and advanced groups. Clipboard section appears when clipboard has content.
`[VERIFIED: EDITOR_REFERENCE.md §6, piston_module_html.txt line 920]`

Available types (all from PISTON_JSON_STRUCTURE_MAP.md §5–27):
IF, DO, ON_EVENT, WHILE, REPEAT, EVERY, SWITCH, FOR, FOR_EACH, BREAK, EXIT, ACTION (with), SET_VARIABLE, WAIT, WAIT_FOR_STATE, LOG_MESSAGE, CALL_PISTON, CANCEL_PENDING_TASKS

ELSE_IF is not in the type picker — it is added via `+ add else if` within an existing IF block.
`[VERIFIED: EDITOR_REFERENCE.md §6, piston_module_html.txt line 579]`

PistonCore-specific standalone types (§3.22–3.27) require original type-picker cards and original dialogs.
`[ASSUMED: EDITOR-GAP-2 — RISK medium]`

### §5.1 Do-List Commands Are Vocab-Driven

The do-list — the non-device "Location commands (non-device)" actions available inside a with-block / action statement — is **built at runtime from `webcore_vocab.json` `virtualCommands`**, not hand-enumerated in this spec or in code. This is the §0.6 vocab-as-runtime-data rule applied to the do-list, exactly as §7.2 applies it to the device command picker.

`virtualCommands` contains 59 entries. Each renders using its own fields: `n` (display name), `d` (display format string with `{N}` placeholders filled by parameter values), `p` (parameter list, each parameter an operand of the given type rendered via §4).
`[VERIFIED: webcore_vocab.json virtualCommands — 59 entries with n/d/p fields]`

**The wizard offers ALL 59** — no curation, no v1 subset. Per the all-of-WebCore rule, the wizard surface exposes the entire vocabulary. Whether the compiler can yet route a given command to HA is a separate, compiler-scope question (§13 / HA_LIMITATIONS.md); an unroutable command may still be authored and is flagged at compile time, not hidden from the wizard.
`[DECISION: do-list is the full virtualCommands set, vocab-driven per §0.6; v1 scoping is compiler-only and never removes commands from the wizard surface]`

**Display and commit.** A do-list item renders via §7.2's command-display rule (`d` format with `{N}` placeholders, else `n`). On commit it becomes a TASK node carrying the command token and its parameter values — the token is the vocab key, stored verbatim.
`[VERIFIED: webcore_vocab.json — virtualCommands d/n/p fields; §7.2 command display rule]`
`[DECISION: do-list item commits as a TASK with the vocab key as the command token]`

---

## §6 Condition / Trigger / Restriction Builder

### §6.1 Group Operator
Condition groups use operator field `o`: `and` / `or` / `xor` / `followed_by`.
PistonCore surfaces only **All (and) / Any (or) / None** to users — XOR is not surfaced because it forces PyScript.
`[DECISION: WIZARD_MENU_FALLS_RAW_EXTRACT.md Deviations — Any/All/None only; XOR forces PyScript per HA_LIMITATIONS.md §6]`

Restriction group uses `rop` field; same three options apply.
`[VERIFIED: EDITOR_REFERENCE.md §5, piston_module_html.txt line 859]`

### §6.2 Left Operand (Lo)
User picks: (1) a device — physical device, variable, or global; (2) an attribute for that device from the capability map.

The wizard displays friendly names. Resolves to entity IDs at commit time per §0.1.
`[VERIFIED: WIZARD_ACTION_COMMAND_SPEC.md Part 7; WEBCORE_WIZARD_MAP.md Part 16 steps 1–2]`

Capability map (`webcore_vocab.json` capabilities section): each entry has `n` (name), `d` (plural description), `a` (primary attribute), optional `c` (commands array).
`[VERIFIED: webcore_vocab.json capabilities section]`

### §6.3 Comparison Operator Selection
Operator list filtered by attribute data type using the `g` field on each comparison.
`[VERIFIED: webcore_vocab.json comparisons.conditions — each operator has "g" field with type codes]`

`g` field type codes: `b`=boolean/enum, `s`=string, `d`=decimal, `i`=integer, `f`=date/time, `t`=time-only. Multiple chars = appears for all those types.
`[VERIFIED: webcore_vocab.json comparisons.conditions entries]`

Operator modifier flags:
- `p:0` → no right operand; `p:1` → one right operand; `p:2` → two right operands (range)
- `t:1` → timed (duration field shown); `t:2` → past-tense (lookback field shown)
- `m:true` → multi-value right operand
`[VERIFIED: webcore_vocab.json comparisons section — p/t/m fields present on relevant entries]`

### §6.4 Timed Operator Duration
Shown when operator `t:1` or `t:2`. Duration widget for `to` operand. Range timed operators add `to2`.
`[VERIFIED: EDITOR_REFERENCE.md §4, piston_module_html.txt lines 1728, 1788–1799]`

### §6.5 When-True / When-False Blocks
Individual CONDITION nodes support `ts[]` (when-true) and `fs[]` (when-false) sub-statement arrays.
`[VERIFIED: WEBCORE_WIZARD_MAP.md Part 32; PISTON_JSON_STRUCTURE_MAP.md §4]`

EDITOR-GAP-4 (from EDITOR_REFERENCE.md) is RESOLVED — ts/fs ARE in the PistonCore structure map.

### §6.6 Trigger Notes
TRIGGER shares the CONDITION JSON shape (PISTON_JSON_STRUCTURE_MAP.md §3) and uses the same §6 builder dialog. The only differences: `is_trigger: true` on the node, and the node is saved to `piston.triggers[]` instead of `conditions[]`. No separate trigger dialog exists or is needed.

EDITOR-GAP-1 — CLOSED. This was a false gap: the §6 Condition / Trigger / Restriction Builder already covers triggers. The "no WebCoRE precedent" note referred to PistonCore's separate `triggers[]` array being its own design choice — not to the dialog being undesigned.

---

## §7 Action Statement and Task Dialog

### §7.1 Action Statement — Device Groups
Page 1 device selector groups:
- Virtual Location device
- Physical devices (from HA)
- Local device variables
- Global device variables

Notify targets are handled as their own flat section — see §8.5. They do NOT route through the device-picker machinery in §8.2 (no capability intersection, no entity-ID resolution): a notify target is a service, not a device.
`[VERIFIED: EDITOR_REFERENCE.md §19, piston_module_html.txt lines 1057–1079; WIZARD_ACTION_COMMAND_SPEC.md Part 7]`

### §7.2 Task Command Picker — Intersection Rule
Commands grouped as **Common** (available to ALL selected devices — intersection).

PistonCore deviates from WebCoRE: **no Partial group** shown. Commands appear ONLY if ALL selected devices support them.
`[DECISION: WIZARD_ACTION_COMMAND_SPEC.md Part 3, Deviation D-1]`

Virtual/location commands: "Location commands (non-device)" group.
`[VERIFIED: EDITOR_REFERENCE.md §20, piston_module_html.txt line 2144]`

Capability source: commands come from `webcore_vocab.json` capabilities section (`c` array), NOT from HA services.
`[VERIFIED: WIZARD_ACTION_COMMAND_SPEC.md Part 4; webcore_vocab.json capabilities.*.c arrays]`

Command display:
- With `d` field: format string with `{N}` placeholders filled by param values
- Without `d` field: `command.n`
`[VERIFIED: webcore_vocab.json commands section; WEBCORE_WIZARD_MAP.md Part 29]`

### §7.3 Task Ordering
`insertIndex` controls insertion position within `parent.k`. On commit, task is spliced to chosen position.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §6]`

### §7.4 Chaining
After committing a new ACTION: wizard immediately opens task dialog scoped to new with-block's tasks array.
After committing a new IF: wizard opens condition dialog.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §4 — optional chaining via nextDialog]`

### §7.5 Speak — Author-Time Gate
Speak is offered as a task type in the do-list ONLY IF all three good-faith checks pass:
1. all resolved entities in the with-block are domain `media_player`, AND
2. every resolved player advertises `supported_features & 512` (PLAY_MEDIA), AND
3. at least one `tts.*` engine entity exists in HA.

If all three hold, "Speak text" is offered; otherwise it is not.

- The PLAY_MEDIA check is intersected across selected devices using the same intersection rule as §8.2 — reference it, do not restate.
- The gate is best-effort, author-time only — it can be stale. It exists to stop the user building an obviously-broken Speak task, not to guarantee correctness (authoritative compatibility is a compiler concern, out of scope).
- Data the gate needs (PLAY_MEDIA bit, tts list) is forwarded per §8.6.
- Volume: Speak's inline optional volume field AND the standalone Set Volume task both exist, exactly as the WebCoRE falls define (WEBCORE_WIZARD_MAP). Do NOT force one shape.
`[VERIFIED: SPEAK_ACTION_SPEC.md §3.3, §6; WEBCORE_WIZARD_MAP.md (volume falls)]`

### §7.6 Custom Command Parameter Builder
For a custom / user-defined command (one not carrying a fixed `p` parameter list from `webcore_vocab.json`), the task dialog lets the user define the command's parameters by hand. Shown only when the task is in custom mode (`designer.custom`).
`[VERIFIED: piston.module.html.txt — addParameter()/deleteParameter() controls gated on designer.custom]`

A **Parameters** dropdown in the task-dialog footer, present only while `designer.custom` is true, offers five typed adders. Each appends a new parameter slot of the chosen type to `designer.parameters`:
- `addParameter('string')` — text parameter
- `addParameter('integer')` — integer parameter
- `addParameter('decimal')` — decimal parameter
- `addParameter('boolean')` — boolean parameter
- `addParameter('datetime')` — datetime parameter

Each appended slot is rendered by the operand/parameter widget (§4) at the chosen type, so the user fills its value with the same widget machinery as any other parameter.
`[VERIFIED: piston.module.html.txt — addParameter('string'|'integer'|'decimal'|'boolean'|'datetime') entries in task footer dropdown]`

**Delete a parameter (`deleteParameter(parameter)`).** Each existing parameter has a delete entry in the same dropdown below a divider. Removes that slot from `designer.parameters`.
`[VERIFIED: piston.module.html.txt — deleteParameter(parameter) per existing parameter, below a divider in the same dropdown]`

**Commit.** On task commit (§9.4), custom parameters travel with the task node as its parameter list, identical to fixed-command parameters.
`[DECISION: derived from WebCore behavior — custom parameters serialize into the task node's parameter array like vocab params; compiler routing of custom commands is compiler-scope, not wizard]`

---

## §8 Device Picker — Capability-Organized

### §8.1 Picker Root
Surfaces physical devices from HA and device variables (local and global).
`[VERIFIED: EDITOR_REFERENCE.md §19, piston_module_html.txt lines 1057–1079; WIZARD_ACTION_COMMAND_SPEC.md Part 7]`

### §8.2 Capability Loading — Five-Step Pipeline
On device selection:
1. **Backend forwards capability signals** per device by friendly name: `supported_features` integer flags plus declaration attributes (e.g. `supported_color_modes`, `hvac_modes`). No entity IDs at this stage.
2. **Translate signals → capability keys**: the wizard applies the Capability-Detection Table (net-new artifact — build session required) to map each HA signal to a WebCoRE capability key. Detection must use declaration surface attributes, never transient value attributes (e.g. brightness uses `supported_color_modes`, not the current `brightness` value).
3. **Intersect capability keys** across all selected devices: only keys present for ALL devices are offered (Deviation D-1 — intersection-only, no Partial group). Multiple entities on a single device are unioned before intersecting across devices.
4. **Build menu from vocab**: the intersected keys drive the capability → attribute → type → operators → value widget chain, populated from `webcore_vocab.json` at runtime (§0.6).
5. **Commit writes entity IDs**: when the user selects a capability, the wizard writes entity IDs — one per device for the chosen capability — into the node. This is the ONLY point entity IDs appear in the picker flow.

Steps 1–4 compare devices by capability key only. Step 5 writes entity IDs as output. These are deliberately different scopes and must never collapse (§0.2).
`[DECISION: PICKER_STRUCTURE_SPEC.md §1–§4 — five-step pipeline; capability-key comparison replaces discarded entity-ID-organized approach]`

**Capability translation files (built — use these):**
- `picker_capability_map.json` — the machine-readable lookup the picker loads at runtime. Organized by HA domain → detection rules → WebCoRE attribute keys. This is the file the picker code reads.
- `CAPABILITY_DETECTION_TABLE.md` — the spec: algorithm, domain-by-domain rules, assumed-row checklist.
- `pistoncore_attribute_translation.json` — REVERSE direction (WebCoRE key → HA source) for compiler use, not picker use.
`[DECISION: CAPABILITY_DETECTION_TABLE.md — derived from PistonCore_HA_to_WebCoRE_Attribute_Map.md v2.0; assumed rows flagged for deploy verification]`

### §8.3 Device Variable Resolution
Variables store friendly names. On resolution, picker looks up each friendly name in device registry to get device IDs, then loads all entity IDs.
`[VERIFIED: WIZARD_ACTION_COMMAND_SPEC.md Part 7; PISTON_JSON_STRUCTURE_MAP.md §1]`

**Dual-bucket resolution (device + notify):** on resolution the wizard looks up each friendly name in BOTH buckets — the device registry (above) AND the notify service registry (§8.5).
- If ALL friendly names in the variable resolve in BOTH buckets, both types resolve in parallel and the combined options are displayed. Resolution to the specific target (device entity vs notify service) happens ON SELECTION.
- If only some names are notify-capable (not all), notify is NOT offered for that variable; device resolution proceeds normally.
- The variable still stores friendly names — dual-bucket lookup is resolution-time behavior, not a change to storage (§0.1 unchanged).
`[DECISION: user — dual-bucket parallel resolution]`

OPEN — DO NOT INVENT: mixed / split-resolution variables (some names notify-capable, some not, or wanting partial per-name resolution) are NOT designed. The all-or-nothing rule above is settled.
`[ASSUMED: split-resolution case not designed — defer until encountered in real use]`

### §8.4 Missing Device Indicator
The ⚠ inline marker appears on a node only when a device that was previously assigned is now offline or not resolvable in live HA at edit-load time. An empty node (`entity_ids: []`) during piston creation is not flagged — that is the normal building state, not a problem. HA handles offline devices at runtime natively; the ⚠ is informational only. The full offline model (three device states, materialized row, deselect affordance) is in §8.7.
`[DECISION: EDIT_DEVICE_RECONCILIATION_SPEC.md §1, §5 — ⚠ is offline/missing only; empty nodes never flagged]`

### §8.5 Notify Target Section
Notify targets appear as their own flat section inside the picker — found where devices are found, but structurally separate from the device picker (§8.1–§8.2). A notify target is an HA service, not a device: it has no sub-entities and no capability bits, and must never be routed through `_groupDevices`, capability intersection, or entity-ID resolution.

- Populated flat from the notify service registry (backend-forwarded — see §8.6). One row per `notify.*` service. Display de-slugified: `mobile_app_jeremy_s_s25` → "Jeremy's S25"; the full service id is stored.
- Picker match is friendly-name → type: if the selected friendly name(s) are the notify type, the notify section is offered.
- After a target is picked, the task collects: message (required) and title (optional). The rich companion-app `data` payload (actions, image, tag, priority) is staged incrementally — NOT v1.
- Commit: a standard §20 TASK — `command:"notify"`, `domain:"notify"`, `ha_service` = chosen service, `parameters` = message/title. No `kind`, no `target_ref`.
`[VERIFIED: NOTIFY_ACTION_SPEC.md §1.2, §1.3, §4.3; PISTON_JSON_STRUCTURE_MAP.md §20]`

**Two-place split (intentional — do NOT merge):** the same physical phone legitimately appears in TWO picker places — as a notify service here (§8.5), and as its sensor entities (`sensor.*_battery_level`, `binary_sensor.*_is_charging`) in the normal device picker (§8.1). The notify service does only "send a notification"; the sensor entities are real entities with a `device_id`. Mirrors WebCoRE's split between device-for-status and notification-destination. Cross-referencing the two (notify a phone AND show its battery as one unit) is v1 OUT OF SCOPE.
`[VERIFIED: NOTIFY_ACTION_SPEC.md §1.4, §6]`

### §8.6 Backend Forwarding for Picker
Several picker capabilities depend on data the backend must forward intact. The following are read from the existing HA `get_states` call (no new round-trips) but are currently at risk of being stripped:
- **Notify service registry** — the `notify.*` services that populate §8.5.
- **PLAY_MEDIA bit** — per-entity `attributes.supported_features` (the `&512` flag), needed for the Speak gate (§7.5).
- **TTS engine list** — `tts.*` entities, needed for the Speak gate (§7.5) and the default-engine setting.
- **Companion lists** — `hvac_modes`, `preset_modes`, `source_list`, `effect_list` (json_object capability lists) used by value resolution in §4.
`[VERIFIED: SPEAK_ACTION_SPEC.md §6; NOTIFY_ACTION_SPEC.md §1.2; HA_LIMITATIONS.md]`

### §8.7 Edit-Load Device Reconciliation (Offline Device Persistence)

**Scope: EDIT ONLY.** Applies exclusively when opening an EXISTING piston. A new piston's picker is populated from live HA only — an offline device cannot appear because it is not live data to pick. Everything in this section is triggered only by edit-load reconciliation.
`[DECISION: EDIT_DEVICE_RECONCILIATION_SPEC.md §8 — scope guard]`

**Three device states on edit-load.** Every device in a node or variable/define slot is in exactly one of:

| state | what it means | how it renders |
|---|---|---|
| **Live** | stored device resolves against current live HA | normal interactive row, no flag |
| **Offline** | stored in the piston, NOT in current live HA | interactive row materialized from stored data, flagged `!`, fully deselectable |
| **Removed** | not in the stored piston at all | does not appear; addable only via live picker |

The displayed selected list = live-resolved devices + re-imported offline devices. Both types produce real, interactive, deselectable rows.
`[DECISION: EDIT_DEVICE_RECONCILIATION_SPEC.md §1]`

**Offline re-import rule.** A stored device that does not resolve against live HA is re-imported as a real interactive row built entirely from the JSON — no live HA lookup attempted. It renders selected (checked), flagged `!`, and fully deselectable. This fix is for the known bug where offline devices had no row and therefore could not be removed (§8.7 implementation invariant below).
`[DECISION: EDIT_DEVICE_RECONCILIATION_SPEC.md §2, §5]`

**Variable/define slots vs. direct-on-node.** Per the load-bearing rule (§0.1), variables store friendly names only — never entity IDs. The offline row label therefore differs by slot type:
- **Variable/define slot:** offline row materializes from the stored **friendly name** (user-assigned, human-readable). No entity_id is in the variable; none is needed.
- **Direct-on-node:** offline row materializes from the stored **entity_id**. The id + `!` flag is sufficient. If the id is opaque, the `!` flag is the signal to the user that the device needs attention.
`[DECISION: EDIT_DEVICE_RECONCILIATION_SPEC.md §4 — load-bearing rule governs; variables never store entity IDs]`

**Two non-crossing rules.**
- **Rule A — Offline never removes.** A device being offline does not drop it from the piston. It persists across edits indefinitely, re-imported each time as a selected `!` row. Only the user removes a device (Rule B).
- **Rule B — Removal never auto-returns.** When the user deselects a device and saves, it is gone from the stored piston — permanently absent, no blacklist, no re-entry on reconnect. Return requires the user to re-add it manually after the device is back online (live picker only; a still-offline removed device cannot be re-added).

Offline ≠ removed. Removed ≠ blacklisted. The two triggers never cross.
`[DECISION: EDIT_DEVICE_RECONCILIATION_SPEC.md §3]`

**Implementation invariant.** The selected-list builder MUST iterate the STORED device set (not the live set) and produce a row for every stored device, marking each live or offline and flagging the offline ones. Building from the live set alone reintroduces the original bug.
`[DECISION: EDIT_DEVICE_RECONCILIATION_SPEC.md §5 — building from live set is the root-cause regression]`

**Notify exclusion.** Notify targets have no device/entity to resolve and do not route through this reconciliation flow.
`[DECISION: EDIT_DEVICE_RECONCILIATION_SPEC.md §7]`

---

## §9 Edit-Isolation Contract

### §9.1 Scratch Buffer
Every dialog edits `$scope.designer` — built fresh from the live node on open, discarded or committed on close. Live tree not touched until explicit Save/Add. Cancel = discard, no rollback needed.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §1, §2, §3]`

### §9.2 Clone vs Reference
- Scalar/flag fields: copied flat into `designer.*`
- Complex value fields (operands, comparisons): **deep-copied** — live node untouched until save
- `designer.$obj` / `designer.$statement`: retained reference to the original live node
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §2]`

### §9.3 New vs Existing
New: `editX(null, parent)` fabricates blank template; `$new:true`.
Existing: `editX(node, parent)` seeds designer from existing node.

For new node initial values (committed JSON shapes and their default field values), see **PISTON_JSON_STRUCTURE_MAP.md** for each node type — that is the authoritative source for what gets written to the piston JSON.

For the designer scratch buffer field contracts used while a dialog is open, see **§9.6**.
`[DECISION: PISTON_JSON_STRUCTURE_MAP.md owns committed node shapes; §9.6 owns designer scratch buffer fields — do not restate either here]`

### §9.4 Commit Sequence
1. `autoSave()` — snapshot BEFORE applying change
2. Resolve target: new → build from designer; existing → reuse `designer.$statement`
3. Write fields back from designer onto node
4. Clear cached render: `statement.$$html = null`
5. If new → splice into parent: `.s` / `.c` / `.r` / `.k` / `.cs`
6. Validate + close dialog
7. Optional chaining: open next dialog for new child array
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §4]`

### §9.5 Group Upgrade Path
A single condition can be wrapped into a group in place via `upgradeCondition()`: runs updateCondition(), finds committed condition by indexOf, builds `{t:'group', o:'and', n:false, c:[oldCondition]}`, replaces array slot.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §7]`

**Statement upgrade (`upgradeStatement`).** Available when editing an existing IF / WHILE / REPEAT statement (non-new mode only). Wraps the statement's condition into a group in place:
1. Run `updateStatement()` to commit pending edit.
2. Locate committed condition in the statement's condition array (`indexOf`).
3. Build `{t:'group', o:'and', n:false, c:[oldCondition]}`.
4. Replace the array slot with the group.
`[VERIFIED: piston.module.html.txt — upgradeStatement() "Convert to new group" button, ng-if="!designer.$new && ((designer.type=='if') || (designer.type=='while') || (designer.type=='repeat'))"]`
`[DECISION: derived from WebCore behavior — mechanics identical to upgradeCondition() above; only the host node type differs]`

**Restriction upgrade (`upgradeRestriction`).** The function exists in WebCoRE source and the button is coded with label "Convert to new group," but it is permanently hidden in WebCoRE by `ng-if="(0==1)"` — never surfaced in the real WebCoRE UI. PistonCore keeps it hidden — do not implement.
`[VERIFIED: piston.module.html.txt — upgradeRestriction() button present but ng-if="(0==1) && !designer.$new && designer.parent" permanently prevents rendering]`
`[DECISION: keep hidden — matches WebCoRE shipped behavior; do not surface upgradeRestriction() in PistonCore]`

---

### §9.6 Dialog Field Contracts

The full scratch-buffer field set for every dialog, derived from piston.module.html.txt. These are the properties the dialog object must carry while open. All names come from the source's data-binding fields translated to vanilla JS — no Angular syntax in the implementation.

**Shared scratch buffer properties (all dialogs):**

| Field | Type | Purpose |
|---|---|---|
| `isNew` | boolean | true = add mode; false = edit mode |
| `page` | integer | 0 = type-picker page; 1 = form page. Not all dialogs use this — see page model below |
| `showAdvancedOptions` | boolean | toggles the advanced options block |
| `description` | string | optional description for the node (advanced) |

`[VERIFIED: piston.module.html.txt — designer.$new, designer.page, designer.showAdvancedOptions, designer.description present across all dialogs]`

---

#### Page Navigation Model (resolves EDITOR-GAP-6)

Three dialogs are two-page; all others are single-page.

| Dialog | Pages | Notes |
|---|---|---|
| edit-statement | 0 (type picker) + 1 (form) | Back button on page 1 in add mode only |
| edit-condition | 0 (type picker) + 1 (form) | Back button on page 1 in add mode only |
| edit-restriction | 0 (type picker) + 1 (form) | Back button on page 1 in add mode only |
| edit-task | page=0 only — single page | No page 1 |
| edit-variable | page=0 only — single page | No page 1 |
| edit-event | No page field — single page | No Back |
| edit-condition-group | No page field — single page | No Back |
| edit-restriction-group | No page field — single page | No Back |
| edit-case | No page field — single page | No Back |
| edit-global-variable | No page field — single page | No Back |
| edit-local-variable | No page field — single page | No Back |

**Two-page navigation contract:** Page 0 shows type-picker cards. Each card has an Add button that writes the chosen type to `designer.type` and advances to page 1. In add mode, page 1 has a Back button that returns to page 0. In edit mode, the dialog opens directly on page 1 — no type picker is shown. The clipboard section appears at the bottom of page 0 when the clipboard is non-empty.

`[VERIFIED: piston.module.html.txt — edit-statement/edit-condition/edit-restriction each have designer.page==0 and designer.page==1 blocks; Back (prevPage()) only shown when designer.$new; setDesignerType(type, true) navigates to page 1]`

---

#### edit-statement field contract

**Page 0:** type cards (simple and advanced groups) + clipboard section. Cards write to `designer.type` and advance to page 1.

`[VERIFIED: piston.module.html.txt lines 917–958 — designer.items.simple/advanced card repeat, setDesignerType(item.type, true)]`

**Page 1 — fields shared by all statement types:**

| Field | Type | Notes |
|---|---|---|
| `type` | string | if / while / repeat / for / each / switch / do / on / action / every / exit / break |
| `description` | string | advanced |
| `tep` | string | task execution policy: '' / 'c' / 'p' / 'b' — advanced; not shown for `on` |
| `tcp` | string | task cancellation policy: '' / 'c' / 'p' / 'b' — advanced; not shown for `on` |
| `async` | string | '0'=sync / '1'=async — advanced; not shown for `every` or `on` |
| `disabled` | string | '0' / '1' — advanced |

**Additional fields by type:**

| Type | Extra fields |
|---|---|
| `switch` | `operand` (expression operand); `ctp` ('i'/'e' case traversal policy, advanced); `smode` ('auto'/'always'/'never', advanced) |
| `for` | `operand` (start value); `operand2` (end value); `operand3` (step value); `x` (counter variable name, optional string) |
| `each` | `x` (counter variable name, must be device type); `operand` (list-of-devices operand) |
| `every` | `operand` (interval operand — carries sub-fields below); `operand2` (at-time operand); `operand3` (time offset operand) |
| `action` | `devices` (array of selected device IDs / variable name strings); `tsp` ('' / 'a' task scheduling policy, advanced) |
| `exit` | `operand` (new piston state operand) |
| `if` / `while` / `repeat` / `do` / `on` / `break` | no extra fields |

**EVERY timer interval sub-fields** (stored on `operand.data`):

| Sub-field | Purpose |
|---|---|
| `vt` | interval unit: 'ms' / 's' / 'm' / 'h' / 'w' / 'n' / 'y' |
| `om` | at-minute-of-hour (vt='h'); or minutes filter (vt='ms'/'s') |
| `oh` | hours filter (vt='ms'/'s'/'m') |
| `odw` | day-of-week (required for vt='w'; optional filter otherwise) |
| `odm` | day-of-month (required for vt='n'/'y'; optional filter otherwise) |
| `owm` | week-of-month filter |
| `omy` | month-of-year (required for vt='y'; optional filter otherwise) |

`[VERIFIED: piston.module.html.txt lines 960–1281 — all ng-model bindings in edit-statement page 1]`

**Commit gate:** break/exit require `type` set AND form valid. All other types require only `type` set for the chain-into-body buttons (Add a condition, Add a task, etc.); edit mode Save also requires form valid.

---

#### edit-event field contract (single page)

| Field | Type | Notes |
|---|---|---|
| `comparison` | comparison object | see §9.6 Comparison Template |
| `description` | string | advanced |

**Commit gate:** `comparison.left.valid` must be true. (Events use only the left operand — no operator or right side.)

`[VERIFIED: piston.module.html.txt lines 1283–1309 — designer.comparison, ng-disabled="!designer.comparison.left.valid"]`

---

#### edit-condition field contract

**Page 0:** type cards (Condition / Group) + clipboard. Cards write `designer.type` and advance to page 1.

**Page 1 — condition type:**

| Field | Type | Notes |
|---|---|---|
| `type` | string | 'condition' |
| `comparison` | comparison object | see Comparison Template |
| `smode` | string | 'auto'/'always'/'never' — advanced |
| `comparison.left.data.dm` | string | variable name to store matching devices — advanced, shown when left operand is device-picker type |
| `comparison.left.data.dn` | string | variable name to store non-matching devices — advanced |
| `description` | string | advanced |

**Page 1 — group type:**

| Field | Type | Notes |
|---|---|---|
| `type` | string | 'group' |
| `operator` | string | 'and' / 'or' / 'xor' / 'followed by' |
| `not` | string | '0' / '1' — whole-group negation |
| `followedBy` | boolean | computed: true when operator === 'followed by'; drives within/withinOpt display |
| `comparison.within` | operand | duration for followed-by window |
| `comparison.withinOpt` | string | 'l'=loose / 's'=strict / 'n'=negated |
| `description` | string | advanced |

**Commit gate:** `type` must be set; if type==='condition' then `comparison.valid` must also be true.

`[VERIFIED: piston.module.html.txt lines 1313–1451]`

---

#### edit-condition-group field contract (single page — editing an existing group)

This is a separate dialog from edit-condition. It opens directly with no type picker.

| Field | Type | Notes |
|---|---|---|
| `operator` | string | 'and' / 'or' / 'xor' / 'followed by' |
| `not` | string | '0' / '1' |
| `followedBy` | boolean | computed from operator |
| `within` | operand | **Note:** `designer.within` directly, NOT `designer.comparison.within` as in edit-condition |
| `withinOpt` | string | 'l' / 's' / 'n' |
| `description` | string | advanced |

`[VERIFIED: piston.module.html.txt lines 1454–1508 — ng-model="designer.within" (not designer.comparison.within)]`

---

#### edit-restriction field contract

Same structure as edit-condition with these differences:
- No `smode` field
- No `comparison.left.data.dm` / `comparison.left.data.dn` (no save-matching-devices in restrictions)
- Page 0 shows the "Restrictions DO NOT subscribe to events" warning banner

`[VERIFIED: piston.module.html.txt lines 1516–1602]`

---

#### edit-restriction-group field contract (single page)

Same as edit-condition-group. Uses `designer.operator`, `designer.not`, `designer.description`. No `within`/`withinOpt` block visible in source (restriction groups do not support followed-by).

`[VERIFIED: piston.module.html.txt lines 1607–1648]`

---

#### edit-case field contract (single page)

| Field | Type | Notes |
|---|---|---|
| `type` | string | 's' = single value; 'r' = range |
| `operand` | operand | the match value (or range start) |
| `operand2` | operand | range end — only shown when type === 'r' |
| `description` | string | advanced |

**Commit gate:** `type` must be set.

`[VERIFIED: piston.module.html.txt lines 1651–1685]`

---

#### edit-task field contract (single page, page=0)

The task dialog is single page. It does not have a type-picker; it is always the same form.

| Field | Type | Notes |
|---|---|---|
| `parent` | reference | read-only ref to the parent action statement — used to display device names and existing task list |
| `insertIndex` | integer | position cursor in `parent.tasks` — tasks before index show above, tasks at/after show below |
| `command` | string | selected command key (from webcore_vocab.json commands or virtualCommands) |
| `parameters` | array | operand objects built by prepareParameters() when command changes |
| `mode` | array | selected mode IDs — "only during these modes" — shown when command is selected |
| `description` | string | advanced |
| `custom` | boolean | true = custom command mode, enables parameter builder (§7.6) |

**Commit gate:** `command` must be set (non-empty).

`[VERIFIED: piston.module.html.txt lines 2118–2205]`

---

#### edit-variable field contract (single page, page=0)

| Field | Type | Notes |
|---|---|---|
| `name` | string | variable name — user-typed |
| `operand.dataType` | string | type code: 'dynamic' / 'string' / 'boolean' / 'integer' / 'decimal' / 'long' / 'datetime' / 'date' / 'time' / 'device'; list variants append '[]' |
| `operand` | operand | initial value — not shown for list types (`dataType.endsWith('[]')`) |
| `assignment` | string | 'd'=dynamic / 's'=constant — only shown when operand has a value and type is not 'device' and not a list |
| `description` | string | advanced |

**Commit gate (Add):** name must be set OR be the literal 'true'/'false'; AND `operand.valid` must be true. **Add-more** gate: name must be set AND `operand.valid` true (stricter — no 'true'/'false' exception).

`[VERIFIED: piston.module.html.txt lines 2213–2277]`

---

#### edit-global-variable field contract (single page, no page field)

| Field | Type | Notes |
|---|---|---|
| `name` | string | global variable name |
| `operand.dataType` | string | type code: 'dynamic' / 'string' / 'boolean' / 'integer' / 'decimal' / 'datetime' / 'date' / 'time' / 'device' — no list variants |
| `operand` | operand | value |

**Commit gate:** name set AND `operand.valid` AND `validateGlobalVariableName()` passes (name uniqueness check — not duplicated in globalVars).

`[VERIFIED: piston.module.html.txt lines 2302–2337]`

---

#### edit-local-variable field contract (single page, no page field)

Inline value editor — for editing the current value of an already-declared local variable at runtime. Not part of the piston-authoring flow; shown inline in the variable list.

| Field | Type | Notes |
|---|---|---|
| `name` | string | read-only, shown in header only |
| `operand` | operand | the current value to set |

**Commit gate:** `operand.valid`.

`[VERIFIED: piston.module.html.txt lines 2282–2298]`

---

#### Comparison Template — shared sub-object

Used by edit-event, edit-condition (condition type), and edit-restriction (restriction type). The comparison object lives at `designer.comparison`.

| Field | Type | Purpose |
|---|---|---|
| `left` | operand | Left side — "what to compare" / "what event to expect" |
| `operator` | string | Comparison operator code (from webcore_vocab.json comparisons) |
| `right` | operand | Right side — "compare to" — shown when `parameterCount > 0` |
| `right2` | operand | Range end — "...and..." — shown when `parameterCount > 1` |
| `time` | operand | Duration — "for..." / "in the last..." — shown when `timed > 0` |
| `time2` | operand | Second time operand for two-sided time ranges |
| `within` | operand | "Within..." duration for followed-by |
| `withinOpt` | string | 'l'=loose / 's'=strict / 'n'=negated — matching method for followed-by |
| `parameterCount` | integer | computed — 0 = no right side; 1 = one right; 2 = range. Drives right/right2 display |
| `timed` | integer | computed — 0 = no duration; 1 = "in the last"; 2 = "for at least/less than". Drives time display |
| `event` | boolean | true = event mode. Hides operator dropdown; changes left-side label to "What event to expect" |
| `valid` | boolean | computed overall validity — used as commit gate |

**Schedule filter fields** on `comparison.left.data` — shown when the left operand selects the built-in `time` system variable:

| Sub-field | Purpose |
|---|---|
| `odw` | day-of-week multi-select filter |
| `odm` | day-of-month multi-select filter |
| `owm` | week-of-month multi-select filter |
| `omy` | month-of-year multi-select filter |

`[VERIFIED: piston.module.html.txt lines 1689–1803 — comparison template ng-model bindings]`

---

## §10 Cross-Dialog Behaviors

Three behaviors appear in multiple dialogs and are specified once here; each dialog section carries a one-line pointer.

### §10.1 "Add more" / Re-arm Commit

**Purpose.** Lets the user commit the current item and immediately start another of the same kind, without the dialog closing. The footer carries a second commit button, **"Add more"** (`btn-success`), beside the normal Add/Save button.

**Where it appears.** Five add-dialogs, new-mode only (`designer.$new`):

| Dialog | Normal commit | Re-arm commit | Target array |
|---|---|---|---|
| edit-event | `updateEvent()` | `updateEvent(true)` | `parent.c` |
| edit-condition | `updateCondition()` | `updateCondition(true)` | `parent.c` |
| edit-task | `updateTask()` | `updateTask(true)` | `parent.k` |
| edit-variable | `updateVariable()` | `updateVariable(true)` | `piston.v` |
| edit-global-variable | `updateGlobalVariable()` | `updateGlobalVariable(true)` | `globalVars` |

`[VERIFIED: piston.module.html.txt — "Add more" buttons calling updateEvent(true)/updateCondition(true)/updateTask(true)/updateVariable(true)/updateGlobalVariable(true), class btn-success, ng-if="designer.$new"]`

**NOT re-arm — do not add the button to these.** edit-statement, edit-restriction, edit-case, the two group dialogs. edit-case's `updateCase(true)` exists but its label is "Add a statement" — that is chaining into the case body (§7.4), a different behavior. Restriction has no `updateRestriction(true)` variant in the source.
`[VERIFIED: piston.module.html.txt — no btn-success "Add more" in edit-statement/edit-restriction/edit-case/group dialogs; updateCase(true) labeled "Add a statement"]`

**The re-arm argument.** Each `updateX()` handler takes one boolean, `rearm` (the `true`). It controls only what happens AFTER the commit — the commit itself is identical to the normal path.

**Commit-and-re-arm sequence.** Extends the §9.4 commit sequence. Steps 1–5 are the §9.4 path unchanged; step 6 branches on `rearm`:

1. `autoSave()` — snapshot BEFORE the change (§11.2 bracket; the pre-change tree is undoable).
2. Resolve target node: new → build from `designer`; (re-arm is new-mode only, so always the new path).
3. Write fields back from `designer` onto the node.
4. Clear cached render on the parent (`$$html = null`).
5. Splice the committed node into the target array at the insert position (`insertIndex` if the dialog tracks one — see §7.3 for task; otherwise append).
6. **Branch on `rearm`:**
   - **`rearm === true` (Add more):** do NOT close the dialog. Rebuild `designer` as a fresh blank template for this dialog type (§9.3 blank templates — e.g. task `{c:'', a:'0', m:'', z:''}`). Advance the insert cursor: `insertIndex = insertIndex + 1` so the next item lands after the one just committed. Re-run validation so the new blank shows its initial disabled state. Dialog stays open, scrolled to the input, ready for the next entry.
   - **`rearm` falsy (Add/Save):** validate + close dialog (§9.4 step 6), then optional chaining (§9.4 step 7).

`[DECISION: derived from WebCore behavior — re-arm = commit via §9.4 then rebuild blank designer + advance insertIndex + hold dialog open; the alternative (close + reopen) is rejected because it loses insert position and scroll]`

**What carries vs. resets across a re-arm.** The committed node is independent; the new blank `designer` shares nothing with it. Nothing the user typed carries forward — each Add-more produces a fresh blank. The ONLY state that persists across the loop is `insertIndex` (advancing) and the parent scope (unchanged).
`[DECISION: derived — fresh blank per §9.3; no field inheritance, matching the blank-template-on-open contract of §9.1]`

**Button enable/disable.** "Add more" uses the same disabled-gate as the dialog's normal commit button (e.g. condition: `!designer.type || (type=='condition' && !comparison.valid)`; variable: `!designer.name || !designer.operand.valid`). When the normal Add is enabled, Add more is enabled.
`[VERIFIED: piston.module.html.txt — btn-success ng-disabled mirrors the adjacent Add button per dialog]`

**Task dialog — positional re-arm.** The task dialog (§7.3) maintains `insertIndex` into `parent.k` and renders existing tasks as before/after previews split at the cursor. Add-more there MUST splice at `insertIndex` (step 5) and advance it (step 6), so successive Add-mores build a contiguous run at the cursor position — not all appended to the end.
`[DECISION: derived — §7.3 insertIndex model requires positional splice; end-append would reorder the user's intended sequence]`

### §10.2 Inline Variable Creation ("create it")

**Purpose.** When the user types a variable name into an operand that is not yet declared, the operand's validation error offers an inline **"(create it)"** link that declares the variable on the spot and re-validates — without leaving the dialog or losing the in-progress edit.

**Where it appears.** Anywhere the operand widget (§4) renders, which is every value-taking slot: condition left/right/right2/within/time/time2 operands, restriction operands, for-loop start/end/step (`operand`/`operand2`/`operand3`), switch expression, exit value, case value, task parameters, variable initial value.
`[VERIFIED: piston.module.html.txt — autoAddVariable(...) appears at 20 operand sites, each paired with validateOperand(...)]`

**Trigger condition.** During operand validation (`validateOperand`), if the operand is an expression/variable reference (`data.t == 'e'` or `'x'`) that names an identifier not found in `piston.v` (locals), `globalVars`, or `systemVars`, validation fails with `expressionVar` set to the unresolved name. The error display then renders the "(create it)" link.
`[DECISION: derived from WebCore behavior — the error path exposes expressionVar; the link is shown only when an unresolved name is the validation failure]`

**Action on click.** The link calls, in order: `autoAddVariable(operand)` then `validateOperand(operand)`.
1. `autoAddVariable` reads the unresolved name from the operand (`operand.expressionVar` / the typed token).
2. It declares a new local variable: appends to `piston.v` a variable node `{t:'dynamic', n:<name>, v:{data:{}}, a:'d', z:''}` (the §9.3 variable blank template, with `n` set to the typed name and type defaulted to `dynamic`).
3. `validateOperand(operand)` re-runs; the name now resolves; the error clears; the operand becomes valid.
The user's dialog and all other in-progress fields are untouched — only `piston.v` gained a row.
`[DECISION: derived — default type dynamic because the create-it path has no type information at point of use; user can retype the variable later to set a concrete type. ASSUMED RISK low — verify default type against running editor.]`

**Scope.** Always creates a LOCAL variable (`piston.v`), never a global. Globals are created only through the explicit global-variable dialog.
`[DECISION: derived — autoAddVariable targets piston.v; globals require the deliberate global dialog with its name-validation gate]`

### §10.3 In-Dialog Clipboard Paste

**Purpose.** When the server clipboard (§12.2) holds a node and the user opens an add-dialog, a **"From clipboard"** section appears inside the dialog, letting them paste the held node directly into the array being edited — without going back to the canvas context menu.

**Where it appears.** The page-0 (type-picker) view of: edit-statement, edit-condition, edit-restriction, edit-task. Shown only when the clipboard is non-empty.
`[VERIFIED: piston.module.html.txt — "From clipboard" clipboard-item repeat blocks with pasteItem(item)/deleteClipboardItem(item) in those four dialogs]`

**Distinct from §12.6.** §12.6 is the clipboard preview in the statement *picker*. This (§10.3) is the same affordance generalized to the condition, restriction, and task add-dialogs. Both read the same §12.2 clipboard slot; they differ only in which dialog hosts them.
`[VERIFIED: piston.module.html.txt — clipboard-item blocks present in all four add-dialogs, not only the statement picker]`

**Rendering.** Each clipboard entry renders a read-only preview of the held node (via the node's normal render function — `renderStatement`/`renderCondition`/`renderRestriction`/`renderTask`) plus two buttons: **[Paste this \<type\>]** (`pasteItem(item)`) and **[Delete from clipboard]** (`deleteClipboardItem(item)`).
`[VERIFIED: piston.module.html.txt — preview + pasteItem + deleteClipboardItem per clipboard-item]`

**Paste action (`pasteItem`).** Follows the §12.4 / §12.5 paste contract exactly:
1. Deep-copy the clipboard JSON.
2. Regenerate every `id` in the copied subtree with a fresh UUID (§12.5 — no UUID may appear twice in the piston).
3. Splice the copy into the dialog's current target array at the insert position (the array the dialog is editing — `.s`/`.c`/`.r`/`.k`), same target resolution as §9.4 step 5.
4. The clipboard slot persists (§12.4) — the user may paste again.
5. Close the dialog (the paste IS the commit; there is no further field entry).
`[DECISION: derived from WebCore behavior — pasteItem reuses the §12.4/§12.5 canvas-paste contract; the only difference is the target array is the open dialog's array rather than "after selected node"]`

**Delete action (`deleteClipboardItem`).** Calls the §12.2 clipboard `DELETE`; the "From clipboard" section disappears when the slot empties. Does not affect the piston.
`[VERIFIED: piston.module.html.txt — deleteClipboardItem(item); §12.2 clipboard API]`

---

## §11 Undo / Redo / Autosave

### §11.1 Stack Structure
`stack = {undo: [], redo: []}`. Each entry: `{hash, timestamp, data}`. Data is a deep copy of the whole piston. Capped at `MAX_STACK_SIZE = 10`.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §8]`

### §11.2 autoSave()
Called at START of every `updateX`. Hashes current piston; if hash differs from top of undo stack, pushes snapshot and clears redo.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §8]`

### §11.3 Undo / Redo
`undo()` — push current to redo, pop undo, replace piston, re-validate, re-persist.
`redo()` — mirror.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §8]`

### §11.4 localStorage Persistence
`saveStack()` persists stack + `current` snapshot to localStorage keyed to piston ID. `loadStack()` restores on entering edit mode.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §8]`

### §11.5 Crash Recovery
On load: if stored `current` snapshot is newer than server `modified` time and hash matches build, offer "choose version" dialog to recover unsaved local edits.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §8]`

### §11.6 Backend Save Is Separate
Node edits are local-only until `save()` — a separate explicit action that compiles the whole piston and POSTs to the backend.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §9]`

---

## §12 Drag, Copy, Paste

Add-dialogs also expose an in-dialog paste path — see §10.3.

### §12.1 Drag-to-Reorder
Directive pattern: `dnd-list` / `dnd-draggable` / `dnd-moved`. Type gating: `dnd-allowed-types`.
Node type codes: statement, task, condition, restriction, variable, event.
`[VERIFIED: DRAG_COPY_PASTE_SPEC.md]`

### §12.2 Clipboard Storage
Server-side, one slot. Persists across sessions and restarts.
API: `GET /api/clipboard` / `POST /api/clipboard` / `DELETE /api/clipboard`
`[VERIFIED: FRONTEND_SPEC.md — Clipboard Storage and API]`

### §12.3 Right-Click Context Menu
On selected statement:
```
Copy selected statement
Duplicate selected statement
Cut selected statement
Delete selected statement
─────────────────────────
Clear clipboard          ← only when clipboard has content
```
`[VERIFIED: FRONTEND_SPEC.md — Right-Click Context Menu]`

### §12.4 Copy / Cut / Duplicate / Paste Behavior
- **Copy:** write subtree to clipboard
- **Cut:** copy + delete from current piston
- **Duplicate:** copy + paste as next sibling; no clipboard write
- **Paste:** deep-copy clipboard JSON, regenerate all UUIDs, insert after selected (or at end if nothing selected); clipboard persists — can paste multiple times
`[VERIFIED: FRONTEND_SPEC.md — Behavior Summary]`

### §12.5 UUID Regeneration on Paste
Every `id` field in the pasted subtree must be regenerated with a fresh UUID. Walk tree recursively, replace every `id`. The same UUID must never appear twice in the same piston.
`[VERIFIED: FRONTEND_SPEC.md — UUID Regeneration on Paste]`
`[ASSUMED: LOW RISK — UUID re-id requirement follows directly from PistonCore's ID-keyed find/replace/remove invariant; field names confirmed against PISTON_JSON_STRUCTURE_MAP.md (statements[]/then[]/else[]/else_ifs[]/tasks[]); verify recursive ID walk at build time]`

### §12.6 Clipboard Preview Panel
When clipboard has content: a "From clipboard" section at the bottom of the statement picker shows a read-only preview and `[Paste this statement]` button.
`[VERIFIED: FRONTEND_SPEC.md — Clipboard Preview Panel]`

---

## §13 HA Limitations Shaping the Editor

### §13.1 PyScript Routing
Forces PyScript (verified June 2026, HA 2026.6 + PyScript 2.0.1):
`on_event` · `break` · `cancel_pending_tasks` · XOR conditions · `followed_by` · switch fallthrough · monthly/yearly scheduling · day-of-month/week-of-month restriction
`[VERIFIED: HA_LIMITATIONS.md §6 — full routing table]`

The editor does NOT determine what forces PyScript. The backend sets `compile_target` on save; the editor reads it and shows the indicator (§1.7).
`[VERIFIED: FRONTEND_SPEC.md — compile target is compiler-owned]`

### §13.2 Missing Device Indicator
Same rule as §8.4: ⚠ fires only on an assigned device that is currently offline or not resolvable — not on empty nodes during creation. Empty nodes are the normal building state; flagging them would mark every fresh node in a new piston. See §8.4 and §8.7 for the complete model.
`[DECISION: EDIT_DEVICE_RECONCILIATION_SPEC.md §1, §5 — matches §8.4; empty/unassigned nodes never flagged]`

### §13.3 Non-Device Commands — Stays vs Cut
The stays-vs-cut table for WebCoRE virtual commands in PistonCore is in HA_LIMITATIONS.md §10, verified HA 2026.6.
`[VERIFIED: HA_LIMITATIONS.md §10]`

Physical vs. programmatic interaction routing is DEFERRED — needs PyScript sandbox validation.
`[VERIFIED: HA_LIMITATIONS.md §6 — marked DEFERRED]`

---

## §14 Known Gaps Requiring Original Design

**EDITOR-GAP-1 — Trigger render / click / dialog:**
PistonCore adds `triggers[]` at root; no WebCoRE standalone triggers section. Must design trigger render string, click handler, and edit dialog from scratch. Expected to resemble condition builder.
`[VERIFIED: EDITOR_REFERENCE.md Appendix C EDITOR-GAP-1; PISTON_JSON_STRUCTURE_MAP.md §3]`

**EDITOR-GAP-2 — PistonCore-specific standalone statement types — render/dialog DERIVED, not blind gaps:**
SET_VARIABLE, WAIT, WAIT_FOR_STATE, LOG_MESSAGE, CALL_PISTON, CANCEL_PENDING_TASKS have no verbatim WebCoRE render template in the reference files, but their render strings and dialog fields are derived directly from the documented structure-map fields (PISTON_JSON_STRUCTURE_MAP.md §22–27). See §3.22–§3.27 for each derived render and dialog. These are `[DECISION: derived]`, not invented and not guessed. No `[VERIFIED]` is used because there is no verbatim render string to verify against — derivation from documented fields is the correct and sufficient basis. Confirm each derived render against the running editor at build time.
`[VERIFIED: EDITOR_REFERENCE.md Appendix C EDITOR-GAP-2 — confirms no WebCoRE standalone render template exists; PISTON_JSON_STRUCTURE_MAP.md §22–27 — field basis for all six derivations]`

**EDITOR-GAP-3 — renderTimer / renderForOperands / renderForEachOperands output format:**
Call sites VERIFIED. Output formats ASSUMED from structure map fields (§2.5, §2.6, §2.7). Confirm at build time.

Correction to EDITOR_REFERENCE.md's EDITOR-GAP-3: `renderComparison()` output format IS available from WEBCORE_WIZARD_MAP.md Part 16/27; `renderTask()` output IS available from webcore_vocab.json `d` fields. Those two do NOT need to be read from editor.js.
`[VERIFIED: WEBCORE_WIZARD_MAP.md Part 16, 27, 29; webcore_vocab.json commands section]`

**EDITOR-GAP-4 — ts/fs condition sub-statements: RESOLVED.**
`ts[]` and `fs[]` ARE in the PistonCore structure map. `[VERIFIED: WEBCORE_WIZARD_MAP.md Part 32; PISTON_JSON_STRUCTURE_MAP.md §4]`

**EDITOR-GAP-5 — Break dialog page 1 content:**
No break-specific page 1 block found in dialog template. Assumed to show only advanced options.
`[ASSUMED: RISK low — EDITOR_REFERENCE.md Appendix C EDITOR-GAP-5]`

**EDITOR-GAP-6 — Dialog page-navigation state machine: RESOLVED.**
Full page-navigation contract now in §9.6 (Page Navigation Model). Three dialogs are two-page (statement, condition, restriction); all others are single-page or pageless. The contract is specified per-dialog in §9.6 rather than as a shared navigation section — the per-dialog approach was chosen because each dialog's page-0 content differs enough that a shared section would require constant back-references.
`[VERIFIED: piston.module.html.txt — see §9.6 for full detail]`

---

## §15 Sources

The following 10 files are the ONLY authorized sources for this document.
No current PistonCore editor.js, wizard-*.js, or any other live code is cited anywhere.
When a source file itself cites current code as its own verification, cite the source file — never propagate those internal citations here.

1. **PISTON_JSON_STRUCTURE_MAP.md** — authoritative JSON shapes for all 29 node types
2. **WEBCORE_WIZARD_MAP.md** — WebCoRE wizard falls, render function call signatures and output formats (Parts 16, 17, 27, 29, 32)
3. **WIZARD_ACTION_COMMAND_SPEC.md** — action command picker architecture, two-bucket rule, intersection-only rule (Parts 3, 4, 5, 7, 8)
4. **WIZARD_MENU_FALLS_RAW_EXTRACT.md** — capability map layers, attribute map, operator codes, PistonCore deviations
5. **DRAG_COPY_PASTE_SPEC.md** — drag/drop directive pattern, copy/paste/duplicate behaviors
6. **HA_LIMITATIONS.md** — PyScript routing table (§6), entity ID missing flow (§3), non-device commands (§10)
7. **EDITOR_REFERENCE.md** — verified render/click/edit surface for all 29 node types (gathered from piston_module_html.txt); gaps documented in Appendix C
8. **WEBCORE_EDIT_STATE_MODEL.md** — edit isolation, scratch buffer, commit sequence, undo/redo, localStorage
9. **FRONTEND_SPEC.md** — editor layout, chrome, save pipeline, PyScript indicator, clipboard API, corrupt loading, error states
10. **webcore_vocab.json** — capability entries (n/d/a/c), attribute types/options/ranges (n/t/o/r/u), command names and display strings (n/d/p fields), comparison operator codes (d/dd/g/p/t/m)
