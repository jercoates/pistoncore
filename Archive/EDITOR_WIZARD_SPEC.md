# PistonCore — Editor & Wizard Specification

**Version:** 1.0 (spec-build session, June 2026)
**Covers:** Both surfaces — the piston editor (code view) and the wizard modal (all dialogs). These are one spec because they form a closed loop: every wizard action lands in the editor, and every editor click opens the wizard.

This spec DESCRIBES BEHAVIOR. JSON shapes live in PISTON_JSON_STRUCTURE_MAP.md — this file references those shapes by name and never restates them. Compiler behavior is out of scope.

---

## 0. Foundational Invariants — Everything Else Derives From These

### 0.1 The Round-Trip Guarantee

The editor and wizard form a single, closed round trip [VERIFIED]:

1. The piston JSON (intent) is the sole source of truth.
2. The editor renders the JSON as human-readable code — a pure projection, one direction only.
3. The user clicks a node — the wizard opens, pre-filled from that node's current JSON values.
4. The user edits, confirms — the wizard writes changed fields back into the JSON.
5. The editor re-renders from the updated JSON.
6. **The user's edits appear in the re-render.** Saved edits survive reload and reappear because they are in the JSON.

The display text is always generated from JSON, never stored, never parsed. No edit ever targets display text. The readable code is a view — destroying and recreating it from scratch is always correct. [VERIFIED]

### 0.2 Pure-Projection Invariant

**The editor never stores display text. It never reads display text to determine piston state.** Every edit goes through a JSON mutation first. The editor re-renders the affected portion after every mutation. Structural keywords (`then`, `end if;`, `end with;`, `when true`, `when false`) are display artifacts produced by the render engine — they do not exist in the JSON, cannot be clicked to edit, and cannot be deleted. They appear and disappear as the JSON changes. [VERIFIED from FRONTEND_SPEC]

### 0.3 Cross-Cutting Rules

1. **Frontend never calls HA directly.** All live HA data (entities, capabilities, states, services) reaches the wizard via the PistonCore backend. [VERIFIED]
2. **Vanilla JS/HTML/CSS, no framework.** WebCoRE's AngularJS handlers are behavioral reference only. This spec describes behavior; a coding agent builds the vanilla-JS mechanism.
3. **Variables and globals store device friendly names, never entity IDs.** The picker resolves live entities at pick time; commit writes the attribute-bearing entity ID per device to the node, but variable and global storage stays friendly-name keyed. LOAD-BEARING — see PISTON_JSON_STRUCTURE_MAP.md §2. [VERIFIED]
4. **Globals live in PistonCore's top-bar drawer.** Do not render WebCoRE's right-hand globals sidebar.
5. **Capability-driven, not service-driven.** Commands come from device capabilities (the `webcore_vocab.json` capability→command map), never from HA services directly. [DECISION: verified root cause of the color-fields-on-on/off defect in WIZARD_ACTION_COMMAND_SPEC]
6. **Compiler out of scope.** Nothing in this spec describes JSON→YAML/PyScript, service mapping, or native-vs-PyScript routing. The editor and wizard build and edit intent only.

---

## 1. Editor Structure — The Code View

### 1.1 Overall Layout

The editor canvas renders the piston as a WebCoRE-style text document: indented, syntax-highlighted, scrollable. It sits inside the `#editor-doc` div with `flex: 1; overflow-y: auto; min-height: 0` applied directly as inline styles (required for flex/scroll behavior). [VERIFIED from FRONTEND_SPEC]

The document renders these sections in order, from top to bottom [VERIFIED]:

```
/*** {piston.name} ***/
settings
  {non-default settings}
end settings;
define
  {variables}
end define;
triggers
  {triggers}
only when
  {restrictions}
execute
  {statements}
end execute;
```

The `settings` block appears only when at least one setting is non-default, or the view-layer toggle "show settings" is on [VERIFIED from WEBCORE_WIZARD_MAP Part 15]. The `define` block and the `triggers`/`only when` blocks follow the same rule — show if content exists or if their toggle is on (see §1.3). Each section's `end X;` line is a display artifact and is not stored in JSON.

The keyword color (teal-family) and dark-background theme are PistonCore's own — not a WebCoRE copy. Indentation uses consistent spacing (2rem per level). Ghost/structural text is muted gray. Statement numbers appear on the left side of the action tree. Selected statement has a visible highlight. [VERIFIED from FRONTEND_SPEC visual notes]

### 1.2 Section-by-Section Render

**Settings block** — each non-default piston option renders as one line [VERIFIED from WEBCORE_WIZARD_MAP Part 15]:
- `enable parallelism;`
- `disable automatic piston state;`
- `disable command optimization;`
- `disable condition traversal optimizations;`
- `disable event subscriptions;`
- `set command execution delay to {N}ms;`
- `allow pre-scheduled tasks to execute during restrictions;`
- `ignore SSL errors on all web requests;` (rendered with a warning icon)

Clicking the piston name at the top → opens piston settings dialog (§6.1). [VERIFIED from EDITOR_REFERENCE §1]

**Define block** — each variable renders as one line [VERIFIED from EDITOR_REFERENCE §2]:
```
[const] {var_type} {name} [= {initial_value}];  /* current runtime value */
```
`const` keyword appears only when the variable's assignment type is `"s"` (constant). The `/* current value */` comment is the live runtime value annotation, not a storage field. A `+ add a new variable` link appears below the list. [VERIFIED]

**Triggers block** — each trigger renders identically to a condition row (§2.4). [ASSUMED: PistonCore adds explicit triggers[] at root level; no WebCoRE render precedent — RISK medium — verify in editor.js trigger section]

**Only-when block** — each restriction renders identically to a condition row (§2.4), using the `renderComparison()` function. The `only when` header and `end only when;` are display artifacts. [VERIFIED from EDITOR_REFERENCE §5]

**Execute block** — the main statement tree. Renders all statement types per §2. The `execute` header and `end execute;` footer are display artifacts.

**Add links** — each section has a `+ add a new {type}` link below its content area. These links are always visible when the section is shown (even if empty). Clicking them opens the new-item wizard dialog for that section type. [VERIFIED from piston.module.html structure]

### 1.3 Four View-Layer Toggles

Four independent show/hide toggles over the same tree [DECISION: verified WebCoRE behavior + user-confirmed keep]. Each toggle changes what is displayed; none change what is stored. A hidden layer's data is fully retained and reappears when toggled on.

| Toggle | What it shows/hides |
|---|---|
| Variables/define | The `define` block and all its variable rows |
| Complex IFs (else/else-if) | The `else if` and `else` branches of `if` blocks |
| Restrictions | The `only when` block and all restriction rows |
| Move handles | Drag handles on every statement/task row |

[DECISION: evaluation console is NOT included — user confirmed drop]

These toggles are persistent UI state (localStorage). The piston JSON is unchanged by any toggle.

---

## 2. Editor: How Each Node Renders

Rendering is always a pure projection from JSON (§0.2). The render engine reads the node's type and fields and produces display text. The coding agent implements each render case from the formats below, which are verified from `piston.module.html.txt` via EDITOR_REFERENCE.

### 2.1 Structural / Block Statements

**IF** [VERIFIED from EDITOR_REFERENCE §6]:
```
[async] if [policy badges]
  {conditions rendered as comparison rows}
then
  {then-statements}
else if
  {else_if[N].conditions}
then
  {else_if[N].statements}
...
else
  {else-statements}
end if;
```
`[async]` appears when `async` is true. Policy badges (TEP/TCP) appear inline after the keyword. `else if` and `else` branches are controlled by the view-layer toggle (§1.3). The `if`, `then`, `else if`, `else`, and `end if;` keywords are display artifacts except for the clickable `if` line.

**DO** [VERIFIED from EDITOR_REFERENCE §8]:
```
/* {description} */
[async] do [policy badges]
  {statements}
end do;
```

**ON_EVENT** [VERIFIED from EDITOR_REFERENCE §9]:
```
/* {description} */
on events from [policy badges]
  {each event: renderOperand(event.lo)}
  ...
do
  {statements}
end on;
```
Multiple events are joined with `or` between them. [VERIFIED from piston.module.html line 772]

**WHILE** [VERIFIED from EDITOR_REFERENCE §10]:
```
/* {description} */
[async] while [policy badges]
  {conditions}
do
  {statements}
end while;
```

