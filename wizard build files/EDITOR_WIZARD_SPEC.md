# EDITOR_WIZARD_SPEC.md — PistonCore Editor and Wizard

**Version:** 2.0 (clean rewrite — 10 approved source files only; no current PistonCore code cited)
**Status:** Base rewrite complete. Notify and Speak merges deferred to separate step.

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

### §0.2 Two-Bucket Picker Rule
The wizard holds ALL entity IDs linked to each device during capability comparison (to build the picker intersection). At commit it writes ONLY the entity IDs for the chosen attribute — one per device. These are two different scopes and must never collapse.
`[VERIFIED: WIZARD_ACTION_COMMAND_SPEC.md Part 7 — picker firewall; WEBCORE_WIZARD_MAP.md Part 16 steps 2–4]`

### §0.3 Pure-Projection Invariant
The editor renders JSON → display text in one direction only. Display text is never stored or parsed back. `role`/`device_label` are always friendly names; `entity_ids` are always real HA entity IDs; `role_tokens` is edit-round-trip only and the compiler ignores it.
`[VERIFIED: FRONTEND_SPEC.md — Editor Rendering Rules; WIZARD_ACTION_COMMAND_SPEC.md Part 7]`

### §0.4 Edit-Isolation Contract
Every dialog edits a scratch buffer (`$scope.designer`), never the live node directly. Built fresh on open. Discarded on Cancel. Written back on commit (Save/Add).
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §1, §2, §3]`

### §0.5 Commit Bracket
Every commit calls `autoSave()` BEFORE writing to the live tree — snapshot taken before the change so the pre-change state is always undoable.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §4, §8]`

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
If `compile_target` is `"pyscript"` on the saved piston and PyScript is not detected in HA, show a subtle warning: *"PyScript required — install via HACS before deploying. [Learn more →]"*
The editor reads `compile_target` from the backend-returned piston. **The editor does NOT determine what forces PyScript — that is the backend's job.**
`[VERIFIED: FRONTEND_SPEC.md — PyScript Requirement Indicator]`

### §1.8 Corrupt / Invalid Piston Loading
- `logic_version` higher than supported: full-editor banner, render read-only if possible.
- `logic_version` 1 (legacy): banner with `[Migrate]` / `[Leave as-is]`.
- Statement node missing required fields: render placeholder row `⚠ Unknown statement [stmt_id] — edit to repair`. Do not crash or skip siblings.
- Empty `statements[]`: valid. Render empty editor with ghost prompt.
- `entity_ids` absent: treat as `[]`, show inline warning.
- `entity_ids: []`: valid, means unassigned; show inline warning per §12.2.
`[VERIFIED: FRONTEND_SPEC.md — Corrupt or Invalid Piston Loading]`

---

## §2 Render Function Reference

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

---

### §3.21 VIRTUAL TASK — `PISTON_JSON_STRUCTURE_MAP.md §21`
**Render:** `do {renderTask(task)}`
`[ASSUMED: same render path as TASK; distinguished by domain value — RISK low — EDITOR_REFERENCE.md §21]`

**Click / Edit:** Same task dialog. Virtual commands appear in the "Location commands (non-device)" group.
`[VERIFIED: EDITOR_REFERENCE.md §21, piston_module_html.txt line 2144]`

---

### §3.22 SET_VARIABLE — `PISTON_JSON_STRUCTURE_MAP.md §22`
**Render:** `set ${variable} = {value}`
**Click:** Opens set_variable edit dialog.
**Edit Surface:** variable picker + value operand widget.
`[ASSUMED for all three: basis = PISTON_JSON_STRUCTURE_MAP.md §22 (variable + value fields); no WebCoRE standalone precedent — RISK medium — EDITOR-GAP-2]`

---

### §3.23 WAIT — `PISTON_JSON_STRUCTURE_MAP.md §23`
**Render:** `wait {duration} {unit}` or `wait until {expression}`
**Click:** Opens wait edit dialog.
**Edit Surface:** wait_type picker (duration/until); duration operand or until expression.
`[ASSUMED for all three: basis = PISTON_JSON_STRUCTURE_MAP.md §23 (wait_type, duration, unit, until fields); no WebCoRE standalone precedent — RISK medium — EDITOR-GAP-2]`

