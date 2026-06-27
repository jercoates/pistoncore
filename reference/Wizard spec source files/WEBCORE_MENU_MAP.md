# WebCoRE Menu Map

Complete inventory of every wizard dialog (menu) in WebCoRE, extracted verbatim from `piston.module.html` (the `text/ng-template` blocks) with handler names cross-referenced. This is the map to build PistonCore's menus against — one row per dialog, every field, every conditional branch, every footer action.

**How this pairs with the Cross-Cutting Inventory:** this document covers what lives *inside* each menu. The Cross-Cutting Inventory covers what lives in its own surface but applies across all of them (re-arm, operand-type switch, reconciliation, etc.). Build a menu from this map, then run the Cross-Cutting Inventory against it. Neither is folded into the other on purpose.

**Source of truth:** `piston.module.html` lines are cited per dialog. Handlers (`updateX()`, `setDesignerType()`, etc.) are AngularJS `$scope` methods in `piston.module.js` (not in the uploaded `app.js`, which is the dashboard/dataService layer — noted where relevant).

---

## 0. The dialog inventory (every `ng-template`)

| # | Template id | Purpose | Multi-page? | Primary commit handler |
|---|---|---|---|---|
| 1 | `piston-editor-buttons` | Editor toolbar buttons | — | — |
| 2 | `dialog-captured-image` | Show a captured image | no | — |
| 3 | `piston` | Piston canvas (root render) | — | — |
| 4 | `variables` / `statements` / `statement` | Render-only templates for the tree | — | — |
| 5 | `events` / `event` | Render-only (event rows) | — | — |
| 6 | `conditions` / `condition` | Render-only (condition rows) | — | — |
| 7 | `restrictions` / `restriction` | Render-only (restriction rows) | — | — |
| 8 | `tasks` / `task` | Render-only (task rows) | — | — |
| **9** | **`dialog-edit-statement`** | **Add/edit a statement** | **yes (page 0/1)** | **`updateStatement()`** |
| **10** | **`dialog-edit-event`** | **Add/edit an event** | no | **`updateEvent()`** |
| **11** | **`dialog-edit-condition`** | **Add/edit a condition** | **yes (page 0/1)** | **`updateCondition()`** |
| **12** | **`dialog-edit-condition-group`** | **Edit a condition group** | no | **`updateConditionGroup()`** |
| **13** | **`dialog-edit-restriction`** | **Add/edit a restriction** | **yes (page 0/1)** | **`updateRestriction()`** |
| **14** | **`dialog-edit-restriction-group`** | **Edit a restriction group** | no | **`updateRestrictionGroup()`** |
| **15** | **`dialog-edit-case`** | **Add/edit a switch case** | no | **`updateCase()`** |
| **16** | **`comparison`** | **(sub-template) the comparison block** | — | — |
| **17** | **`operand`** | **(sub-template) the operand input switch** | — | `validateOperand()` |
| **18** | **`parameter`** | **(sub-template) command parameter inputs** | — | — |
| **19** | **`dialog-edit-task`** | **Add/edit a task (command)** | no (paged feel via insertIndex) | **`updateTask()`** |
| **20** | **`dialog-edit-variable`** | **Add/edit a local variable (declaration)** | no | **`updateVariable()`** |
| **21** | **`dialog-edit-local-variable`** | **Edit a local variable's value (use site)** | no | **`updateLocalVariable()`** |
| **22** | **`dialog-edit-global-variable`** | **Add/edit a global variable** | no | **`updateGlobalVariable()`** |
| 23 | `dialog-del-piston` | Confirm piston delete | no | `del()` |
| **24** | **`dialog-edit-settings`** | **Piston settings** | no | **`updateSettings()`** |
| 25 | `dialog-wiki` | Wiki iframe | no | — |
| 26 | `dialog-choose-version` | Crash-recovery version picker | no | `chooseVersion()` |
| 27 | `dialog-rebuild-piston` | Reconciliation/rebuild (⚠ rows) | no | `doRebuildPiston()` |

