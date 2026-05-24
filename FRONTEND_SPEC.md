# PistonCore Frontend Specification

**Version:** 1.1
**Status:** Authoritative — For Developer Use
**Last Updated:** May 2026 (Session 58 / D-S3 — WebSocket protocol specced,
  Settings page specced, clipboard API endpoints added, API endpoint list updated)

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

## AST / Pure Projection Invariant — Hard Rule

**Every edit operation acts on structured JSON first. Rendering is always a pure
projection from that structure. This rule has no exceptions.**

The editor never stores display text. It never reads display text. It renders display
text from structured JSON on every paint using render functions defined in
STATEMENT_TYPES.md. The same render functions produce the Snapshot preview on export —
guaranteeing the preview always matches exactly what the editor shows. The Snapshot
export format is structured JSON, not piston_text. piston_text is not a v1 format.

**Rendered labels are never editable nodes.** Labels like `then`, `end if;`, `end with;`,
`when true`, `when false`, `end repeat;` are display artifacts produced by render
functions. They do not exist in the JSON. They cannot be clicked to edit. They cannot
be deleted. They appear and disappear automatically as the underlying JSON structure
changes.

**Implications for the editor implementation:**
- Every insertion, deletion, and edit goes through a JSON mutation function first
- The editor re-renders the affected portion of the tree after every mutation
- There is no "parse the display text to find what changed" path anywhere
- If you find yourself reading display text to determine piston state, that is a bug

This invariant is the single most important rule for preventing editor bugs. Violations
cause insertion errors, ghost statements, and delete failures — the exact bugs that
destroyed earlier editor attempts.

### wizard_context — Retired

`wizard_context` is not part of the piston format and does not exist in the codebase.
Any reference to `wizard_context` in existing code or comments is from an earlier design
and must be removed. Wizard state is transient UI state held in the wizard modal's own
JavaScript scope — it is never attached to the piston JSON and never sent to the backend.

---

## Import Dialog

The Import button on the piston list page opens a dialog with two tabs:

**Tab 1 — Paste JSON**
Paste a full piston JSON (Snapshot or Backup format). PistonCore validates
the JSON, detects format type, and proceeds accordingly.

**Tab 2 — From URL**
Paste a URL to a raw `.piston` or `.json` file. Fetches and processes the
same as Tab 1.

### Format Detection

PistonCore detects whether the pasted JSON is a Snapshot or Backup by checking
whether any condition or action node has a non-empty `entity_ids` array:

- **All nodes have entity_ids populated** → Backup format. Skip role mapping,
  assign new ID (or preserve original for restore), open in editor.
- **Any node has empty entity_ids** → Snapshot format. Proceed to role mapping.

### Role Mapping Step (Snapshot Import Only)

The role mapping dialog walks the entire `statements` tree and collects every
unique `role` value from condition and action nodes where `entity_ids` is empty.
Roles are presented one at a time in order of first appearance.

```
┌─────────────────────────────────────────────────────┐
│  Map your devices — Step 1 of 2                [✕] │
├─────────────────────────────────────────────────────┤
│  Role: "Doors"                                      │
│  Used as: trigger (changes to Open),                │
│           condition (is Open)                       │
│                                                     │
│  [Device picker — search and multi-select]          │
│  Selected: [front door ×] [back door ×]             │
│                                                     │
│            [Skip]        [← Back]  [Next →]         │
└─────────────────────────────────────────────────────┘
```

- Each role shows where it is used (trigger, condition, action) for context
- Multi-select is always available — user decides how many devices fill the role
- **Skip** — leaves entity_ids empty on that role's nodes. Piston imports with
  unmapped roles. User can fix later in editor.
- **Back** — returns to previous role
- **Next** — advances to next role or completes import if last role

On completion, PistonCore writes the selected entity_ids to every node whose
`role` matches the mapped role. Same role name = same entity_ids on all nodes.
This is intentional — role name is the mapping key.

New UUID assigned on import. `created_at` and `modified_at` set to now.
Piston opens in editor after import completes.

**Import button is disabled** until the user has acted on every role
(mapped or skipped). Skipped roles show a ⚠ indicator in the editor.

**There is no piston_text parser.** `piston_text` is not a v1 format.
Any reference to piston_text parsing in this codebase is from an earlier
design and must be removed.

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

A `[Global Variables]` button is present in the header area. **This button exists but the drawer is not yet implemented.** Clicking it has no effect in v1. Do not build the slide-out panel until this is scheduled for implementation.

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

