# PistonCore Frontend Specification

**Version:** 0.1
**Status:** Draft — For Developer Use
**Last Updated:** April 2026

This document is written for the frontend developer. It defines exactly what to build.
Read DESIGN.md first for background and philosophy. This document is the concrete implementation spec.

**Guiding rule:** When in doubt about any UI or terminology decision, match WebCoRE exactly.
Deviation from WebCoRE requires a specific documented reason.

---

## Technology Stack

- Vanilla JavaScript, HTML, and CSS — no framework
- No build pipeline, no transpilation
- Files served directly by the FastAPI backend at port 7777
- WebSocket connection to HA is managed by the backend — the frontend talks to the backend, not directly to HA

---

## Three Pages

Navigation flow: **List → Status Page → Editor → Status Page**

The browser never navigates to a new URL for these transitions — this is a single-page app.
Page transitions are handled by showing and hiding sections in JS.

1. **Piston List** — the home screen
2. **Piston Status Page** — the hub for a specific piston
3. **Piston Editor** — where the piston is built

There is no fourth page. The wizard is a modal that opens on top of the editor.

---

## Page 1 — Piston List

### Layout

Two-column layout. Left column is the folder sidebar. Right column is the piston list for the selected folder.

```
┌─────────────────────────────────────────────────────┐
│  PistonCore            [Copy AI Prompt]  [+ New]    │
│  [Search pistons...]                                │
├──────────────────┬──────────────────────────────────┤
│  FOLDERS         │  Outdoor Lighting                │
│                  │  ─────────────────────────────── │
│  Outdoor    ──▶  │  ● Driveway Lights at Sunset  ✅  │
│  Lighting        │    Last ran: 10 minutes ago       │
│                  │                                   │
│  Indoor          │  ● Side Gate Motion Light     ✅  │
│  Lighting        │    Last ran: 2 hours ago          │
│                  │                                   │
│  Security        │  ○ Holiday Lights (disabled)  —   │
│                  │    Never deployed                 │
│  HVAC            │                                   │
│                  │                                   │
│  Notifications   │                                   │
│                  │                                   │
│  Uncategorized   │                                   │
│                  │                                   │
│  [+ New Folder]  │                                   │
└──────────────────┴──────────────────────────────────┘
```

### Folder Sidebar

- Lists all user-defined folders plus Uncategorized at the bottom
- Clicking a folder selects it and shows its pistons in the right column
- `[+ New Folder]` button at the bottom — opens a simple inline text input to name the new folder
- Folders are created here only — not in the editor or wizard
- Active folder is visually highlighted

### Piston List (right column)

Each piston shows:
- Enabled indicator: ● (green, enabled) or ○ (gray, disabled)
- Piston name — clicking navigates to the Status Page for that piston
- Last ran time or "Never deployed"
- Last evaluation result: ✅ (true) / ❌ (false) / — (never run or disabled)
- Pause/Resume button per piston (inline, subtle)

### Global Variables Drawer

Accessible from the main list page. A slide-out panel from the right side showing all global variables and their current values — read only. Matches the WebCoRE right sidebar behavior.

### Mode Notice

**PyScript-only mode (subtle, footer or sidebar):**
"PistonCore manages automations in its own subfolder. Automations created directly in Home Assistant are not visible or managed here."

**Full Mode (prominent banner):**
"PistonCore is running in Full Mode (YAML + PyScript). Creating automations directly in the Home Assistant GUI may cause unexpected behavior. Manage all automations through PistonCore."

### Buttons

- `[Copy AI Prompt]` — copies the PistonCore JSON format spec to clipboard (no user data)
- `[+ New]` — creates a new blank piston and navigates to its Status Page
- `[Import]` — opens import dialog (paste JSON, paste URL, or upload .piston file)

---

## Page 2 — Piston Status Page

The hub for every individual piston. Every action on a piston starts here.
Saving in the editor always returns here.