The **bolded** rows are the editable menus PistonCore must reproduce. The rest are render-only or trivial confirm dialogs.

---

## 9. `dialog-edit-statement` — Add / edit a statement

**The most complex dialog.** Two pages. Page 0 is a type picker; page 1 is the per-type form.

### Page 0 — type selector
Renders three sections of cards:
- **Basic statements** — `designer.items.simple` (repeated as cards)
- **Advanced statements** — `designer.items.advanced` (only if `view.advancedStatements`)
- **From clipboard** — `designer.clipboard` entries, each with *Paste this statement* / *Delete from clipboard*

Each card button → `setDesignerType(item.type, true)` (the `true` advances to page 1).
Footer: **Cancel** only (`closeDialog()`).

### Page 1 — per-type form
Header: "Add a new {{type}}" / "Edit {{type}}". The body is a chain of `ng-if="designer.type=='…'"` blocks — **one branch per statement type**:

| `designer.type` | Fields shown |
|---|---|
| `if` | Two cards: **Condition** → `updateStatement(true,'condition')`; **Group** → `updateStatement(true,'group')` |
| `switch` | **Expression** operand (`designer.operand`) |
| `while` | info only (condition added via footer) |
| `repeat` | info only |
| `for` | **Start value** (`operand`), **End value** (`operand2`), **Step** (`operand3`), **Counter variable** (optional select, integer/decimal/dynamic local+global) |
| `each` | **Counter variable** (optional, device-typed vars), **List of devices** (`operand`) |
| `exit` | **New piston state** (`operand`) |
| `do` | info only |
| `on` | info only |
| `action` | **Devices** multiselect (Virtual `Location`, Physical devices, device-typed local/global/system vars) |
| `every` (timer) | **Every…** (`operand`) + a large set of conditional schedule sub-fields (see below) |

#### `every` (timer) schedule sub-fields — driven by `designer.operand.data.vt`
This is the densest conditional block in the codebase. `vt` is the interval type token:

| `vt` | Meaning | Extra fields revealed |
|---|---|---|
| `s` | seconds | "Only during these minutes/hours", days-of-week, days-of-month, weeks-of-month, months-of-year |
| `ms` | (sub-second / ms) | minutes, hours filters |
| `m` | minutes | hours filter |
| `h` | hours | **At this minute of the hour** (required) |
| `w` | weekly | **On this day of the week** (required) |
| `n` | monthly | **On this day of the month** (dom + dow pair) |
| `y` | yearly | day-of-month pair **+ On this month of the year** (required) |
| (others) | — | **At this time…** (`operand2`) + **With this offset…** (`operand3`, only if `operand2.data.t != 'c'`) |

Plus the "Only during/on these…" warning-styled multiselects (minutes, hours, dow, dom, wom, moy) that appear for the recurring types. A `< 30s` interval shows a red performance warning.

### Advanced options (toggle, `designer.showAdvancedOptions`)
Shown for all types when the cog is toggled:
- **Description** (textarea)
- **Task Execution Policy** (`tep`): always / condition-change / piston-change / both — *(not for `on`)*
- **Task Cancellation Policy** (`tcp`): never / condition (default) / piston / both — *(not for `on`)*
- **Task Scheduling Policy** (`tsp`): override (default) / allow multiple — *(action only)*
- **Case Traversal Policy** (`ctp`): Safe auto-break (default) / Fall-through — *(switch only)*
- **Execution Method** (`async`): Synchronous (default) / Asynchronous — *(not every/on)*
- **Subscription method** (`smode`): auto / always / never — *(switch with ct=='c')*
- **Disable statement** (`disabled`): No (default) / Yes — *(all types)*

### Footer (per-type, `$new` vs edit)
New + type: a single "Add a {condition|statement|event|case|task}" button calling `updateStatement(true)` (advances into a child dialog), **except** `break`/`exit` which call `updateStatement()` (commit immediately).
Edit: **Save** (`updateStatement()`), optional **Convert to new group** (`upgradeStatement()`, for if/while/repeat), cog, **Cancel**, **Delete** (`deleteObject()`).

