# EDITOR REFERENCE — PISTONCORE PISTON JSON
### Verified editor data for every node type in PISTON_JSON_STRUCTURE_MAP.md

**Purpose:** Gather file. For every node type in the locked JSON structure map, records:
1. How that node RENDERS as a readable code line
2. What CLICKING it opens (handler name + surface type)
3. What the EDIT SURFACE SHOWS (fields/steps)

**Authority and labels:**
- `[VERIFIED: piston_module_html.txt line N]` — read directly from WebCoRE HTML source
- `[VERIFIED: app_js.txt line N]` — read directly from WebCoRE JS source
- `[NOT FOUND]` — not present in the reference files
- `[ASSUMED: basis — RISK — where to check]` — inference, unconfirmed

**Source files read:**
- PRIMARY: `reference\Webcore\piston.module.html.txt`
- SECONDARY: `reference\Webcore\app.js.txt`
- STRUCTURE AUTHORITY: `wizard build files\PISTON_JSON_STRUCTURE_MAP.md` (node types and order)

**Rendering function note:** Functions `renderTask()`, `renderTimer()`, `renderForOperands()`,
`renderForEachOperands()`, `renderComparison()`, `renderOperand()`, `renderDeviceNameList()`
are called from the HTML template at the sites noted below. Their implementations are in the
piston controller, which is NOT in the reference files. Call signatures and arguments are
`[VERIFIED]` from template call sites. Internal rendering logic is `[NOT FOUND]`.

**PistonCore-specific types note:** Several node types in the structure map (SET_VARIABLE,
WAIT, WAIT_FOR_STATE, LOG_MESSAGE, CALL_PISTON, CANCEL_PENDING_TASKS) do not exist as
standalone WebCoRE statement types. In WebCoRE they appear as tasks within action statements.
These sections are marked `[NOT FOUND]` for their render/click/surface data.

---

## 1. PISTON ROOT