---

### §3.24 WAIT_FOR_STATE — `PISTON_JSON_STRUCTURE_MAP.md §24`
**Render:** conditions block + optional timeout, similar to WHILE.
**Click:** Opens wait_for_state edit dialog.
**Edit Surface:** conditions list + optional timeout_seconds field.
`[ASSUMED for all three: basis = PISTON_JSON_STRUCTURE_MAP.md §24 (conditions[], timeout_seconds); no WebCoRE standalone precedent — RISK medium — EDITOR-GAP-2]`

---

### §3.25 LOG_MESSAGE — `PISTON_JSON_STRUCTURE_MAP.md §25`
**Render:** `log [{level}]: {message}`
**Click:** Opens log_message edit dialog.
**Edit Surface:** level picker (info/warn/error) + message value operand.
`[ASSUMED for all three: basis = PISTON_JSON_STRUCTURE_MAP.md §25 (level, message fields); no WebCoRE standalone precedent — RISK medium — EDITOR-GAP-2]`

---

### §3.26 CALL_PISTON — `PISTON_JSON_STRUCTURE_MAP.md §26`
**Render:** `call piston {target_piston_name}`
**Click:** Opens call_piston edit dialog.
**Edit Surface:** piston picker from available pistons list.
`[ASSUMED for all three: basis = PISTON_JSON_STRUCTURE_MAP.md §26 (target_piston_id, target_piston_name); no WebCoRE standalone precedent — RISK medium — EDITOR-GAP-2]`

---

### §3.27 CANCEL_PENDING_TASKS — `PISTON_JSON_STRUCTURE_MAP.md §27`
**Render:** `cancel pending tasks`
**Click:** Opens edit dialog (if any).
**Edit Surface:** description + disable toggle only (JSON has no functional fields beyond id).
`[ASSUMED for all three: basis = PISTON_JSON_STRUCTURE_MAP.md §27; no WebCoRE standalone precedent — RISK low — EDITOR-GAP-2]`

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

The operand widget is the reusable UI for entering any value. Appears in condition left/right operands, restriction operands, task parameter slots, switch expression, exit value, case value, and for/each loop fields.

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
TRIGGER shares the CONDITION JSON shape. PistonCore adds `triggers[]` at piston root. Trigger render and edit dialog are original designs — no WebCoRE precedent.
`[ASSUMED: EDITOR-GAP-1 — RISK medium]`

---

## §7 Action Statement and Task Dialog

### §7.1 Action Statement — Device Groups
Page 1 device selector groups:
- Virtual Location device
- Physical devices (from HA)
- Local device variables
- Global device variables

(Notify services section deferred to merge step — does NOT route through device-picker machinery.)
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

---

## §8 Device Picker — Two-Bucket Architecture

### §8.1 Picker Root
Surfaces physical devices from HA and device variables (local and global).
`[VERIFIED: EDITOR_REFERENCE.md §19, piston_module_html.txt lines 1057–1079; WIZARD_ACTION_COMMAND_SPEC.md Part 7]`

### §8.2 Capability Loading — Four-Step Sequence
On device selection:
1. Use friendly name(s) to pull device IDs from HA
2. Load ALL entity IDs linked to each device (every entity the physical device exposes — NOT just the primary)
3. For multiple devices: show ONLY attributes common to ALL selected devices (union within device, intersect across devices)
4. On attribute selection: write ONLY entity IDs for that attribute — one per device

Steps 2–3 load everything FOR THE PICKER. Step 4 stores one-per-device for the chosen attribute. These are deliberately different scopes.
`[VERIFIED: WIZARD_ACTION_COMMAND_SPEC.md Part 7 — _capEntityMap, _loadCapsIntoSelect, _getGroupedEntityIdsForTokens; WEBCORE_WIZARD_MAP.md Part 16 steps 2–4]`