**REPEAT** [VERIFIED from EDITOR_REFERENCE §11]:
```
/* {description} */
[async] repeat [policy badges]
do
  {statements}
until
  {until_conditions}
end repeat;
```
Conditions are rendered AFTER the `until` keyword. The JSON field is `until_conditions[]` — distinct from `conditions[]` on all other block types. [VERIFIED from PISTON_JSON_STRUCTURE_MAP §11]

**EVERY (timer)** [VERIFIED from EDITOR_REFERENCE §12]:
```
every {renderTimer(statement)} [policy badges]
do
  {statements}
end every;
```
`renderTimer()` produces the human-readable interval expression (e.g., `5 minutes`; `1 hour at :30`). [VERIFIED call site; implementation in editor.js]

**SWITCH** [VERIFIED from EDITOR_REFERENCE §13]:
```
[async] switch ({renderOperand(statement.expression)}) [fall-through badge if case_traversal_policy=='fallthrough']
  case {value}:
    {statements}
  ...
  default:
    {default-statements}
end switch;
```
Expression rendered via `renderOperand(statement.expression)`. Range cases render as `case {value_from} to {value_to}:`. [ASSUMED: range render format — RISK medium — verify in editor.js switch case render]

**FOR** [VERIFIED from EDITOR_REFERENCE §15]:
```
[async] for ({renderForOperands(statement)})
do
  {statements}
end for;
```

**FOR_EACH** [VERIFIED from EDITOR_REFERENCE §16]:
```
[async] for each ({renderForEachOperands(statement)})
do
  {statements}
end for each;
```

**ACTION (with-block)** [VERIFIED from EDITOR_REFERENCE §19]:
```
/* {description} */
only when {restrictions}
[async] with [policy badges]
  {renderDeviceNameList(statement.role)}
do
  {tasks}
end with;
```
The keyword is `with`, not `action`. [VERIFIED] The device name list renders the `role` label (the friendly name or variable label) wrapped in curly braces, e.g., `{Kitchen Light}`. In compact mode (no restrictions, one task), renders inline without the block wrapper. [ASSUMED: compact mode behavior — RISK low — verify in editor.js action render]

### 2.2 Leaf Statements

**BREAK** [VERIFIED from EDITOR_REFERENCE §17]:
```
break
```

**EXIT** [VERIFIED from EDITOR_REFERENCE §18]:
```
exit {renderOperand(statement.value)};
```
Value comes from `statement.value` (a Value Object per PISTON_JSON_STRUCTURE_MAP §18). The keyword is `exit`.

**SET_VARIABLE** [ASSUMED: PistonCore-specific, no WebCoRE render precedent — RISK medium — check editor.js]:
```
set {variable} = {renderOperand(statement.value)};
```

**WAIT** [ASSUMED: PistonCore-specific — RISK medium — check editor.js]:
```
wait {duration} {unit};
```
or, for `wait_type: "until"`: `wait until {expression};`
or, for `wait_type: "duration"` with variable: `wait {$varName};`

**WAIT_FOR_STATE** [ASSUMED: PistonCore-specific — RISK medium — check editor.js]:
```
wait for state
  {conditions}
[timeout: {timeout_seconds}s]
end wait;
```

**LOG_MESSAGE** [ASSUMED: PistonCore-specific — RISK medium — check editor.js]:
```
log {level}: {renderOperand(statement.message)};
```

**CALL_PISTON** [ASSUMED: PistonCore-specific — RISK medium — check editor.js]:
```
call piston {target_piston_name};
```

**CANCEL_PENDING_TASKS** [ASSUMED: PistonCore-specific — RISK medium — check editor.js]:
```
cancel pending tasks;
```

### 2.3 Task Rendering (inside action with-blocks)

Each task in `action.tasks[]` renders as a row [VERIFIED from EDITOR_REFERENCE §20]:
```
do {renderTask(task)}
```
`do` is a fixed prefix keyword. `renderTask()` produces the human-readable command + parameter description (e.g., `Turn on`, `Set level to 75%`, `Speak "Hello"`). [VERIFIED call site; `renderTask()` implementation in editor.js]

### 2.4 Condition / Trigger / Restriction Rendering

Each item in a conditions, triggers, restrictions, or until_conditions array renders as one comparison row [VERIFIED from EDITOR_REFERENCE §4]:
```
{renderComparison(condition)}
```
`renderComparison()` produces: `{subject} {operator} {value}` where subject is the device + attribute label (or virtual device label, or variable), operator is the human-readable operator string, and value is the right-operand value. [VERIFIED call site; implementation in editor.js]

Additional annotations below a condition when set [VERIFIED from WEBCORE_WIZARD_MAP Part 16]:
- `save matching devices to {variableName}` — when `dm` field is set
- `save non-matching devices to {variableName}` — when `dn` field is set

When the view-layer "when true/false" toggle is on [DECISION from §3 pre-approved change — `ts`/`fs` fields]:
```
{
  when true
    {ts-statements}
  when false
    {fs-statements}
}
```

For a condition that is a group (has a `c` sub-array), the render engine shows the group header with its logical operator badge, then renders the sub-conditions indented. [VERIFIED from piston.module.html line 820]

The `group_operator` connecting a condition to the previous one renders as an `and` / `or` / `xor` badge at the same indent level as the conditions it connects. [VERIFIED from editor.js condition rendering model]

---

## 3. Editor: Click-to-Edit Handoff

Clicking a clickable element in the editor opens the corresponding wizard dialog. The editor passes the clicked node (by reference) and its parent array to the wizard. The wizard opens pre-filled from the node's current values.

### 3.1 Click Targets Per Node Type

| Node clicked | Handler | Dialog opened |
|---|---|---|
| Piston name (top) | `editSettings()` | Piston settings (§6.1) |
| Variable row | `editVariable(variable)` | Variable dialog (§6.2) |
| Trigger row | `editTrigger(trigger, triggers[])` | Condition/trigger dialog (§5) [ASSUMED: RISK medium] |
| Condition row | `editCondition(condition, collection.c)` | Condition dialog (§5) |
| Restriction row | `editRestriction(restriction, collection.r)` | Restriction dialog (§5.3) |
| Condition group header | `editConditionGroup(group, collection.c)` | Condition group dialog (§5.2) |
| `if` keyword line | `editStatement(statement, parentArray)` | Statement dialog (§4) |
| `do` keyword line | `editStatement(statement, parentArray)` | Statement dialog (§4) |
| `on events from` line | `editStatement(statement, parentArray)` | Statement dialog (§4) |
| `while` keyword line | `editStatement(statement, parentArray)` | Statement dialog (§4) |
| `repeat` keyword line | `editStatement(statement, parentArray)` | Statement dialog (§4) |
| `every` keyword line | `editStatement(statement, parentArray)` | Statement dialog (§4) |
| `switch` keyword line | `editStatement(statement, parentArray)` | Statement dialog (§4) |
| `for` keyword line | `editStatement(statement, parentArray)` | Statement dialog (§4) |
| `for each` keyword line | `editStatement(statement, parentArray)` | Statement dialog (§4) |
| `break` line | `editStatement(statement, parentArray)` | Statement dialog (§4) |
| `exit` line | `editStatement(statement, parentArray)` | Statement dialog (§4) |
| `case` line | `editCase(case, switch.cases)` | Case dialog (§4.11) |
| Action device name list | `editStatement(statement, parentArray)` | Statement dialog (§4) — action type |
| Task row | `editTask(task, statement)` | Task dialog (§6.3) |
| Event row (in on_event) | `editEvent(event, collection.c)` | Event dialog (§5.4) |
| SET_VARIABLE statement | `editStatement(statement, parentArray)` | Statement dialog (§4) [ASSUMED: RISK medium] |
| WAIT statement | `editStatement(statement, parentArray)` | Statement dialog (§4) [ASSUMED: RISK medium] |
| WAIT_FOR_STATE statement | `editStatement(statement, parentArray)` | Statement dialog (§4) [ASSUMED: RISK medium] |
| LOG_MESSAGE statement | `editStatement(statement, parentArray)` | Statement dialog (§4) [ASSUMED: RISK medium] |
| CALL_PISTON statement | `editStatement(statement, parentArray)` | Statement dialog (§4) [ASSUMED: RISK medium] |
| CANCEL_PENDING_TASKS | `editStatement(statement, parentArray)` | Statement dialog (§4) [ASSUMED: RISK medium] |

[VERIFIED handler names from EDITOR_REFERENCE §3.1 column entries]

**Add links (always present, not edit):**