### RENDER
```
/*** {name} ***/
/* Author: ... | Created: ... | Modified: ... | Build: ... | UI version: ... */
settings
  enable parallelism;
  disable automatic piston state;
  ...
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
`[VERIFIED: piston_module_html.txt lines 407–461]`

- `settings` block only appears if non-default options are set. Individual settings appear on their own line with `enable`/`disable` keywords. `[VERIFIED: piston_module_html.txt lines 419–432]`
- `define` block contains variables. `[VERIFIED: line 435]`
- `only when` block contains restrictions. `[VERIFIED: line 440]`
- `execute` block contains statements. `[VERIFIED: line 448]`

### CLICK ACTION
Clicking the piston name `{name}` → `editSettings()` `[VERIFIED: piston_module_html.txt line 413]`

### EDIT SURFACE
Dialog: `dialog-edit-settings` `[VERIFIED: piston_module_html.txt lines 2364–2445]`

**Standard fields:**
- Piston name (text input) `[VERIFIED: line 2372]`
- Description — optional (textarea) `[VERIFIED: line 2375]`
- Automatic piston state — Enabled (default) / Disabled `[VERIFIED: line 2380]`

**Advanced options (behind gear icon):**
- Piston execution parallelism — Enabled / Disabled (default) `[VERIFIED: line 2389]`
- Command optimizations — Enabled (default) / Disabled `[VERIFIED: line 2395]`
- Condition traversal optimizations — Enabled (default) / Disabled `[VERIFIED: line 2403]`
- Event subscriptions — Enabled (default) / Disabled `[VERIFIED: line 2409]`
- Allow pre-scheduled tasks to execute during restrictions — Enabled / Disabled (default) `[VERIFIED: line 2416]`
- Ignore SSL security issues for web requests — Enabled / Disabled (default) `[VERIFIED: line 2423]`
- Command execution delay — number input in ms `[VERIFIED: line 2432]`

**Footer:** Save (disabled if name empty), gear icon, Cancel `[VERIFIED: line 2440]`

---

## 2. VARIABLE

### RENDER
```
[const] {var_type} {name} [= {initial_value}];  /* current value */
```
`[VERIFIED: piston_module_html.txt lines 466–475]`

- `const` keyword appears when assignment type is constant. `[VERIFIED: line 467]`
- `/* current value */` is the live runtime value comment. `[VERIFIED: line 468]`
- `+ add a new variable` link appears below variable list. `[VERIFIED: line 474]`

### CLICK ACTION
Click on variable line → `editVariable(variable)` `[VERIFIED: piston_module_html.txt line 471]`
Click "+ add a new variable" → `addVariable()` `[VERIFIED: piston_module_html.txt line 474]`

### EDIT SURFACE
Dialog: `dialog-edit-variable` `[VERIFIED: piston_module_html.txt lines 2213–2278]`

**Fields (page 0 — single page):**
- Type + Name (inline input group):
  - Type dropdown `[VERIFIED: line 2221]`:
    - Basic: Dynamic, String (text), Boolean (true/false), Number (integer), Number (decimal), Large number (long), Date and Time, Date (date only), Time (time only), Device
    - Advanced lists: Dynamic list, String list, Boolean list, Number list (integer), Number list (decimal), Large number list (long), Date and Time list, Date list, Time list
  - Name (text input) `[VERIFIED: line 2246]`
- Initial value (optional) — operand widget; only shown for non-list types `[VERIFIED: line 2249]`
- Note about initial value persistence — shown when initial value is set `[VERIFIED: line 2253]`
- Assignment type — Dynamic (default) / Constant; shown when initial value is set and type is not `device` `[VERIFIED: line 2256]`

**Advanced options:**
- Description (optional) `[VERIFIED: line 2263]`

**Footer:** Add / Add more (new) or Save (edit); gear icon; Cancel; Delete (edit mode) `[VERIFIED: lines 2270–2276]`

---

## 3. TRIGGER

### RENDER
`[NOT FOUND]` — PistonCore has an explicit `triggers[]` array at root level. WebCoRE does
not have a separate triggers section; in WebCoRE, triggers are implicit from which device
attributes have event subscriptions. No trigger-specific rendering exists in
`piston_module_html.txt`.

`[ASSUMED: triggers will render like conditions using the same comparison rendering path —
RISK medium — check PistonCore editor.js trigger rendering]`

### CLICK ACTION
`[NOT FOUND]` — no trigger-specific click handler in WebCoRE source.

`[ASSUMED: will use same handler as conditions (editCondition-equivalent) since triggers
share the CONDITION JSON shape — RISK medium — check editor.js]`

### EDIT SURFACE
`[NOT FOUND]` — no trigger-specific dialog in WebCoRE source.

`[ASSUMED: will use the same condition edit surface as §4, since triggers share the
CONDITION shape — RISK medium]`

---

## 4. CONDITION

### RENDER
```
{renderComparison(condition.lo, condition.co, condition.ro, condition.ro2, condition.to, condition.to2)}
```
`[VERIFIED: piston_module_html.txt line 823]`

- Full comparison is rendered inline via `renderComparison()`. Example output: `Kitchen Light · brightness is greater than 50` `[ASSUMED: typical WebCoRE output — check runtime]`
- If condition has `condition.lo.dm`: "Save matching devices to variable" annotation shown `[VERIFIED: line 827]`
- Condition sub-statement blocks (`condition.ts` = when-true; `condition.fs` = when-false) are supported in WebCoRE but `[ASSUMED: not in PistonCore structure map — check if implemented]`
- If condition has `condition.c` sub-array: renders as a condition group (§29) `[VERIFIED: line 820]`

### CLICK ACTION
Click on condition line → `editCondition(condition, collection.c, null, null, collection.o)` `[VERIFIED: piston_module_html.txt line 823]`

### EDIT SURFACE
Dialog: `dialog-edit-condition` — two pages `[VERIFIED: piston_module_html.txt lines 1313–1450]`

**Page 0 — Type picker:**
- "Condition" card → `setDesignerType('condition', true)` `[VERIFIED: piston_module_html.txt]`
- "Group" card → `setDesignerType('group', true)` `[VERIFIED]`
- Clipboard section (paste existing conditions) `[VERIFIED]`

**Page 1 — Condition form** (uses `comparison` template `[VERIFIED: piston_module_html.txt lines 1689–1801]`):
- "What to compare" — left operand (operand widget) `[VERIFIED: line 1692]`
- "What kind of comparison?" — operator dropdown (options vary by data type) `[VERIFIED: line 1696]`
- "Compare to" / "Between..." — right operand (shown when `parameterCount > 0`) `[VERIFIED: line 1712]`
- "With offset..." — time offset (shown for time operands) `[VERIFIED: line 1716]`
- "...and..." — second right operand (range comparisons, `parameterCount > 1`) `[VERIFIED: line 1720]`
- "With offset..." — second time offset `[VERIFIED: line 1724]`
- "In the last..." / "For..." — timed comparison duration (shown when operator is timed) `[VERIFIED: line 1728]`
- "Only on these days of the week..." — day-of-week multi-select (time operands) `[VERIFIED: line 1743]`
- "Only on these days of the month..." — 1–31, last, second-last, third-last (mutually exclusive with weeks-of-month) `[VERIFIED: line 1750]`
- "Only on these weeks of the month..." — 1–5, last, second-last, third-last (mutually exclusive with days-of-month) `[VERIFIED: line 1759]`
- "Only on these months of the year..." — January–December `[VERIFIED: line 1769]`
- "Within..." + "Matching method" — appears in "followed by" context `[VERIFIED: lines 1788–1799]`

**Advanced options (gear icon, page 1):**
- "Save the list of matching devices into variable..." — device variable dropdown (shown for device operands) `[VERIFIED: lines 1395–1410]`
- "Store the list of non-matching devices into variable..." — device variable dropdown `[VERIFIED: lines 1411–1424]`
- "Subscription method" — Automatic / Always subscribe / Never subscribe `[VERIFIED: lines 1426–1432]`
- Description (optional) `[VERIFIED: lines 1433–1436]`

**Footer:** Add / Add more (new) or Save (edit); gear icon; Back (new) or Cancel (edit); Delete (edit mode) `[VERIFIED: lines 1441–1449]`

**Page 1 — Group form** (uses `dialog-edit-condition-group` template `[VERIFIED: lines 1454–1509]`):
- Logical operator — and / or / xor / "followed by" `[VERIFIED: line 1463]`
- Whole group negation — Not negated / Negated `[VERIFIED: line 1474]`
- If "followed by": Within (operand widget) + Matching method (loose/strict/negated) `[VERIFIED: lines 1489–1500]`
- Advanced: description `[VERIFIED: line 1484]`
- Footer: Save, gear icon, Cancel, Delete (if has parent) `[VERIFIED: lines 1503–1507]`

---

## 5. RESTRICTION

### RENDER
```
{renderComparison(restriction.lo, restriction.co, restriction.ro, restriction.ro2, restriction.to, restriction.to2)}
```
`[VERIFIED: piston_module_html.txt line 878]`

- Renders identically to a condition line. `[VERIFIED: same renderComparison call]`
- Group operator shown on collection: `collection.rop` `[VERIFIED: line 859]`
- "only when" section header wraps the restriction block. `[VERIFIED: piston root render]`

### CLICK ACTION
Click on restriction line → `editRestriction(restriction, collection.r)` `[VERIFIED: piston_module_html.txt line 878]`

### EDIT SURFACE
Dialog: `dialog-edit-restriction` — two pages `[VERIFIED: piston_module_html.txt lines 1516–1603]`

**Page 0 — Type picker:**
- Alert: "Restrictions DO NOT subscribe to events and will not cause the piston to run." `[VERIFIED: line 1524]`
- "Restriction" card → `setDesignerType('restriction', true)` `[VERIFIED: line 1530]`
- "Group" card → `setDesignerType('group', true)` `[VERIFIED: line 1537]`
- Clipboard section `[VERIFIED: lines 1542–1551]`

**Page 1 — Restriction form:**
- Same `comparison` template as §4 condition `[VERIFIED: line 1566]`
- Same fields as condition comparison (left operand, operator, right operand, time fields)

**Page 1 — Group form:**
- Logical operator — and / or / xor / "followed by" `[VERIFIED: line 1570]`
- Whole group negation — Not negated / Negated `[VERIFIED: line 1580]`
- Advanced: description `[VERIFIED: line 1588]`

**Footer (page 1):** Add/Save; gear icon; Back (new)/Cancel (edit); Delete (edit mode) `[VERIFIED: lines 1594–1601]`

Restriction group has its own dialog `dialog-edit-restriction-group` with same fields as condition group `[VERIFIED: piston_module_html.txt lines 1607–1648]`

---

## 6. IF

### RENDER
```
[async] if [policy badges]
  [conditions]
