# PistonCore Frontend Specification

**Version:** 0.6
**Status:** Draft — For Developer Use
**Last Updated:** May 2026

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

## Hard Rules — No Exceptions

**The frontend never calls HA directly.** This is a security invariant, not a guideline. All HA data comes from the PistonCore backend API. Any `fetch()` to an HA URL in frontend JS is a bug.

**BASE_URL must be used for every connection.** See the BASE_URL section below. No hardcoded paths anywhere.

---

## BASE_URL Standard — Required for All Connections

HA addon ingress proxies traffic through a path prefix. All frontend connections must use `BASE_URL` so they work correctly under both Docker (no prefix) and addon ingress (prefix injected at serve time).

```javascript
// frontend/js/config.js
const BASE_URL = window.PISTONCORE_BASE_URL || '';
```

Apply `BASE_URL` to every connection type — no exceptions:

```javascript
// API calls
fetch(BASE_URL + '/api/pistons')

// WebSocket
new WebSocket(BASE_URL.replace('http', 'ws') + '/ws')

// Any dynamically constructed static asset path
BASE_URL + '/static/something.js'
```

**Docker:** `BASE_URL` is empty string — zero change to current behavior.
**Addon ingress:** `BASE_URL` is injected by the backend at page serve time.

Any hardcoded path is a bug that will silently break under addon ingress.

---

## Deployment Type Feature Flags

The backend includes `deployment_type: "addon" | "docker"` in the config response. The frontend uses this to conditionally show or hide UI elements:

| UI Element | Addon | Docker |
|---|---|---|
| HA token entry field in settings | Hidden — supervisor token is automatic | Shown |
| PyScript requirement indicator on complex pistons | Hidden in v2+ (native runtime available) | Always shown |
| "HA Disconnected" badge | Shown if WebSocket not connected | Shown if WebSocket not connected |

Feature flags are informational — the editor never blocks building based on deployment type.

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
with a piston count. There is no folder sidebar column.

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