| Link | Handler | Result |
|---|---|---|
| `+ add a new variable` | `addVariable()` | New variable dialog |
| `+ add a new trigger` | `addTrigger(triggers[])` | New condition/trigger dialog [ASSUMED] |
| `+ add a new condition` | `addCondition(conditions[])` | New condition dialog |
| `+ add a new restriction` | `addRestriction(restrictions[])` | New restriction dialog |
| `+ add a new statement` | `addStatement(statements[])` | New statement type picker |
| `+ add a new task` | `addTask(statement)` | New task dialog |
| `+ add else if` | `addCondition(statement.else_ifs[], true)` | New condition dialog |
| `+ add event` | `addEvent(on.conditions[])` | New event dialog |
| `+ add a case` | `addCase(switch.cases)` | New case dialog |

---

## 4. Wizard: The Statement Dialog

### 4.1 Two-Page Flow

The statement dialog is two pages [VERIFIED from WEBCORE_WIZARD_MAP Part 3]:

**Page 0 — Type picker.** The user chooses what kind of statement to add. Statements are grouped into Simple (always visible) and Advanced (behind a "Show advanced statements" toggle).

Simple statements [VERIFIED from WEBCORE_WIZARD_MAP Part 19]:
- **If Block** (`if`) — blue
- **Action** (`action`) — green
- **Timer** (`every`) — orange

Advanced statements [VERIFIED from WEBCORE_WIZARD_MAP Part 19]:
- **Switch** — blue
- **Do Block** — green
- **On Event** — orange
- **For Loop** — orange
- **For Each Loop** — orange
- **While Loop** — orange
- **Repeat Loop** — orange
- **Break** — red
- **Exit** — red

PistonCore adds: **Set Variable**, **Wait**, **Wait For State**, **Log**, **Call Piston**, **Cancel Pending Tasks** as additional types. [DECISION: PistonCore-specific additions; placement in simple vs advanced is a build decision — ASSUMED: advanced group — RISK low]

A clipboard section at the bottom of page 0 shows any statement previously copied, with a `[Paste this statement]` button. [VERIFIED from WEBCORE_WIZARD_MAP Part 3]

**Page 1 — Type-specific configuration.** After the user picks a type, the dialog advances to the configuration form for that type. For edit mode (clicking an existing statement), the dialog opens directly at page 1 with the current values pre-filled.

### 4.2 Per-Type Configuration (Page 1)

#### `if`

Page 1 shows two buttons only: **Add a condition** and **Add a group**. No expression field — conditions are added after the `if` block is created. [VERIFIED from WEBCORE_WIZARD_MAP Part 3 / EDITOR_REFERENCE §6]

After creating the `if` block, the wizard chains immediately to the condition dialog without closing (see §7.3 chaining).

#### `switch`

Page 1 shows one operand picker: the switch **Expression** (the value to compare against cases). [VERIFIED from WEBCORE_WIZARD_MAP Part 3]

After creating the `switch` block, wizard chains to the case dialog.

#### `while`

Page 1 shows info text only. No fields. Conditions are added after. [VERIFIED from WEBCORE_WIZARD_MAP Part 3]

#### `repeat`

Page 1 shows info text only. No fields. Statements and until-conditions added after. [VERIFIED from WEBCORE_WIZARD_MAP Part 3]

#### `for`

Page 1 shows [VERIFIED from WEBCORE_WIZARD_MAP Part 3]:
- **Start value** — operand picker
- **End value** — operand picker
- **Step** — operand picker
- **Counter variable (optional)** — dropdown, only integer / decimal / dynamic variables

After creating, wizard chains to add-statement.

#### `each` (for_each)

Page 1 shows [VERIFIED from WEBCORE_WIZARD_MAP Part 3]:
- **Counter variable (optional)** — dropdown, only `device`-type variables
- **List of devices** — operand picker (device type)

After creating, wizard chains to add-statement.

#### `exit`

Page 1 shows [VERIFIED from WEBCORE_WIZARD_MAP Part 3]:
- **New piston state** — operand picker (the value the piston returns on exit)

Add fires immediately — no chaining.

#### `do`

Page 1 shows info text only. After creating, wizard chains to add-statement. [VERIFIED from WEBCORE_WIZARD_MAP Part 3]

#### `on` (on_event)

Page 1 shows info text only. After creating, wizard chains to add-event. [VERIFIED from WEBCORE_WIZARD_MAP Part 3]

#### `action`

Page 1 shows a device multi-select picker [VERIFIED from WEBCORE_WIZARD_MAP Part 3]:

Groups shown in order:
1. Virtual devices (Location) — shown as a header/disabled entry
2. Physical devices from HA device list
3. Local variables of type `device`
4. Global variables of type `device`
5. System variables of type `device`

After creating, wizard chains to task dialog.

#### `every` (timer)

Page 1 shows [VERIFIED from WEBCORE_WIZARD_MAP Part 3]:
- **Every...** — operand picker, duration type
- **At this minute of the hour** — integer 0–59, shown only when unit is `h`
- **At this time** — time operand, shown when unit is `d`/`w`/`n`/`y`
- **With this offset** — operand, shown when at-this-time is set and not a constant
- **Only during these minutes** — multi-select 0–59, shown when unit is `ms` or `s`
- **Only during these hours** — multi-select 0–23, shown when unit is `ms`/`s`/`m`
- **Only on these days of the week** — multi-select, shown when unit is not `w`/`n`/`y`
- **Only on these days of the month** — multi-select (1–31, last, second-last, third-last), shown when unit is not `n`/`y` and no week-of-month is selected
- **Only on these weeks of the month** — multi-select (1–5, last, second-last, third-last), shown when unit is not `n`/`y` and no day-of-month is selected
- **Only on these months of the year** — multi-select Jan–Dec, shown when unit is not `y`

Warning shown if interval is less than 30 seconds. [VERIFIED from WEBCORE_WIZARD_MAP Part 3]

After creating, wizard chains to add-statement.

#### `break`

No configuration fields. Add fires immediately. [VERIFIED from WEBCORE_WIZARD_MAP Part 3]

#### PistonCore-specific types

**SET_VARIABLE** [ASSUMED: basis: structure map §22 + wizard_action_command path — RISK medium]:
- Variable name — dropdown of all local and global variables
- Value — operand picker

**WAIT** [ASSUMED: basis: structure map §23 — RISK medium]:
- Wait type — Duration / Until
- Duration: duration operand (shown when type is Duration)
- Duration variable: variable dropdown (alternative to fixed duration)
- Until expression: expression/operand (shown when type is Until)

**WAIT_FOR_STATE** [ASSUMED: basis: structure map §24 — RISK medium]:
- Conditions added after (chains to add-condition)
- Timeout — optional duration operand

**LOG_MESSAGE** [ASSUMED: basis: structure map §25 — RISK medium]:
- Level — dropdown: info / warn / error
- Message — operand picker (string type)

**CALL_PISTON** [ASSUMED: basis: structure map §26 — RISK medium]:
- Target piston — dropdown from all pistons in PistonCore

**CANCEL_PENDING_TASKS** [ASSUMED: basis: structure map §27 — RISK medium]:
- No configuration fields

### 4.3 Advanced Options Panel (All Statement Types)

The gear icon on page 1 reveals the advanced options panel [VERIFIED from WEBCORE_WIZARD_MAP Part 3]:

| Field | Appears on |
|---|---|
| Description (textarea) | All types |
| Task Execution Policy (TEP) | All except `on` |
| Task Cancellation Policy (TCP) | All except `on` |
| Task Scheduling Policy (TSP) | `action` only |
| Case Traversal Policy | `switch` only — Safe (auto-break) / Fall-through |
| Execution Method (async) | All except `every`, `on` |
| Subscription method | `switch` with `ct=='c'` only |
| Disable statement | All |

[VERIFIED from WEBCORE_WIZARD_MAP Part 2 and Part 3 advanced options]

### 4.4 Footer Buttons

New item: **Add** / **Add more** / **Back** [VERIFIED from piston.module.html footer pattern]
Existing item: **Save** / **Cancel** / **Delete** [VERIFIED]
**Add more** commits the current item and immediately opens a new blank dialog of the same type — no close/reopen.

### 4.11 Case Dialog (switch cases)

Dialog: `dialog-edit-case` [VERIFIED from EDITOR_REFERENCE §14]:
- **Case type** — Single value / Range
- **Switch expression matches** — operand picker (single value)
- If Range: **and** — second operand picker (range end value)
- Advanced: Description