```
┌─────────────────────────────────────────────────────┐
│  ← My Pistons                                       │
│  Driveway Lights at Sunset                          │
│  Folder: [Outdoor Lighting ▼]    ● Active           │
│  [Pause]                                            │
├─────────────────────────────────────────────────────┤
│  ⚠ VALIDATION                                       │
│  (warnings appear here automatically after save)    │
├─────────────────────────────────────────────────────┤
│  [✎ Edit] [▶ Test] [📷 Snapshot] [📷 Backup]        │
│  [⧉ Duplicate] [🗑 Delete]                          │
│                      [Trace: OFF]  [⚠ Notify: OFF]  │
├─────────────────────────────────────────────────────┤
│  QUICK FACTS                                        │
│  Compile target: PyScript                           │
│  Last ran: 10 minutes ago                           │
│  Next scheduled: sunset today                       │
│  Devices used: Driveway Main Light                  │
├─────────────────────────────────────────────────────┤
│  LOG                          [▼ Full] [Clear Log]  │
│  10:42 PM — Triggered by sunset                     │
│    Condition 1: No conditions — passed              │
│    Action 1: Turn On Driveway Main Light — ✅        │
│    Action 2: Wait until 11:00 PM                    │
│    Action 3: Turn Off Driveway Main Light — ✅       │
│    Completed in 0.3s                                │
├─────────────────────────────────────────────────────┤
│  VARIABLES                                          │
│  (piston variable state from last run)              │
└─────────────────────────────────────────────────────┘
```

### Navigation

- `← My Pistons` returns to the folder this piston is in — not always the root list
- `[✎ Edit]` opens the Editor for this piston
- Folder dropdown on this page allows reassigning the piston to a different folder

### Buttons

All buttons use icon + plain English label. Never icon alone.

- `[✎ Edit]` — opens editor
- `[▶ Test]` — fires the piston manually (dry run for YAML, live fire with warning for PyScript)
- `[📷 Snapshot]` — green label — anonymized export, safe to share
- `[📷 Backup]` — red label — full export including entity mappings, personal restore only
- `[⧉ Duplicate]` — creates a copy of the piston, lands in Uncategorized
- `[🗑 Delete]` — deletes the piston with a confirmation prompt
- `[Trace: OFF/ON]` — toggle, only active after Test has been pressed at least once
- `[⚠ Notify: OFF/ON]` — toggle, enables failure notifications

### Validation Banner

Appears automatically after save. Shows warnings and errors from Stage 1 internal validation.
Plain English only. No technical error codes.

### Log Panel

Most recent runs at the top. Each run entry is collapsible.
Log level selector: Full / Minimal / None (mirrors what is set in the editor).
`[Clear Log]` button clears all entries.

**Compiled output (YAML or PyScript) is never shown on this page.**

---

## Page 3 — Piston Editor

### Layout

```
┌─────────────────────────────────────────────────────┐
│  PistonCore                    [← Status] [+ New]   │
├─────────────────────────────────────────────────────┤
│  Piston Name: [____________________________]        │
│  Description: [____________________________]        │
│  Folder: [Outdoor Lighting ▼]                       │
│  Mode: [Single ▼]                                   │
│  [● Enabled]              [Simple / Advanced]       │
│  Compile target: YAML → PyScript indicator          │
├─────────────────────────────────────────────────────┤
│  ▼ PISTON VARIABLES              [+ Add] (Adv only) │
├─────────────────────────────────────────────────────┤
│  ▼ TRIGGERS                                         │
│  [trigger statements]                               │
│  + add a new trigger                                │
├─────────────────────────────────────────────────────┤
│  ▼ CONDITIONS                                       │
│  [condition statements]                             │
│  + add a new condition                              │
├─────────────────────────────────────────────────────┤
│  ▼ ACTIONS                                          │
│  [action tree — see Section below]                  │
│  + add a new statement                              │
├─────────────────────────────────────────────────────┤
│  [▶ Test]  [💾 Save]  [📷 Snapshot] [📷 Backup]     │
│  Log Level: [Full ▼]                                │
└─────────────────────────────────────────────────────┘
```

### Save Behavior

