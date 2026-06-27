# WebCoRE Wizard Behavior Map
**Source:** `ady624/webCoRE` — `dashboard/html/modules/piston.module.html` (master branch, fetched June 2026)  
**Purpose:** Verified extraction of every statement type, menu structure, and wizard step sequence for PistonCore spec alignment.  
**Method:** Direct source read — no assumptions, no prior session context. Every entry is derived from the template HTML.

---

## Part 1 — Statement Types (Complete List)

Extracted from the `id="statement"` template. Each `ng-if="statement.t=='X'"` block defines one statement type.

| Internal type key | Display keyword(s) | Has conditions | Has tasks | Has sub-statements | Has events |
|---|---|---|---|---|---|
| `action` | `with ... do ... end with;` | no (restrictions only) | yes (`statement.k`) | no | no |
| `do` | `do ... end do;` | no (restrictions only) | no | yes (`statement.s`) | no |
| `on` | `on events from ... do ... end on;` | no | no | yes (`statement.s`) | yes (`statement.c`) |
| `if` | `if ... then ... else if ... else ... end if;` | yes | no | yes (then/elseif/else blocks) | no |
| `switch` | `switch (expr) ... case ... default ... end switch;` | no | no | yes (per case) | no |
| `for` | `for (start; end; step) do ... end for;` | no | no | yes (`statement.s`) | no |
| `each` | `for each (expr) do ... end for each;` | no | no | yes (`statement.s`) | no |
| `while` | `while ... conditions ... do ... end while;` | yes | no | yes (`statement.s`) | no |
| `repeat` | `repeat do ... until ... conditions ... end repeat;` | yes (at end) | no | yes (`statement.s`) | no |
| `every` | `every [timer] do ... end every;` | no | no | yes (`statement.s`) | no |
| `break` | `break` | no | no | no | no |
| `exit` | `exit [operand];` | no | no | no | no |

**Total: 12 statement types.** All are present in the source template.

---

## Part 2 — Statement Properties Panel

From the `id="toolbar"` `<table properties>` section. These fields are available on the selected statement in the sidebar:

| Property | Applies to | Options |
|---|---|---|
| Case Traversal Policy | `switch` only | Safe (auto-break) / Fall-through |
| Description | all | free text |
| Disabled | all statements | Yes / No |
| Execution Method | all except `on`, `every` | Synchronous / Asynchronous |
| Subscription Method | conditions, and `switch` with `ct=='c'` | Auto / Always / Never |
| Task Cancellation Policy | all except `on` | Never / On condition state / On piston state / On condition or piston state |
| Task Execution Policy | all except `on` | Always / On condition state / On piston state / On condition or piston state |
| Task Scheduling Policy | `action` only | Override / Allow multiple |

---

## Part 3 — `dialog-edit-statement` Wizard (Add/Edit Statement)

### Page 0 — Statement type picker

User sees two groups (Basic and Advanced — Advanced is behind the "Show advanced statements" toggle):

**Basic statements** (always visible, from `designer.items.simple`):
- The actual items are populated by `app.js` at runtime, not hardcoded in the template. The template renders them via `ng-repeat="item in designer.items.simple"` and `ng-repeat="item in designer.items.advanced"`.

**Known from the dialog page 1 handlers** — the following types are handled: `if`, `switch`, `while`, `repeat`, `for`, `each`, `exit`, `do`, `on`, `action`, `every`, `break`.

**Clipboard section** — shows any statements previously copied, with paste option.

### Page 1 — Type-specific configuration

Each type has its own form section (shown via `ng-if="designer.type=='X'"`):

#### `if`
- Info text: "An IF block is the simplest decisional block..."
- Two buttons: **Add a condition** / **Add a group**
- No other fields on this page — conditions are added after

#### `switch`
- Info text: "A SWITCH block is a decisional block designed to compare an expression..."
- **Expression** operand picker (full `operand` widget)
- After save: **Add a case** button

#### `while`
- Info text only: "A WHILE loop checks a condition and executes actions when true..."
- No fields — conditions added after via the conditions editor

#### `repeat`
- Info text only: "A REPEAT loop executes some actions, then checks a condition..."
- No fields — statements and until-condition added after

#### `for`
- Info text: "A FOR loop repeats for a preset number of times..."
- **Start value** — operand picker
- **End value** — operand picker
- **Step** — operand picker
- **Counter variable (optional)** — select from local/global variables of type `integer`, `decimal`, `dynamic`
- After save: **Add a statement** button

#### `each` (for each)
- Info text: "A FOR EACH loop repeats for each device in a device list"
- **Counter variable (optional)** — select from local/global variables of type `device`
- **List of devices** — operand picker
- After save: **Add a statement** button