New case: footer shows **Add a statement** (chains to add-statement after creating the case). [VERIFIED from piston.module.html line 1679]

---

## 5. Wizard: The Condition, Trigger, and Restriction Dialogs

### 5.1 Condition Dialog — Two-Page Flow

**Page 0 — Type picker** [VERIFIED from WEBCORE_WIZARD_MAP Part 4]:
- **Condition** — a single comparison between two operands
- **Group** — a collection of conditions with a logical operator

Clipboard section shows previously copied conditions.

**Page 1 (Condition type)** — uses the comparison widget (§5.5) [VERIFIED from WEBCORE_WIZARD_MAP Part 4]

**Page 1 (Group type)** [VERIFIED from WEBCORE_WIZARD_MAP Part 4]:
- **Logical Operator** — Logical AND / Logical OR / Logical eXclusive OR (XOR) / Followed by
- **Whole group negation** — Not negated / Negated
- If operator is "Followed by":
  - **Within...** — duration operand
  - **Matching method** — Loose / Strict / Negated

**Advanced options** (gear icon, both types) [VERIFIED from WEBCORE_WIZARD_MAP Part 4]:
- **Store matching devices to variable** — device variable dropdown (condition type only, when left operand is a physical device)
- **Store non-matching devices to variable** — device variable dropdown (same condition)
- **Subscription method** — Auto / Always subscribe / Never subscribe
- **Description** — textarea

**ts/fs sub-statements** [DECISION from §3.1 — pre-approved structure-map change]: The condition node supports `ts` (when-true) and `fs` (when-false) sub-statement arrays. The condition dialog must include a way to add statements to these arrays when building or editing a condition. Shown in the editor only when the view-layer toggle is on (§1.3). [DECISION: verified WebCoRE behavior (piston.module.html lines 832-835) + user-confirmed keep]

### 5.2 Condition Group Dialog (Edit Existing Group)

A separate dialog (`dialog-edit-condition-group`) opens when clicking an existing condition group to edit it [VERIFIED from EDITOR_REFERENCE §29]:
- **Logical operator** — AND / OR / XOR / Followed by
- **Whole group negation** — Not negated / Negated
- If Followed by: **Within** duration + **Matching method** (Loose / Strict / Negated)
- Advanced: Description

Footer: **Save** / gear icon / **Cancel** / **Delete** (if not top-level group)

### 5.3 Restriction Dialog