`[💾 Save]` writes the piston JSON to the backend and navigates to the Status Page.
Save does not stay in the editor.
If save fails, an error banner appears at the top of the editor. The user stays in the editor with their work intact.

### Unsaved Changes

If the user navigates away with unsaved changes, show a prompt:
"You have unsaved changes. Save, Discard, or Cancel?"
- Save → triggers save pipeline then navigates
- Discard → navigates without saving
- Cancel → returns user to editor

### Browser Refresh

On refresh, restore from local browser storage:
- Currently open folder in the piston list
- Last viewed status page (if on status page)
- Editor state if in the editor — unsaved changes preserved

### WebSocket Drop While in Editor

If the WebSocket connection to HA drops:
- Show a reconnecting banner at the top of the editor
- Disable the Deploy button
- Disable wizard capability fetching (wizard can still open but shows an error state)
- Preserve all unsaved work in local browser storage
- When connection restores, remove banner and re-enable everything

### Compile Target Indicator

Shows the current compile target (YAML or PyScript) based on the auto-detection rules.
Updates live as the user adds statements. If the target changes from YAML to PyScript mid-build,
show a brief notification: "This piston now requires PyScript compilation."

### Simple / Advanced Toggle

Single global toggle. Default is Simple.

**Simple mode hides:**
- Piston Variables section
- Loop statement types (Repeat, For Each)
- Wait for State action
- Call Another Piston action
- TEP/TCP options in wizard

**Advanced mode shows everything.**

Switching modes never destroys data. A piston built in Advanced mode opens correctly in Simple mode — advanced features are just not editable until switching back.

---

## The Action Tree — Document Rendering

This is the core of the editor. It renders the piston's action tree as a structured document
that reads top to bottom like a script.

### Visual Rules — Match WebCoRE Exactly

- Keywords are rendered in a distinct color/weight: `if`, `when true`, `when false`, `else if`, `else`, `end if;`, `with`, `do`, `end with;`, `only when`, `repeat`, `for each`, `end repeat;`
- Indentation increases with nesting depth — each level adds one indent stop
- Curly braces `{` and `}` mark branch boundaries, exactly as WebCoRE does
- `end if;` closes every if block at the same indent level as the opening `if`
- `else if` and `else` appear at the same indent level as the opening `if`
- `when true` and `when false` label the branches inside an if block

### Rendered Example

```
if
  Any of (@Smoke_Detectors)'s smoke changes to detected
  {
    when true
      + add a new statement
      with
        (@Notification_Text)
      do
        Send device notification "Smoke detected";
      end with;
      + add a new statement
    when false
      + add a new statement
  }
end if;
+ add a new statement
only when
  + add a new restriction
for each ($device in {@Smoke_Detectors})
do
  only when
    + add a new restriction
  if
    Any of ($device)'s smoke is detected
    {
      when true
        + add a new statement
      when false
        + add a new statement
    }
  else if
    [condition]
    {
      when true
        + add a new statement
    }
  else
    + add a new statement
  end if;
  + add a new statement
end for each;
+ add a new statement
```

### Ghost Text — Primary Insertion Method

At every valid insertion point, ghost text appears inline in a muted color:
- `+ add a new statement` — at the top level and inside blocks
- `+ add a new task` — inside a with/do block
- `+ add a new trigger` — in the triggers section
- `+ add a new condition` — in the conditions section
- `+ add a new restriction` — after an `only when` line

Clicking any ghost text opens the wizard modal for that insertion point.
Ghost text is not shown when hovering — it is always visible at valid insertion points.

### Right-Click Context Menu

Right-clicking any statement node shows:
- Copy selected statement
- Duplicate selected statement
- Cut selected statement
- Delete selected statement
- Clear clipboard (if clipboard has content)

Paste is triggered by clicking a ghost text insertion point when the clipboard has a copied/cut statement.
Cut statement is visually dimmed in place until pasted or clipboard is cleared.

### Within-Block Drag to Reorder

Statements can be dragged to reorder within their containing block.
Dragging across block boundaries is not supported in v1 — use cut and paste for that.
Valid drop targets highlight on hover.
No undo for drag operations in v1.