#### `exit`
- Info text: "Return causes the piston to end and set piston state to the value provided"
- **New piston state** — operand picker
- Add button fires immediately (`updateStatement()`)

#### `do`
- Info text: "There are no options for the do statement. Add statements you want to execute."
- No fields
- After save: **Add a statement** button

#### `on`
- Info text: "There are no options for the on statement. Add events that you want to execute statements on."
- No fields
- After save: **Add an event** button

#### `action`
- Info text: "Actions represent a collection of tasks a device or group of devices have to perform. The Location virtual device provides non-device-specific tasks..."
- **Devices** — multi-select picker with groups:
  - Virtual devices (Location — shown as disabled option header)
  - Physical devices (from `devices` list)
  - Local variables (type `device`)
  - Global variables (type `device`)
  - System variables (type `device`)
- After save: **Add a task** button

#### `every`
- Info text: "Timers trigger piston runs at regular intervals."
- Warning if interval < 30 seconds
- **Every...** — operand picker (duration)
- **At this minute of the hour** — shown if unit is `h` (hours), select 0–59
- **On this day of the week** — shown if unit is `w` (weeks), select day
- **On this day of the month** — shown if unit is `n` (months) or `y` (years), select day + weekday position
- **On this month of the year** — shown if unit is `y`, select month
- **At this time** — shown if not ms/s/m/h units
- **With this offset** — shown if not ms/s/m/h and time is not a constant
- **Only during these minutes** — multi-select 0–59, shown if ms or s units
- **Only during these hours** — multi-select 0–23, shown if ms/s/m units
- **Only on these days of the week** — multi-select, shown if not w/n/y units
- **Only on these days of the month** — multi-select (1–31 + last/second-last/third-last), shown if not n/y and no week-of-month selected
- **Only on these weeks of the month** — multi-select (1–5 + last/second-last/third-last), shown if not n/y and no day-of-month selected
- **Only on these months of the year** — multi-select Jan–Dec, shown if not y unit
- After save: **Add a statement** button

#### `break`
- No form fields
- Add fires immediately

### Page 1 — Advanced options (gear button, all types)

Shown when `designer.showAdvancedOptions` is true:
- **Description** — textarea (all types)
- **Task Execution Policy** — select (all except `on`)
- **Task Cancellation Policy** — select (all except `on`)
- **Task Scheduling Policy** — select (`action` only)
- **Case Traversal Policy** — select (`switch` only)
- **Execution Method** — select (all except `every`, `on`)
- **Subscription method** — select (`switch` with `ct=='c'` only)
- **Disable statement** — select (all)

---

## Part 4 — `dialog-edit-condition` Wizard (Add/Edit Condition)

### Page 0 — Type picker

Two options:
- **Condition** — single comparison between two operands → `setDesignerType('condition', true)`
- **Group** — collection of conditions with logical operator → `setDesignerType('group', true)`

Clipboard section shows pasted conditions with paste/delete.

### Page 1 — Condition type: `condition`

- Info: "A condition allows for a single comparison to be made between two expressions."
- **comparison** widget (see Part 7)

### Page 1 — Condition type: `group`

- Info: "A group is a container for other conditions or groups..."
- **Logical Operator** — select:
  - Logical AND
  - Logical OR
  - Logical eXclusive OR (XOR)
  - Followed by
- **Whole group negation** — Not negated / Negated
- If operator is "Followed by":
  - **Within...** — operand picker (duration)
  - **Matching method** — Loose / Strict / Negated

### Advanced options (gear button, both types)

- **Store matching devices to variable** — device variable select (condition type, when left operand is physical device)
- **Store non-matching devices to variable** — device variable select (same condition)
- **Subscription method** — Auto / Always subscribe / Never subscribe
- **Description** — textarea

---

## Part 5 — `dialog-edit-event` Wizard (Add/Edit Event — for `on` statement)

Single page:
- Info: "An event allows the execution of statements when certain devices' attributes change."
- **comparison** widget (same widget as condition, see Part 7)
- Advanced options: Description textarea
- Buttons: **Add** / **Add more** (new) or **Save** (edit)

---

## Part 6 — `dialog-edit-task` Wizard (Add/Edit Task — inside `action` with-block)

Single page (page 0):

**Header context** — shows current device list (`renderDeviceNameList`)

**Existing tasks preview** — tasks already in the with-block shown above and below insertion point (clickable to reposition insert)

**Do...** — command picker:
```
Select: "Please select a command"
  Optgroup: "Commands available to all devices"     [common commands]
  Optgroup: "Commands available to only some devices" [partial commands]
  Optgroup: "Location commands (non-device)"         [virtual commands]
```
- Commands have a type badge: `device` / `emulated` / `custom` / `location`
- Live search enabled

**Parameters** — rendered dynamically per selected command via `designer.parameters` array, each shown via `operand` widget (see Part 8)