### PistonCore notes
- Statement type list is the spine. Each `ng-if` branch = one wizard sub-form.
- `vt`-driven timer block is its own mini state machine — spec it separately.
- ⚠ **No "Add more" here** — statement dialog commits one statement. Re-arm lives in event/condition/task/variable dialogs, not this one. (Confirms Cross-Cutting Inventory: re-arm is per-array-dialog, and the statement dialog adds a single node.)

---

## 10. `dialog-edit-event` — Add / edit an event

Single page. Body is one `comparison` sub-template bound to `designer.comparison` (events are device-attribute comparisons). Advanced options: Description only.

**Footer (this is where re-arm IS present):**
- New: **Add** (`updateEvent()`) · **Add more** (`updateEvent(true)`) · cog · Cancel
- Edit: **Save** (`updateEvent()`) · cog · Cancel · Delete

Disabled-gate: `!designer.comparison.left.valid`.

→ **`updateEvent(true)` is the canonical re-arm call.** The `true` arg = "commit, keep dialog open, reset scratch for the next one." Matches the re-arm contract in `ADD_MORE_REARM_HANDOFF.md`.

---

## 11. `dialog-edit-condition` — Add / edit a condition

Two pages.

### Page 0 — type selector
Two cards: **Condition** → `setDesignerType('condition', true)`; **Group** → `setDesignerType('group', true)`. Plus clipboard paste section. Footer: Cancel.

### Page 1 — form
- `type=='condition'` → `comparison` sub-template (`designer.comparison`)
- `type=='group'` → **Logical Operator** (`and`/`or`/`xor`/`followed by`) + **Whole group negation** (`not`: 0/1)
- **Followed-by extras** (`designer.followedBy`): **Within…** (`comparison.within` operand) + **Matching method** (`withinOpt`: Loose `l` / Strict `s` / Negated `n`)

### Advanced options
- *(condition + LHS is physical device `data.t=='p'`)* **Store matching devices into variable…** (`data.dm`) and **Store non-matching devices into variable…** (`data.dn`) — both device-typed var selects
- **Subscription method** (`smode`: auto/always/never)
- **Description**

**Footer (re-arm present):**
- New: **Add** (`updateCondition()`) · **Add more** (`updateCondition(true)`) · cog · Back (`prevPage()`) · 
- Edit: **Save** (`updateCondition()`) · cog · Cancel · Delete

Disabled-gate: `!designer.type || (type=='condition' && !comparison.valid)`.

---

## 12. `dialog-edit-condition-group` — Edit a condition group

Single page (no type picker — the group already exists). Fields: **Logical Operator**, **Whole group negation**, Description (advanced), and the **Within…/Matching method** pair when `followedBy`. Commit: `updateConditionGroup()`. Footer: Save · cog · Cancel · Delete (`deleteObject()`, only if `designer.parent`).

**No "Add more"** — editing an existing container, not appending.

---

## 13. `dialog-edit-restriction` — Add / edit a restriction

Structurally **identical to `dialog-edit-condition`** with restriction wording and a persistent red warning banner ("Restrictions DO NOT subscribe to events"). Two pages, same condition/group split, same comparison sub-template.

**Difference: NO "Add more" button.** New footer is just **Add** (`updateRestriction()`) — no `updateRestriction(true)` variant in the template. Edit: Save. Plus a disabled `upgradeRestriction()` (gated `0==1`, dead code).