then
  [statements]
else if
  [else_if[N].conditions]
then
  [else_if[N].statements]
...
else
  [else statements]
end if;
```
`[VERIFIED: piston_module_html.txt lines 554–584]`

- `[async]` shown if `statement.a` is true `[VERIFIED: line 558]`
- Policy badges (TEP/TCP) shown inline `[VERIFIED: line 559]`
- `else if` blocks iterate `statement.ei` array `[VERIFIED: lines 573–576]`
- `+ add else if` link → `addCondition(statement.ei, true, null, statement.o)` `[VERIFIED: line 579]`
- `else` block shown if `statement.e` exists `[VERIFIED: lines 580–583]`

### CLICK ACTION
Click on `if` keyword line → `editStatement(statement, statements)` `[VERIFIED: piston_module_html.txt line 560]`

### EDIT SURFACE
Dialog: `dialog-edit-statement` — two pages `[VERIFIED: piston_module_html.txt lines 916–1281]`

**Page 0 — Type picker:**
- Simple and advanced statement type cards shown `[VERIFIED: line 920+]`
- Clipboard section `[VERIFIED]`

**Page 1 — If-specific content:**
- Two cards: "Condition" → `updateStatement(true, 'condition')` and "Group" → `updateStatement(true, 'group')` `[VERIFIED: piston_module_html.txt lines 966–983]`
- Note: No expression to configure at this level. Conditions are added/edited individually.

**Advanced options (gear icon):**
- Description (optional) `[VERIFIED: line 1196]`
- Task execution policy (TEP) — `[VERIFIED: line 1200]`
- Task cancellation policy (TCP) — `[VERIFIED: line 1209]`
- Async — No / Yes `[VERIFIED: line 1232]`
- Disable — No / Yes `[VERIFIED: line 1242]`

**Footer:** Save / Update, Cancel, Delete (edit mode) `[VERIFIED: lines 1260–1280]`

---

## 7. ELSE_IF

### RENDER
Rendered as part of the IF block (§6). Each `else_if` item in `statement.ei[]` renders as:
```
else if
  [else_if.conditions]
then
  [else_if.statements]
```
`[VERIFIED: piston_module_html.txt lines 573–577]`

- Clicking an individual condition within an else_if block → `editCondition()` on that condition `[ASSUMED: same handler as §4 — RISK low]`
- The else_if block itself has no dedicated click target for editing the block as a unit `[ASSUMED: RISK low]`

### CLICK ACTION
`+ add else if` → `addCondition(statement.ei, true, null, statement.o)` `[VERIFIED: piston_module_html.txt line 579]`

### EDIT SURFACE
No dedicated else_if dialog. Conditions within an else_if are edited via the condition
dialog (§4). `[VERIFIED: implied by template — no editElseIf call found in source]`

---

## 8. DO

### RENDER
```
/* {description} */
[async] do [policy badges]
  {statements}