Frozen elements — MUST NOT be changed without explicit review:
`sel.tokens`, `_groupDevices`, `_getGroupedEntityIdsForTokens`, `_getFlatEntityIds`, `_capEntityMap`, `role`/`role_tokens`/`entity_ids` write separation.
`[VERIFIED: WIZARD_ACTION_COMMAND_SPEC.md Part 7 — picker firewall]`

### §8.3 Device Variable Resolution
Variables store friendly names. On resolution, picker looks up each friendly name in device registry to get device IDs, then loads all entity IDs.
`[VERIFIED: WIZARD_ACTION_COMMAND_SPEC.md Part 7; PISTON_JSON_STRUCTURE_MAP.md §1]`

### §8.4 Entity ID Missing Flow
`entity_ids: []` = unassigned. Show ⚠ inline on node. When user clicks, wizard opens pre-filled; user picks replacement.
`[VERIFIED: HA_LIMITATIONS.md §3; FRONTEND_SPEC.md — entity_ids: [] handling]`

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

Blank templates:
- Statement: `{t:null, d:[], o:'and', n:false, rop:'and', rn:false, a:'0', di:false, tcp:'c', tep:'', tsp:'', ctp:'i', s:'local', z:''}`
- Condition: `{lo:{}, co:'', ro:{}, ts:[], fs:[], o:'and', n:false, z:''}`
- Task: `{c:'', a:'0', m:'', z:''}`
- Variable: `{t:'dynamic', n:'', v:{data:{}}, a:'d', z:''}`
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §5]`

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

---

## §10 Undo / Redo / Autosave

### §10.1 Stack Structure
`stack = {undo: [], redo: []}`. Each entry: `{hash, timestamp, data}`. Data is a deep copy of the whole piston. Capped at `MAX_STACK_SIZE = 10`.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §8]`

### §10.2 autoSave()
Called at START of every `updateX`. Hashes current piston; if hash differs from top of undo stack, pushes snapshot and clears redo.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §8]`

### §10.3 Undo / Redo
`undo()` — push current to redo, pop undo, replace piston, re-validate, re-persist.
`redo()` — mirror.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §8]`

### §10.4 localStorage Persistence
`saveStack()` persists stack + `current` snapshot to localStorage keyed to piston ID. `loadStack()` restores on entering edit mode.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §8]`

### §10.5 Crash Recovery
On load: if stored `current` snapshot is newer than server `modified` time and hash matches build, offer "choose version" dialog to recover unsaved local edits.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §8]`

### §10.6 Backend Save Is Separate
Node edits are local-only until `save()` — a separate explicit action that compiles the whole piston and POSTs to the backend.
`[VERIFIED: WEBCORE_EDIT_STATE_MODEL.md §9]`

---

## §11 Drag, Copy, Paste

### §11.1 Drag-to-Reorder
Directive pattern: `dnd-list` / `dnd-draggable` / `dnd-moved`. Type gating: `dnd-allowed-types`.
Node type codes: statement, task, condition, restriction, variable, event.
`[VERIFIED: DRAG_COPY_PASTE_SPEC.md]`

### §11.2 Clipboard Storage
Server-side, one slot. Persists across sessions and restarts.
API: `GET /api/clipboard` / `POST /api/clipboard` / `DELETE /api/clipboard`
`[VERIFIED: FRONTEND_SPEC.md — Clipboard Storage and API]`

### §11.3 Right-Click Context Menu
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

### §11.4 Copy / Cut / Duplicate / Paste Behavior
- **Copy:** write subtree to clipboard
- **Cut:** copy + delete from current piston
- **Duplicate:** copy + paste as next sibling; no clipboard write
- **Paste:** deep-copy clipboard JSON, regenerate all UUIDs, insert after selected (or at end if nothing selected); clipboard persists — can paste multiple times
`[VERIFIED: FRONTEND_SPEC.md — Behavior Summary]`

### §11.5 UUID Regeneration on Paste
Every `id` field in the pasted subtree must be regenerated with a fresh UUID. Walk tree recursively, replace every `id`. The same UUID must never appear twice in the same piston.
`[VERIFIED: FRONTEND_SPEC.md — UUID Regeneration on Paste]`
`[ASSUMED: HIGH RISK — DRAG_COPY_PASTE_SPEC.md flags UUID regeneration as CRITICAL ASSUMED; verify implementation at build time]`

