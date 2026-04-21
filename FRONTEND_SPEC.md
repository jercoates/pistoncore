# PistonCore Frontend Specification

**Version:** 0.3
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

Single scrolling list. **Not a two-column layout.** Folder names appear as inline section headers
with a piston count — the same pattern WebCoRE uses. There is no folder sidebar column.

```
┌─────────────────────────────────────────────────────┐
│  PistonCore            [Copy AI Prompt]  [+ New]    │
│  [Search pistons...]                                │
├─────────────────────────────────────────────────────┤
│  Outdoor Lighting (3)                               │
│  ─────────────────────────────────────────────────  │
│  ● Driveway Lights at Sunset          ✅  08:46:25  │
│  ● Side Gate Motion Light             ✅  14:22:01  │
│  ○ Holiday Lights (disabled)          —   Never     │
│                                                     │
│  Security (2)                                       │
│  ─────────────────────────────────────────────────  │
│  ● Front Door Alert                   ✅  09:11:44  │
│  ● Garage Monitor                     ❌  07:30:12  │
│                                                     │
│  Uncategorized (1)                                  │
│  ─────────────────────────────────────────────────  │
│  ● Test Piston                        —   Never     │
│                                                     │
│                              [+ New Folder] [Import]│
└─────────────────────────────────────────────────────┘
```

### Folder Section Headers