### editor-doc div

The `#editor-doc` div (the scrollable action tree container) must have the following inline styles applied directly:

```
flex: 1;
overflow-y: auto;
min-height: 0;
```

These are required for correct flex/scroll behavior inside the editor layout. Do not rely on stylesheet rules alone — apply them inline.

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

The entire action tree is wrapped in `execute / end execute;` — rendered automatically by the frontend. **execute and end execute are not data nodes in the JSON.** The JSON `statements` array is the execute body.

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

### Vertical Structure Lines

Vertical structure lines (connecting parent blocks to their children visually) are **not yet implemented.** Do not add them until this is scheduled for a specific session.

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

### Aggregation — Any of (Device Subject Conditions)

When the subject of a condition is a device (or device group), the **"Any of"** aggregation selector is **always shown**, regardless of how many devices are selected. Do not hide it for single-device selections. This matches WebCoRE behavior.

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

## Wizard JavaScript Architecture

The wizard is split into six files. Each file owns a distinct concern. All wizard files are loaded together; there is no dynamic import.

| File | Responsibility |
|---|---|
| `wizard-core.js` | Modal lifecycle, step navigation, sentence builder, Done/Cancel/Back, shared state |
| `wizard-statement.js` | Statement type picker (first step for action insertion) |
| `wizard-condition.js` | Condition builder, operator list, value input, group builder |
| `wizard-loops.js` | Repeat, For Each, While, For Loop step flows |
| `wizard-action.js` | With block, service call, set variable, log, call piston, break, exit |
| `wizard-variable.js` | Variable define step (used when adding entries to the define block) |

### Shared State — window.WizardCore

Wizard state that must be shared across files is exposed via `window.WizardCore` with explicit getter and setter properties. Files must never reach into another file's internal variables directly.

```javascript
// wizard-core.js sets up:
window.WizardCore = {
  get currentStep() { ... },
  set currentStep(v) { ... },
  get selections() { ... },
  set selections(v) { ... },
  // ... other shared properties
};
```

Accessing shared wizard state from any other wizard file:
```javascript
// Correct
const step = window.WizardCore.currentStep;
window.WizardCore.selections = newSelections;

// Wrong — never reach into another file's scope directly
```

---

## define Block — Variable Display Rules

Variable entries in the `define` block follow these display rules:

- **Local variables (non-device):** Show name and current value. Example: `myCounter = 0`
- **Device variables:** Show name only. **Never show `= value` for device variables.** The value of a device variable is a live entity reference, not a scalar — displaying it as `= value` is misleading and must never occur.

Example of correct define block rendering:
```
define
  myCounter = 0
  motionSensor           ← device variable, no = value
  frontDoorLock          ← device variable, no = value
end define;
```

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
- `GET /api/pistons` — all pistons with status (reads piston_index.json)
- `GET /api/piston/{id}` — single piston JSON
- `POST /api/piston/{id}/save` — save piston JSON to volume
- `POST /api/piston/{id}/deploy` — compile and deploy to HA
- `POST /api/piston/{id}/test` — fire piston manually (always live fire, always confirms first)
- `POST /api/piston/{id}/test_compile` — compile and return output for preview (does not deploy)
- `GET /api/globals` — all global variables
- `PUT /api/config` — save HA connection settings
- `GET /api/clipboard` — current clipboard content or null
- `POST /api/clipboard` — save statement subtree to clipboard
- `DELETE /api/clipboard` — clear clipboard
- `WebSocket /ws` — live log updates, trace data, run status, deploy status events

The capability map (which operators are valid for which attribute types) lives in the frontend. Binary sensor friendly labels come from the device_class lookup table in WIZARD_SPEC.md — not from HA. The backend provides raw HA data. The frontend applies the map.

---

## WebSocket Protocol

The frontend connects to `ws://{host}/ws` on page load and maintains a persistent
connection. All real-time events flow through this single connection.

### Connection Lifecycle

- Connect on page load
- On disconnect: show "HA Disconnected" banner, attempt reconnect with exponential
  backoff (1s, 2s, 4s, 8s, max 60s)
- On reconnect: re-subscribe to any active piston run log, refresh piston index

### Message Format

All messages are JSON. Every message has a `type` field.