end do;
```
`[VERIFIED: piston_module_html.txt lines 516–534]`

### CLICK ACTION
Click on `do` keyword line → `editStatement(statement, statements)` `[VERIFIED: piston_module_html.txt line 522]`

### EDIT SURFACE
Dialog: `dialog-edit-statement` — two pages

**Page 1 — Do-specific content:**
Info text only: "A DO block simply groups statements together and runs them all." `[VERIFIED: piston_module_html.txt lines 1051–1053]`

**Advanced options:** Description, TEP, TCP, async, disable `[VERIFIED: lines 1187–1258]`

---

## 9. ON_EVENT

### RENDER
```
/* {description} */
on events from [policy badges]
  {events — each renders as: renderOperand(event.lo)}
do
  {statements}
end on;
```
`[VERIFIED: piston_module_html.txt lines 538–551]`

- Keyword is `on events from` `[VERIFIED: line 544]`
- Events come from `collection.c` array (events section, separate template) `[VERIFIED: line 549]`
- Events joined with "or" between them `[VERIFIED: piston_module_html.txt line 772]`
- "+ add event" link appears `[VERIFIED: piston_module_html.txt line 786]`

### CLICK ACTION
Click on `on events from` line → `editStatement(statement, statements)` `[VERIFIED: piston_module_html.txt line 544]`
Click on individual event line → `editEvent(event, collection.c)` `[VERIFIED: piston_module_html.txt line 784]`

### EDIT SURFACE
Dialog: `dialog-edit-statement` — two pages

**Page 1 — On-specific content:**
Info text only. `[VERIFIED: piston_module_html.txt lines 1054–1056]`

**Advanced options:** Description, TEP, TCP, async, disable `[VERIFIED: lines 1187–1258]`

**Events sub-dialog** (opened via `editEvent`):
- Uses `comparison` template but with `comparison.event = true`
- Label changes to "What event to expect" instead of "What to compare" `[VERIFIED: piston_module_html.txt line 1691]`
- No operator dropdown shown (event detection, not comparison) `[VERIFIED: line 1694 ng-if="!comparison.event"]`

---

## 10. WHILE

### RENDER
```
/* {description} */
[async] while [policy badges]
  [conditions]
do
  {statements}
end while;
```
`[VERIFIED: piston_module_html.txt lines 667–687]`

### CLICK ACTION
Click on `while` keyword line → `editStatement(statement, statements)` `[ASSUMED: same pattern as other loop statements — RISK low — confirm line number]`

### EDIT SURFACE
Dialog: `dialog-edit-statement` — two pages

**Page 1 — While-specific content:**
Info text only. `[VERIFIED: piston_module_html.txt lines 990–992]`

**Advanced options:** Description, TEP, TCP, async, disable `[VERIFIED: lines 1187–1258]`

---

## 11. REPEAT

### RENDER
```
/* {description} */
[async] repeat [policy badges]
do
  {statements}
until
  [until_conditions]
end repeat;
```
`[VERIFIED: piston_module_html.txt lines 690–711]`

- Conditions rendered AFTER `until` keyword `[VERIFIED: lines 708–709]`
- In PistonCore JSON the array is `until_conditions[]`; WebCoRE uses the same conditions template `[VERIFIED: structure map §11]`

### CLICK ACTION
Click on `repeat` keyword line → `editStatement(statement, statements)` `[ASSUMED: same pattern — RISK low]`

### EDIT SURFACE
Dialog: `dialog-edit-statement` — two pages

**Page 1 — Repeat-specific content:**
Info text only. `[VERIFIED: piston_module_html.txt lines 993–995]`

**Advanced options:** Description, TEP, TCP, async, disable `[VERIFIED: lines 1187–1258]`

---

## 12. EVERY (timer)

### RENDER
```
every {renderTimer(statement)} [policy badges]
do
  {statements}
end every;
```
`[VERIFIED: piston_module_html.txt lines 714–733]`

- Timer expression rendered by `renderTimer(statement)` call `[VERIFIED: line 720]`
- Implementation of `renderTimer()` is `[NOT FOUND]` in reference files

### CLICK ACTION
Click on `every` keyword line → `editStatement(statement, statements)` `[VERIFIED: piston_module_html.txt line 720]`

### EDIT SURFACE
Dialog: `dialog-edit-statement` — two pages

**Page 1 — Every-specific content:** `[VERIFIED: piston_module_html.txt lines 1080–1186]`

- Interval operand (the period value) `[VERIFIED: line 1086]`
- "At minute" (shown for hours interval only) `[VERIFIED: line 1100]`
- "At time" (shown for days, weeks, months, years intervals) `[VERIFIED: line 1114]`
- "Only on these days of the week..." — multi-select `[VERIFIED: line 1131]`
- "Only on these days of the month..." — 1–31 ordinals (mutually exclusive with weeks-of-month) `[VERIFIED: line 1146]`
- "Only on these weeks of the month..." — 1–5 ordinals (mutually exclusive with days-of-month) `[VERIFIED: line 1162]`
- "Only on these months of the year..." — January–December `[VERIFIED: line 1177]`

**Advanced options:** Description, TEP, TCP, async, disable `[VERIFIED: lines 1187–1258]`

---

## 13. SWITCH

### RENDER
```
[async] switch ({renderOperand(statement.lo)}) [fall-through icon if case_traversal_policy=='fallthrough']
  case {value}:
    {statements}
  ...
  default:
    {statements}