- Folder name in a distinct color (teal or equivalent, matching WebCoRE's style) as a section divider
- Piston count shown inline: "Outdoor Lighting (3)"
- A horizontal rule or divider line below the header
- Folders are sorted alphabetically; Uncategorized always appears last
- `[+ New Folder]` button at the bottom of the list — opens a simple inline text input to name the new folder
- Folders are created here only — not in the editor or wizard

### Piston List Items

Each piston shows on a single row:
- Enabled indicator: `●` (green, enabled) or `○` (gray, disabled)
- Piston name — clicking navigates to the Status Page for that piston
- Last evaluation result: `✅` (true) / `❌` (false) / `—` (never run or disabled) — shown inline after the name
- Last ran timestamp — shown right-aligned as a time only: `08:46:25` not "10 minutes ago". Shows `Never` if never run.
- Pause/Resume button per piston (inline, subtle)

### Global Variables Drawer

Accessible from the main list page via a button or link in the header area.
A slide-out panel from the right side showing all global variables and their current values — read only.
Matches the WebCoRE right sidebar behavior.

### Mode Notice

**Standard mode notice (subtle, footer):**
*"PistonCore manages automations in its own subfolder. Automations created directly in Home Assistant are not visible or managed here."*

### Buttons

- `[Copy AI Prompt]` — copies the PistonCore JSON format spec to clipboard (redesign required — see DESIGN.md Section 11)
- `[+ New]` — creates a new blank piston and navigates to its Status Page. New piston lands in Uncategorized.
- `[+ New Folder]` — opens inline text input at the bottom of the list
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
│  [✎ Edit] [▶ Test — Live Fire ⚠] [📷 Snapshot]     │
│  [📷 Backup] [⧉ Duplicate] [🗑 Delete]              │
│                      [Trace: OFF]  [⚠ Notify: OFF]  │
├─────────────────────────────────────────────────────┤
│  QUICK FACTS                                        │
│  Compile target: Native HA Script                   │
│  Last ran: 08:46:25                                 │
│  Next scheduled: sunset today                       │
│  Devices used: Driveway Main Light                  │
├─────────────────────────────────────────────────────┤
│  PISTON SCRIPT (read-only)                          │
│  execute                                            │
│  1   with                                           │
│  2     (Driveway Main Light)                        │
│  3   do                                             │
│  4     Turn On                                      │
│  5       Brightness: 100%                           │
│  6   end with;                                      │
│  7   wait until 11:00 PM;                           │
│  8   with                                           │
│  9     (Driveway Main Light)                        │
│  10  do                                             │
│  11    Turn Off                                     │
│  12  end with;                                      │
│  end execute;                                       │
├─────────────────────────────────────────────────────┤
│  LOG                          [▼ Full] [Clear Log]  │
│  08:46:25 — Triggered by sunset                     │
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

### Piston Script Panel

Displayed below Quick Facts, above the Log panel.

This shows the piston in **read-only form** — the same visual document the editor shows, rendered
with syntax highlighting and statement numbers. This is PistonCore's own visual format, the script
the user authored. It is NOT compiled output (YAML or PyScript).

**Compiled output is never shown on this page.**

Rendering rules:
- `execute` and `end execute;` appear as wrapper lines at the top and bottom of the script
- Statement numbers appear on the left (used by Trace mode)
- Keywords are styled the same as in the editor (distinct color/weight)
- Indentation matches the editor indentation
- The saved format is used here: `then / end if;` (not `when true / when false`)
- The view is read-only — clicking on it opens the editor

### Test Button — Always Live Fire

**Both compile targets (Native HA Script and PyScript) execute real device actions when tested.**
There is no preview or dry-run mode for either target.

The Test button always shows: `[▶ Test — Live Fire ⚠]`

Before firing, always show a confirmation dialog:
*"This will execute real actions on your devices. Are you sure?"*
`[Yes, run it]` `[Cancel]`

The ⚠ warning symbol must be visible on the button itself before the user clicks.

### Navigation

- `← My Pistons` returns to the folder this piston is in — not always the root list
- If the piston is in Uncategorized, the back button returns to the list with Uncategorized visible
- `[✎ Edit]` opens the Editor for this piston
- Folder dropdown on this page allows reassigning the piston to a different folder

### Buttons

All buttons use icon + plain English label. Never icon alone.

- `[✎ Edit]` — opens editor
- `[▶ Test — Live Fire ⚠]` — fires the piston manually, always with confirmation dialog
- `[📷 Snapshot]` — green label — anonymized export, safe to share
- `[📷 Backup]` — red label — full export including entity mappings, personal restore only
- `[⧉ Duplicate]` — creates a copy of the piston, lands in Uncategorized
- `[🗑 Delete]` — deletes the piston with a confirmation prompt
- `[Trace: OFF/ON]` — toggle, only active after Test has been pressed at least once
- `[⚠ Notify: OFF/ON]` — toggle, enables failure notifications via persistent HA UI notification

### Validation Banner

Appears automatically after save. Shows warnings and errors from Stage 1 internal validation.
Plain English only. No technical error codes.

### Log Panel

Most recent runs at the top. Each run entry is collapsible.
Log level selector: Full / Minimal / None (mirrors what is set in the editor).
`[Clear Log]` button clears all entries.

Timestamps in the log are shown as the time the event was received, not just when the piston ran.
If status is unknown (WebSocket drop, missed event), show: *"Status unknown"* — never wrong information.

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
│  Compile target: [Native HA Script] ← updates live  │
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
│  execute                                            │
│  [action tree — indented, see rendering section]    │
│  + add a new statement                              │
│  end execute;                                       │
├─────────────────────────────────────────────────────┤
│  [▶ Test]  [💾 Save to PistonCore]  [🚀 Deploy to HA]│
│  [📷 Snapshot] [📷 Backup]                          │
│  Log Level: [Full ▼]                                │
└─────────────────────────────────────────────────────┘
```

### Two Distinct Save Operations — UI Must Make This Unmistakable

There are two separate operations and users must never confuse them:

**Save to PistonCore** `[💾 Save to PistonCore]`
- Writes the piston JSON to the Docker volume
- Runs Stage 1 internal validation
- Fast — no HA involvement at all
- Returns to the status page on success
- This is where your work is preserved

**Deploy to HA** `[🚀 Deploy to HA]`
- Compiles the piston to native HA files
- Runs Stages 2–4 validation
- Writes automation and script files to HA directories
- Calls automation.reload and script.reload
- Only available after at least one successful Save to PistonCore
- A separate button — never combined with Save

The status page shows which version is deployed vs saved. If the saved piston differs from the
deployed version, the status page shows: *"Unsaved changes — deploy to update HA."*

### Save Pipeline

1. Frontend validates piston has a name — if empty, stop and highlight the field
2. Frontend sends piston JSON to backend via POST
3. Save button shows loading state: "Saving..."
4. Backend writes piston JSON to Docker volume, runs Stage 1 validation
5. Backend returns success or failure plus any validation warnings
6. If success → navigate to status page, warnings appear in banner if any
7. If write fails → stay in editor, error banner: "Save failed — your work is preserved. Try again."

### Unsaved Changes

If the user navigates away with unsaved changes, show a prompt:
*"You have unsaved changes. Save, Discard, or Cancel?"*
- Save → triggers save pipeline then navigates
- Discard → navigates without saving
- Cancel → returns user to editor

### Browser Refresh

On refresh, restore from local browser storage:
- Currently open folder / scroll position in the piston list
- Last viewed status page (if on status page)
- Editor state if in the editor — unsaved changes preserved

### WebSocket Drop While in Editor

If the WebSocket connection to HA drops:
- Show a reconnecting banner at the top of the editor
- Disable the Deploy to HA button
- Disable wizard capability fetching (wizard can still open but shows an error state)
- Preserve all unsaved work in local browser storage
- When connection restores, remove banner and re-enable everything

### Compile Target Indicator

Shows the current compile target (Native HA Script or PyScript) based on auto-detection rules.
Updates live as the user adds statements. If the target changes from Native HA Script to PyScript
mid-build, show a brief inline notification:
*"This piston now requires PyScript compilation."*

### Simple / Advanced Toggle

Single global toggle. Default is Simple.

**Simple mode hides:**
- Piston Variables section
- Loop statement types (Repeat, For Each, While, For Loop)
- Wait for State action
- Call Another Piston action
- Break, Cancel All Pending Tasks, On Event, Switch, Do Block
- TEP/TCP options in wizard

**Advanced mode shows everything.**

Switching modes never destroys data. A piston built in Advanced mode opens correctly in Simple mode
— advanced features are not editable until switching back.

---

## The Action Tree — Document Rendering

This is the core of the editor. It renders the piston's action tree as a structured document
that reads top to bottom like a script.

The entire action tree is wrapped in `execute / end execute;` — rendered automatically by the
frontend. **execute and end execute are not data nodes in the JSON.** The JSON `actions` array
is the execute body. The frontend adds the wrapper rendering only.

### Visual Rules — Match WebCoRE Exactly

- Keywords are rendered in a distinct color/weight: `if`, `when true`, `when false`, `else if`, `else`, `end if;`, `with`, `do`, `end with;`, `only when`, `repeat`, `for each`, `end repeat;`, `execute`, `end execute;`, `define`, `end define;`, `settings`, `end settings;`
- Indentation increases with nesting depth — each level adds one indent stop (suggest 2rem per level)
- Curly braces `{` and `}` mark branch boundaries in editor display — styled same as keywords
- `end if;` closes every if block at the same indent level as the opening `if`
- `else if` and `else` appear at the same indent level as the opening `if`
- `when true` and `when false` label the branches inside an if block **in the editor**
- `then` and `end if;` are used in the **status page read-only view** and export format
- `and` and `or` between conditions appear at the **same indent level as the conditions**
- `until` in a repeat block appears at the **bottom** of the block, before `end repeat;`
- Statement numbers appear on the left side (used by Trace mode)
- Line numbers are NOT shown — trace uses statement numbers, not line numbers

### Editor Rendering Example

```
execute
if
  Any of (@Smoke_Detectors)'s smoke changes to Detected
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
    Any of ($device)'s smoke is Detected
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
repeat
do
  + add a new statement
until
  [condition]
end repeat;
+ add a new statement
end execute;
```

### Status Page Read-Only Rendering Example

```
execute
1  if
2    Any of (@Smoke_Detectors)'s smoke changes to Detected
3  then
4    with
5      (@Notification_Text)
6    do
7      Send device notification "Smoke detected";
8    end with;
9  end if;
10 for each ($device in {@Smoke_Detectors})
11 do
12   if
13     Any of ($device)'s smoke is Detected
14   then
15     + (empty branch)
16   end if;
17 end for each;
end execute;
```

Note: condition values in the document display the friendly label ("Detected") not the compiled
value ("on"). The document always shows what the user chose, never the HA internal state value.

### Ghost Text — Primary Insertion Method

At every valid insertion point, ghost text appears inline in a muted color.
Ghost text is always visible at valid insertion points — not only on hover.

- `+ add a new statement` — at the top level and inside blocks
- `+ add a new task` — inside a with/do block
- `+ add a new trigger` — in the triggers section
- `+ add a new condition` — in the conditions section
- `+ add a new restriction` — after an `only when` line

Clicking any ghost text opens the wizard modal for that insertion point.

### Right-Click Context Menu

Right-clicking any statement node shows:
- Copy selected statement
- Duplicate selected statement
- Cut selected statement
- Delete selected statement
- Clear clipboard (if clipboard has content)

Paste is triggered by clicking a ghost text insertion point when the clipboard has a copied/cut statement.
Cut statement is visually dimmed in place (50% opacity) until pasted or clipboard is cleared.

### Within-Block Drag to Reorder

Statements can be dragged to reorder within their containing block only.
Dragging across block boundaries is not supported in v1 — use cut and paste for that.
Valid drop targets highlight on hover.
No undo for drag operations in v1.

---

## The Statement Tree Data Structure

This is the internal JSON structure the editor manipulates in memory.
This same structure is serialized to the piston JSON file on save.
The compiler reads this same structure to generate native HA YAML files.

**execute / end execute is a rendering artifact.** It is not represented in the JSON.
The `actions` array in the piston JSON IS the execute block body. The frontend renders
`execute` and `end execute;` as wrapper lines when displaying the document.

### Condition Object

Used inside `if_block.condition`, `repeat_block.condition`, `while_block.condition`, and `only_when` arrays.

```json
{
  "id": "cond_001",
  "subject": {
    "type": "device",
    "role": "motion_sensor",
    "capability": "motion",
    "attribute_type": "binary"
  },
  "aggregation": "any",
  "operator": "changes to",
  "display_value": "Detected",
  "compiled_value": "on",
  "duration": null,
  "group_operator": "AND"
}
```

`display_value` — shown in the editor document and status page read-only view.
`compiled_value` — used by the compiler when generating HA YAML. For binary sensors this is
always `"on"` or `"off"`. For all other entity types these are the same string.

The frontend always displays `display_value`. It never shows `compiled_value` to the user.

`aggregation`: `any` / `all` / `none` / `null` (null = single device, no aggregation)

Subject types: `device` / `variable` / `time` / `date` / `sun` / `ha_system`

### Statement IDs

Generated by the editor when a statement is created.
Format: `stmt_` + incrementing integer padded to 3 digits, e.g. `stmt_001`, `stmt_002`.
IDs never change after creation — reordering does not reassign IDs.
IDs are unique within a piston.

Full statement node type definitions are in COMPILER_SPEC.md Section 7 and 8.
The frontend uses the same JSON structure — do not duplicate the definitions here.

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

### First Step — Condition or Group

When adding to the CONDITIONS section or inside an if block condition, the first step presents:

**Condition** — "a single comparison between two or more operands, the basic building block of a decisional statement"
`[Add a condition]`

**Group** — "a collection of conditions, with a logical operator between them, allowing for complex decisional statements"
`[Add a group]`

Groups are first-class objects. This is how WebCoRE handles complex AND/OR logic.

### Cog Icon — Advanced Options

Every wizard modal has a cog icon in the bottom right corner.
Tooltip: "Show/Hide advanced options"
Clicking expands:
- Task Execution Policy (TEP)
- Task Cancellation Policy (TCP)
- Execution Method (Synchronous / Asynchronous)

These are always accessible but hidden by default.
If set on a native-script-bound piston, show a note: *"These options only apply to PyScript pistons."*

### Wizard Steps — Condition / Trigger

0. Condition or Group (when adding to conditions section)
1. What to evaluate — Physical Device / Variable / Time / Date / Location / HA System
2. Pick the device — type-to-filter search by friendly name, device name, or area
3. Pick the capability or attribute — list fetched live from HA for that specific device
4. Pick the operator — trigger group (⚡) or condition group, appropriate to the selected capability
   (Optional) Which interaction — Any / Physical / Programmatic
5. Value input — friendly labels shown to user; compiled_value stored internally

Full wizard capability map and value input types are defined in WIZARD_SPEC.md.

### Call Another Piston — Warning Before Target Selection

If the user initiates a Call Another Piston action with wait-for-completion on a native-script-bound
piston, show immediately — **before** the target piston picker:

*"Waiting for a called piston to finish requires converting this piston to PyScript."*
`[Convert and continue]` `[Use fire-and-forget]` `[Cancel]`

This must appear BEFORE the user picks the target piston, not after.

### Loading State

If the backend is fetching capability data from HA when the wizard opens, show a loading spinner inside the dropdown. Never show an empty dropdown — always show loading state until data arrives or an error occurs.

If capability data fails to load, show:
*"Could not load device capabilities. Check your Home Assistant connection."*
With a Retry button.

---

## Capability Data — What Comes from the Backend

The frontend never calls HA directly. All HA data comes from the FastAPI backend.

The backend provides these endpoints the frontend uses:

- `GET /api/devices` — all devices with friendly names, areas, domains
- `GET /api/device/{id}/capabilities` — capabilities with attribute_type and device_class
- `GET /api/device/{id}/triggers` — valid triggers for a device
- `GET /api/device/{id}/conditions` — valid conditions for a device
- `GET /api/device/{id}/services` — valid services for a device with parameter schema
- `GET /api/pistons` — all pistons with status
- `GET /api/piston/{id}` — single piston JSON
- `POST /api/piston/{id}/save` — save piston JSON to Docker volume
- `POST /api/piston/{id}/deploy` — compile and deploy to HA
- `POST /api/piston/{id}/test` — fire piston manually (always live fire, always confirms first)
- `GET /api/globals` — all global variables
- `WebSocket /ws` — live log updates, trace data, run status events

The capability map (which operators are valid for which attribute types) lives in the frontend.
Binary sensor friendly labels come from the device_class lookup table in WIZARD_SPEC.md — not from HA.
The backend provides raw HA data. The frontend applies the map to determine operators and input types.

Exact endpoint signatures to be confirmed with the backend developer.

---

## Visual Style Notes

Match WebCoRE's visual language as closely as possible:

- Dark background editor area
- Keywords in a distinct highlight color (teal or similar — match WebCoRE)
- Folder section headers in teal or the same keyword color
- Ghost text in a muted/gray color — clearly secondary
- Indentation uses consistent spacing (suggest 2rem per level)
- Curly braces `{` and `}` styled the same as keywords
- Statement numbers visible on the left side of the action tree (used by Trace mode)
- Selected statement has a visible highlight/border
- Cut statement is visually dimmed (50% opacity or similar)
- `and` and `or` between conditions rendered at same indent as conditions, not indented further

---

## What Is Not the Frontend's Responsibility

- Compiling piston JSON to native HA YAML — that is the backend
- Fetching data from HA directly — always go through the backend
- Storing piston data permanently — backend writes to Docker volume
- Validating piston logic deeply — backend runs the validation pipeline
- Writing files to HA — companion integration handles that

The frontend's job is: render the tree, let the user edit it, send it to the backend on save.

---

## Open Items — Not Yet Defined

These affect the frontend but are not yet decided. Do not implement them until they are:

1. **AI Prompt feature** — needs redesign before implementation. See DESIGN.md Section 11.
2. **Exact backend API signatures** — to be confirmed with backend developer.
3. **settings / end settings block contents** — do not implement until defined. See DESIGN.md Section 26.
4. **Which-interaction step feasibility** — evaluate PyScript context tracking in sandbox before building the wizard step. See DESIGN.md Section 8.6.
5. **Timer statement** — evaluate overlap with HA scheduler before including in v1. See DESIGN.md Section 22.
6. **Debugging UI** — what the user sees when a native HA script fails mid-run needs a design pass before implementing the log panel in detail.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