**Only during these modes** — multi-select from `location.modes` (shown when a command is selected)

**Advanced options:** Description textarea

**Custom command parameter management** (shown when `designer.custom` is true):
- Add string / integer / decimal / boolean / datetime parameter
- Delete parameter buttons

---

## Part 7 — `comparison` Widget (used in conditions, events, restrictions)

Step 1: **What to compare** (or "What event to expect" for events)
- Full `operand` widget for the left side

Step 2: **What kind of comparison?**
- Dropdown populated from `comparison.options` at runtime (from `app.js`)
- Grouped by category
- Not rendered for events (`comparison.event` flag)

Step 3: **Compare to** / **Between...**
- Right operand — shown when `comparison.parameterCount > 0`
- Second right operand — shown when `comparison.parameterCount > 1` (range comparisons)

**Time offset fields** (shown when left operand data type is `time` and right value is not a constant):
- **With offset...** for right operand
- **With offset...** for right2 operand

**Timed comparisons** (`was` / `stays` style):
- **In the last...** or **For...** duration operand
- For `stays` (timed==2): sub-select "less than..." / "at least..."

**Day/week/month filters** (shown when left operand is the `time` virtual device):
- Only on these days of the week (multi-select)
- Only on these days of the month (multi-select, if no week filter)
- Only on these weeks of the month (multi-select, if no day filter)
- Only on these months of the year (multi-select)

**IFTTT helper** (shown when left operand is virtual device `ifttt`):
- Displays the webhook URL to use in IFTTT Maker channel

**Followed by group fields:**
- **Within...** — duration operand
- **Matching method** — Loose / Strict / Negated

---

## Part 8 — `operand` Widget (universal value picker)

### Input type selector (left dropdown, always visible)

Options shown conditionally based on `operand.allow*` flags:
- `d` — Physical device(s) (variable — used in for-each, device operands)
- `p` — Physical device(s) (with attribute — standard device condition picker)
- `v` — Virtual device
- `s` — Preset
- `c` — Value (constant)
- `x` — Variable
- `e` — Expression
- `u` — Argument

### Right side — changes based on selected type

**`d` — Physical device (variable)**
- Multi-select from: Physical devices / Local device vars / Global device vars / System device vars

**`p` — Physical device with attribute**
- Device multi-select (75% width): Physical devices / Local device vars / Global device vars / System device vars
- Attribute select (25% width): from `operand.attributes` (populated at runtime from device capabilities)
- When multiple devices and aggregation allowed:
  - Aggregation selector: Any / All / Average / Count / Least / Max / Median / Min / Most / Stdev / Sum / Variance
- When attribute has sub-devices (e.g. lock codes): "Which [attribute](s)" multi-select
- When attribute supports physical/programmatic interaction: "Which interaction" — Any / Physical / Programmatic

**`v` — Virtual device**
- Single select from `virtualDevices` list (runtime populated from `app.js`)
- In condition/restriction context: all virtual devices shown
- In action context: only virtual devices with `device.x` flag shown

**`x` — Variable**
- Single or multi-select depending on `operand.multiple`
- Sources: Local variables / Global variables / System variables
- Filtered by `operand.restrictType` if set
- If variable type ends with `]` (list type): shows list index input

**`s` — Preset**
- For `time`/`datetime` data type: Sunrise / Noon / Sunset / Midnight
- For `color` data type: Random + standard color list

**`c` — Value (constant)**
- If no options list: plain input (type from `operand.inputType`: text/number/time/date/datetime-local)
- If options list, single select: dropdown
- If options list, multi select: multi-select dropdown
- For `lifxSelector` data type: LIFX-specific grouped selector (All lights / Individual lights / Groups / Locations / Scenes)

**`e` — Expression**
- Label showing evaluated result
- Textarea for expression entry (smart-area with autocomplete config)

**`u` — Argument**
- Plain text input

**Duration unit selector** (appended to any input when `operand.dataType == 'duration'`):
- milliseconds / seconds / minutes / hours / days / weeks / months / years

---

## Part 9 — `dialog-edit-condition-group` (Edit Existing Condition Group)

Separate dialog from the add-new flow. Shows when clicking the group operator in view.

Fields:
- **Logical Operator** — AND / OR / XOR / Followed by
- **Whole group negation** — Not negated / Negated
- If "Followed by": **Within...** operand + **Matching method**
- Advanced: Description textarea

---

## Part 10 — `dialog-edit-case` (Add/Edit Switch Case)

- **Case type** — Single value / Range
- **Switch expression matches** (or "is between" for range):
  - Operand picker (first value)
  - If range: second operand picker labeled "and"
- Advanced: Description textarea
- New case: **Add a statement** button

---