end switch;
```
`[VERIFIED: piston_module_html.txt lines 587–620]`

- Expression rendered via `renderOperand(statement.lo)` `[VERIFIED: line 594]`
- Fall-through: `ctp=='e'` shows a badge `[VERIFIED: line 590]`
- Cases rendered from `statement.cs` array `[VERIFIED: line 603]`
- Default block rendered from `statement.e` `[VERIFIED: lines 615–616]`

### CLICK ACTION
Click on `switch` keyword line → `editStatement(statement, statements)` `[VERIFIED: piston_module_html.txt line 594]`
Click on `case` line → `editCase(case, statement.cs)` `[VERIFIED: piston_module_html.txt line 609]`

### EDIT SURFACE
Dialog: `dialog-edit-statement` — two pages

**Page 1 — Switch-specific content:**
- Switch expression operand field `[VERIFIED: piston_module_html.txt lines 987–989]`

**Advanced options:**
- Description `[VERIFIED: line 1196]`
- TEP `[VERIFIED: line 1200]`
- TCP `[VERIFIED: line 1209]`
- Case traversal policy — safe (auto-break) / fallthrough `[VERIFIED: line 1219]`
- Subscription method `[VERIFIED: line 1228]`
- Async `[VERIFIED: line 1232]`
- Disable `[VERIFIED: line 1242]`

---

## 14. CASE

### RENDER
```
case {value}:
  {statements}
```
or (range):
```
case {value_from} to {value_to}:
  {statements}
```
`[ASSUMED: range rendering format — RISK medium — WebCoRE source shows two operands for range but
not the exact rendered text. Verify against wizard-loops.js case render.]`

Single-value render: `[VERIFIED: piston_module_html.txt line 609 — case.ro rendered]`
Range detection: `case.t=='r'` triggers second operand `case.ro2` `[VERIFIED: line 609]`

### CLICK ACTION
Click on `case` line → `editCase(case, statement.cs)` `[VERIFIED: piston_module_html.txt line 609]`

### EDIT SURFACE
Dialog: `dialog-edit-case` `[VERIFIED: piston_module_html.txt lines 1651–1686]`

**Fields:**
- Case type — Single value (`s`) / Range (`r`) `[VERIFIED: line 1661]`
- "Switch expression matches" — operand widget `[VERIFIED: line 1669]`
- If Range: "and" — second operand widget `[VERIFIED: line 1671]`

**Advanced options:**
- Description (optional) `[VERIFIED: line 1673]`

**Footer:** "Add a statement" (new) / "Save" (edit); gear icon; Cancel; Delete (edit mode) `[VERIFIED: lines 1679–1684]`

---

## 15. FOR

### RENDER
```
[async] for ({renderForOperands(statement)})
do
  {statements}
end for;
```
`[VERIFIED: piston_module_html.txt lines 623–642]`

- Operands rendered by `renderForOperands(statement)` `[VERIFIED: line 629]`
- Implementation of `renderForOperands()` is `[NOT FOUND]` in reference files

### CLICK ACTION
Click on `for` keyword line → `editStatement(statement, statements)` `[VERIFIED: piston_module_html.txt line 629]`

### EDIT SURFACE
Dialog: `dialog-edit-statement` — two pages

**Page 1 — For-specific content:** `[VERIFIED: piston_module_html.txt lines 996–1024]`

- Start operand `[VERIFIED: line 1000]`
- End operand `[VERIFIED: line 1008]`
- Step operand `[VERIFIED: line 1011]`
- Counter variable — dropdown listing integer, decimal, and dynamic variables only `[VERIFIED: lines 1015–1023]`

**Advanced options:** Description, TEP, TCP, async, disable `[VERIFIED: lines 1187–1258]`

---

## 16. FOR_EACH

### RENDER
```
[async] for each ({renderForEachOperands(statement)})
do
  {statements}