### §11.6 Clipboard Preview Panel
When clipboard has content: a "From clipboard" section at the bottom of the statement picker shows a read-only preview and `[Paste this statement]` button.
`[VERIFIED: FRONTEND_SPEC.md — Clipboard Preview Panel]`

---

## §12 HA Limitations Shaping the Editor

### §12.1 PyScript Routing
Forces PyScript (verified June 2026, HA 2026.6 + PyScript 2.0.1):
`on_event` · `break` · `cancel_pending_tasks` · XOR conditions · `followed_by` · switch fallthrough · monthly/yearly scheduling · day-of-month/week-of-month restriction
`[VERIFIED: HA_LIMITATIONS.md §6 — full routing table]`

The editor does NOT determine what forces PyScript. The backend sets `compile_target` on save; the editor reads it and shows the indicator (§1.7).
`[VERIFIED: FRONTEND_SPEC.md — compile target is compiler-owned]`

### §12.2 Entity ID Missing Flow
`entity_ids: []` = unassigned. Show ⚠ inline on node. Clicking opens wizard pre-filled for user to pick replacement. Can still save; only deploy is blocked.
`[VERIFIED: HA_LIMITATIONS.md §3; FRONTEND_SPEC.md — entity_ids: [] handling]`

### §12.3 Non-Device Commands — Stays vs Cut
The stays-vs-cut table for WebCoRE virtual commands in PistonCore is in HA_LIMITATIONS.md §10, verified HA 2026.6.
`[VERIFIED: HA_LIMITATIONS.md §10]`

Physical vs. programmatic interaction routing is DEFERRED — needs PyScript sandbox validation.
`[VERIFIED: HA_LIMITATIONS.md §6 — marked DEFERRED]`

---

## §13 Known Gaps Requiring Original Design

**EDITOR-GAP-1 — Trigger render / click / dialog:**
PistonCore adds `triggers[]` at root; no WebCoRE standalone triggers section. Must design trigger render string, click handler, and edit dialog from scratch. Expected to resemble condition builder.
`[VERIFIED: EDITOR_REFERENCE.md Appendix C EDITOR-GAP-1; PISTON_JSON_STRUCTURE_MAP.md §3]`

**EDITOR-GAP-2 — PistonCore-specific standalone statement types:**
SET_VARIABLE, WAIT, WAIT_FOR_STATE, LOG_MESSAGE, CALL_PISTON, CANCEL_PENDING_TASKS: all six need original render strings, click handlers, and edit dialogs. JSON shapes in PISTON_JSON_STRUCTURE_MAP.md §22–27.
`[VERIFIED: EDITOR_REFERENCE.md Appendix C EDITOR-GAP-2]`

**EDITOR-GAP-3 — renderTimer / renderForOperands / renderForEachOperands output format:**
Call sites VERIFIED. Output formats ASSUMED from structure map fields (§2.5, §2.6, §2.7). Confirm at build time.

Correction to EDITOR_REFERENCE.md's EDITOR-GAP-3: `renderComparison()` output format IS available from WEBCORE_WIZARD_MAP.md Part 16/27; `renderTask()` output IS available from webcore_vocab.json `d` fields. Those two do NOT need to be read from editor.js.
`[VERIFIED: WEBCORE_WIZARD_MAP.md Part 16, 27, 29; webcore_vocab.json commands section]`

**EDITOR-GAP-4 — ts/fs condition sub-statements: RESOLVED.**
`ts[]` and `fs[]` ARE in the PistonCore structure map. `[VERIFIED: WEBCORE_WIZARD_MAP.md Part 32; PISTON_JSON_STRUCTURE_MAP.md §4]`

**EDITOR-GAP-5 — Break dialog page 1 content:**
No break-specific page 1 block found in dialog template. Assumed to show only advanced options.
`[ASSUMED: RISK low — EDITOR_REFERENCE.md Appendix C EDITOR-GAP-5]`

---

## §14 Sources

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