## Part 11 — `dialog-edit-restriction` (Add/Edit Restriction — `only when` blocks)

Same two-page structure as condition dialog but for restrictions.

Page 0:
- Warning: "Restrictions DO NOT subscribe to events and will not cause the piston to run."
- **Restriction** button / **Group** button
- Clipboard section

Page 1 (restriction):
- Same warning
- **comparison** widget

Page 1 (group):
- Same warning
- Logical Operator / Whole group negation (same as condition group)

---

## Part 12 — `dialog-edit-variable` (Add/Edit Local Variable)

- **Type** selector (25% width) + **Name** input (75% width)
- Variable types available:
  - Basic: Dynamic / String / Boolean / Integer / Decimal / Long / DateTime / Date / Time / Device
  - Advanced lists: Dynamic[] / String[] / Boolean[] / Integer[] / Decimal[] / Long[] / DateTime[] / Date[] / Time[]
- **Initial value (optional)** — operand widget (shown for non-list types)
- Note displayed when initial value is set explaining it resets on every run
- **Assignment type** — Dynamic (default) / Constant (cannot be changed) — shown when value is set and not a device
- Advanced: Description textarea

---

## Part 13 — `dialog-edit-global-variable` (Add/Edit Global Variable)

- **Type** selector + **Name** input (same layout)
- Variable types: Dynamic / String / Boolean / Integer / Decimal / DateTime / Date / Time / Device
  - Note: No list types for globals (unlike local variables)
- **Value** — operand widget (required, not optional)

---

## Part 14 — Piston Settings (`dialog-edit-settings`)

- **Piston name** — text input
- **Description** — textarea
- **Automatic piston state** — Enabled (default) / Disabled

Advanced options:
- **Piston execution parallelism** — Enabled / Disabled (default)
- **Command optimizations** — Enabled (default) / Disabled
- **Condition traversal optimizations** — Enabled (default) / Disabled
- **Event subscriptions** — Enabled (default) / Disabled
- **Allow pre-scheduled tasks during restrictions** — Enabled / Disabled (default)
- **Ignore SSL security issues for web requests** — Enabled / Disabled (default) — note displayed about self-signed certs
- **Command execution delay** — number input (ms), range 0–5000

---

## Part 15 — Piston-Level Structure (the `piston` template)

The code editor view renders these sections in order:

1. Comment header block (name, author, created, modified, build, UI version)
2. Import bin code (if `view.exportBin`)
3. **settings** block — shown if any setting is non-default or `view.settings` is on
   - `enable parallelism;`
   - `disable automatic piston state;`
   - `disable command optimization;`
   - `disable condition traversal optimizations;`
   - `disable event subscriptions;`
   - `set command execution delay to Xms;`
   - `allow pre-scheduled tasks to execute during restrictions;`
   - `ignore SSL errors on all web requests;` (shown with warning icon)
4. **define** block — local variables (shown if any defined or `view.variables` on)
5. **only when** block — piston-level restrictions (shown if any defined or `view.restrictions` on)
6. **execute** block — main statement list
7. **end execute;**

---

## Part 16 — Condition Rendering in the Code View

From the `condition` template — each condition line renders as:
```
[device/operand] [operator] [value]
```
Produced by `renderComparison(condition.lo, condition.co, condition.ro, condition.ro2, condition.to, condition.to2)`

Additional lines rendered below a condition when set:
- `save matching devices to {variableName}` — when `condition.lo.dm` is set
- `save non-matching devices to {variableName}` — when `condition.lo.dn` is set

Conditions also support inline when-true/when-false statement blocks (shown when `view.whens` is on):
```
{
  when true
    [statements]
  when false
    [statements]
}
```

---

## Part 17 — Parameter Widget (`parameter` template)

Used inside task dialogs for command parameters. Renders based on `parameter.i` (input type):

| `parameter.i` value | Input rendered |
|---|---|
| `color` | Dropdown: Random / Custom / Whites / Standard colors + color picker if Custom |
| `text` | Text input |
| `range` | Range slider with min/max/unit label |
| `number` | Number input with unit addon |
| `boolean` | Dropdown: false / true |
| `enum` (not optional) | Dropdown or button group (≤6 options) |
| `enum` (optional `d` flag) | Same but with "Nothing selected" option, radio deselects |
| `duration` | Number input + time unit select |

---

## Part 18 — What `app.js` Is Still Needed For

The following are populated at runtime from `app.js` and are NOT in `piston.module.html`:

- `designer.items.simple` and `designer.items.advanced` — the actual statement type cards shown on page 0 of the statement dialog (names, descriptions, icons, cssClass, button labels)
- `comparison.options` — the full list of comparison operators grouped by category (is / is not / is less than / was / stays / etc.)
- `virtualDevices` — the virtual device list (Location, time, date, etc.)
- `operand.attributes` — the attribute list per device (populated from HA capabilities)
- `designer.commands.common`, `designer.commands.partial`, `designer.commands.virtual` — the command lists in the task picker
- `designer.parameters` — the parameter definitions per selected command
- System variables list (`systemVarNames`, `systemVars`)
- Color database (`db.colors.standard`)