- Folder name in a distinct color (teal or equivalent, matching WebCoRE's style)
- Piston count shown inline: "Outdoor Lighting (3)"
- A horizontal rule or divider line below the header
- Folders are sorted alphabetically; Uncategorized always appears last
- `[+ New Folder]` at the bottom of the list — opens a simple inline text input

### Piston List Items

Each piston shows on a single row:
- Enabled indicator: `●` (green, enabled) or `○` (gray, disabled)
- Piston name — clicking navigates to the Status Page
- Last evaluation result: `✅` / `❌` / `—` (never run or disabled)
- Last ran timestamp — right-aligned, time only: `08:46:25` not "10 minutes ago". Shows `Never` if never run.
- Pause/Resume button per piston (inline, subtle)

### Global Variables Drawer

Accessible from the header area. A slide-out panel from the right showing all global variables and their current values — read only.

### Buttons

- `[+ New]` — creates a new blank piston and navigates to its Status Page. Lands in Uncategorized.
- `[+ New Folder]` — opens inline text input at the bottom of the list
- `[Import]` — opens import dialog (paste JSON, paste URL, or upload .piston file)
- `[AI Help]` — opens the AI Help modal (see below)

### AI Help Modal

The AI Help button on the main menu opens a modal with user-facing AI prompts. v1 contains one prompt: **Write a Piston**.

```
┌─────────────────────────────────────────────────────┐
│  AI Help — Write a Piston                       [✕] │
├─────────────────────────────────────────────────────┤
│  Copy this prompt and paste it into any AI          │
│  assistant (ChatGPT, Claude, Gemini, etc.).         │
│  Then describe what you want your piston to do.     │
│  When the AI gives you JSON, come back and use      │
│  the Import button on this page to load it.         │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ [prompt text — read only, scrollable]       │   │
│  │                                             │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│                        [Copy to Clipboard] [Close]  │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- Modal opens centered, backdrop transparent (matches wizard style)
- Prompt text area is read-only and scrollable — user cannot edit it
- `[Copy to Clipboard]` copies the full prompt text, button changes to `[Copied ✓]` for 2 seconds
- `[Close]` or `[✕]` closes with no action
- Prompt content is fetched from `GET /api/prompts/write-a-piston` — backend serves the file from `pistoncore/prompts/write-a-piston.md`
- If the fetch fails, show: *"Prompt unavailable — check your connection and try again."*

**Future prompt options** (not v1 scope) will appear as tabs or a dropdown inside this same modal. Do not build the tab structure until a second prompt exists.

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
│  [✎ Edit] [▶ Test — Live Fire ⚠] [Test Compile]     │
│  [📷 Snapshot] [📷 Backup] [⧉ Duplicate] [🗑 Delete]│
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
│  ...                                                │
│  end execute;                                       │
├─────────────────────────────────────────────────────┤
│  LOG                          [▼ Full] [Clear Log]  │
│  08:46:25 — Triggered by sunset                     │
│  ...                                                │
├─────────────────────────────────────────────────────┤
│  VARIABLES                                          │
│  (piston variable state from last run)              │
└─────────────────────────────────────────────────────┘
```

### Piston Script Panel

Shows the piston in **read-only form** — the same visual document the editor shows, rendered with syntax highlighting and statement numbers. This is PistonCore's own visual format.

**Compiled output is never shown on this page.**

Rendering rules:
- `execute` and `end execute;` appear as wrapper lines
- Statement numbers appear on the left (used by Trace mode)
- Keywords are styled the same as in the editor
- The saved format is used here: `then / end if;` (not `when true / when false`)
- Clicking on it opens the editor

### Test Compile Button

`[Test Compile]` opens a read-only compiled YAML or PyScript output view. This is the **only place compiled output is ever shown to the user.** The view is read-only and does not deploy to HA.

Compiler errors and warnings appear inline below the compiled output.

### Test Button — Always Live Fire

Both compile targets execute real device actions when tested. There is no preview or dry-run mode.

Button always shows: `[▶ Test — Live Fire ⚠]`

Before firing, always show:
*"This will execute real actions on your devices. Are you sure?"*
`[Yes, run it]` `[Cancel]`

The ⚠ warning symbol must be visible on the button itself before the user clicks.

### Compile Target / Complexity Indicator

Quick Facts section shows current compile target. If the piston is complex (PyScript required), show a subtle indicator:
- **Addon:** "Requires PyScript — install via HACS before deploying"
- **Docker:** Same indicator, same text

If PyScript is detected as already installed, the indicator changes to a neutral confirmation: "PyScript: Installed ✓"

### Navigation

- `← My Pistons` returns to the piston list
- `[✎ Edit]` opens the Editor for this piston
- Folder dropdown allows reassigning the piston to a different folder

### Buttons

All buttons use icon + plain English label. Never icon alone.

- `[✎ Edit]` — opens editor
- `[▶ Test — Live Fire ⚠]` — fires the piston manually, always with confirmation dialog
- `[Test Compile]` — shows compiled output in read-only view, does not deploy
- `[📷 Snapshot]` — green label — anonymized export, safe to share
- `[📷 Backup]` — red label — full export including entity mappings, personal restore only
- `[⧉ Duplicate]` — creates a copy, lands in Uncategorized
- `[🗑 Delete]` — deletes with confirmation prompt
- `[Trace: OFF/ON]` — toggle, only active after Test has been pressed at least once
- `[⚠ Notify: OFF/ON]` — toggle, enables failure notifications via persistent HA UI notification

### Validation Banner

Appears automatically after save. Shows warnings and errors from Stage 1 internal validation. Plain English only. No technical error codes visible to the user.

### Log Panel

Most recent runs at the top. Each run entry is collapsible.
Log level selector: Full / Minimal / None.
`[Clear Log]` clears all entries.

If status is unknown (WebSocket drop, missed event): show *"Status unknown"* — never wrong information.

**Stale run detection:** If `PISTONCORE_RUN_COMPLETE` is not received within a configurable timeout (default 5 minutes), the log entry updates to:
*"Status unknown — piston may still be running, or may have been interrupted. Check Home Assistant logs for details."*

Never show "Running..." indefinitely.

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
│  [action tree — indented]                           │
│  + add a new statement                              │
│  end execute;                                       │
├─────────────────────────────────────────────────────┤
│  [▶ Test]  [💾 Save to PistonCore]  [🚀 Deploy to HA]│
│  [📷 Snapshot] [📷 Backup]                          │
│  Log Level: [Full ▼]                                │
│  Compile status: [Compiled ✓]                       │
└─────────────────────────────────────────────────────┘
```

### Simple / Advanced Mode Toggle

Single global toggle. **Default is Advanced.**

Mode preference saved to localStorage (`pc_simpleMode`).

**Simple mode hides:**
- Piston Variables section
- Loop statement types (Repeat, For Each, While, For Loop)
- Wait for State action
- Call Another Piston action
- Break, Cancel All Pending Tasks, On Event, Switch, Do Block
- TEP/TCP options in wizard

**Advanced mode shows everything.**

Switching modes never destroys data.

### Compile Target Indicator

Shows the current compile target based on auto-detection. Updates live as the user adds statements. If the target changes from Native HA Script to PyScript mid-build:

*"This piston now requires PyScript compilation."*

This indicator is always visible in the editor header area.

### PyScript Requirement Indicator

If the current piston is complex (PyScript required) and PyScript is not detected in HA:

- Show a subtle warning below the compile target indicator
- Text: "PyScript not detected in HA — required before deploying this piston"
- On Docker: always show this for complex pistons until PyScript is confirmed installed
- On Addon v2+: suppress this indicator entirely (native runtime replaces PyScript)

### Compile Status Indicator

Shows background compile state in the editor footer:
- `Compiling...` — compile job running
- `Compiled ✓` — last compile succeeded
- `Error ✗` — last compile had errors (click to view)

Background compilation runs on a 2-second debounce after the last change. Never blocks the UI.

### Two Distinct Save Operations — UI Must Make This Unmistakable

**Save to PistonCore** `[💾 Save to PistonCore]`
- Writes the piston JSON to the volume
- Runs Stage 1 internal validation
- Fast — no HA involvement at all
- Returns to the status page on success

**Deploy to HA** `[🚀 Deploy to HA]`
- Compiles the piston to native HA files
- Runs Stages 2–4 validation
- Writes automation and script files to HA
- Only available after at least one successful Save to PistonCore

The status page shows: *"Unsaved changes — deploy to update HA."* when the saved piston differs from deployed.

### Save Pipeline

1. Frontend validates piston has a name — if empty, stop and highlight the field
2. Frontend sends piston JSON to backend via POST
3. Save button shows: "Saving..."
4. Backend writes piston JSON to volume, runs Stage 1 validation
5. Backend returns success or failure plus any validation warnings
6. If success → navigate to status page, warnings appear in banner if any
7. If write fails → stay in editor, error banner: "Save failed — your work is preserved. Try again."

### Unsaved Changes

If the user navigates away with unsaved changes:
*"You have unsaved changes. Save, Discard, or Cancel?"*

### WebSocket Drop While in Editor

If the WebSocket connection to HA drops:
- Show a reconnecting banner at the top of the editor
- Disable the Deploy to HA button
- Disable wizard capability fetching (wizard can still open but shows an error state)
- Preserve all unsaved work in local browser storage
- When connection restores: remove banner, re-enable everything

---

## The Action Tree — Document Rendering

This is the core of the editor. It renders the piston's action tree as a structured document.

The entire action tree is wrapped in `execute / end execute;` — rendered automatically by the frontend. **execute and end execute are not data nodes in the JSON.** The JSON `actions` array is the execute body.

### Visual Rules — Match WebCoRE Exactly

- Keywords in a distinct highlight color: `if`, `when true`, `when false`, `else if`, `else`, `end if;`, `with`, `do`, `end with;`, `only when`, `repeat`, `for each`, `end repeat;`, `execute`, `end execute;`, `define`, `end define;`, `settings`, `end settings;`
- Indentation increases with nesting depth — each level adds one indent stop (suggest 2rem per level)
- Curly braces `{` and `}` mark branch boundaries in editor display — styled same as keywords
- `end if;` closes every if block at the same indent level as the opening `if`
- `else if` and `else` appear at the same indent level as the opening `if`
- `when true` and `when false` label branches in **editor display**
- `then` and `end if;` are used in the **status page read-only view** and export format
- `and` and `or` between conditions appear at the **same indent level as the conditions**
- `until` in a repeat block appears at the **bottom** of the block, before `end repeat;`
- Statement numbers appear on the left side (used by Trace mode)
- Line numbers are NOT shown — trace uses statement numbers, not line numbers

### Ghost Text — Primary Insertion Method

At every valid insertion point, ghost text appears inline in a muted color. Ghost text is always visible at valid insertion points — not only on hover.

- `+ add a new statement` — at the top level and inside blocks
- `+ add a new task` — inside a with/do block
- `+ add a new trigger` — in the triggers section
- `+ add a new condition` — in the conditions section
- `+ add a new restriction` — after an `only when` line

Clicking any ghost text opens the wizard modal for that insertion point.

### Simple Mode Rendering

Simple mode shows:
- Comment header block
- `settings / end settings` (if non-empty)
- `define` block — **ALWAYS shown in both Simple and Advanced** (users define variables constantly)
- `execute` block with `· add a new statement`
- NO `only when` blocks unless they have content

Advanced mode shows everything including `only when` blocks with ghost text.

### Right-Click Context Menu

Right-clicking any statement node shows:
- Copy selected statement
- Duplicate selected statement
- Cut selected statement
- Delete selected statement
- Clear clipboard (if clipboard has content)

Paste is triggered by clicking a ghost text insertion point when the clipboard has a copied/cut statement. Cut statement is visually dimmed in place (50% opacity) until pasted or clipboard is cleared.

### Within-Block Drag to Reorder

Statements can be dragged to reorder within their containing block only. Dragging across block boundaries is not supported in v1 — use cut and paste for that. No undo for drag operations in v1.

---

## The Wizard Modal

Opens when the user clicks any ghost text or clicks to edit an existing statement.

### Behavior

- Opens as a modal overlay on top of the editor
- **Backdrop is transparent** — no dark overlay. Modal is centered, floats over the document.
- **Modal size: 720px wide, fills most of screen height.** wiz-body scrolls, modal does not grow.
- The wizard builds a plain English sentence at the top as the user progresses
- Each step's options are fetched live from the backend
- Clicking Back goes to the previous step without losing selections
- Clicking Cancel closes the wizard with no changes
- Clicking Done (final step) closes the wizard and inserts or updates the statement
- **Never two modals open at once**

### Device Picker

Opens as an inline panel **below** the device row — not a separate modal. The panel includes a search field. Selecting a device closes the panel and populates the row.

### Condition Builder Layout

One screen — everything visible at once:
- Row: `[Physical device(s) ▾]` `[device picker button]` `[attribute ▾]`
- Device picker opens inline panel below the row with search
- "Which interaction" row always visible (not conditional on device selection)
- Operator dropdown below that (Triggers first ⚡, then Conditions)
- Value row appears below operator when needed — textarea for free text types

### Operator Order

Triggers appear **first** with ⚡ prefix. Conditions appear second. This order is non-negotiable.

### Value Inputs

- Binary/enum attributes → dropdown of actual values
- Numeric attributes → number input with unit
- Free text (Value/Variable/Expression/Argument) → textarea that wraps

### if_block Unified Mechanism

Adding an if_block goes to the condition builder first. Only inserts the if_block after the condition is completed. Uses `_extra['block-id']` exclusively as the unified mechanism.

### First Step — Condition or Group

When adding to CONDITIONS section or inside an if_block condition, the first step presents:

**Condition** — *"a single comparison between two or more operands"*
`[Add a condition]`

**Group** — *"a collection of conditions with a logical operator between them"*
`[Add a group]`

This first step does not apply when adding triggers — triggers go directly to the device/event picker.

### Cog Icon — Advanced Options

Every wizard modal has a cog icon (bottom right, tooltip: "Show/Hide advanced options") expanding:
- Task Execution Policy (TEP)
- Task Cancellation Policy (TCP)
- Execution Method (Synchronous / Asynchronous)

Always present, hidden until clicked. If set on a native-script-bound piston: show note *"These options only apply to PyScript pistons."*

### Call Another Piston — Warning Before Target Selection

If the piston is native-script-bound and the user adds a Call Another Piston with wait-for-completion, show **before** the target piston picker:

*"Waiting for a called piston to finish requires converting this piston to PyScript."*
`[Convert and continue]` `[Use fire-and-forget]` `[Cancel]`

This must appear BEFORE the user picks the target piston, not after.

### Loading State

If capability data is being fetched: show a loading spinner. Never show an empty dropdown.
If capability data fails to load: show error with a Retry button.

---

## Capability Data — What Comes from the Backend

The frontend never calls HA directly. All HA data comes from the FastAPI backend.

Backend endpoints the frontend uses:

- `GET /api/config` — deployment type, ha_url, connection status
- `GET /api/devices` — all devices with friendly names, areas, domains
- `GET /api/device/{id}/capabilities` — capabilities with attribute_type and device_class
- `GET /api/device/{id}/triggers` — valid triggers for a device
- `GET /api/device/{id}/conditions` — valid conditions for a device
- `GET /api/device/{id}/services` — valid services for a device with parameter schema
- `GET /api/pistons` — all pistons with status
- `GET /api/piston/{id}` — single piston JSON
- `POST /api/piston/{id}/save` — save piston JSON to volume
- `POST /api/piston/{id}/deploy` — compile and deploy to HA
- `POST /api/piston/{id}/test` — fire piston manually (always live fire, always confirms first)
- `POST /api/piston/{id}/test_compile` — compile and return output for preview (does not deploy)
- `GET /api/globals` — all global variables
- `PUT /config` — save HA connection settings
- `WebSocket /ws` — live log updates, trace data, run status events

The capability map (which operators are valid for which attribute types) lives in the frontend. Binary sensor friendly labels come from the device_class lookup table in WIZARD_SPEC.md — not from HA. The backend provides raw HA data. The frontend applies the map.

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
- Statement numbers visible on the left side of the action tree
- Selected statement has a visible highlight/border
- Cut statement is visually dimmed (50% opacity or similar)
- `and` and `or` between conditions rendered at same indent as conditions

---

## What Is Not the Frontend's Responsibility

- Compiling piston JSON to native HA YAML — that is the backend
- Fetching data from HA directly — always go through the backend
- Storing piston data permanently — backend writes to volume
- Validating piston logic deeply — backend runs the validation pipeline
- Writing files to HA — backend + HA REST API handles that

The frontend's job is: render the tree, let the user edit it, send it to the backend on save.

---

## Open Items — Not Yet Defined

Do not implement these until they are decided:

1. **AI Prompt feature** — needs redesign before implementation. See DESIGN.md Section 31.
2. **Exact backend API signatures** — to be confirmed with backend developer.
3. **settings / end settings block contents** — do not implement until defined. See DESIGN.md Section 31.
4. **Which-interaction step feasibility** — evaluate PyScript context tracking in sandbox before building the wizard step. See DESIGN.md Section 31.
5. **Timer statement** — evaluate overlap with HA scheduler before including in v1. See DESIGN.md Section 29.
6. **Global variable management UI** — create/edit/delete flows defined in DESIGN.md Section 7. Implement from there.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