---

## The Statement Tree Data Structure

This is the internal JSON structure the editor manipulates in memory.
This same structure is serialized to the piston JSON file on save.
The compiler reads this same structure to generate YAML or PyScript.

### Node Types

**if_block**
```json
{
  "id": "stmt_001",
  "type": "if_block",
  "condition": { ...condition object... },
  "only_when": [ ...array of condition objects... ],
  "true_branch": [ ...array of statement nodes... ],
  "false_branch": [ ...array of statement nodes... ]
}
```
`else if` is represented as the first node in `false_branch` being another `if_block`.
`else` (no condition) is represented as `false_branch` containing non-if_block statements directly.

**with_block**
```json
{
  "id": "stmt_002",
  "type": "with_block",
  "target_role": "porch_light",
  "only_when": [ ...array of condition objects... ],
  "tasks": [ ...array of task nodes... ]
}
```

**repeat_block**
```json
{
  "id": "stmt_003",
  "type": "repeat_block",
  "condition": { ...condition object... },
  "only_when": [ ...array of condition objects... ],
  "body": [ ...array of statement nodes... ]
}
```

**for_each_block**
```json
{
  "id": "stmt_004",
  "type": "for_each_block",
  "variable_name": "$device",
  "collection_role": "smoke_detectors",
  "only_when": [ ...array of condition objects... ],
  "body": [ ...array of statement nodes... ]
}
```

**wait**
```json
{
  "id": "stmt_005",
  "type": "wait",
  "until": "23:00:00"
}
```
or
```json
{
  "id": "stmt_005",
  "type": "wait",
  "duration_seconds": 300
}
```

**wait_for_state**
```json
{
  "id": "stmt_006",
  "type": "wait_for_state",
  "target_role": "garage_door",
  "capability": "state",
  "operator": "is",
  "value": "closed",
  "timeout_seconds": 120
}
```

**set_variable**
```json
{
  "id": "stmt_007",
  "type": "set_variable",
  "variable_name": "$light_was_on",
  "value_expression": "..."
}
```

**log_message**
```json
{
  "id": "stmt_008",
  "type": "log_message",
  "level": "info",
  "message": "Motion detected in hallway"
}
```
Level options: `info` / `warning` / `error` / `debug` / `trace`

**call_piston**
```json
{
  "id": "stmt_009",
  "type": "call_piston",
  "target_piston_id": "b7e2a1f4",
  "wait_for_completion": true
}
```
`wait_for_completion: true` only valid for PyScript pistons.
YAML pistons always fire-and-forget — `wait_for_completion` is ignored with a UI warning.

**stop**
```json
{
  "id": "stmt_010",
  "type": "stop"
}
```

### Condition Object

Used inside `if_block.condition`, `repeat_block.condition`, and `only_when` arrays.

```json
{
  "subject": {
    "type": "device",
    "role": "motion_sensor",
    "capability": "motion"
  },
  "operator": "is",
  "value": "detected",
  "group_operator": "AND"
}
```

`group_operator` is `AND` or `OR` — applies to this condition's relationship with the next condition in the array. Omit on the last condition in the array.

Subject types: `device` / `variable` / `time` / `date` / `sun` / `ha_system`

### Statement IDs

Generated by the editor when a statement is created.
Format: `stmt_` + incrementing integer padded to 3 digits, e.g. `stmt_001`, `stmt_002`.
IDs never change after creation — reordering does not reassign IDs.
IDs are unique within a piston.

---

## The Wizard Modal

Opens when the user clicks any ghost text or clicks to edit an existing statement.

### Behavior

- Opens as a modal overlay on top of the editor
- The editor document behind it is dimmed but still visible
- The wizard builds a plain English sentence at the top as the user progresses through steps
- Each step's options are fetched live from the backend (which fetches from HA via WebSocket)
- Clicking Back goes to the previous step without losing selections
- Clicking Cancel closes the wizard with no changes
- Clicking Done (final step) closes the wizard and inserts or updates the statement