---

## Summary — Complete WebCoRE Wizard Surface

| Category | Count | Source |
|---|---|---|
| Statement types | 12 | Verified from template |
| Statement properties | 8 | Verified from template |
| Dialogs | 10 | Verified from template |
| Operand input types | 8 | Verified from template |
| Variable types (local) | 19 (10 scalar + 9 list) | Verified from template |
| Variable types (global) | 9 (scalar only) | Verified from template |
| Parameter input types | 7 | Verified from template |
| Items requiring `app.js` | 8 categories | Noted — not in this file |

---

## Part 19 — Statement Type Cards (Page 0 of dialog-edit-statement)

**Source:** `piston.js` — `$scope.designer.items` assignment in `editStatement()`

### Simple (always visible)

| type | Display name | Icon | Color | Description | Button label |
|---|---|---|---|---|---|
| `if` | If Block | `fa-code-branch` | info (blue) | "An if block allows the piston to execute different actions depending on the truth result of a comparison or set of comparisons" | "an if" |
| `action` | Action | `fa-code` | success (green) | "An action allows the piston to control devices and execute tasks" | "an action" |
| `every` | Timer | `fa-clock` (far) | warning (orange) | "A timer will trigger execution of the piston at set time intervals" | "a timer" |

### Advanced (behind "Show advanced statements" toggle)

| type | Display name | Icon | Color | Description | Button label |
|---|---|---|---|---|---|
| `switch` | Switch | `fa-code-branch` | info | "A switch statement compares an operand against a set of values and executes statements corresponding to those matches" | "a switch" |
| `do` | Do Block | `fa-code` | success | "A do block can help organize several statements into a single block" | "a do block" |
| `on` | On event | `fa-code-branch` | warning | "An on event executes its statements only when certain events happen" | "an on event" |
| `for` | For Loop | `fa-circle-notch` | warning | "A for loop executes the same statements for a set number of iteration cycles" | "a for loop" |
| `each` | For Each Loop | `fa-circle-notch` | warning | "An each loop executes the same statements for each device in a device list" | "a for each loop" |
| `while` | While Loop | `fa-circle-notch` | warning | "A while loop executes the same statements for as long as a condition is met" | "a while loop" |
| `repeat` | Repeat Loop | `fa-circle-notch` | warning | "A repeat loop executes the same statements until a condition is met" | "a repeat loop" |
| `break` | Break | `fa-ban` | danger (red) | "A break allows the interruption of the inner most switch, for loop, for each loop, while loop, or repeat loop" | "a break" |
| `exit` | Exit | `fa-ban` | danger | "An exit interrupts the piston execution and exits immediately" | "an exit" |

**Total: 3 simple + 9 advanced = 12 statement types.** Matches the template extraction exactly.

---

## Part 20 — Statement JSON Shape (verified from updateStatement())

What each statement type writes to piston JSON when saved. Source: `updateStatement()` switch block.

| Type | Key fields written |
|---|---|
| `action` | `d` (device array), `k` (tasks array, initialized empty) |
| `do` | `s` (statements array) |
| `on` | `c` (events array), `o: 'or'` (hardcoded), `n: false` (hardcoded), `s` (statements array) |
| `if` | `o` (operator), `n` (negation bool), `c` (conditions array), `s` (then-statements), `ei` (else-if array), `e` (else-statements) |
| `switch` | `lo` (expression operand), `cs` (cases array), `e` (default statements), `ctp` (case traversal policy) |
| `for` | `x` (counter variable name), `lo` (start), `lo2` (end), `lo3` (step), `s` (statements) |
| `each` | `x` (device variable name), `lo` (device list operand), `s` (statements) |
| `while` | `o` (operator), `n` (negation), `c` (conditions), `s` (statements) |
| `every` | `lo` (interval operand), `lo2` (time-of-day operand), `lo3` (offset operand), `s` (statements) |
| `repeat` | `o` (operator), `n` (negation), `c` (until-conditions), `s` (statements) |
| `break` | no additional fields |
| `exit` | `lo` (new piston state operand) |

**All statements also write:** `a` (async flag), `tcp`, `tep`, `tsp`, `z` (description), `r` (restrictions array), `rop`, `rn`, `di` (disabled bool), optionally `sm` (subscription method — deleted if auto).

---

## Part 21 — Every Statement Default Values (from editStatement())

When creating a new statement, before any type is chosen:

```
t: null        // type — set when user picks
d: []          // device list
o: 'and'       // condition operator
n: false       // condition negation
rop: 'and'     // restriction operator
rn: false      // restriction negation
a: '0'         // async — synchronous by default
di: false      // disabled
tcp: 'c'       // cancel on condition state change (default)
tep: ''        // always execute (default)
tsp: ''        // override scheduling (default)
ctp: 'i'       // safe case traversal (default)
z: ''          // description
```

---

## Part 22 — Operand Default Data Shape (from validateOperand())

Every operand starts with this data structure:

```json
{
  "t": "",       // type: p/v/d/x/s/c/e/u (or "" for nothing selected)
  "a": "",       // attribute (for physical device operands)
  "c": "",       // constant value
  "v": "",       // virtual device id
  "e": "",       // expression string
  "x": "",       // variable name
  "d": [],       // device id array
  "g": "any",    // aggregation (any/all/avg/count/min/max/etc.)
  "f": "l"       // timed comparison direction (l=less than, g=at least)
}
```

---

## Part 23 — Operand Allow Flags (what types are permitted per context)

From `validateOperand()` — which input types are shown in the type dropdown depends on the operand's `dataType`:

**Physical device (`p`) is NOT allowed when dataType is:**
datetime, date, time, device, variable, boolean (strict mode), duration

**Virtual device (`v`) is NOT allowed when dataType is:**
datetime, date, time, device, variable, decimal, integer, number, boolean, enum, color, duration

**Preset (`s`) is allowed only for:** datetime, time, color

**Constant (`c`) is NOT allowed for:** device, variable

**Variable (`x`) is NOT allowed for:** device (unless multiple), boolean (strict mode)

**Expression (`e`) is NOT allowed for:** variable, boolean (strict mode), events

**In `onlyAllowConstants` mode** (edit local var, global var, every-timer): only constant (`c`) or device list (`d`) is available; no physical/virtual/variable/expression.

---

## Part 24 — Operand DataType Normalizations (from validateOperand())

These plural/variant dataType strings are normalized before processing:

| Input dataType | Normalized to | Sets multiple |
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

---

## Part 25 — Operand Options Population (from validateOperand() switch block)

For constant (`c`) type operands, the options dropdown is populated from:

| dataType | Options source |
|---|---|
| `boolean` | hardcoded: `['false', 'true']` |
| `mode` | `instance.virtualDevices['mode'].o` |
| `powerSource` | `instance.virtualDevices['powerSource'].o` |
| `alarmSystemStatus` | `instance.virtualDevices['alarmSystemStatus'].o` |
| `rule` | `instance.virtualDevices['rule'].o` |
| `routine` | `instance.virtualDevices['routine'].o` |
| `attribute` | `listAvailableAttributeNames(parent.d)` |
| `piston` | `listAllPistons()` |
| `contact` | `contacts` list |
| `lifxScene` | `instance.lifx.scenes` |
| `lifxSelector` | empty array (uses custom grouped select in template) |
| `integer`, `decimal`, `duration` | null (plain number input) |
| everything else | null (plain text input) |

---

## Part 26 — Comparison Operator Groups (from validateComparison())

The comparison operator dropdown is populated from `db.comparisons.conditions` and `db.comparisons.triggers` — these are served from the Hubitat/SmartThings backend, not hardcoded in the JS.

**However**, the filtering logic is defined in the source. Operators are filtered by a `g` (group/datatype) field:

- `dt` (datatype code) is derived from the selected left operand's data type:
  - `color`, `hexcolor`, `object`, `vector3`, `enum` → `s` (string)
  - `image` → `f` (binary)
  - `dynamic` → `` (empty = matches all non-momentary)
  - `time`, `date`, `datetime` → `t`
  - everything else → first letter of datatype name (e.g. `n`→`d` for number→decimal)
- Momentary attributes get type `m` (for physical) or `v` (for virtual)
- Timed comparisons (`was`, `stays`) are disabled when: left operand is not a physical device, OR an aggregation function other than any/all is applied

**Two categories of operators:**
- **Conditions** — appear in if/while/repeat/restriction contexts (from `db.comparisons.conditions`)
- **Triggers** — appear in condition/event contexts but NOT in restrictions (filtered when `comparison.type == 'restriction'`)

Timed triggers are also suppressed when the left operand uses physical/programmatic interaction filtering.

---

## Part 27 — Comparison Operator Display fields

Each operator in `db.comparisons.conditions` and `db.comparisons.triggers` has these fields (used by the rendering code):

| Field | Purpose |
|---|---|
| `d` | Display text (singular) |
| `dd` | Display text (plural — shown when multiple devices selected) |
| `g` | Datatype group string (which data types this operator applies to) |
| `p` | Parameter count (0 = no right operand, 1 = one value, 2 = range) |
| `t` | Timed flag (0 = not timed, 1 = "in the last", 2 = "for") |
| `m` | Multiple flag (right operand allows multiple values) |