**Frontend → Backend:**
```json
{ "type": "subscribe_run", "piston_id": "a3f8c2d1" }
{ "type": "unsubscribe_run", "piston_id": "a3f8c2d1" }
{ "type": "ping" }
```

**Backend → Frontend:**
```json
{ "type": "pong" }
{ "type": "run_start", "piston_id": "a3f8c2d1", "run_id": "uuid", "timestamp": "..." }
{ "type": "run_log", "piston_id": "a3f8c2d1", "run_id": "uuid", "sequence": 1,
  "event_type": "trigger|condition|action|log|error", "statement_id": "stmt_001",
  "message": "...", "timestamp": "..." }
{ "type": "run_complete", "piston_id": "a3f8c2d1", "run_id": "uuid",
  "status": "success|error", "duration_ms": 142, "timestamp": "..." }
{ "type": "deploy_start", "piston_id": "a3f8c2d1" }
{ "type": "deploy_complete", "piston_id": "a3f8c2d1",
  "status": "success|error", "message": "..." }
{ "type": "entity_missing", "piston_id": "a3f8c2d1",
  "entity_ids": ["binary_sensor.front_door"], "role": "Front Door" }
{ "type": "piston_index_updated" }
{ "type": "ha_connected" }
{ "type": "ha_disconnected" }
```

### Frontend Behavior Per Message Type

| Message type | Frontend action |
|---|---|
| `run_start` | Show run indicator on piston list row and status page |
| `run_log` | Append to live log panel on status page if subscribed |
| `run_complete` | Update run indicator, show duration, refresh last run time |
| `deploy_start` | Show deploy spinner on piston list row and status page |
| `deploy_complete` | Hide spinner, show success/error, refresh piston index |
| `entity_missing` | Show ⚠ on piston list row, update entity_missing flag |
| `piston_index_updated` | Refresh piston list from piston_index.json |
| `ha_connected` | Hide "HA Disconnected" banner, enable deploy button |
| `ha_disconnected` | Show "HA Disconnected" banner, disable deploy button |

### Subscription Model

The frontend subscribes to run logs for a specific piston when the user is on that
piston's status page. On navigating away: unsubscribe. The backend only streams
`run_log` events for subscribed pistons — it never broadcasts all run events to all clients.

---

## Settings Page