end for each;
```
`[VERIFIED: piston_module_html.txt lines 645–664]`

- Operands rendered by `renderForEachOperands(statement)` `[VERIFIED: line 651]`
- Implementation of `renderForEachOperands()` is `[NOT FOUND]` in reference files

### CLICK ACTION
Click on `for each` keyword line → `editStatement(statement, statements)` `[VERIFIED: piston_module_html.txt line 651]`

### EDIT SURFACE
Dialog: `dialog-edit-statement` — two pages

**Page 1 — Each-specific content:** `[VERIFIED: piston_module_html.txt lines 1025–1045]`

- Counter variable — dropdown listing DEVICE variables only `[VERIFIED: lines 1028–1040]`
- List of devices — operand widget (device type) `[VERIFIED: lines 1041–1044]`

**Advanced options:** Description, TEP, TCP, async, disable `[VERIFIED: lines 1187–1258]`

---

## 17. BREAK

### RENDER
```
break
```
`[VERIFIED: piston_module_html.txt lines 736–745]`

### CLICK ACTION
Click on `break` line → `editStatement(statement, statements)` `[VERIFIED: piston_module_html.txt line 742]`

### EDIT SURFACE
Dialog: `dialog-edit-statement` — two pages

**Page 1 — Break-specific content:**
`[NOT FOUND]` — No break-specific content block in dialog template. Page 1 content section lists:
if, switch, while, repeat, for, each, exit, do, on, action, every — break is absent.

`[ASSUMED: break's page 1 shows only the advanced options panel — RISK low — confirm in wizard]`

**Advanced options:** Description, async, disable `[VERIFIED: lines 1187–1258; TEP/TCP probably not applicable to break]`

---

## 18. EXIT

### RENDER
```
exit {renderOperand(statement.lo)};
```
`[VERIFIED: piston_module_html.txt line 754]`

- Keyword is `exit` (code comment notes `<!--return-->`) `[VERIFIED: line 754]`
- Exit value from `statement.lo` (NOT `statement.value`) `[VERIFIED: line 754]`
- Implementation of `renderOperand()` is `[NOT FOUND]` in reference files

### CLICK ACTION
Click on `exit` line → `editStatement(statement, statements)` `[VERIFIED: piston_module_html.txt line 754]`

### EDIT SURFACE
Dialog: `dialog-edit-statement` — two pages

**Page 1 — Exit-specific content:** `[VERIFIED: piston_module_html.txt lines 1046–1050]`

- "New piston state" — operand widget `[VERIFIED: line 1048]`

**Advanced options:** Description, async, disable `[VERIFIED: lines 1187–1258]`

---

## 19. ACTION (with)

### RENDER
```
/* {description} */
only when [restrictions]
[async] with [policy badges]
  {renderDeviceNameList(statement.d)}
do
  {tasks — each: do {renderTask(task)}}
end with;
```
`[VERIFIED: piston_module_html.txt lines 489–513]`

- Keyword is `with` not `action` `[VERIFIED: line 495]`
- Device list rendered by `renderDeviceNameList(statement.d)` `[VERIFIED: line 495]`
- In compact (non-edit) mode: tasks render inline without `with...end with` wrapper `[VERIFIED: line 490–492]`
- Task section uses `do` prefix before each task `[VERIFIED: line 901]`
- Implementation of `renderDeviceNameList()` is `[NOT FOUND]` in reference files

### CLICK ACTION
Click on device name list → `editStatement(statement, statements)` `[VERIFIED: piston_module_html.txt lines 495/506]`

### EDIT SURFACE
Dialog: `dialog-edit-statement` — two pages

**Page 1 — Action-specific content:** `[VERIFIED: piston_module_html.txt lines 1057–1079]`

Device selector with groups:
- Virtual Location device `[VERIFIED: line 1059]`
- Physical devices (from HA device list) `[VERIFIED: line 1063]`
- Local device variables `[VERIFIED: line 1068]`
- Global device variables `[VERIFIED: line 1073]`

**Advanced options:**
- Description `[VERIFIED: line 1196]`
- TEP `[VERIFIED: line 1200]`
- TCP `[VERIFIED: line 1209]`
- TSP (task scheduling policy) — action statements only `[VERIFIED: line 1219]`
- Async `[VERIFIED: line 1232]`
- Disable `[VERIFIED: line 1242]`

---

## 20. TASK

### RENDER
```
do {renderTask(task)}
```
`[VERIFIED: piston_module_html.txt line 901]`

- `do` keyword rendered as separate `<span pun>` element `[VERIFIED: line 901]`
- Task description rendered via `renderTask(task)` `[VERIFIED: line 901]`
- Implementation of `renderTask()` is `[NOT FOUND]` in reference files
- "+ add a new task" link → `addTask(statement)` `[VERIFIED: line 890]`

### CLICK ACTION
Click on task line → `editTask(task, statement)` `[VERIFIED: piston_module_html.txt line 901]`
Click "+ add a new task" → `addTask(statement)` `[VERIFIED: piston_module_html.txt line 890]`

### EDIT SURFACE
Dialog: `dialog-edit-task` — single page `[VERIFIED: piston_module_html.txt lines 2118–2207]`

**Fields:**
- Header shows `renderDeviceNameList(designer.parent.d)` — the parent action's device list `[VERIFIED: line 2126]`
- Existing tasks shown above insert point (in edit mode) `[VERIFIED: lines 2128–2131]`
- "Do..." — command dropdown, grouped as: `[VERIFIED: lines 2136–2147]`
  - "Commands available to all devices" (common)
  - "Commands available to only some devices" (partial)
  - "Location commands (non-device)" (virtual)
- Parameters — operand widgets for each command parameter `[VERIFIED: lines 2149–2153]`
- "Only during these modes" — mode multi-select (shown when command selected) `[VERIFIED: lines 2154–2159]`
- Remaining tasks shown below insert point (in edit mode) `[VERIFIED: lines 2162–2165]`
- Clipboard section `[VERIFIED: lines 2171–2179]`

**Advanced options:** Description `[VERIFIED: line 2167]`

**Footer:** Add / Add more (new) or Save (edit); gear icon; Cancel; Delete (edit mode); Parameters dropdown for custom commands `[VERIFIED: lines 2184–2204]`

---

## 21. VIRTUAL TASK

### RENDER
Same as TASK (§20) — `do {renderTask(task)}` `[ASSUMED: same render path, distinguished by domain value — RISK low]`

### CLICK ACTION
Same as TASK — `editTask(task, statement)` `[ASSUMED: RISK low]`

### EDIT SURFACE
Same as TASK dialog. Virtual/location commands appear in the "Location commands (non-device)"
group of the command dropdown `[VERIFIED: piston_module_html.txt line 2144]`

---

## 22. SET_VARIABLE

### RENDER
`[NOT FOUND]` — PistonCore-specific. No standalone `set_variable` statement in WebCoRE.
In WebCoRE, "set variable" is a location command task within an action statement.

`[ASSUMED: will render as something like: set $variableName = {value}
— RISK medium — check PistonCore editor.js SET_VARIABLE case]`

### CLICK ACTION
`[NOT FOUND]` — no WebCoRE handler.

`[ASSUMED: will open a set_variable-specific dialog — RISK medium — check wizard-action.js _saveLocationCmd]`

### EDIT SURFACE
`[NOT FOUND]` — no WebCoRE dialog.

`[ASSUMED: will show variable name picker + value operand widget, based on the JSON shape
{variable, value: ValueObject} — RISK medium — check wizard-action.js]`

---

## 23. WAIT

### RENDER
`[NOT FOUND]` — PistonCore-specific. In WebCoRE, "wait" is a location command task.

`[ASSUMED: will render as: wait {duration} {unit} or wait until {expression}
— RISK medium — check PistonCore editor.js WAIT case]`

### CLICK ACTION
`[NOT FOUND]` — no WebCoRE handler for standalone wait.

### EDIT SURFACE
`[NOT FOUND]` — no WebCoRE dialog for standalone wait.

`[ASSUMED: will show wait_type picker (duration/until), duration operand or until expression
— RISK medium — check wizard-action.js wait handling]`

---

## 24. WAIT_FOR_STATE

### RENDER
`[NOT FOUND]` — PistonCore-specific canonical state-wait. WebCoRE used a `wait`-with-condition
pattern; PistonCore has canonical WAIT_FOR_STATE with `conditions[]`.

`[ASSUMED: will render with a conditions block and optional timeout, similar to if/while
— RISK medium — check PistonCore editor.js WAIT_FOR_STATE case]`

### CLICK ACTION
`[NOT FOUND]` — no WebCoRE handler.

### EDIT SURFACE
`[NOT FOUND]` — no WebCoRE dialog.

`[ASSUMED: will show conditions list + optional timeout_seconds field — RISK medium]`

---

## 25. LOG_MESSAGE

### RENDER
`[NOT FOUND]` — PistonCore-specific. In WebCoRE, logging is a location command task.

`[ASSUMED: will render as: log {level}: {message} — RISK medium — check editor.js]`

### CLICK ACTION
`[NOT FOUND]` — no WebCoRE handler.

### EDIT SURFACE
`[NOT FOUND]` — no WebCoRE dialog.

`[ASSUMED: will show level picker (info/warn/error) + message value operand
— RISK medium — check wizard-action.js log handling]`

---

## 26. CALL_PISTON

### RENDER
`[NOT FOUND]` — PistonCore-specific. In WebCoRE, calling a piston is a location command task.

`[ASSUMED: will render as: call piston {target_piston_name} — RISK medium — check editor.js]`

### CLICK ACTION
`[NOT FOUND]` — no WebCoRE handler.

### EDIT SURFACE
`[NOT FOUND]` — no WebCoRE dialog.

`[ASSUMED: will show piston picker from available pistons list, writing target_piston_id +
target_piston_name — RISK medium — check wizard-action.js call_piston handling]`

---

## 27. CANCEL_PENDING_TASKS

### RENDER
`[NOT FOUND]` — PistonCore-specific.

`[ASSUMED: will render as: cancel pending tasks — RISK medium — check editor.js]`

### CLICK ACTION
`[NOT FOUND]` — no WebCoRE handler.

### EDIT SURFACE
`[NOT FOUND]` — no WebCoRE dialog. JSON shape has only `id`, `description`, `disabled`.

`[ASSUMED: dialog (if any) shows only description and disable toggle — RISK low — check wizard]`

---

## 28. VALUE OBJECT (operand)

Not a rendered node — it is an inline sub-object embedded within other nodes.
Appears in: `set_variable.value`, `exit.value`, `switch.expression`, expression-condition `.value`.

### RENDER
Rendered inline by `renderOperand(value)` wherever the parent node uses it.
`[VERIFIED: piston_module_html.txt — renderOperand() called at lines 754, 784, 594, etc.]`

### CLICK ACTION
Not clickable as a standalone element. The parent node's click handler opens the dialog
containing the operand widget.

### EDIT SURFACE
Uses the `operand` template `[VERIFIED: piston_module_html.txt lines 1804–2031]`

**Operand type selector (left dropdown):** `[VERIFIED: lines 1831–1842]`
- Nothing selected (optional operands only)
- Physical device(s) — `d` (variable device) or `p` (physical device with attribute)
- Virtual device — `v`
- Preset — `s`
- Value — `c` (constant)
- Variable — `x`
- Expression — `e`
- Argument — `u`

**Per-type fields:** `[VERIFIED: lines 1843–2030]`
- Physical device (`d`): multi-select from physical devices + local/global/system device variables
- Physical device with attribute (`p`): multi-select for devices + attribute picker; aggregation option (any/all/avg/count/max/min/etc.) shown for multiple devices
- Virtual device (`v`): single-select from virtual device list
- Variable (`x`): single-select from local/global/system variables; optional list-index field for list types
- Preset (`s`): Sunrise/Noon/Sunset/Midnight (time/datetime); color presets (color type)
- Constant (`c`): text/number/date/time/datetime input or dropdown of options (if options defined)
- Expression (`e`): textarea for expression string + rendered preview label
- Argument (`u`): text input

**Duration unit** (shown when `dataType == 'duration'`): ms/s/min/hours/days/weeks/months/years `[VERIFIED: lines 1990–2001]`

**Sub-device/interaction pickers** (shown for physical devices with sub-devices or interaction types): `[VERIFIED: lines 2009–2029]`

---

## 29. CONDITION GROUP

Not a distinct node type in the JSON — expressed by nesting within the flat `conditions[]` array.
A condition with `condition.c` sub-array is a group.

### RENDER
Rendered as a nested conditions block within the parent conditions list.
`[VERIFIED: piston_module_html.txt line 820 — ng-if="condition.c" renders group template]`

### CLICK ACTION
Click on condition group line → same handler as condition `[ASSUMED: editCondition() with the group object — RISK low]`

### EDIT SURFACE
Dialog: `dialog-edit-condition-group` `[VERIFIED: piston_module_html.txt lines 1454–1509]`

**Fields:**
- Logical operator — Logical AND / Logical OR / Logical eXclusive OR (XOR) / Followed by `[VERIFIED: lines 1463–1468]`
- Whole group negation — Not negated / Negated `[VERIFIED: lines 1474–1478]`
- If "followed by": Within (operand widget) + Matching method — Loose / Strict / Negated `[VERIFIED: lines 1489–1500]`

**Advanced options:** Description `[VERIFIED: line 1484]`

**Footer:** Save, gear icon, Cancel, Delete (if has parent) `[VERIFIED: lines 1503–1507]`

---

## APPENDIX A — Advanced Options Panel (all statement types)

The advanced options panel appears behind the gear icon button on page 1 of
`dialog-edit-statement`. Fields shown vary by statement type. `[VERIFIED: piston_module_html.txt lines 1187–1258]`

| Field | Types that show it |
|---|---|
| Description (textarea) | All types `[VERIFIED: line 1196]` |
| Task execution policy (TEP) | Most statement types (not break/exit) `[VERIFIED: line 1200]` |
| Task cancellation policy (TCP) | Most statement types `[VERIFIED: line 1209]` |
| Task scheduling policy (TSP) | Action (`with`) only `[VERIFIED: line 1219]` |
| Case traversal policy | Switch only `[VERIFIED: line 1219]` |
| Subscription method | Switch only `[VERIFIED: line 1228]` |
| Async (yes/no) | Most statement types `[VERIFIED: line 1232]` |
| Disable (yes/no) | All statement types `[VERIFIED: line 1242]` |

---

## APPENDIX B — Operand Source/Type Summary

Source type codes used in operand widgets (WebCoRE `data.t` field): `[VERIFIED: piston_module_html.txt lines 1831–1842]`

| Code | Meaning | PistonCore equivalent |
|---|---|---|
| `d` | Physical device (as variable/token) | device variable reference |
| `p` | Physical device + attribute | device + attribute selector |
| `v` | Virtual device | virtual/system device |
| `s` | Preset value | preset (Sunrise, colors, etc.) |
| `c` | Constant/literal value | literal |
| `x` | Variable reference | variable |
| `e` | Expression string | expression |
| `u` | Argument | argument |

---

## APPENDIX C — Genuine Gaps (found during gather)

**EDITOR-GAP-1 — Trigger render/click/dialog:** PistonCore adds `triggers[]` at piston root. No
corresponding render section, click handler, or edit dialog exists in WebCoRE source. The wizard
must invent this. Expected: renders like conditions; clickable to editTrigger(); dialog similar to
condition dialog but with `is_trigger:true` implied.

**EDITOR-GAP-2 — SET_VARIABLE/WAIT/WAIT_FOR_STATE/LOG_MESSAGE/CALL_PISTON/CANCEL_PENDING_TASKS:**
Six statement types in the structure map have no WebCoRE UI precedent as standalone statements.
PistonCore must define render strings, click handlers, and edit dialogs for all six from scratch.

**EDITOR-GAP-3 — renderTask/renderTimer/renderForOperands/renderForEachOperands/renderComparison/renderOperand render format:** These functions produce the human-readable code line text but their implementations are not in the reference files. The exact output format (what a comparison looks like as a string, what a timer looks like) must be read from PistonCore's editor.js rather than derived from WebCoRE.

**EDITOR-GAP-4 — Condition sub-statement blocks (when-true/when-false):** WebCoRE supports
`condition.ts` and `condition.fs` sub-statement blocks on individual conditions
`[VERIFIED: piston_module_html.txt lines 832–835]`. The PistonCore structure map (§4) does not
include these fields. Either they were deliberately excluded or overlooked. Flag for spec decision
before implementing condition editing.

**EDITOR-GAP-5 — Break dialog content:** No break-specific page 1 content found in
dialog-edit-statement. Assumed to show only advanced options on page 1. Verify against wizard.

---

*Gather complete. All 29 node types covered. PistonCore-specific types (§22–27) are [NOT FOUND]
in WebCoRE source and require original design. Node types §1–21 and §29 have substantial
[VERIFIED] data from piston_module_html.txt.*