---

## Part 28 — Virtual Devices (from listAvailableVirtualDevices() + instance.virtualDevices)

Virtual devices are served from the backend (`instance.virtualDevices`). The JS code references these by key:

**Confirmed referenced virtual device keys:**
- `mode` — location modes (options object: id → name)
- `routine` — SmartThings routines (options object)
- `rule` — Hubitat rules (options object)
- `powerSource` — power source states
- `alarmSystemStatus` — SHM/HSM status values

**Used in rebuild dialog:**
- `mode.o` — mode options
- `routine.o` — routine options
- `rule.o` — rule options

**In the operand widget,** virtual devices shown in the `v` type picker are filtered: in action context only devices with `device.x` flag are shown; in condition/restriction context all virtual devices are shown.

---

## Part 29 — Command Structure (from prepareParameters() + listAvailableCommands())

Commands come from `db.commands.physical` and `db.commands.virtual`. Each command has:

| Field | Purpose |
|---|---|
| `n` | Command name (display) |
| `d` | Display format string with `{0}`, `{1}` parameter placeholders |
| `p` | Parameters array |
| `r` | Required capabilities array (for virtual/emulated commands only) |
| `i` | Icon name (Font Awesome) |
| `is` | Icon style (pro only) |
| `em` | Emulated flag |
| `cm` | Custom flag |

Each parameter in `p` has:
| Field | Purpose |
|---|---|
| `n` | Parameter label |
| `t` | Data type (maps to attribute type or primitive) |
| `d` | Optional/default value indicator |
| `o` / `c` | Options array |
| `s` | Strict flag |
| `h` | Help text |
| `w` | Warning text |

**httpRequest special handling** (confirmed in source via `taskedit` directive and `renderTask()`):
- Parameter[1] = method (GET/POST/PUT/DELETE/HEAD)
- Parameter[2] = request body type
- Parameter[3] = send variables / query string
- Parameter[4] = request body
- Parameter[5] = content type
- GET/DELETE/HEAD → hide body type, show query string
- POST/PUT + body type CUSTOM → show body + content-type, hide send-variables
- POST/PUT + other body type → show encoded data fields

---

## Part 30 — Command Picker Grouping Logic (from listAvailableCommands())

The three groups in the task picker are built dynamically:

**Common** — commands supported by ALL selected devices (count == deviceCount)

**Partial** — commands supported by only SOME of the selected devices

**Virtual** — commands from `db.commands.virtual` that have no `r` requirement (available to all), OR have `r` requirements that ALL selected devices satisfy (→ common group) or SOME satisfy (→ partial group)

**Custom commands** — identified with `$custom` suffix in the picker. A command is custom if `cmd.cm` is true OR if the command name isn't in `db.commands.physical`.

**Variable device resolution** — if a device variable is selected instead of a specific device, the wizard attempts to resolve the variable's current value to get the device list; if empty/unknown, it falls back to the full physical command DB.

---

## Part 31 — Device Type Icons (from determineDeviceType() in dataService)

Used for dashboard display. Maps device capability names to type strings:

| Capability | Type string |
|---|---|
| Water Sensor | `waterSensor` |
| Contact Sensor | `contactSensor` |
| Thermostat | `thermostat` |
| Garage Door Control | `garageDoor` |
| Music Player | `musicPlayer` |
| Door Control | `door` |
| Presence Sensor | `presenceSensor` |
| Motion Sensor | `motionSensor` |
| Color Control | `rgbBulb` |
| Color Temperature | `whiteBulb` |
| Switch Level + "light" in name | `whiteBulb` |
| Switch Level + "keen"/"vent" in name | `vent` |
| Switch Level (other) | `dimmer` |
| Lock | `lock` |
| Button (double) | `keypad` |
| Button | `button` |
| Temperature Measurement | `temperatureSensor` |
| Switch + Power Meter | `outlet` |
| Switch | `switch` |
| Power Meter | `powerMeter` |
| (none matched) | `unknownDevice` |

---

## Part 32 — Condition JSON Shape (from updateCondition())

**Type `condition`:**
```
lo  — left operand data
co  — comparison operator id
ro  — right operand data
ro2 — right2 operand data (range comparisons)
to  — time operand data (was/stays duration)
to2 — time2 operand data (second time operand)
wd  — within duration operand (followed-by groups)
wt  — within matching method ('l'=loose, 's'=strict, 'n'=negated)
sm  — subscription method
ts  — when-true statements array
fs  — when-false statements array
z   — description
```

**Type `group`:**
```
c   — conditions array
o   — logical operator (and/or/xor/followed by)
n   — negation bool
wd  — within duration (followed-by only)
wt  — within matching method (followed-by only)
z   — description
```