→ Cross-Cutting note: restriction is an array-bearing dialog that **lacks** re-arm in WebCoRE. For PistonCore, decide whether to add it for consistency (the inventory's re-arm row lists `edit-condition` but restriction is the same shape — flag as a DECISION).

---

## 14. `dialog-edit-restriction-group` — Edit a restriction group

Mirror of `dialog-edit-condition-group`. Logical Operator, negation, Description. Commit: `updateRestrictionGroup()`.

---

## 15. `dialog-edit-case` — Add / edit a switch case

Single page. Fields:
- **Case type** (`designer.type`): Single value `s` / Range `r`
- **Switch expression matches / is between** → `operand` (`designer.operand`); if `type=='r'`, "and" + second `operand` (`designer.operand2`)
- Description (advanced)

Footer: New → **Add a statement** (`updateCase(true)`) · Edit → **Save** (`updateCase()`) · cog · Cancel · Delete.

---

## 16. `comparison` — sub-template (the comparison block)

Included by event/condition/restriction dialogs. Renders:
1. **LHS operand** — "What to compare" / "What event to expect" (`comparison.left`)
2. **Comparison operator** (`comparison.operator`) — `ng-options` grouped by category, populated from `comparison.options` (operator list is **datatype-filtered**, the Cross-Cutting "operator-by-datatype" row)
3. **RHS operand(s)** — count driven by `comparison.parameterCount`:
   - 0 params → none
   - 1 → "Compare to" (`comparison.right`)
   - 2 → "Between…" (`right`) + "…and…" (`right2`)
4. **Time offset operands** — when LHS `selectedDataType=='time'` and RHS isn't a constant: "With offset…" (`comparison.time`, `time2`)
5. **Timed comparison** (`comparison.timed`) — "In the last…" (1) / "For…" (2) with less-than/at-least selector + duration operand
6. **Special datatype branches:**
   - `dataType=='email'` → **From** + **Message** operands
   - LHS is `v`/`ifttt` → IFTTT Maker URL textarea
   - LHS is `v`/`time` → days-of-week / days-of-month / weeks-of-month / months-of-year filters
7. **Followed-by** Within… + Matching method (when `designer.followedBy`)

→ This sub-template is the **operand-type switch in action** (Cross-Cutting "operand type switch" PARTIAL row). The whole comparison axis is built on repeated `operand` includes.

---

## 17. `operand` — sub-template (THE operand input switch)

**This is the single most cross-cutting template in WebCoRE.** Every value-taking site (`condition LHS/RHS`, `set_variable`, command args, loop bounds, timer durations, case values, initial values) includes `operand`. It's a `<select ng-model="operand.data.t">` whose chosen token swaps the input control:

| `data.t` | Branch | Gated by | Input rendered |
|---|---|---|---|
| `''` | (none) | `optional` | "(no value set)" label |
| `d` | Physical device(s) | `allowDevices` | device multiselect (devices + device-vars + system vars) |
| `p` | Physical device(s) **+ attribute** | `allowPhysical` | device multiselect (75%) + **attribute select** (25%) |
| `v` | Virtual device | `allowVirtual` | virtualDevices select |
| `s` | Preset | `allowPreset` | preset select — **time** (sunrise/noon/sunset/midnight) or **color** (db.colors) |
| `c` | Value (constant) | `allowConstant` | text/number/time/date/datetime input, OR options select (single/multi), OR lifxSelector |
| `x` | Variable | `allowVariable` | variable select (local + global + system, restrictType-filtered); list-index input if type ends `[]` |
| `e` | Expression | `allowExpression` | expression label + `smart-area` textarea |
| `u` | Argument | `allowArgument` | text input |

**Cross-cutting properties carried on every operand** (the Cross-Cutting Inventory "datatype + coercion" row lives here):
- `operand.dataType` — drives preset branch, duration unit, input type
- `operand.inputType` — text/number/time/date/datetime for the constant branch
- `operand.durationUnit` — ms/s/m/h/d/w/n/y selector (shown when `dataType=='duration'`)
- `operand.optional`, `.allow*` flags — which branches are even offered
- `operand.restrictType` / `.restrictAttribute` — filters var and device lists
- `operand.multiple` — single vs multi-select variants
- **Aggregation** (when `data.t=='p'` and multiple devices): any/all + math (avg/count/min/max/median/sum/stdev/variance/most/least)

**Sub-device / interaction extras** (when `data.t=='p'`):
- **Which {attribute}(s)** — `data.i` multiselect (when `operand.count && showSubDevices`)
- **Which interaction** — `data.p` (any/physical/programmatic, when `operand.interactive && showInteraction`)

→ **PistonCore's wizard fall engine is this template.** Each `data.t` branch = one operand sub-builder. The Cross-Cutting Inventory flags only the device branch as built; the other 8 branches (v/s/c/x/e/u and the duration/aggregation modifiers) are the unbuilt work.

---

## 18. `parameter` — sub-template (command parameter inputs)

Used inside `dialog-edit-task` to render each command argument by its input type `parameter.i`:

| `parameter.i` | Control |
|---|---|
| `color` | color select (special/whites/standard) + custom color picker |
| `text` | text input |
| `range` | range slider (min `m`, max `M`, unit `u`) |
| `number` | number input (min/max/unit) |
| `boolean` | false/true select |
| `enum` | select (>6 options) or radio button group (≤6); separate variant when `parameter.d` default |
| `duration` | number + unit select (ms…y) |

Plus `parameter.help` and `parameter.warn` text. Note: the task dialog actually includes `'operand'` (not `'parameter'`) for most args via `<parameter ng-include="'operand'">` — `parameter` here is the legacy/simple-input path.

---

## 19. `dialog-edit-task` — Add / edit a task (command)

Single dialog with an **insert-cursor** model (the "Add more" re-arm pattern with positional insertion).

Fields:
- **With…** — renders parent device list (read-only, `renderDeviceNameList`)
- **Existing tasks before cursor** — clickable task previews (`selectTaskIndex($index)`), shown when `$index < designer.insertIndex`
- **Do…** — command select (`designer.command`), grouped: common / partial / location (virtual). Triggers `prepareParameters()`
- **Parameters** — `ng-repeat` over `designer.parameters`, each rendered via `<parameter ng-include="'operand'">` (so command args are full operands)
- **Only during these modes** — `designer.mode` multiselect (location modes)
- **Existing tasks after cursor** — previews shown when `$index >= insertIndex`
- Description (advanced)
- Clipboard paste section

**Custom command parameter builder** (when `designer.custom`): dropdown to Add string/integer/decimal/boolean/datetime parameter, and delete-parameter entries.

**Footer (re-arm + positional insert):**
- New: **Add** (`updateTask()`) · **Add more** (`updateTask(true)`) · cog · Cancel
- Edit: **Save** (`updateTask()`) · cog · Cancel · Delete

→ This is the dialog that needs the **positional re-arm** the Cross-Cutting Inventory/`ADD_MORE_REARM_HANDOFF.md` call out: `insertIndex` + the before/after preview split mean "Add more" must commit at the cursor and advance it, not just append. The custom-parameter builder is its own sub-surface.

---

## 20. `dialog-edit-variable` — Add / edit a local variable (DECLARATION)

This is the **declaration** site (Cross-Cutting "variable declaration vs use" row). Single page.

Fields:
- **Type** (`designer.operand.dataType`) + **Name** (`designer.name`) on one row. Type groups:
  - Basic: dynamic, string, boolean, integer, decimal, long, datetime, date, time, device
  - Advanced lists: each Basic type + `[]`
- **Initial value** (optional) — `operand`, only for non-list types. With a NOTE warning about re-initialization on every run.
- **Assignment type** (`designer.assignment`) — Dynamic (default `d`) / Constant (`s`), shown when a value is set and type isn't device/list
- Description (advanced)

**Footer (re-arm present):**
- New: **Add** (`updateVariable()`) · **Add more** (`updateVariable(true)`) · cog · Cancel
- Edit: **Save** (`updateVariable()`) · cog · Cancel · Delete

---

## 21. `dialog-edit-local-variable` — Edit a local variable's value (USE site)

Minimal. Single **Value** operand (`designer.operand`). Commit: `updateLocalVariable()`. Footer: Save · Cancel. No type, no name — this edits the *current value* of an already-declared variable. (Distinct from #20: declaration vs use, exactly the Cross-Cutting distinction.)

---

## 22. `dialog-edit-global-variable` — Add / edit a global variable

Like #20 but **no list types** in the type select, and value is mandatory (not "initial value"). Type list: dynamic/string/boolean/integer/decimal/datetime/date/time/device. Adds `validateGlobalVariableName()` gate (global names have a prefix convention, e.g. `@`/`@@`).

**Footer (re-arm present):** Add · **Add more** (`updateGlobalVariable(true)`) · Save · Cancel · Delete (`deleteGlobalVariable()`).

---

## 24. `dialog-edit-settings` — Piston settings

Single page. Basic: **Piston name**, **Description**, **Automatic piston state** (enabled/disabled). Advanced:
- Piston execution parallelism
- Command optimizations
- Condition traversal optimizations
- Event subscriptions
- Allow pre-scheduled tasks during restrictions
- Ignore SSL security issues
- Command execution delay (ms)

Commit: `updateSettings()`. Gate: `!designer.name`.

---

## 26. `dialog-choose-version` — crash recovery

Two buttons: **Use the current version** (`chooseVersion(false)`, discards local) / **Use the locally saved version** (`chooseVersion(true)`). This is the autosave/crash-recovery surface — a "moment, not a menu" (Cross-Cutting signature).

---

## 27. `dialog-rebuild-piston` — reconciliation (⚠ rows)

The **reference-reconciliation surface** (Cross-Cutting "⚠ rows" row). Iterates `designer.legend` and offers a replacement picker per missing item type:

| `item.t` | Picker |
|---|---|
| `contact` | contact select |
| `device` | device select (tokens) |
| `mode` | location-mode select |
| `routine` | routine select |
| `phone` | text input |
| `uri` | URL input |
| `email` | email input |

Footer: **Ignore** (`closeDialog()`) / **Continue** (`doRebuildPiston()`). This fires on import/load when a piston references items not present in the instance.

---

## Cross-cutting roll-up (which dialogs carry which shared surface)

| Cross-cutting item | Dialogs that instantiate it |
|---|---|
| **"Add more" / re-arm** | event (10), condition (11), task (19, positional), variable (20), global-variable (22). **Absent** in restriction (13) and case (15) — DECISION whether to add. |
| **Operand type switch** | EVERY operand include: statement (9: switch/for/each/exit/every), comparison (16), case (15), variable initial value (20/21/22), task parameters (19) |
| **Reference reconciliation (⚠)** | rebuild-piston (27); also fires implicitly on load/paste/import |
| **Datatype + coercion** | operand (17) `dataType`/`inputType`/`restrictType`; comparison (16) operator filtering |
| **Disable/enable flag** | statement (9) advanced `disabled`; settings (24) `automaticState` |
| **Variable declaration vs use** | declaration: variable (20), global-variable (22); use: local-variable (21), every operand `x` branch |
| **$ system variables** | every operand `x`/`d`/`p` branch (System variables optgroup) |
| **Legal-drop / legal-slot** | statement page 0 (9) type lists (`items.simple`/`advanced`); case only under switch; break only inside loop (enforced in JS, not template) |
| **Operator-by-datatype** | comparison (16) `comparison.options` |

---

## What to extract next (not in the HTML templates)

These live in `piston.module.js`, not the templates, and are needed to make the menus functional:
1. `designer.items.simple` / `.advanced` — the actual statement-type catalog (icons, descriptions, which are "advanced")
2. `prepareParameters()` — how a command id maps to its `designer.parameters` operand list (the vocab lookup)
3. `validateOperand()` — the cascade that sets `valid`/`error`/`dataType`/`inputType` per operand
4. `comparison.options` builder — operator list per LHS datatype
5. The `updateX(rearm)` handlers — commit + splice + (rearm ? reset+advance : close) contract
6. `setDesignerType()` / `prevPage()` / `nextPage()` — page navigation state machine