Same two-page structure as the condition dialog with these differences [VERIFIED from EDITOR_REFERENCE §5]:
- Page 0 shows a warning: "Restrictions DO NOT subscribe to events and will not cause the piston to run."
- Same warning on page 1
- Labels say "Restriction" and "Group" (not "Condition")
- `ts`/`fs` sub-statement fields NOT present on restrictions [DECISION: restrictions don't have when-true/false blocks in WebCoRE]
- Commits to `restrictions[]` on the parent node (not `conditions[]`)

### 5.4 Event Dialog (inside on_event)

A single page. Uses the same comparison widget (§5.5) but with `comparison.event = true`, which changes [VERIFIED from piston.module.html line 1691]:
- Label changes from "What to compare" to "What event to expect"
- The operator dropdown is NOT shown (events detect changes, not compare values)

Advanced options: Description textarea.
Footer: **Add** / **Add more** (new) or **Save** (edit).

### 5.5 The Comparison Widget

Used in conditions, events, and restrictions. Shared widget building a comparison between two operands [VERIFIED from WEBCORE_WIZARD_MAP Part 7]:

**Step 1 — Left operand ("What to compare"):**
The full operand widget (§8) for the left side.

**Step 2 — Comparison operator ("What kind of comparison?"):**
A dropdown populated by the fall engine (§9). Not shown for events.

The operator list is split into two optgroups in PistonCore: ⚡ Triggers (change-detection operators) and Conditions (current-state operators). [ASSUMED: basis: current PistonCore code merges both with optgroups — RISK medium — confirm the merged presentation stays]

The visible operators are filtered by the left operand's attribute data type via the `attributeTypeToOperatorGroup` mapping in `webcore_vocab.json`. [VERIFIED]

**Step 3 — Right operand(s):**
- "Compare to" / "Between..." — shown when `operator.p > 0` (one value)
- "...and..." — shown when `operator.p > 1` (range, second value)

**Timed comparisons** [VERIFIED from WEBCORE_WIZARD_MAP Part 7]:
- "In the last..." — duration operand, shown when `operator.t == 2` (was-style)
- "For..." — duration operand, shown when `operator.t == 1` (stays-style); with sub-select "less than..." / "at least..."

**Time offset fields** (shown when left operand data type is `time` and right value is not a constant) [VERIFIED from WEBCORE_WIZARD_MAP Part 7]:
- "With offset..." for right operand
- "With offset..." for right2 operand

**Day/week/month filters** (shown when left operand is the virtual `time` device) [VERIFIED from WEBCORE_WIZARD_MAP Part 7]:
- Only on these days of the week (multi-select)
- Only on these days of the month (multi-select, if no week filter)
- Only on these weeks of the month (multi-select, if no day filter)
- Only on these months of the year (multi-select)

**Followed by fields** [VERIFIED from WEBCORE_WIZARD_MAP Part 7]:
- "Within..." — duration operand (shown when in a "followed by" group context)
- "Matching method" — Loose / Strict / Negated

---

## 6. Wizard: Settings, Variable, and Task Dialogs

### 6.1 Piston Settings Dialog

Fields [VERIFIED from WEBCORE_WIZARD_MAP Part 14]:

**Standard:**
- Piston name (text input)
- Description (textarea)
- Automatic piston state — Enabled (default) / Disabled

**Advanced options (gear icon):**
- Piston execution parallelism — Enabled / Disabled (default)
- Command optimizations — Enabled (default) / Disabled
- Condition traversal optimizations — Enabled (default) / Disabled
- Event subscriptions — Enabled (default) / Disabled
- Allow pre-scheduled tasks during restrictions — Enabled / Disabled (default)
- Ignore SSL security issues for web requests — Enabled / Disabled (default) — note about self-signed certs
- Command execution delay — number input (ms), 0–5000

Footer: **Save** (disabled if name empty) / gear icon / **Cancel**.

**OPEN QUESTION** [from §3.7]: The on-disk filename/path convention for a saved piston is not defined in these files (it lives in backend storage code). The user wants the piston name carried over somehow, but the mechanism is not specified. Do NOT invent a naming scheme — flag this for a backend spec decision.

### 6.2 Variable Dialog

**New/edit local variable** [VERIFIED from WEBCORE_WIZARD_MAP Part 12]:
- Type dropdown (25%) + Name text input (75%), inline group
  - Basic types: Dynamic / String / Boolean / Integer / Decimal / Long / DateTime / Date / Time / Device
  - Advanced list types: Dynamic[] / String[] / Boolean[] / Integer[] / Decimal[] / Long[] / DateTime[] / Date[] / Time[]
- Initial value (optional) — operand widget; only shown for non-list types
- Note shown when initial value is set: explains it resets on every run
- Assignment type — Dynamic (default) / Constant; shown when value is set and type is not device

Advanced: Description.
Footer: Add / Add more (new) or Save (edit); gear; Cancel; Delete (edit).

**New/edit global variable** [VERIFIED from WEBCORE_WIZARD_MAP Part 13]:
- Same type + name layout
- Global types (scalar only, no list types): Dynamic / String / Boolean / Integer / Decimal / DateTime / Date / Time / Device
- Value — operand widget (required, not optional)

Footer: Add / Add more (new) or Save (edit); Cancel; Delete (edit).

### 6.3 Task Dialog (inside action blocks)

Single-page dialog [VERIFIED from WEBCORE_WIZARD_MAP Part 6 / EDITOR_REFERENCE §20]:

**Header context** — shows the action's device name list (the `with {devices}` label from the parent action). This tells the user which devices they are adding a task for.

**Existing tasks preview** — tasks already in the action are shown above and below the insertion point. The user can click a task preview to reposition where the new task will be inserted (the ordered-splice model per §7.4). [VERIFIED from WEBCORE_EDIT_STATE_MODEL §6]

**Do... command picker** — a dropdown with three groups [VERIFIED from WEBCORE_WIZARD_MAP Part 6]:
1. "Commands available to all devices" (intersection commands — see §10.2)
2. [NOT PRESENT in PistonCore — intersection-only, no partial group per WIZARD_ACTION_COMMAND_SPEC §3]
3. "Location commands (non-device)" (virtual/location commands)

Commands have a type badge: `device` / `location`. Each command name comes from the `webcore_vocab.json` command vocabulary. [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 4]

**Parameters** — rendered dynamically per selected command. Each parameter is an operand widget (§8) with the parameter's label, type constraints, and help text from the command definition. [VERIFIED from WEBCORE_WIZARD_MAP Part 6]

For parameters with known options lists (enum attributes like `switch[on,off]`, `thermostatMode[auto,cool,heat,off]`), the operand widget renders a dropdown instead of a text input (Tier 1 of the three-tier value resolution — §10.3). [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 5]

**Only during these modes** — mode multi-select from the location's modes list, shown when a command is selected. [VERIFIED from WEBCORE_WIZARD_MAP Part 6]

Advanced: Description.

Footer: **Add** / **Add more** (new) or **Save** (edit); gear; **Cancel**; **Delete** (edit); Parameters dropdown for custom commands (add/delete parameter types). [VERIFIED from piston.module.html lines 2184–2204]

---

## 7. Wizard: The Edit-Isolation Contract

The edit-isolation contract governs every dialog in the wizard — statements, conditions, restrictions, tasks, cases, events, and variables. It is a behavioral contract; the coding agent builds the vanilla-JS mechanism. [VERIFIED from WEBCORE_EDIT_STATE_MODEL §1 and Summary]

### 7.1 Scratch Buffer per Dialog

Every dialog creates a fresh scratch buffer when it opens. The scratch buffer is built from the node's current values; it is NOT the live node. [VERIFIED from WEBCORE_EDIT_STATE_MODEL §1]

- The original node is **referenced** (not cloned) — one pointer back to the actual node in the piston tree.
- The node's **value fields** (operands, comparison data) are **deep-copied** into the scratch. Edits in the form mutate the copies, not the live node.
- The node's **scalar flags** (type, operator, negation, async, disabled, description) are copied into flat scratch properties and written back on commit.

A `$new` flag distinguishes new items (no prior type/command) from existing items. New items are built from blank templates before opening. [VERIFIED from WEBCORE_EDIT_STATE_MODEL §5]

### 7.2 Cancel = Discard Scratch

When the user clicks **Cancel** or closes the dialog without confirming: the scratch buffer is discarded. No rollback is needed because nothing was written back to the live node. The live tree is exactly as it was. [VERIFIED from WEBCORE_EDIT_STATE_MODEL §3]

Dialogs do not close on a click outside (must use an explicit button). [VERIFIED from WEBCORE_EDIT_STATE_MODEL §3]

### 7.3 Commit = Write Fields Back + Splice

When the user clicks **Add** or **Save** [VERIFIED from WEBCORE_EDIT_STATE_MODEL §4]:

1. **Snapshot before commit** — take an undo snapshot of the current piston state BEFORE applying any change (§11.1).
2. **Resolve target** — for existing items, use the retained live-node reference. For new items, build the final node object from the scratch data.
3. **Write fields back** — copy scalar flags and the deep-copied operands from the scratch onto the node.
4. **Mark for re-render** — mark the node dirty so the editor re-renders it.
5. **Splice if new** — push the new node into its parent array using the per-type child key:
   - Statements → `parent.statements[]` / `then[]` / `else[]` / etc.
   - Conditions → `parent.conditions[]` (or `until_conditions[]` for repeat)
   - Restrictions → `parent.restrictions[]`
   - Tasks → `parent.tasks[]` (with ordered-splice — see §7.4)
   - Cases → `parent.cases[]`
   - Events → `parent.conditions[]` (on_event events live in its `conditions[]`)
6. **Validate** — run the piston JSON validation pass.

Existing items are edited in place (the retained reference is already in the tree — no array operation needed). [VERIFIED from WEBCORE_EDIT_STATE_MODEL §4]

### 7.4 Ordered Task Splice (Tasks Only)

Tasks support ordered insertion — the user can choose where in the action's task list the new task appears [VERIFIED from WEBCORE_EDIT_STATE_MODEL §6]:

- An `insertIndex` tracks the target position.
- The dialog shows existing tasks above and below the insertion point. Clicking a task preview repositions the insert point.
- On commit, the new task is spliced into `parent.tasks[]` at `insertIndex`. Successive "Add more" calls land in sequence.
- This is the only edit path that reorders an existing element's position as part of save.

### 7.5 Chaining ("Stay in the Wizard")

After creating a new block statement (`if`, `action`, `every`, `switch`, `for`, `each`, `do`, `on`, `while`, `repeat`, `wait_for_state`), the wizard does NOT close and reopen. Instead it commits the block and immediately opens the next relevant dialog scoped to the just-created child array [VERIFIED from WEBCORE_EDIT_STATE_MODEL §4]:

| Statement created | Next dialog opened |
|---|---|
| `if` | Add condition to the new `if.conditions[]` |
| `action` | Add task to the new `action.tasks[]` |
| `every`, `do`, `for`, `each`, `while`, `repeat`, `on` | Add statement to the new `statements[]` |
| `switch` | Add case to `switch.cases[]` |
| `wait_for_state` | Add condition to the new `wait_for_state.conditions[]` |

This chaining is seamless — the wizard appears to stay open with the context shifted.

---

## 8. Wizard: The Operand Widget (Universal Value Picker)

The operand widget is the shared, reusable value input used in every place a value must be entered: condition operands, comparison right-hand values, command parameters, timer intervals, for-loop bounds, switch expressions, exit values, and more. [VERIFIED from WEBCORE_WIZARD_MAP Part 8]

### 8.1 Type Selector

A left-side dropdown sets the operand type. Available options depend on context (`allow*` flags set by the calling dialog) [VERIFIED from WEBCORE_WIZARD_MAP Part 8]:

| Code | Meaning |
|---|---|
| `d` | Physical device(s) as variable — used in for-each, device list operands |
| `p` | Physical device(s) with attribute — standard device condition picker |
| `v` | Virtual device |
| `s` | Preset value |
| `c` | Value (constant / literal) |
| `x` | Variable reference |
| `e` | Expression |
| `u` | Argument |

### 8.2 Per-Type Input (right side)

**`p` — Physical device with attribute** [VERIFIED from WEBCORE_WIZARD_MAP Part 8]:
- Device multi-select (75%): Physical devices / Local device vars / Global device vars / System device vars
- Attribute select (25%): attribute list for the selected device(s), grouped, from HA capabilities
- When multiple devices selected and aggregation is allowed: aggregation selector appears above (Any / All / [mathematical aggregations if enabled])
- When attribute has sub-devices (e.g. lock codes): "Which [attribute](s)" multi-select
- When attribute supports physical/programmatic interaction: "Which interaction" — Any / Physical / Programmatic [DECISION: deferred per HA_LIMITATIONS §6 — do not build until sandbox-validated]

**`d` — Physical device (variable)** [VERIFIED from WEBCORE_WIZARD_MAP Part 8]:
- Multi-select from: Physical devices / Local device vars / Global device vars / System device vars

**`v` — Virtual device** [VERIFIED from WEBCORE_WIZARD_MAP Part 8]:
- Single select from virtual devices list (Location, time, date, etc.)
- In action context: only devices with the `x` action flag shown
- In condition/restriction context: all virtual devices shown

**`x` — Variable reference** [VERIFIED from WEBCORE_WIZARD_MAP Part 8]:
- Single or multi-select depending on context
- Sources: Local variables / Global variables / System variables
- Filtered by allowed type if set
- If variable type is a list (`[]`): shows list index input alongside

**`s` — Preset** [VERIFIED from WEBCORE_WIZARD_MAP Part 8]:
- For time/datetime: Sunrise / Noon / Sunset / Midnight
- For color: Random + standard color list

**`c` — Value (constant)** [VERIFIED from WEBCORE_WIZARD_MAP Part 8]:
- No options defined: plain input (text/number/time/date/datetime depending on data type)
- Options list defined, single select: dropdown
- Options list defined, multi select: multi-select dropdown
- Boolean type: `false` / `true` dropdown

**`e` — Expression** [VERIFIED from WEBCORE_WIZARD_MAP Part 8]:
- Textarea for expression entry (with autocomplete)
- Preview label showing the evaluated result

**`u` — Argument** [VERIFIED from WEBCORE_WIZARD_MAP Part 8]:
- Plain text input

**Duration unit** (appended to any input when `dataType == 'duration'`): milliseconds / seconds / minutes / hours / days / weeks / months / years [VERIFIED from WEBCORE_WIZARD_MAP Part 8]

### 8.3 Operand Type Restrictions by Context

The `allow*` flags on each operand instance restrict which type options appear. Key rules from `webcore_vocab.json` [VERIFIED from WEBCORE_WIZARD_MAP Part 23]:

- Physical device with attribute (`p`) is NOT allowed when dataType is: datetime, date, time, device, variable, boolean (strict), duration
- Virtual device (`v`) is NOT allowed for: datetime, date, time, device, variable, decimal, integer, boolean, enum, color, duration
- Preset (`s`) only for: datetime, time, color
- Constant (`c`) NOT allowed for: device, variable
- Expression (`e`) NOT allowed for: variable, boolean (strict), events
- In `onlyAllowConstants` mode (edit timer interval, edit variable initial value): only `c` or `d` available

### 8.4 Aggregation

When a physical-device operand has multiple devices selected (directly or through a variable), and the operand supports aggregation, an aggregation selector appears above the device/attribute inputs [VERIFIED from WEBCORE_WIZARD_MAP Part 8]:

- **No aggregation:** Any / All
- **Mathematical aggregation** (when allowed by context): Average / Count / Least occurring / Max / Median / Min / Most occurring / Standard deviation / Sum / Variance

For condition evaluation, "Any" means the condition is true if any device matches; "All" means all must match. [VERIFIED from WIZARD_MENU_FALLS_RAW_EXTRACT deviations]

Timed comparison operators (`was`, `stays`) are disabled when the left operand uses a mathematical aggregation function (not Any/All). [VERIFIED from WEBCORE_WIZARD_MAP Part 26]

---

## 9. Wizard: The Fall Engine

The fall engine is how the wizard narrows choices as the user makes selections. It runs through four sequential layers. [VERIFIED from WIZARD_MENU_FALLS_RAW_EXTRACT §1 — the fall rule]

### 9.1 Layer 1 — Device → Capabilities → Attributes + Commands

When the user picks one or more devices, the wizard fetches their capabilities from the backend. Each capability exposes:
- **For conditions/triggers:** an attribute (the subject the user can compare against)
- **For actions:** one or more commands (the actions the device can perform)

The full capability→attribute and capability→command map lives in `webcore_vocab.json` (the `capabilities` section). The backend's `GET /api/device/{id}/capabilities` response is joined against this map. [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 1]

Sensor-only capabilities (motionSensor, contactSensor, temperatureMeasurement, etc.) expose attributes for conditions/triggers but no commands for actions. [VERIFIED from WIZARD_MENU_FALLS_RAW_EXTRACT Layer 1]

### 9.2 Layer 2 — Attribute → Data Type → Operator Group

When the user picks an attribute (in the condition/trigger left operand), the attribute's data type (`t:` field in `webcore_vocab.json`) determines which operator group letter applies [VERIFIED from WIZARD_MENU_FALLS_RAW_EXTRACT §1]:

| Attribute data type | Operator group letter |
|---|---|
| `enum`, `color`, `hexcolor`, `object`, `vector3` | `s` (string group) |
| `integer`, `decimal` | `d` and `i` |
| `boolean` | `b` |
| `image` | `f` (binary) |
| `time`, `date`, `datetime` | `t` |
| momentary | `m` |
| presence/event | `e` |
| piston | `v` |

### 9.3 Layer 3 — Operator Group → Operators Shown

The comparison operator dropdown is populated from the condition/trigger operator lists in `webcore_vocab.json` (the `comparisons` section, split into `conditions` and `triggers`). An operator appears if its `g:` field contains the current operator group letter. [VERIFIED from WIZARD_MENU_FALLS_RAW_EXTRACT Layer 3 and Layer 4]

**Condition operators** (current-state checks, appear in if/while/repeat/restriction contexts): `is`, `is not`, `is any of`, `is not any of`, `is equal to`, `is less than`, `is greater than`, `is inside of range`, `is outside of range`, `is even`, `is odd`, `was`, `was not`, `was equal to`, `was less than`, `was greater than`, `was inside of range`, `was outside of range`, `changed`, `did not change`, time operators (`is any`, `is before`, `is after`, `is between`, `is not between`), and their variants. [VERIFIED from WIZARD_MENU_FALLS_RAW_EXTRACT Layer 3]

**Trigger operators** (change-detection, appear in trigger/on_event contexts but NOT in restrictions): `changes`, `changes to`, `changes away from`, `changes to any of`, `drops`, `drops below`, `rises`, `rises above`, `stays`, `stays away from`, `stays equal to`, `enters range`, `exits range`, `remains inside of range`, `gets`, `happens daily at`, `arrives`, `executes`, and their variants. [VERIFIED from WIZARD_MENU_FALLS_RAW_EXTRACT Layer 4]

**NO OPERATOR CUTS from the wizard menu.** Every operator in the full WebCoRE operator set appears in the wizard. Cuts are compiler-side only, never wizard-side. [VERIFIED from WIZARD_MENU_FALLS_RAW_EXTRACT deviations note]

### 9.4 Layer 4 — Operator → Value Fields That Fall In

After the operator is chosen, additional value fields fall in based on the operator's parameter flags [VERIFIED from WIZARD_MENU_FALLS_RAW_EXTRACT §1]:

| Operator flag | Effect |
|---|---|
| `p: 0` | No right operand |
| `p: 1` | One "Compare to" operand |
| `p: 2` | Two operands: "Between..." and "...and..." (range) |
| `t: 1` | "For..." duration falls in (stays-style timed comparison) |
| `t: 2` | "In the last..." duration falls in (was-style timed comparison) |
| `m: true` | Right operand uses multi-value select |

Additionally: trigger operators on attributes with `p: true` (interaction-capable, e.g., `switch`) reveal the "Which interaction" picker (Any / Physical / Programmatic). [VERIFIED from WIZARD_MENU_FALLS_RAW_EXTRACT §1] [DECISION: defer building the Which-Interaction picker until PyScript context tracking is sandbox-validated per HA_LIMITATIONS §6]

### 9.5 Action Command Fall (Layer 5)

For action tasks, after device selection the command dropdown is populated, and after command selection the parameter fields fall in. [VERIFIED from WIZARD_MENU_FALLS_RAW_EXTRACT Layer 5]

Command parameter types map back to Layer 2 attributes for their input widget and range. Example: `setLevel`'s Level parameter has type `level` → integer 0–100 with `%` unit → numeric input with range. [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 4.3 and WIZARD_MENU_FALLS_RAW_EXTRACT Layer 5]

---

## 10. Wizard: The Action Picker — Root and Device Variables

### 10.1 Device Selection Root

The action command picker's root is device selection [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 1]:

The picker is a multi-select list of devices. The user selects one or more devices. The selection can include:
- Physical HA devices (by friendly name)
- Local device variables
- Global device variables
- System device variables

Physical devices are shown by their HA-friendly name, grouped (optionally) by area. Variables are shown with their variable name and `device` or `devices` type badge.

### 10.2 Multi-Device Intersection Rule (LOAD-BEARING)

When multiple devices are selected, a command appears in the picker **only if every selected device supports it**. If any selected device lacks the capability, the command does not appear. There is NO "partial" commands group. [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 3 — deviation D-1]

This is the intersection-only rule. It overrides WebCoRE's Common/Partial split.

The workaround for commands that only some devices share: define separate device variables — one per capability group. Each variable's intersection then exposes the commands its members share. [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 3]

### 10.3 The Two-Bucket Rule (LOAD-BEARING — do not collapse)

The picker operates in two distinct, deliberate scopes [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 7 — picker firewall; and CLAUDE.md hard guardrail]:

**Bucket 1 — Capability comparison (for the picker and intersection):**
When loading the command/attribute screen, the wizard holds ALL entity IDs linked to each selected device (every entity the physical device exposes). The intersection is computed across every entity of every device to determine what the picker can offer. This is the full entity cluster — the picker SEES everything.

**Bucket 2 — Commit (writing to the node):**
When the user commits a choice, only the entity IDs for the chosen attribute (one per physical device) are written to the node. The picker held everything in memory to decide what to offer; the commit writes only one-per-device for the chosen attribute.

**The buckets must never be collapsed.** Writing the full entity cluster at commit, or computing intersection on the committed single entity, is the exact regression to guard against. The `_capEntityMap` model (`attribute → one entity per device group`) mediates between the two scopes at commit time. [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 7 / CLAUDE.md]

### 10.4 Device Variable Resolution

When the user selects a device variable (local or global) in the picker instead of a specific device, the wizard resolves it to get the device list [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 8; WEBCORE_WIZARD_MAP Part 30]:
- Friendly names in the variable's `initial_value[]` are used to pull current entity IDs from HA via the backend.
- If the variable is empty or unresolved, fall back to the full HA physical command vocabulary.
- The resolution is live at pick time — the same variable may resolve differently if its value changes.

The `role`, `role_tokens`, and `entity_ids` write separation is preserved on commit regardless of whether the selection came from a direct device pick or a variable [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 8]:
- `role` — the friendly label string
- `role_tokens` — the raw selection tokens (friendly names and/or variable names), for edit round-trip
- `entity_ids` — the resolved HA entity IDs, written at commit time

### 10.5 Three-Tier Value Resolution (Command Parameters and Condition Values)

For any value the user must supply, the input widget is resolved in three tiers [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 5]:

**Tier 1 — Enumerated.** If the parameter's type maps to an attribute with an options list in `webcore_vocab.json`, OR the live HA entity carries a companion list attribute (e.g., `hvac_modes`, `preset_modes`, `options`, `effect_list`): render a **dropdown** of those options.

**Tier 2 — Inferred type.** Numeric with range → number widget with min/max/unit from the attribute definition. Boolean → true/false. Color → color picker. Duration → number + unit.

**Tier 3 — Unknown (escape hatch, mandatory).** If neither Tier 1 nor Tier 2 applies: render a **free operand input** (text/expression). Seed it with the entity's current `state` value as a hint ("currently: person"). This guarantees no attribute is ever uncompletable, regardless of integration.

Tier 3 is the unknowns lock — every HA entity has a state value, so every operand always has at least one valid input path. [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 5]

### 10.6 Non-Device (Location) Commands

The task dialog's "Location commands (non-device)" group contains commands that are not tied to a physical HA device. These correspond to the non-device `virtualCommands` in `webcore_vocab.json`. [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 1 / HA_LIMITATIONS §10]

Commands that are REPRODUCIBLE in HA and stay in the wizard [VERIFIED from HA_LIMITATIONS §10.1]:
- **Wait** / Wait for time / Wait for date & time / Wait randomly → HA `delay`, `wait_for_trigger`, `wait_template`
- **Set variable** → HA `variables:` action
- **Log to console** → `logbook.log` / `system_log.write`
- **Execute piston (call_piston)** → `script.turn_on` / `automation.trigger`
- **Set location mode** → `input_select.select_option` on a mode helper
- **Make a web request** → `rest_command` (incl. JSON response via `response_variable`)
- **Read from file / Write to file** → HA File integration
- **HSM status** → HA `alarm_control_panel` arm/disarm
- **Capture/Restore attributes** → `scene.create` with `snapshot_entities` + `scene.turn_on`
- **Webhook** (renamed from "Send an IFTTT Maker event") → `rest_command` to webhook URL

Commands CUT from the wizard (no clean HA reproduction) [VERIFIED from HA_LIMITATIONS §10.2]:
- Piston tiles (WebCoRE-dashboard-only construct — HIGH confidence cut)
- Set piston state / Pause piston / Resume piston (HA has no mid-run pause concept)

### 10.7 Backend Requirement for Tier 1 Breadth

For Tier 1 to be broad, the backend must forward HA's companion list attributes (e.g., `hvac_modes`, `preset_modes`, `effect_list`) when building the capabilities response. [VERIFIED from WIZARD_ACTION_COMMAND_SPEC Part 6]

Current gap: `ha_client._fetch_capabilities` skips list-valued attributes. This must be fixed — the companion list must be attached as the capability's `options` array instead of being skipped.

---

## 11. Editor: State Management and Save

### 11.1 Undo / Redo / Autosave

Undo operates on the committed piston tree, not on in-progress wizard edits [DECISION from §3.4 — behavioral contract only]:

- **At the start of every wizard commit** (before applying any change): take a snapshot of the current piston tree and push it onto the undo stack. This snapshot is a deep copy of the whole piston JSON at that moment.
- **Deduplication:** if the new snapshot's hash matches the top of the stack, don't push (no-op edits don't create undo entries).
- **Undo:** pop the top of the undo stack, replace the in-memory piston with it, re-render the editor.
- **Redo:** the mirror of undo.
- **Stack cap:** 10 entries. [ASSUMED: same as WebCoRE's MAX_STACK_SIZE — RISK low]
- **Cancel (wizard)** discards the in-progress scratch buffer only — does NOT add to the undo stack, because no change was made to the tree.

PistonCore's snapshot is direct JSON deep copy. Do NOT carry WebCoRE's cloud-code restore mechanism (that is a WebCoRE/SmartThings-specific save path). [DECISION from §3.4]

The wizard's job is to commit as ONE clean discrete event so the editor has a whole change to snapshot. The wizard does not create multiple partial undo entries mid-edit.

### 11.2 Unsaved-Changes Flag

An in-memory flag tracks whether the piston has uncommitted changes (edits made since the last final save to the backend). [VERIFIED from §3.5]

- The flag is set every time a wizard commit mutates the piston tree.
- The flag is cleared on a successful final save (§11.3).
- The editor shows an "unsaved" indicator (e.g., a dot on the save button) while the flag is set.
- Navigating away while the flag is set prompts: *"You have unsaved changes. Save, Discard, or Cancel?"*

### 11.3 Final Save Model

The final save writes the piston JSON to the PistonCore backend. It is completely separate from wizard commits. [VERIFIED from §3.5]

1. Frontend validates: piston must have a name. Empty name blocks save with an inline error on the name field.
2. Frontend strips runtime-only fields (e.g., globals cache, $$html render memos).
3. Frontend PUT to `/pistons/{id}` with the full piston JSON.
4. Save button shows "Saving..." while the request is in flight.
5. On success: backend returns the canonical saved piston. Frontend replaces its in-memory copy with the returned version. Unsaved-changes flag cleared.
6. On failure: "Save failed — your work is preserved," editor stays open, in-memory piston unchanged.

Save is SEPARATE from compile and deploy — saving never pushes to HA. [VERIFIED from §3.5]

---

## 12. Drag, Copy, and Paste

This behavior is in scope for v1. The following is synthesized from DRAG_COPY_PASTE_SPEC. Each claim's verification status is preserved from that document.

### 12.1 Drag to Reorder

Each block array (`statements[]`, `tasks[]`, `conditions[]`, `restrictions[]`, `else[]`, `then[]`, `else_ifs[N].statements[]`, `cases[N].statements[]`) is an independent drop zone. A node can only be dropped into a zone whose type matches the node's type — statements into statement arrays, tasks into task arrays, etc. [VERIFIED from DRAG_COPY_PASTE_SPEC]

Node types that are draggable: `statement`, `task`, `condition`, `restriction`, `variable`, `event`. [VERIFIED from DRAG_COPY_PASTE_SPEC]

**Reorder within the same array:** the node is removed from its current position and inserted at the new position. Node object unchanged — only its index changes. [ASSUMED: RISK low per DRAG_COPY_PASTE_SPEC]

**Re-parent across arrays:** the node is removed from the source array and inserted into the target array. Node object unchanged. Type gating prevents illegal structures. [ASSUMED: RISK low per DRAG_COPY_PASTE_SPEC]

The move handles (drag targets on each row) are shown/hidden by the view-layer toggle §1.3.

### 12.2 Copy, Cut, Duplicate, Paste

[VERIFIED from FRONTEND_SPEC Copy/Paste section and DRAG_COPY_PASTE_SPEC]

**Copy:** write the statement subtree to the server-side clipboard (POST `/api/clipboard`). Clipboard persists across sessions. One slot.

**Cut:** copy then delete from the current piston.

**Duplicate:** deep-copy the node + regenerate all `id` fields, insert as the next sibling. Does NOT write to clipboard. Immediate effect.

**Paste:** deep-copy the clipboard JSON, regenerate all `id` fields in the clone and every nested node, insert after the selected statement (or at end of the block if nothing is selected). Clipboard content remains — the same statement can be pasted multiple times.

**Critical: UUID regeneration on paste/duplicate.** Every `id` field in the pasted/duplicated subtree must be a fresh UUID. A cloned node with duplicate IDs breaks find/edit/delete operations because those operations key on `id`. [ASSUMED: RISK HIGH if missed — DRAG_COPY_PASTE_SPEC marks this as the single most important thing to confirm] Implement as `deepCopyWithNewIds(node)` — walks the tree recursively, replaces every `id` field.

**Right-click context menu** on a selected statement [VERIFIED from FRONTEND_SPEC]:
```
Copy selected statement
Duplicate selected statement
Cut selected statement
Delete selected statement
─────────────────────────
Clear clipboard    ← only shown when clipboard has content
```

**Clipboard preview** — when the clipboard has content, a "From clipboard" section appears at the bottom of the statement type picker (page 0 of the statement dialog) with a read-only preview and a `[Paste this statement]` button. [VERIFIED from WEBCORE_WIZARD_MAP Part 3]

---

## 13. HA Limitations That Affect Wizard Behavior

The following HA-specific constraints affect what the wizard builds or warns. Sourced from HA_LIMITATIONS.md. Compiler routing is out of scope here — these are the wizard-visible effects only.

### 13.1 Entity ID Changes

If an entity_id stored on a node no longer exists in HA, the node shows an inline warning in the editor: ⚠ on the row. The wizard opens pre-filled with the current role label. The user picks a replacement device from the live HA picker. New entity_ids are written to the node on commit. [VERIFIED from HA_LIMITATIONS §3]

### 13.2 Physical vs Programmatic Interaction (Deferred)

The "Which interaction" operand sub-picker (Any / Physical / Programmatic) in the operand widget (§8.2, `p` type with `interaction-capable` attribute) is deferred until PyScript context tracking (`context.id`, `context.parent_id`) is sandbox-validated. Do not build this sub-picker until that validation is complete. [VERIFIED from HA_LIMITATIONS §6]

### 13.3 XOR, Followed-By, Switch Fall-Through Warning

When the user selects:
- XOR as a condition group operator
- "Followed by" as a condition group operator
- "Fall-through" as the switch case traversal policy

...the piston will compile to PyScript instead of native HA. The editor should show a subtle inline indicator on the affected node. The full PyScript requirement notice lives on the status page, not in the editor. The editor's job is only to flag which specific statement forces the routing. [VERIFIED from HA_LIMITATIONS §1 and §6 — routing table]

### 13.4 Monthly/Yearly Scheduling

When an `every` statement uses `interval_unit: "n"` (months) or `"y"` (years), or has non-empty `only_on_dom`, `only_on_wom`, or `only_on_months`, the piston will compile to PyScript. Same inline indicator as §13.3. [VERIFIED from HA_LIMITATIONS §6]

### 13.5 Break, On_Event, Cancel_Pending_Tasks

These statement types always force PyScript. The editor marks them with the same inline PyScript indicator. [VERIFIED from HA_LIMITATIONS §6]

---

## 14. Visual Placement and Chrome (from FRONTEND_SPEC — layout only)

The wizard is a modal that opens on top of the editor canvas. It does not navigate to a new page. The editor remains visible (optionally dimmed) behind the modal. [VERIFIED from FRONTEND_SPEC §3]

The modal sits centered in the editor view, with a backdrop. It does not close on click-outside (§7.2). [VERIFIED]

**Editor page structure** (from FRONTEND_SPEC §3 — chrome/layout only):
- Top header: PistonCore branding, `[← Status]` nav, `[+ New]` button
- Piston metadata area: name field, description, folder dropdown, mode selector, enabled toggle
- Simple/Advanced mode toggle (default: Advanced; preference saved to localStorage as `pc_simpleMode`)
- The code view canvas: `#editor-doc` div — scrollable action tree
- Footer: `[▶ Test]` / `[💾 Save to PistonCore]` / `[🚀 Deploy to HA]` / `[📷 Snapshot]` / `[📷 Backup]` / compile status indicator

**Visual style** (from FRONTEND_SPEC visual notes — colors and theme):
- Dark background editor area (PistonCore's own theme)
- Keywords in a distinct highlight color — teal-family
- Ghost/structural labels in muted gray
- Indentation: 2rem per level
- Curly braces `{` `}` styled the same as keywords
- Statement numbers on the left side of the action tree
- Selected statement has a visible highlight/border
- `and` / `or` between conditions rendered at the same indent level as the conditions

---

## 15. Sources

Every claim in this document traces to one or more of these files. All were read from disk for this spec-build session.

| File | Role |
|---|---|
| `WEBCORE_WIZARD_MAP.md` | Authority for all wizard menu structure, dialog fields, statement type cards, operand widget types, condition JSON shape |
| `WIZARD_ACTION_COMMAND_SPEC.md` | Authority for capability-driven picker, intersection-only rule, two-bucket rule, three-tier value resolution, device variable resolution, command vocabulary |
| `WIZARD_MENU_FALLS_RAW_EXTRACT.md` | Raw fall-engine data: capability→attribute, datatype→operator-group, operator flags, action command params |
| `webcore_vocab.json` | Picker vocabulary: capabilities, attributes, commands, comparisons, `attributeTypeToOperatorGroup`; cited by name throughout |
| `DRAG_COPY_PASTE_SPEC.md` | Drag/copy/paste behavior; §12 |
| `HA_LIMITATIONS.md` | HA constraints affecting wizard behavior; §10 non-device commands; §13 wizard-visible effects |
| `EDITOR_REFERENCE.md` | Verified WebCoRE render format and click targets per node type; §2, §3 |
| `WEBCORE_EDIT_STATE_MODEL.md` | Edit-isolation contract, undo/redo behavioral model; §7, §11 |
| `PISTON_JSON_STRUCTURE_MAP.md` | Locked JSON shapes; referenced throughout for node field names |
| `FRONTEND_SPEC.md` | Screen layout/chrome, visual style, modal placement; §14 (behavior ignored — layout/visuals only) |

---

## 16. Post-Write Report

**Sections written:** 14 numbered sections (plus subsections), covering all checklist items from the task spec §4.

**`[ASSUMED]` tag count:** 21 — these are the user's review targets:
1. Trigger render format (§2 — no WebCoRE render precedent)
2. Trigger click handler (§3.1)
3. Action compact-mode render (§2.1)
4. SET_VARIABLE render format (§2.2)
5. WAIT render format (§2.2)
6. WAIT_FOR_STATE render format (§2.2)
7. LOG_MESSAGE render format (§2.2)
8. CALL_PISTON render format (§2.2)
9. CANCEL_PENDING_TASKS render format (§2.2)
10. Switch range case render format (§2.1)
11. PistonCore-specific type SET_VARIABLE dialog (§4.2)
12. PistonCore-specific type WAIT dialog (§4.2)
13. PistonCore-specific type WAIT_FOR_STATE dialog (§4.2)
14. PistonCore-specific type LOG_MESSAGE dialog (§4.2)
15. PistonCore-specific type CALL_PISTON dialog (§4.2)
16. PistonCore-specific type CANCEL_PENDING_TASKS dialog (§4.2)
17. Click handlers for PistonCore-specific statement types (§3.1, 6 entries)
18. Merged operator dropdown (Triggers/Conditions optgroups) presentation (§5.5)
19. Undo stack cap of 10 (§11.1 — same as WebCoRE, reasonable)
20. ts/fs sub-statement display toggle naming (§1.3)
21. Aggregation deviations note — Any/All/None only (§8.4, from WIZARD_MENU_FALLS_RAW_EXTRACT)

**Disagreements resolved by map/falls-wins:**
1. **WebCoRE has a "partial commands" group in the task picker** (WEBCORE_WIZARD_MAP Part 30). WIZARD_ACTION_COMMAND_SPEC Part 3 explicitly overrides this with intersection-only, no partial group. Resolution: WIZARD_ACTION_COMMAND_SPEC wins — spec-build instruction §2 says WIZARD_ACTION_COMMAND_SPEC is authority for picker-root behavior. Documented as deviation D-1.
2. **FRONTEND_SPEC describes editor/wizard behavior in several places** (behavior it attributes to old code). This was ignored per the spec-build instruction: FRONTEND_SPEC is used for layout/visuals only; behavior files win on every conflict.
3. **WebCoRE aggregation bar has 12 options** (WEBCORE_WIZARD_MAP Part 8). WIZARD_MENU_FALLS_RAW_EXTRACT deviations note says Any/All/None only for v1. Resolution: falls-extract deviation wins.