---

## Part 33 — System Variables Referenced in Source

From `parseExpression()` — composite variable prefixes that bypass normal variable validation:

- `$args.` / `$args[` — piston argument access
- `$json.` / `$json[` — JSON response data
- `$places.` / `$places[` — places data
- `$response.` / `$response[` — web request response
- `$nfl.` — NFL data
- `$weather.` — weather data
- `$twcweather.` — TWC weather data
- `$incidents.` / `$incidents[` — incidents data

From `listAutoCompleteDevices()`:
- `$currentEventDevice`
- `$previousEventDevice`

From `getVariableByName()`:
- `$device` — resolves to current for-each device
- `$currentEventDevice` — resolves to devices from nearest `on` statement
- `$currentEventValue` — resolves attribute type/options from nearest `on` statement

---

## Summary of app.js Additions

| Part | Content | Source |
|---|---|---|
| 19 | Statement card names, icons, descriptions | `editStatement()` `$scope.designer.items` |
| 20 | Statement JSON fields per type | `updateStatement()` switch |
| 21 | New statement default values | `editStatement()` initialization |
| 22 | Operand data default shape | `validateOperand()` init block |
| 23 | Operand allow flags by dataType | `validateOperand()` allow logic |
| 24 | DataType normalizations | `validateOperand()` normalization block |
| 25 | Options dropdown population | `validateOperand()` switch block |
| 26 | Comparison operator filtering | `validateComparison()` |
| 27 | Comparison operator data fields | `renderComparison()` usage |
| 28 | Virtual device keys | `validateOperand()` + `rebuildPiston()` |
| 29 | Command structure | `prepareParameters()` |
| 30 | Command picker grouping | `listAvailableCommands()` |
| 31 | Device type icons | `determineDeviceType()` |
| 32 | Condition JSON shape | `updateCondition()` |
| 33 | System variables | `parseExpression()` + `getVariableByName()` |

---

## What Remains Backend-Served (not in frontend source)

These are referenced in the JS as `$scope.db.*` and are fetched from the Hubitat/SmartThings backend via `getPiston()` → `getDb()`. They are NOT hardcoded in the frontend and cannot be extracted from the WebCoRE source files. PistonCore must supply its own equivalents:

| `db` key | Content | PistonCore equivalent |
|---|---|---|
| `db.comparisons.conditions` | All condition operators (is, is not, is less than, was, stayed, etc.) with group/display/param fields | Must be defined in PistonCore — maps to HA condition types |
| `db.comparisons.triggers` | All trigger operators (changes, changes to, changes from, etc.) | Must be defined in PistonCore — maps to HA trigger types |
| `db.commands.physical` | All device commands with parameters (on, off, setLevel, setColor, etc.) | Live from HA — PistonCore pulls from HA services |
| `db.commands.virtual` | Non-device commands (wait, set variable, log, etc.) | PistonCore defines these — see Section 10 of HA_LIMITATIONS.md |
| `db.attributes` | All device attributes with types, options, ranges (switch, level, color, etc.) | Live from HA — PistonCore pulls from HA entity states |
| `db.capabilities` | Capability definitions mapping capabilities to attributes | HA equivalent is domain + attribute from entity registry |
| `db.functions` | Expression functions (now(), round(), abs(), etc.) | PistonCore must define its own function list for the expression editor |

**Key implication for PistonCore:** The comparison operator lists (`conditions` and `triggers`) are the one piece of the wizard vocabulary that WebCoRE defines internally but PistonCore must define independently. These do not come from HA — they are the semantic vocabulary of the condition editor itself (is, is not, was, stays, changes to, etc.). This is the remaining gap in the verified map.

---

## Document Completeness

**Fully verified from source (no assumptions):**
- All 12 statement types and their display syntax — `piston.module.html`
- All 10 dialog structures and their exact fields — `piston.module.html`
- All operand widget input types and their visibility rules — `piston.module.html` + `piston.js`
- All statement card names, descriptions, icons — `piston.js`
- All JSON shapes written on save — `piston.js`
- All default values for new objects — `piston.js`
- Command picker grouping logic — `piston.js`
- Virtual device key names — `piston.js`
- System variable names — `piston.js`

**Confirmed backend-served (cannot extract from frontend):**
- Comparison operator lists (conditions + triggers)
- Physical device command definitions
- Attribute definitions
- Capability definitions
- Expression function list

**Not applicable to PistonCore (WebCoRE/Hubitat-platform-specific, cut per HA_LIMITATIONS.md §10.2):**
- Piston tiles
- Pause/resume piston engine state
- SmartThings routines (replaced by HA scripts/automations)
- LIFX cloud integration (replaced by HA LIFX integration entity commands)