### Cog Icon — Advanced Options

Every wizard modal has a cog icon in the bottom right corner.
Tooltip: "Show/Hide advanced options"
Clicking expands:
- Task Execution Policy (TEP)
- Task Cancellation Policy (TCP)
- Execution Method (Synchronous / Asynchronous)

These are always accessible but hidden by default.
If set on a YAML-bound piston, show a note: "These options only apply to Complex (PyScript) pistons."

### Wizard Steps — Condition / Trigger

1. What to evaluate — Physical Device / Variable / Time / Date / Location / HA System
2. Pick the device — type-to-filter search by friendly name, device name, or area
3. Pick the capability or attribute — list fetched live from HA for that specific device
4. Pick the operator — list appropriate to the selected capability
5. Compare to — value input, another device, a variable, or a time

The plain English sentence at the top grows with each step. Example progression:
- Step 1: "When..."
- Step 2: "When Porch Motion Sensor..."
- Step 3: "When Porch Motion Sensor's motion..."
- Step 4: "When Porch Motion Sensor's motion changes to..."
- Step 5: "When Porch Motion Sensor's motion changes to detected"

### Wizard Steps — Action (with block)

1. Pick the device
2. Pick the capability or service — list fetched live from HA
3. Configure parameters — fields generated from HA's service schema

### Loading State

If the backend is fetching capability data from HA when the wizard opens, show a loading spinner inside the dropdown. Never show an empty dropdown — always show loading state until data arrives or an error occurs.

If capability data fails to load, show:
"Could not load device capabilities. Check your Home Assistant connection."
With a Retry button.

---

## Capability Data — What Comes from the Backend

The frontend never calls HA directly. All HA data comes from the FastAPI backend.

The backend provides these endpoints the frontend uses:

- `GET /api/devices` — all devices with friendly names and areas
- `GET /api/device/{id}/triggers` — valid triggers for a device
- `GET /api/device/{id}/conditions` — valid conditions for a device
- `GET /api/device/{id}/services` — valid services for a device
- `GET /api/pistons` — all pistons with status
- `GET /api/piston/{id}` — single piston JSON
- `POST /api/piston/{id}/save` — save piston JSON
- `POST /api/piston/{id}/deploy` — deploy to HA
- `POST /api/piston/{id}/test` — fire piston manually
- `GET /api/globals` — all global variables
- `WebSocket /ws` — live log updates, trace data, run status events

Exact endpoint signatures to be confirmed with the backend developer.

---

## Visual Style Notes

Match WebCoRE's visual language as closely as possible:

- Dark background editor area
- Keywords in a distinct highlight color
- Ghost text in a muted/gray color — clearly secondary
- Indentation uses consistent spacing (suggest 2rem per level)
- Curly braces `{` and `}` styled the same as keywords
- Line numbers visible on the left side of the action tree (used by Trace mode)
- Selected statement has a visible highlight/border
- Cut statement is visually dimmed (50% opacity or similar)

The goal is that a WebCoRE user sits down, looks at the editor, and immediately feels at home.

---

## What Is Not the Frontend's Responsibility

- Compiling piston JSON to YAML or PyScript — that is the backend
- Fetching data from HA directly — always go through the backend
- Storing piston data permanently — backend writes to Docker volume
- Validating piston logic deeply — backend runs the validation pipeline
- Writing files to HA — companion integration handles that

The frontend's job is: render the tree, let the user edit it, send it to the backend on save.

---

## Open Items — Not Yet Defined

These affect the frontend but are not yet decided. Do not implement them until they are:

1. **Wizard Capability Map** — the decision tree that determines valid operators and value types given a device capability. Defined in DESIGN.md Section 8.1. Required before wizard coding.
2. **AI Prompt feature** — needs redesign before implementation. See DESIGN.md Section 11.
3. **Exact backend API signatures** — to be confirmed with backend developer.
4. **globals.json runtime access method** — affects whether global variable values can be shown live in the editor sidebar. See DESIGN.md Section 4.1.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