The Settings page is accessible from the main nav. It is a simple form — no wizard,
no multi-step flow.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Settings                                           │
├─────────────────────────────────────────────────────┤
│  Home Assistant Connection                          │
│                                                     │
│  HA URL          [http://homeassistant.local:8123]  │
│  Long-lived token [●●●●●●●●●●●●●●●●●●●●] [Show]   │
│  [Test Connection]                                  │
│  Status: ● Connected — HA 2026.5                    │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Deployment                                         │
│                                                     │
│  Deployment type   ○ Docker  ○ HA Addon             │
│  Entity check interval  [30] minutes                │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Danger Zone                                        │
│                                                     │
│  [Backup All Pistons]  Downloads all pistons as zip │
│  [Clear Run Log]       Clears all run history       │
│                                                     │
├─────────────────────────────────────────────────────┤
│                              [Cancel]  [Save]       │
└─────────────────────────────────────────────────────┘
```

### Fields

**HA URL** — text input. Must start with `http://` or `https://`. Validated on save.

**Long-lived token** — password input. Shown masked. `[Show]` toggles visibility.
If unchanged on save (user didn't type in the field): do not overwrite the stored token.
Show `[●●●●●●●●]` as placeholder when a token is already stored.

**Test Connection** — fires `GET /api/config` with the current URL and token values
(not yet saved). Shows inline result: ✓ Connected — HA 2026.5 | ✗ Could not connect.

**Deployment type** — radio. Docker or HA Addon. Affects which features are shown
throughout the UI (PyScript indicator, token field visibility).

**Entity check interval** — number input, default 30. Minimum 5. Label: "minutes".
Stored in `config.json` as `entity_check_interval_minutes`.

**Backup All Pistons** — triggers `GET /api/pistons/backup` which returns a zip of
all piston JSON files. Browser downloads it. Filename: `pistoncore-backup-{date}.zip`.

**Clear Run Log** — confirmation dialog: *"This will delete all run history. Cannot be undone."* `[Cancel]` `[Clear]`. On confirm: `DELETE /api/logs`.

### Validation

- HA URL empty → show inline error, block save
- HA URL malformed → show inline error, block save
- Entity check interval < 5 → normalize to 5 on save with a note
- Token empty when no token was previously stored → show inline error, block save
- Token field unchanged (still showing ●●●● placeholder) → preserve existing token

### Addon Mode

When `deployment_type === "addon"`: hide the HA URL and Long-lived token fields entirely.
The supervisor token is automatic. Show instead: *"Running as HA Addon — connection is automatic."*

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

## Role Label Display Rules

Every condition, action, and for_each node has a `role` string (display label)
and an `entity_ids` array. The editor always renders from these fields.

### Generating the Role Label (Wizard Commit Time)

When the user commits a device selection in the wizard, the role string is
generated as follows:

- **Single device:** Use the device's friendly name. `role: "Front Door"`
- **Two devices:** Join with " and ". `role: "Front Door and Back Door"`
- **Three devices:** Join first two with ", " and last with " and ". `role: "Front Door, Back Door and Garage Door"`
- **Four or more:** First name + count of remaining. `role: "Front Door +3"`
- **Single global variable:** Use the global's display name with @ prefix. `role: "@Door_Contacts_Exterior"`
- **Mixed (physical + global):** Resolve all entity_ids from the global at commit time, merge into one flat array. Role label uses first device name + total count remaining. `role: "Front Door +4"`

The role label is generated once at commit time and stored. Never regenerated
from entity_ids at render time.

### Rendering the Role in the Editor

Role labels appear in curly braces in condition and action lines:

```
⚡ Any of {Front Door and Back Door}'s contact changes to Open
   with {Downstairs Lights}
     do Turn on;
   end with;
   for each ($device in {Smoke Detectors})
```

Global variable roles render with @ prefix inside the braces:
```
⚡ Any of {@Door_Contacts_Exterior}'s contact changes to Open
```

This visually distinguishes a global-sourced role from a manually picked
multi-device role. Same curly brace treatment, @ prefix is the signal.

---

## Aggregation Display Rules

Every device condition node has an `aggregation` field: `"any"` / `"all"` / `"none"`.

### Editor Rendering

| aggregation | Rendered prefix |
|---|---|
| `"any"` | `Any of {role}` |
| `"all"` | `All of {role}` |
| `"none"` | `None of {role}` |

Single-device nodes always show `Any of` regardless of aggregation value.
The aggregation bar in the wizard is always visible when more than one entity_id
is present. Hidden for single-entity nodes.

### Aggregation → Compiler → HA Output

| aggregation | Native HA trigger | Native HA condition | PyScript trigger |
|---|---|---|---|
| `"any"` | entity_id array (HA fires on any) | Jinja2 `any()` template | One string per entity OR'd |
| `"all"` | Template trigger (no native all-match) | Jinja2 `all()` template | All strings must match |
| `"none"` | Template trigger | Jinja2 `none()` template | None of strings match |

This table is authoritative. The compiler reads `aggregation` from the condition
node and uses this table to determine output strategy.

---

## Inline Validation Feedback

The editor shows lightweight pre-compile warnings inline on statement rows.
These are informational only — they never block editing or saving.

| Condition | Warning shown |
|---|---|
| Action or condition node has `entity_ids: []` | ⚠ "No device mapped — edit to assign" |
| for_each node has `entity_ids: []` | ⚠ "No devices in list — edit to assign" |
| Piston variable type `devices` has empty entity_ids | ⚠ "No devices assigned" |
| Condition node has no operator set | ⚠ "Incomplete condition" |

Warnings appear as a small ⚠ icon on the right side of the statement row.
Hovering shows tooltip text. Clicking the row opens the wizard to fix.

Warnings never block saving, never auto-fix, never appear for nodes with valid
entity_ids even if those entities are currently unavailable in HA.

Pre-compile warnings are distinct from compile errors (MISSING_ENTITY etc.)
which are returned by the backend after attempting compilation.

---

## Global Variable Visual Distinction

**In condition/action/for_each role labels:**
`{@Door_Contacts_Exterior}` — @ prefix inside curly braces.

**In the define block:**
```
define
  @MyLights        ← global variable reference — @ prefix, no = value
  myCounter = 0   ← local variable — name = value
end define;
```

Global variable references never show `= value`. The @ prefix is sufficient
visual distinction — no additional color treatment needed beyond the standard
keyword color.

---

## Corrupt or Invalid Piston Loading

The editor never crashes silently or shows a blank editor on bad input.

**logic_version higher than supported:**
Show full-editor banner: *"This piston was created with a newer version of
PistonCore. Update PistonCore to edit it."* Render read-only if possible.

**logic_version 1 (legacy format):**
Show banner: *"This piston uses the legacy format."*
`[Migrate]` `[Leave as-is]` — migration converts to logic_version 2 in place.

**Statement node missing required fields (no type, no id, corrupt children):**
Render placeholder row: `⚠ Unknown statement [stmt_id] — edit to repair`
Log error to console. Do not crash or skip rendering siblings.

**Empty statements array:** Valid. Render empty editor with "add a new statement" ghost prompt.

**entity_ids field absent from a node:** Treat as `[]`, show inline warning, log to console.

**entity_ids: []** is valid — means unassigned. Show inline warning per Inline Validation Feedback section above.

---

## What Is Not the Frontend's Responsibility

- Compiling piston JSON to native HA YAML — that is the backend
- Fetching data from HA directly — always go through the backend
- Storing piston data permanently — backend writes to volume
- Validating piston logic deeply — backend runs the validation pipeline
- Writing files to HA — backend + HA REST API handles that

The frontend's job is: render the tree, let the user edit it, send it to the backend on save.

---

## Copy / Paste / Duplicate Statements

**This is v1 scope.** WebCoRE had this and users depend on it for cross-piston
reuse. Full spec in MISSING_SPECS.md Item 26. Summary here for frontend developer:

### Clipboard Storage
Clipboard is stored server-side at `/pistoncore-userdata/clipboard.json`.
One slot. Persists across browser sessions, piston navigation, and container
restarts. Not localStorage — server-side only.

API endpoints:
- `GET /api/clipboard` — returns current clipboard content or null
- `POST /api/clipboard` — saves statement subtree
- `DELETE /api/clipboard` — clears clipboard

### Right-Click Context Menu
Right-clicking a selected statement shows:
```
Copy selected statement
Duplicate selected statement
Cut selected statement
Delete selected statement
─────────────────────────
Clear clipboard          ← only shown when clipboard has content
```

### Clipboard Preview Panel
When clipboard has content, a "From clipboard" section appears at the bottom
of the statement picker (see WebCoRE reference). Shows a read-only preview
of the clipboard statement with a **[Paste this statement]** button.

### UUID Regeneration on Paste
Every `id` field in the pasted subtree must be regenerated with a fresh UUID.
Use `deepCopyWithNewIds(node)` — walks the tree recursively, replaces every
`id` field. The same UUID must never appear twice in the same piston.

### Behavior Summary
- **Copy:** write subtree to clipboard.json. Clipboard persists.
- **Cut:** copy then delete from current piston.
- **Duplicate:** copy + paste as next sibling immediately. No clipboard write.
- **Paste:** deep-copy clipboard JSON, regenerate all UUIDs, insert after
  selected statement (or at end of block if nothing selected). Clipboard
  content remains — same statement can be pasted multiple times.

---

## Post-Implementation — Resolved Open Items

These items from earlier versions of this spec are now implemented:

- Vertical structure lines — implemented (Session 47)
- GlobalsDrawer panel — implemented (Sessions 48-50)
- Global variable management UI — implemented (Sessions 48-50)

---

## Open Items — Not Yet Defined

Do not implement these until they are decided:

1. **AI Prompt feature** — needs redesign before implementation. See DESIGN.md Section 31.
2. **Exact backend API signatures** — to be confirmed with backend developer.
3. **settings / end settings block contents** — do not implement until defined. See DESIGN.md Section 31.
4. **Which-interaction step feasibility** — evaluate PyScript context tracking in sandbox before building the wizard step. See DESIGN.md Section 31.
5. **Timer statement** — evaluate overlap with HA scheduler before including in v1. See DESIGN.md Section 29.
6. **Undo/Redo** — command pattern on piston JSON history stack. Not v1 scope — deferred.
7. **Copy/Paste/Duplicate subtrees** — See MISSING_SPECS.md Item 26. V1 SCOPE — spec before coding.
8. **Wizard draft state recovery** — browser refresh mid-edit behavior. Not v1 scope — deferred.
9. **Deep nesting performance** — virtual rendering strategy for 10+ levels. Not v1 scope — monitor.
10. **Keyboard navigation** — arrow keys, Enter to edit, Delete. Not v1 scope — deferred.
11. **Mobile/tablet responsiveness** — desktop-first in v1. Deferred.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
