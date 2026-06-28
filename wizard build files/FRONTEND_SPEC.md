# PistonCore Frontend Specification

**Version:** 1.9
**Status:** Authoritative — screen layouts, navigation, chrome, help system, AI prompt system

This document covers what the screens look like and how pages connect. It does NOT describe
what the editor renders or how the wizard behaves — those are in EDITOR_WIZARD_SPEC.md.

Read DESIGN.md first for background and philosophy.

**Guiding rule:** What matches WebCoRE is **what the user sees on screen and the wizard that
builds it** — the rendered piston as displayed (the statement tree, keyword styling,
indentation, how each statement reads on screen) and the statement-building flow (condition
builder, pickers, operand widget, step sequence). A WebCoRE user should recognize the rendered
piston and the building flow immediately. The match is at the glass — the visible output —
and says nothing about the JSON behind it: the render function reads PistonCore JSON
(PISTON_JSON_STRUCTURE_MAP.md) and draws WebCoRE-familiar text. The **page furniture around the code** —
piston-name field, header, button placement, save/deploy buttons, folder dropdown, surrounding
layout — is PistonCore's own and does not need to match WebCoRE. PistonCore's own areas
(dark-mode theme, font, the piston-list and status/debug/log screens, globals-from-the-top-bar)
are first-class choices, not deviations needing justification.

**Scope boundary:** If it lives on the editor canvas (action tree, ghost text, statement
rendering, wizard modal, device picker, condition builder) → EDITOR_WIZARD_SPEC.md. If it is
navigation, a screen layout, a button on a page header, an error message, a protocol
message, or a settings field → this document.

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
PISTON_JSON_STRUCTURE_MAP.md (statement type schemas) and EDITOR_WIZARD_SPEC.md (editor rendering rules). The same render functions produce the Snapshot preview on export —
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

PistonCore detects whether the pasted JSON is a Snapshot or Backup by checking whether any condition, action, or for_each node has a placeholder in `entity_ids` (any entry matching `__placeholder_*`):

- **Placeholders found** → Snapshot format. Proceed to import wizard.
- **All nodes have real entity_ids** → Backup format. Show ID-handling dialog, skip import wizard.

Format detection uses `entity_ids` content only. Do not use presence or absence of `role_tokens` as a detection signal.

### Import Wizard (Snapshot Import Only)

The full import wizard logic is defined in DESIGN.md §6.11. This section covers the screen layout only.

The wizard handles three separate mapping cases in sequence. Order of presentation within a case does not matter — all items in each list are presented before moving to the next case.

**Case A — Fill piston variables**

For each device-type variable (`var_type: "device"` or `"devices"`) whose `initial_value` is `["__fill_devices__"]`:

```
┌─────────────────────────────────────────────────────┐
│  Fill variable $Motion_Sensors          [✕ Skip]    │
├─────────────────────────────────────────────────────┤
│  Pick the devices for this variable.                │
│  Used in 3 places in this piston.                   │
│                                                     │
│  [Device picker — search and multi-select]          │
│  (soft-filtered by most common attribute;           │
│   full list always accessible)                      │
│                                                     │
│            [Skip]        [← Back]  [Next →]         │
└─────────────────────────────────────────────────────┘
```

**Case B — Match global references**

For each unique `@name` found in `role_tokens` across all nodes:

```
┌─────────────────────────────────────────────────────┐
│  Match global @Speakers_All             [✕ Skip]    │
├─────────────────────────────────────────────────────┤
│  This piston uses @Speakers_All.                    │
│  Match it to one of your globals:                   │
│                                                     │
│  [@my_speakers                          ▼]          │
│  (all your globals — no type filtering)             │
│                                                     │
│  + Create new global "@Speakers_All"                │
│                                                     │
│            [Skip]        [← Back]  [Next →]         │
└─────────────────────────────────────────────────────┘
```

**Case C — Map direct device nodes**

For each unique `role` where the node used a direct physical device pick (no variable or global in `role_tokens`):

```
┌─────────────────────────────────────────────────────┐
│  Map devices — "Front Door"             [✕ Skip]    │
├─────────────────────────────────────────────────────┤
│  Used as: trigger (changes to Open)                 │
│  Device type: binary_sensor                         │
│                                                     │
│  [Device picker — filtered to binary_sensor]        │
│  Selected: [front door ×]                           │
│                                                     │
│            [Skip]        [← Back]  [Next →]         │
└─────────────────────────────────────────────────────┘
```

After all cases:

```
┌─────────────────────────────────────────────────────┐
│  Ready to import                                    │
├─────────────────────────────────────────────────────┤
│  ✓ $Motion_Sensors — 2 devices selected             │
│  ✓ @Speakers_All → matched to @my_speakers          │
│  ✓ Front Door — mapped                              │
│  ⚠ Back Door — skipped (fix later in editor)        │
│                                                     │
│                         [← Back]  [Import]          │
└─────────────────────────────────────────────────────┘
```

- **Skip** on any step — that item imports with placeholder still in place. Editor shows ⚠ on affected nodes.
- **Back** — returns to the previous step within the wizard.
- **Import** — available only after every item has been acted on (mapped or explicitly skipped).

New UUID assigned on import. `created_at` and `modified_at` set to now. Piston opens in editor after import completes.

**There is no piston_text parser.** `piston_text` is not a v1 format. Any reference to piston_text parsing in this codebase is from an earlier design and must be removed.

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

Navigation flows (single-page app — JS shows/hides sections, no URL changes):

**Existing piston:** `List → Status Page → Editor → Status Page`

**New piston:** `List → Editor (directly, skipping Status Page) → Status Page` (on save) or `List` (on discard)

1. **Piston List** — the home screen
2. **Piston Status Page** — the hub for a specific piston. This is where save results are shown (validation banner), compile output is shown (Test Compile), and HA tests are run (Test — Live Fire). Every save from the editor returns here. Opening an existing piston always lands here first.
3. **Piston Editor** — where the piston is built

There is no fourth page. The wizard is a modal that opens on top of the editor.

---

## Page 1 — Piston List

### Layout

Single scrolling list. **Not a two-column layout.** Folder names appear as inline section headers
with a piston count. There is no folder sidebar column.

```
┌─────────────────────────────────────────────────────┐
│  PistonCore   [Global Variables] [? Help]  [+ New]  │
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
│             [+ New Folder] [Browse Library] [Import]│
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

A `[Global Variables]` button is present in the header area. Clicking it opens the globals drawer panel.

### Buttons

- `[+ New]` — creates a new blank piston and opens the editor directly (skips Status Page — nothing to show there yet). Lands in Uncategorized.
- `[+ New Folder]` — opens inline text input at the bottom of the list
- `[Import]` — opens import dialog (paste JSON, paste URL, or upload .piston file)
- `[Copy AI Prompt]` — copies the write_a_piston prompt to the clipboard (see AI Prompt below). Button changes to `[Copied ✓]` for 2 seconds.
- `[? Help]` — opens the Help modal (see Help System below). **Not yet built.**
- `[Browse Library]` — opens the Built-in Library modal (see Built-in Piston Library below). **Not yet built.**

### AI Prompt — Copy a Piston-Writing Prompt

PistonCore provides an AI prompt the user can copy and paste into any AI assistant
(ChatGPT, Claude, Gemini, etc.) to generate a piston from a plain-English description.
The AI returns importable JSON with role placeholders and empty entity_ids; the user
loads it through the Import dialog, and the role-mapping picker binds real devices. **The
AI never generates device data** — the picker is the authoritative source for entity_ids,
not an AI.

**The presentation mechanism is not yet designed.** The current build surfaces this as a
`[Copy AI Prompt]` button in the piston-list header (one-click copy, button changes to
`[Copied ✓]` for 2 seconds). Whether the final design is a one-click copy, a modal with a
read-only prompt area, or something else is **an open design decision — do not treat the
current button as the locked design.**

**What is decided (stable regardless of presentation):**
- Prompt content is fetched from `GET /api/prompts/write_a_piston` — backend serves the
  file content; where it is stored is a backend implementation detail.
- The copied/displayed prompt text is read-only — the user never edits it in PistonCore.
- On copy success: confirmation feedback (e.g. `[Copied ✓]`) for ~2 seconds.
- On fetch failure: *"Prompt unavailable — check your connection and try again."*

**Future prompt options** (not v1 scope): additional prompts beyond write_a_piston are
anticipated (see HELP_AND_DEVIATIONS_PROTO.md — the `→ AI PROMPT` entries seed these).
How multiple prompts are presented (tabs, dropdown, list) is **part of the same
undesigned mechanism above** — do not build a multi-prompt structure until both a second
prompt exists and the presentation is designed.

---

## Help System

PistonCore help content is served from backend-managed markdown files. The frontend fetches and renders them wherever help is needed. To update any help content — correct a description, add a newly-discovered PyScript requirement, note that HA now handles something natively — edit a markdown file and redeploy. No code change, no frontend update required.

### Help and Prompt Files

All help and prompt files are backend-managed. Where they are stored on disk is a backend implementation detail — not specced here. The frontend only cares about the API endpoints.

**Help files served via `GET /api/help/{filename}`:**
- `overview` — what PistonCore is, how it relates to WebCoRE and HA
- `getting_started` — building a first piston; the AI-assisted path
- `statements` — what each statement type does in plain English
- `conditions` — operators, triggers vs conditions, was vs stays
- `variables` — piston variables vs globals, how they work
- `pyscript` — what PyScript is, why some pistons need it, how to install via HACS, which features require it, how to update the routing table
- `compiler` — what compile means, native vs PyScript, reading the debug screen
- `template_customization` — where the compiler templates live, how to edit them, that an AI-UPDATE-GUIDE.md file lives next to the templates to help with edits
- `troubleshooting` — common problems and fixes

**Prompt file served via `GET /api/prompts/{filename}`:**
- `write_a_piston` — the AI prompt for generating automation logic as importable JSON with role placeholders and empty entity_ids

**These files ship with default content** that can be updated without a coding session. Where they live is up to the backend implementation.

### Help API Endpoints

```
GET /api/help/{filename}     — returns markdown content for the named help file
GET /api/prompts/{filename}  — returns markdown content for the named prompt file
```

Both return file content as plain text. The frontend renders it as HTML. If the file does not exist, returns 404 and the frontend shows: *"Content unavailable."*

### Help Button — Piston List

A `[? Help]` button appears in the piston list header alongside `[+ New]`. Clicking it opens the Help modal.

### Help Modal

```
┌─────────────────────────────────────────────────────┐
│  PistonCore Help                               [✕]  │
├─────────────────────────────────────────────────────┤
│  [Overview] [Getting Started] [Statements]          │
│  [Conditions] [Variables] [PyScript] [Compiler]     │
│  [Templates] [Troubleshooting]                      │
├─────────────────────────────────────────────────────┤
│  [rendered markdown content — scrollable]           │
│                                                     │
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- Opens centered with a backdrop
- Tab bar at the top — one tab per help file
- Selected tab fetches its markdown file and renders it
- Default tab on open: Overview
- `[✕]` closes the modal
- If a fetch fails: show *"Help content unavailable — check your connection."*
- Markdown is rendered as standard HTML (headings, paragraphs, lists, code blocks, bold, italic)

### AI Prompt in the Getting-Started Path

The AI prompt (see AI Prompt — Copy a Piston-Writing Prompt above) is the entry point for
users who find the editor intimidating. The `getting_started.md` help file walks the full
AI-assisted path: copy the AI prompt → paste into any AI → import the returned JSON → map
devices with the picker → done. This gives a complete working path that never requires the
user to build a piston by hand.

### Help Links from the Debug/Compile Panel

The Test Compile panel on the status page includes a `[? Help]` link at the top right. This opens the Help modal directly to the `compiler.md` tab.

When the PyScript notice is shown (see below), it includes an inline link: *"[Learn more about PyScript →]"* that opens the Help modal directly to the `pyscript.md` tab.

### PyScript Notice on Debug/Compile Panel

When `compile_target` is `"pyscript"` on the saved piston, the Test Compile panel shows a prominent notice **above** the compiled output:

```
┌─────────────────────────────────────────────────────┐
│  ⚠  This piston requires PyScript                   │
│  It will be deployed as a Python file, not a native │
│  HA automation. PyScript must be installed via HACS │
│  before deploying.                                  │
│  [Learn more about PyScript →]                      │
└─────────────────────────────────────────────────────┘
```

- This notice is set by the backend on save — the frontend reads `compile_target` off the piston wrapper and shows the notice if it is `"pyscript"`
- The frontend does NOT determine what forces PyScript — that is the backend's job
- On Docker: always shown when `compile_target` is `"pyscript"`
- On Addon v2+: suppressed (native runtime replaces PyScript)
- The `[Learn more about PyScript →]` link opens the Help modal to the `pyscript.md` tab

---

## Built-in Piston Library

PistonCore ships with a curated set of tested, ready-to-use pistons. These are stored in the backend (read-only, inside the container) and are not editable by the user. Importing one copies it into the user's piston storage with a fresh ID.

The library is the primary way to give new users immediate value. The goal is to ship 20–50 tested pistons covering common HA use cases: lighting, security, routines, notifications, climate, presence, etc. These come from Jeremy's own working piston library — tested in production before inclusion.

### Library API Endpoint

```
GET /api/library
```

Returns a list of library entries with metadata — name, description, category, and the piston JSON. The frontend renders the list and handles import. Where the backend stores the library files is a backend implementation detail.

```
POST /api/library/{id}/import
```

Copies the named library piston into user storage with a fresh UUID. Returns the new piston object. The imported piston lands in the user's piston list immediately, same as any other import.

### Browse Library — Piston List

A `[Browse Library]` button appears in the piston list header alongside `[+ New]` and `[? Help]`. Clicking it opens the Library modal.

### Library Modal

```
┌─────────────────────────────────────────────────────┐
│  Built-in Library                              [✕]  │
├─────────────────────────────────────────────────────┤
│  [Lighting] [Security] [Routines] [Notifications]   │
│  [Climate] [Presence] [Holiday] [All]               │
├─────────────────────────────────────────────────────┤
│  Driveway Lights at Sunset          [Import]        │
│  Turns on driveway lights at sunset,                │
│  off at midnight.                                   │
│  ─────────────────────────────────────────────────  │
│  Motion Light with Timeout          [Import]        │
│  Lights on when motion detected,                    │
│  off after N minutes of no motion.                  │
│  ─────────────────────────────────────────────────  │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

- Category tabs filter the list
- Each entry shows name and short description
- `[Import]` copies the piston into user storage and closes the modal
- After import the piston appears in the user's list immediately
- Import goes through the standard role-mapping dialog — the user maps their real devices before the piston is saved
- If the library fetch fails: show *"Library unavailable — check your connection."*

### Library Piston Format

Library pistons are Snapshot-format JSON — `entity_ids` contain role placeholders, `role` and `role_tokens` are intact, `variables` (defines) are preserved. This means the role-mapping dialog fires on import and the user maps their real devices through the picker before the piston is saved. The AI never generates these — they are Jeremy's own tested pistons exported as Snapshots.

---

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
│  only when                                          │
│  [restriction statements]                           │
│  + add a new restriction                            │
├─────────────────────────────────────────────────────┤
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

**Compile target** is not shown in the editor. It is a compiler-owned value set automatically on every save and is shown only on the Test Compile / debug page. The editor shows a PyScript notification only when a statement forces PyScript (see PyScript Requirement Indicator below).

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

What each mode shows and hides is specified in **EDITOR_WIZARD_SPEC.md** (Simple vs Complex Mode section). Switching modes never destroys data.

### PyScript Requirement Indicator

If the current piston requires PyScript (`compile_target` is `"pyscript"` on the saved piston wrapper) and PyScript is not detected in HA:

- Show a subtle warning below the compile target indicator
- Text: *"PyScript required — install via HACS before deploying. [Learn more →]"*
- The `[Learn more →]` link opens the Help modal to the `pyscript.md` tab
- `compile_target` is set by the **backend on save** — the editor reads it from the returned piston, it does not determine routing itself
- On Docker: always shown when `compile_target` is `"pyscript"` until PyScript is confirmed installed
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

- **Save** — saves and navigates to the status page
- **Discard (existing piston)** — discards changes and returns to the status page
- **Discard (new piston, never saved)** — discards the blank piston entirely and returns to the piston list; no piston record is kept
- **Cancel** — closes the prompt and stays in the editor

### WebSocket Drop While in Editor

If the WebSocket connection to HA drops:
- Show a reconnecting banner at the top of the editor
- Disable the Deploy to HA button
- Disable wizard capability fetching (wizard can still open but shows an error state)
- Preserve all unsaved work in local browser storage
- When connection restores: remove banner, re-enable everything

---

## Editor and Wizard — See EDITOR_WIZARD_SPEC.md

All editor rendering behavior (action tree visual rules, keyword highlighting, ghost text,
simple/advanced mode, right-click context menu, drag to reorder, with-block/task rendering,
define block display rules, role label display, aggregation display, inline validation
warnings, global variable visual distinction) and all wizard modal behavior (modal lifecycle,
device picker, condition builder, operator order, aggregation selector, wizard JavaScript
architecture, shared state) are specified in **EDITOR_WIZARD_SPEC.md**.

This document covers screen layouts and chrome only. Anything the editor canvas renders
belongs in EDITOR_WIZARD_SPEC.md, not here.

---

## Capability Data — What Comes from the Backend

The frontend never calls HA directly. All HA data comes from the FastAPI backend.

Backend endpoints the frontend uses:

- `GET /api/config` — deployment type, ha_url, connection status
- `GET /api/help/{filename}` — markdown help content (overview, getting_started, statements, conditions, variables, pyscript, compiler, template_customization, troubleshooting)
- `GET /api/prompts/{filename}` — markdown prompt content (write_a_piston)
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

The capability map (which operators are valid for which attribute types) lives in the frontend. Binary sensor friendly labels come from the device_class lookup table in EDITOR_WIZARD_SPEC.md — not from HA. The backend provides raw HA data. The frontend applies the map.

---

## Visual Style Notes

The editor's visual language is PistonCore's own dark-mode theme — not a WebCoRE
reproduction. What is borrowed from WebCoRE is the *structural* presentation of the
action tree (keyword highlighting, indentation, statement numbering) so the document reads
the way WebCoRE users expect; the colors, theme, and font are PistonCore's choices.

- Dark background editor area (PistonCore's theme)
- Keywords in a distinct highlight color — PistonCore's palette (teal-family works well)
- Folder section headers in the keyword color
- Ghost text in a muted/gray color — clearly secondary
- Indentation uses consistent spacing (suggest 2rem per level)
- Curly braces `{` and `}` styled the same as keywords
- Statement numbers visible on the left side of the action tree
- Selected statement has a visible highlight/border
- Cut statement is visually dimmed (50% opacity or similar)
- `and` and `or` between conditions rendered at same indent as conditions

---

## Editor Rendering Rules — See EDITOR_WIZARD_SPEC.md

Role label generation, role rendering in curly braces, aggregation display (Any of / All of / None of), aggregation→compiler→HA output table, inline validation feedback (⚠ warnings on statement rows), and global variable visual distinction (@prefix in labels) are all specified in **EDITOR_WIZARD_SPEC.md**.

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
Clipboard is stored server-side (backend implementation detail — not specced here).
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

## Error States Inventory

Every error the backend can return and how the frontend must display it. This is the
authoritative list for v1. Errors not in this list are not handled until they are added.

**Display rule:** Error messages are always plain English. No stack traces. No HTTP status
codes. No internal error codes visible to users. Internal codes are logged to browser
console for debugging only.

---

### Connection Errors

**HA completely unreachable on startup**
- Show persistent full-width banner at top of piston list: *"Home Assistant is not connected. Wizard and deploy are unavailable."*
- Piston list is readable (reads from local index). Wizard is disabled. Deploy is disabled.
- `[Retry Connection]` button in banner. Retrying triggers the startup Step 1 sequence again.
- Banner persists until connection succeeds. No auto-retry without user action in v1.

**HA WebSocket drops while on piston list**
- Replace any existing HA connection indicator with: *"⚠ HA disconnected"* in the header
- Show banner: *"HA disconnected — wizard and deploy are unavailable."*
- Piston list remains readable. All piston rows remain visible.
- `[Reconnect]` button in banner. Reconnect triggers exponential backoff (1s, 2s, 4s, 8s, max 60s).
- Banner clears automatically on successful reconnect.

**HA WebSocket drops while in editor**
- Show reconnecting banner at top of editor: *"⚠ HA disconnected — reconnecting..."*
- Deploy to HA button: disabled with tooltip: *"Deploy unavailable — HA disconnected"*
- Wizard can still open but capability fetch will fail (see wizard error below)
- All unsaved work preserved — do not clear or lose piston state
- Banner clears automatically on reconnect. Deploy re-enables. Wizard re-enables.

**HA WebSocket drops while wizard is open**
- If the wizard was mid-step and waiting on a capability fetch: show error inline in wizard: *"Couldn't load device options — HA disconnected. [Retry]"*
- If the wizard had already loaded its data: leave it open. The loaded data is stale but usable.
- The user can complete the wizard with stale data and save. Deploy will be blocked until HA reconnects.

**HA WebSocket drops during deploy**
- Show error in deploy status area: *"Deploy interrupted — HA connection was lost mid-deploy."*
- State is unknown: the file may or may not have been written. HA may or may not have reloaded.
- Show: *"Check Home Assistant logs before retrying. The piston may be in an inconsistent state."*
- `[Retry Deploy]` available. User should verify in HA before retrying.

**Token invalid or expired (Docker only)**
- Deploy attempt returns 401 from HA. Show error banner: *"HA rejected the long-lived token. Check your token in Settings and try again."*
- Link to Settings page inline in the banner.
- This never occurs in addon mode (supervisor token is automatic).

**HA version below minimum (2023.1)**
- Detected at startup. Show banner: *"PistonCore requires Home Assistant 2023.1 or later. Update HA to use PistonCore."*
- Piston list visible but wizard and deploy are disabled.
- No retry — this is a configuration error, not a connection error.

---

### Save / Deploy Errors

**Volume write failure (disk full, permissions)**
- Save attempt fails at the backend file-write step.
- Editor stays open. Show error banner: *"Save failed — couldn't write to storage. Check disk space and file permissions. Your work is preserved."*
- `[Try Again]` retries the save immediately.
- The piston JSON the user was editing is preserved in browser state — not lost.

**Compile error (invalid piston structure)**
- Returned from backend during deploy (Stage 3). Shows in compile status indicator: `Error ✗`
- Clicking the error indicator opens the Test Compile view with the error details.
- Error text is always plain English — never raw Python exceptions or YAML error strings.
- Example: *"Missing device — 'Front Door' has no devices assigned. Edit the statement to fix it."*
- Deploy button is disabled until the compile error is resolved.

**MISSING_ENTITY compiler error**
- A specific compile error type (entity_id no longer exists in HA).
- Show clearly: *"Device not found in Home Assistant — 'binary_sensor.front_door' (role: Front Door) no longer exists. Edit the statement and pick a new device."*
- The piston can still be saved. Only deploy is blocked.

**yamllint failure on compiled output**
- Returned from backend during deploy (Stage 4). This is a PistonCore bug, not a user error.
- Show: *"Compiled output failed syntax check. This is a PistonCore issue — please report it."*
- Include a `[Copy error details]` button that copies the raw yamllint output to clipboard (for bug reports).
- Do not show raw YAML to the user.

**HA reload failure after successful file write**
- File was written to HA but the `automation/reload` or `script/reload` call failed.
- Show: *"Automation deployed but HA didn't reload automatically. Reload automations in Home Assistant to activate it."*
- This is a non-critical error — the file is correct and the automation will work after a manual HA reload.
- `[Open HA Developer Tools]` — deep link to HA developer tools if deployment type allows it.

**File hash mismatch on deploy (manual edit detected)**
- Detected in Stage 4 / Section 13 hash check.
- Show confirmation dialog before overwriting: *"This piston's compiled file was edited manually since the last PistonCore deploy. PistonCore will overwrite the manual changes. Continue?"*
- `[Overwrite]` `[Cancel]`
- If user chooses Overwrite: deploy proceeds, hash is updated, `manually_edited` flag cleared.
- If Cancel: deploy aborted, piston remains in `manually_edited` state.

**PyScript not installed when complex piston deploy attempted**
- Show: *"This piston requires PyScript, which isn't detected in Home Assistant. Install PyScript via HACS, then try again."*
- `[Learn how to install PyScript]` — opens PyScript HACS docs in new tab.
- The piston JSON is saved. Only deploy is blocked.

---

### Piston List Errors

**Piston file corrupt or unreadable**
- Shown as a row in the list: `⚠ [filename] — could not be read`
- No clickable link — there is nothing to navigate to.
- Tooltip: *"This piston file is damaged or unreadable. Check the file at [path] on your volume."*
- All other pistons continue loading normally.

**Entity missing (single or partial)**
- Piston row shows: ⚠ icon, piston name, status indicator shows `—`
- Tooltip: *"One or more devices used by this piston no longer exist in Home Assistant."*
- Clicking the row navigates to the status page where the specific missing entity is named.
- The piston is still running in HA — it was compiled against the old entity. PistonCore flags it but does not touch the running automation.

**Piston with future logic_version or ui_version**
- Shown as a row: `⚠ [Piston name] — created with a newer version of PistonCore`
- Clicking navigates to the status page which shows a read-only banner: *"This piston was created with a newer version of PistonCore. Update PistonCore to edit it."*

---

### Import Errors

**Invalid JSON pasted**
- Inline in the import dialog: *"That doesn't look like valid JSON. Check for missing brackets or quotes."*
- The paste field stays open. The user can fix and retry.

**Valid JSON but wrong format (not a piston)**
- Inline: *"This JSON doesn't look like a PistonCore piston. Make sure you copied the full piston JSON."*

**logic_version or ui_version from the future**
- Inline: *"This piston requires a newer version of PistonCore. Update PistonCore to import it."*
- Import is blocked.

**URL fetch failed**
- Inline: *"Couldn't fetch that URL. Check the URL and try again."* If the response was non-2xx: *"The URL returned an error ([status code])."*

**URL returns non-JSON content**
- Inline: *"That URL didn't return a piston file. Make sure it's a direct link to a .json or .piston file."*

---

### Global Redeploy Errors (during Redeploy All)

**Individual piston compile error during batch redeploy**
- Show ✗ in the progress modal row: `✗ [Piston name] — compile error: [short message]`
- Continue with remaining pistons — one failure does not stop the batch.

**HA disconnected mid-batch**
- Stop the queue. Show row: `⚠ HA connection lost — redeploy stopped`
- Show `[Retry when reconnected]` (enabled after reconnect) and `[Done]`.

---

## Piston List — Row States

Every piston row in the piston list has a state driven by the `piston_index.json` entry.
Multiple state flags can coexist — the row shows the highest-priority indicator.

Priority order (highest first): `orphaned` > `entity_missing` > `manually_edited` > `compile_error` > `disabled` > `never_deployed` > `healthy`

### State Definitions and Display

**healthy — deployed and running normally**
- Indicator: `●` (green dot)
- Status column: `✅` (last run succeeded) or `❌` (last run had a runtime error)
- Timestamp column: last run time
- No tooltip beyond what the piston name conveys

**never_deployed — saved to PistonCore but never deployed to HA**
- Indicator: `○` (gray dot)
- Status column: `—`
- Timestamp column: `Never`
- Tooltip: *"Not yet deployed to Home Assistant"*
- The piston exists in PistonCore storage but has no compiled output in HA.

**disabled — piston is paused by the user**
- Indicator: `○` (gray dot)
- Name shown in muted color
- Status column: `—`
- Timestamp column: `Never` or last run time if it was previously enabled
- Appended to name in muted text: `(disabled)`

**entity_missing — one or more entity_ids no longer exist in HA**
- Indicator: `⚠` (amber/orange)
- Tooltip: *"One or more devices used by this piston no longer exist in Home Assistant."*
- Status page shows which specific entity is missing and its last known role label.
- The piston keeps running in HA — only the PistonCore record is flagged.

**manually_edited — compiled file was hand-edited after last PistonCore deploy**
- Indicator: `⚠` (amber/orange)
- Tooltip: *"This piston's compiled file was edited manually. PistonCore will overwrite it on next deploy."*
- Informational only — does not block anything.

**compile_error — last compile attempt failed**
- Indicator: `✗` (red)
- Status column: `✗`
- Tooltip: *"Last compile failed — open to see the error."*
- Clicking navigates to status page where the error is shown.

**orphaned — compiled file exists in HA but no matching piston in PistonCore**
- Indicator: `⚠` (amber/orange) or distinct "orphan" badge
- Row shows: `⚠ Orphaned automation — [filename]`
- Not a normal piston row — no edit, no deploy. Only options: `[Delete from HA]` with confirmation.
- Tooltip: *"A PistonCore automation was found in Home Assistant but its piston is no longer in PistonCore. It may still be running."*

**currently_running — piston is actively executing in HA (live run in progress)**
- Shown via a real-time WebSocket update
- Indicator: animated spinner `↻` alongside the normal `●`
- This state overlays the existing state — a healthy piston that is currently running shows both `●` and `↻`
- Clears when `PISTONCORE_RUN_COMPLETE` is received

### Multiple State Flags

When multiple flags are set, apply priority order and show only the highest-priority indicator.
Tooltip for a multi-flag piston shows all flags: *"Device list outdated, and compiled file was manually edited."*

---

## Status Page — Full Layout

This section is the authoritative spec for Page 2. The existing layout mockup above is
supplemented here with the complete behavior for every section and button state.

### Header Area

```
┌─────────────────────────────────────────────────────┐
│  ← My Pistons                                       │
│  Driveway Lights at Sunset            [● Enabled ▼] │
│  Folder: [Outdoor Lighting ▼]                       │
└─────────────────────────────────────────────────────┘
```

- `← My Pistons` — returns to piston list
- Piston name is read-only here — click `[✎ Edit]` to change it
- `[● Enabled ▼]` — dropdown toggle: Enabled / Disabled. Changing disables the compiled HA automation immediately via HA REST API (no redeploy required). If HA is disconnected, shows tooltip: *"Can't change — HA disconnected."*
- Folder dropdown — changes the piston's folder immediately (no redeploy required)

### State Banners (appear automatically, not user-triggered)

Banners appear directly below the header. Multiple banners stack vertically.
Each banner has an `[✕]` to dismiss for the current session (they reappear on next page load).

**Unsaved changes banner** (when piston JSON differs from last deploy):
*"Unsaved changes — deploy to update Home Assistant."*

**Manually edited banner**:
*"⚠ This piston's compiled file was edited manually. PistonCore will overwrite it on next deploy."*

**Entity missing banner**:
*"⚠ 'binary_sensor.front_door' (role: Front Door) no longer exists in Home Assistant. Edit to fix."* `[✎ Edit]`

**Never deployed banner**:
*"This piston has not been deployed to Home Assistant yet."* `[🚀 Deploy to HA]`

**Compile error banner**:
*"⚠ Last compile failed — see details below."*

### Action Buttons

All buttons on the status page use icon + plain English label. Never icon alone.

| Button | Always shown | Disabled when | Disabled tooltip |
|---|---|---|---|
| `[✎ Edit]` | Yes | Never | — |
| `[▶ Test — Live Fire ⚠]` | Yes | HA disconnected, or piston never deployed | "Deploy first" or "HA disconnected" |
| `[Test Compile]` | Yes | Never | — |
| `[📷 Snapshot]` | Yes | Never | — |
| `[📷 Backup]` | Yes | Never | — |
| `[⧉ Duplicate]` | Yes | Never | — |
| `[🗑 Delete]` | Yes | Never | — |
| `[🚀 Deploy to HA]` | Yes | HA disconnected | "HA disconnected" |
| `[Trace: OFF/ON]` | Yes | Never | — |
| `[⚠ Notify: OFF/ON]` | Yes | Never | — |

**Deploy to HA button states:**

| Piston state | Button appearance |
|---|---|
| No changes since last deploy, HA connected | `[🚀 Deploy to HA]` — normal |
| Unsaved changes (piston differs from last deploy) | `[🚀 Deploy to HA]` — highlighted (amber outline or accent color) |
| Currently compiling (debounce in progress) | `[🚀 Deploy to HA — Compiling...]` — disabled |
| Last compile had errors | `[🚀 Deploy to HA]` — disabled, tooltip: *"Fix compile errors before deploying"* |
| HA disconnected | `[🚀 Deploy to HA]` — disabled, tooltip: *"HA disconnected"* |
| Deploy in progress | `[🚀 Deploying...]` — disabled, spinner |
| Deploy succeeded | Returns to normal state. Brief success indicator (1.5 seconds): `[✓ Deployed]` |
| Deploy failed | `[🚀 Deploy to HA]` — re-enabled. Error shown in banner. |

### Test Compile Panel

`[Test Compile]` opens an inline panel **below the action buttons** (does not navigate away).
The panel is read-only and collapsible.

```
┌─────────────────────────────────────────────────────┐
│  Compiled Output — Native HA Script    [? Help] [✕] │
├─────────────────────────────────────────────────────┤
│  automation.yaml                                    │
│  ──────────────────────────────────────────────     │
│  [yaml content — read-only, syntax highlighted]     │
│                                                     │
│  pistoncore_driveway_lights_at_sunset.yaml          │
│  ──────────────────────────────────────────────     │
│  [yaml content — read-only, syntax highlighted]     │
└─────────────────────────────────────────────────────┘
```

- `[? Help]` in the panel header opens the Help modal to the `compiler.md` tab
- When `compile_target` is `"pyscript"`: a prominent PyScript notice appears **above** the compiled output — see Help System section above for full spec
- Compile errors appear **above** the compiled output (and above the PyScript notice if present) in a red box
- Warnings appear in an amber box below the compiled output
- Panel closes when `[✕]` is clicked or `[Test Compile]` is clicked again (toggle)
- The compiled output shown here is always freshly compiled on button click — not cached

### Test — Live Fire Flow

1. User clicks `[▶ Test — Live Fire ⚠]`
2. Confirmation dialog: *"This will execute real actions on your devices. Are you sure?"* `[Yes, run it]` `[Cancel]`
3. If Yes: fires the piston immediately via the HA `script.turn_on` service call (or PyScript equivalent)
4. Log panel below updates in real time via WebSocket

**Test button is only enabled after at least one successful deploy.**
Before first deploy: button shows tooltip *"Deploy the piston to HA before testing."*

### Piston Script Panel

Shows the piston in PistonCore's visual format — same rendering as the editor, read-only.
Statement numbers appear on the left (1, 2, 3...).

```
┌─────────────────────────────────────────────────────┐
│  PISTON SCRIPT                    [⟨⟩ Expand]       │
├─────────────────────────────────────────────────────┤
│  execute                                            │
│  1   with {Driveway Main Light}                     │
│  2     do Turn on;                                  │
│  3   end with;                                      │
│  end execute;                                       │
└─────────────────────────────────────────────────────┘
```

- Clicking anywhere in the panel opens the editor
- `[⟨⟩ Expand]` opens a full-screen read-only view of the piston script (useful for long pistons)
- Keywords styled the same as in the editor
- `then` and `end if;` are used here (not `when true / when false` — those are editor-only)
- No edit controls visible — it's read-only. All editing is through `[✎ Edit]`.

### Log Panel

```
┌─────────────────────────────────────────────────────┐
│  LOG                          [Full ▼]  [Clear Log] │
├─────────────────────────────────────────────────────┤
│  ▼ 08:46:25 — Triggered ✓ 1.2s                      │
│    08:46:25 — Triggered by: sun.next_setting        │
│    08:46:25 — Condition: Time is between... ✓       │
│    08:46:26 — Action: Driveway Light → turn on ✓    │
│    08:46:26 — Complete                              │
│                                                     │
│  ▶ 07:30:00 — Triggered ✓ 0.8s  (collapsed)        │
│  ▶ 06:55:00 — Triggered ✓ 0.9s  (collapsed)        │
└─────────────────────────────────────────────────────┘
```

- Most recent run at the top, expanded by default
- Earlier runs collapsed — click row header to expand
- Log level selector: `[Full ▼]` dropdown — Full / Minimal / None
  - Full: every statement logged
  - Minimal: trigger + final status only
  - None: no log entries (piston still runs — just not logged)
- `[Clear Log]` — prompts *"Clear all log entries?"* `[Clear]` `[Cancel]`
- Log entries arrive in real time via WebSocket `PISTONCORE_LOG` events
- If WebSocket drops: existing entries remain visible, new entries stop arriving
  - Show note at top of log panel: *"⚠ Log paused — HA disconnected"*
  - When reconnected: resume streaming new entries (may have gaps for the disconnected period)

**Stale run detection:**
If `PISTONCORE_RUN_COMPLETE` is not received within 5 minutes of a `PISTONCORE_LOG` trigger event:
- Update the run entry header: *"Status unknown — piston may still be running or was interrupted. Check Home Assistant logs."*
- Never show "Running..." indefinitely.
- `[Check HA]` deep link to HA developer tools.

**Status unknown (WebSocket drop, missed event):** Always show *"Status unknown"* — never infer a wrong status.

### Variables Panel

Shows piston variable state from the last run. Only visible if the piston has variables.

```
┌─────────────────────────────────────────────────────┐
│  VARIABLES (from last run)                          │
├─────────────────────────────────────────────────────┤
│  $count        12                                   │
│  $message      "3 devices reporting low battery"    │
└─────────────────────────────────────────────────────┘
```

If no variables are defined: this panel is hidden entirely.
Variable values are received via WebSocket `PISTONCORE_RUN_COMPLETE` event payload.

### Quick Facts Panel

```
┌─────────────────────────────────────────────────────┐
│  QUICK FACTS                                        │
│  Compile target: Native HA Script                   │
│  Last ran: 08:46:25 today                           │
│  Next scheduled: sunset today                       │
│  Devices used: Driveway Main Light                  │
└─────────────────────────────────────────────────────┘
```

- **Compile target:** shows current target (Native HA Script / PyScript). If PyScript is required and not detected: shows *"PyScript — not detected ⚠"* in amber.
- **Last ran:** human-readable — *"08:46:25 today"*, *"Yesterday at 14:22"*, *"May 20 at 09:11"*. Shows *"Never"* if no runs.
- **Next scheduled:** only shown for pistons with time triggers. Shows *"No scheduled trigger"* if event-only.
- **Devices used:** friendly names of all devices referenced in the piston (from entity_state_cache).

---

## WebSocket Protocol — Backend-to-Frontend Messages

The frontend connects to `ws://[host]/ws` (using `BASE_URL`). The backend maintains the
connection and forwards PistonCore events to the browser.

**Connection establishment:**
On connect, the server immediately sends a `hello` message:
```json
{
  "type": "hello",
  "version": "1.0.0",
  "ha_connected": true,
  "timestamp": "2026-05-24T08:46:25Z"
}
```

`ha_connected` tells the frontend immediately whether HA is available. If false, disable
deploy and wizard capability fetching before the UI finishes loading.

**Message shape — all messages share these top-level fields:**
```json
{
  "type": "PISTONCORE_LOG | PISTONCORE_RUN_COMPLETE | ha_status | error",
  "timestamp": "ISO 8601"
}
```

**PISTONCORE_LOG** — one per log line from a running piston:
```json
{
  "type": "PISTONCORE_LOG",
  "piston_id": "uuid",
  "run_id": "uuid",
  "sequence": 4,
  "event_type": "trigger | condition | action | log | error",
  "statement_id": "stmt_a3f8c2d1",
  "message": "Triggered by: sun.next_setting",
  "timestamp": "2026-05-24T08:46:25.123Z"
}
```

- `sequence` is a monotonically increasing integer per run (starts at 1)
- `statement_id` matches the statement ID in the piston JSON — used by Trace mode to highlight rows
- `event_type` drives log level filtering (Full shows all; Minimal shows only `trigger` and result)

**PISTONCORE_RUN_COMPLETE** — one per piston run, at the end:
```json
{
  "type": "PISTONCORE_RUN_COMPLETE",
  "piston_id": "uuid",
  "run_id": "uuid",
  "status": "success | error | timeout",
  "duration_ms": 1247,
  "final_variables": {
    "$count": 12,
    "$message": "3 devices reporting low battery"
  },
  "timestamp": "2026-05-24T08:46:26.370Z"
}
```

- `final_variables` is used to update the Variables panel on the status page
- `status: "timeout"` — piston exceeded the 5-minute stale detection threshold

**ha_status** — sent when HA connection changes:
```json
{
  "type": "ha_status",
  "connected": false,
  "reason": "websocket_dropped | token_invalid | version_mismatch | startup",
  "timestamp": "2026-05-24T09:00:00Z"
}
```

The frontend handles `ha_status` by updating the connection indicator and disabling/enabling
deploy and wizard capability fetching accordingly.

**error** — generic backend error forwarded to the browser:
```json
{
  "type": "error",
  "code": "INTERNAL_ERROR | COMPILE_ERROR | DEPLOY_ERROR",
  "piston_id": "uuid | null",
  "message": "Plain English error message",
  "timestamp": "2026-05-24T09:00:01Z"
}
```

**Keep-alive / ping-pong:**
The server sends a `ping` message every 30 seconds:
```json
{ "type": "ping", "timestamp": "..." }
```

The frontend must respond with:
```json
{ "type": "pong" }
```

If the server does not receive a pong within 10 seconds of a ping, it closes the connection.
The frontend should reconnect automatically with exponential backoff (1s, 2s, 4s, 8s, max 60s)
when the connection closes.

**Message size limits:**
Individual `PISTONCORE_LOG` messages are capped at 4KB. If a piston generates a log message
larger than 4KB, the backend truncates and appends `[truncated]`. The frontend never needs to
handle oversized messages.

High-frequency trace output (e.g., a tight loop firing 100 iterations per second): the backend
throttles WebSocket sends to a maximum of 20 messages per second per piston run. Excess messages
are queued and flushed at the end of the run as a batch.

**HA WebSocket reconnect events:**
When PistonCore reconnects to HA (after a drop), it sends:
```json
{
  "type": "ha_status",
  "connected": true,
  "reason": "reconnected",
  "timestamp": "..."
}
```

This tells the frontend to re-enable deploy and wizard features.

---

## Settings Page

The Settings page is accessible from the piston list header. A `[⚙ Settings]` button in
the header area navigates to it. The Settings page is a separate view — `← Back` returns
to the piston list.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  ← Back to My Pistons                               │
│  Settings                                           │
├─────────────────────────────────────────────────────┤
│  ▼ HA CONNECTION                                    │
│  (connection fields here)                           │
├─────────────────────────────────────────────────────┤
│  ▼ PISTONCORE                                       │
│  (version and deployment type)                      │
├─────────────────────────────────────────────────────┤
│  ▼ INTEGRATIONS                                     │
│  (HA entities/services for specific commands)       │
├─────────────────────────────────────────────────────┤
│  ▼ MY DEVICE DEFINITIONS                            │
│  (custom device definitions)                        │
├─────────────────────────────────────────────────────┤
│  ▼ GLOBAL VARIABLES                                 │
│  (global variable management)                       │
└─────────────────────────────────────────────────────┘
```

Each section is collapsible. Sections open by default.

### HA Connection Section

**Docker mode:**
```
HA URL:       [http://192.168.1.10:8123          ]
Long-Lived Token: [••••••••••••••••••••••••••••  ]
              [Test Connection]
              
Status: ✅ Connected — Home Assistant 2026.4.1
WebSocket: ✅ Connected
```

- URL and token fields are editable. Saving either field triggers an immediate reconnect attempt.
- `[Test Connection]` attempts a test API call and shows: *"Connection successful"* or *"Failed: [reason]"*
- Token storage guidance text (below the token field): *"This token is stored on your PistonCore volume. It is not sent to any external server."*
- Token rotation instructions (collapsible, below token field): *"To rotate your token: create a new long-lived token in HA, paste it here, and save. The old token can then be deleted from HA."*

**Addon mode:**
```
Status: ✅ Connected — Home Assistant 2026.4.1
WebSocket: ✅ Connected

Token: Managed automatically by the HA supervisor.
```

No URL or token fields shown in addon mode. Connection status only.

**HA disconnected state:**
- Status shows: `❌ Not connected`
- Token/URL fields remain editable
- All other sections on the page remain visible but show: *"(HA disconnected — data unavailable)"* where live data is expected

### PistonCore Section

```
Deployment type: Docker
PistonCore version: 1.0.0
```

Read-only. No user actions available.

### Integrations Section

Some wizard commands map to HA entities or services that vary by user setup — different alarm integrations, different TTS engines, etc. Rather than the compiler guessing, the user configures the target once here. The wizard menu always shows the generic name (e.g. "Alarm Panel", "Speak text"); the compiler reads the user's selection to know which entity or service to call.

Each row shows the command name, a description of what it targets, and a dropdown populated from live HA data. If HA is disconnected the dropdowns are disabled and show *"(HA disconnected)"*.

```
INTEGRATIONS
──────────────────────────────────────────────────────
  Alarm Panel
  Which alarm_control_panel entity to use for
  "Set alarm panel status" commands.
  [ alarm_control_panel.home              ▼ ]

  Text-to-Speech (Speak text)
  Which TTS service to use for "Speak text" commands.
  [ tts.google_cloud_tts                  ▼ ]
```

**Population — how dropdowns are filled:**
When the Integrations section opens (or the user presses `[↻ Refresh]`), the frontend calls `GET /api/integrations/available`. The backend queries HA via the standard state and service APIs and returns two lists:
- `alarm_panels` — all `alarm_control_panel.*` entities from HA's state API (`GET /api/states`, filtered by domain)
- `tts_engines` — all services under the `tts` domain from HA's service API (`GET /api/services`, filtered to domain `tts`). PistonCore targets current HA only (minimum version enforced); the compiler always calls `tts.speak` with the engine id — no old-style `tts.X_say` calls.

Each list entry carries the entity/service id and the friendly name for display.

**Default selection — first open:**
On first open (no saved selection), PistonCore auto-selects:
- Alarm Panel: `alarm_control_panel.home` if present; otherwise the first entity alphabetically
- TTS Engine: first TTS engine alphabetically

Defaults are saved automatically on first open so the compiler always has a value.

**Alarm Panel picker:**
- Dropdown populated from `alarm_panels` list
- If none found: shows *"No alarm panel found in HA — install an alarm integration first"* (picker disabled)
- Stored: entity id (e.g. `alarm_control_panel.home`)
- Used by: compiler only — wizard does not need this setting

**Text-to-Speech picker:**
- Dropdown populated from `tts_engines` list (e.g. `tts.cloud`, `tts.google_translate`, `tts.piper`)
- If none found: shows *"No TTS engine found in HA — install a TTS integration first"* (picker disabled)
- Stored: engine id (e.g. `tts.cloud`)
- Used by: wizard (pre-fills the Speak task, no per-command engine picker needed) AND compiler (generates `tts.speak` call with this engine id)

**Stale selection warning:**
If the saved entity/service id is no longer present in the list returned by HA, the picker shows a warning next to the current value: *"⚠ Not found in HA — pick a replacement."* The saved value is not auto-cleared (the user may be temporarily offline or the integration may be reloading).

**`[↻ Refresh]` button:**
Re-queries HA and repopulates both lists. Does not change saved selections unless the user picks a new value. Useful after installing a new TTS integration or alarm panel without reloading PistonCore.

**Extensibility:** additional integrations follow this same pattern — one row per command that needs a user-configured HA target, populated from HA on open, stored id read by wizard and/or compiler.

`[DECISION: integration targets are user-configured here, not hardcoded — compiler stays generic; TTS engine pre-loaded into wizard at editor open so no per-command picker is needed; alarm panel compiler-only]`
`[VERIFIED: HA state API GET /api/states for alarm_control_panel domain; HA service API GET /api/services for tts domain — standard HA REST API, available on all supported versions]`

---

### My Device Definitions Section

Lists custom device definitions created through the unknown device fallback flow.

```
My Device Definitions                    [+ Add Definition]
─────────────────────────────────────────────────────────────
  Zigbee Outlet (Salus SP600)           [✎ Edit] [🗑 Delete]
  MQTT Lock (Yale Z-Wave)               [✎ Edit] [🗑 Delete]
```

- `[+ Add Definition]` opens the unknown device fallback flow (same as when the wizard triggers it automatically)
- `[✎ Edit]` opens the definition editor
- `[🗑 Delete]` — prompts: *"Delete this device definition? Any device that used this definition will show as unknown."* `[Delete]` `[Cancel]`
- If no definitions: show *"No custom device definitions. These are created automatically when you use an unknown device."*

### Global Variables Section

Globals are PistonCore variables shared across pistons. Unlike piston (local) variables —
which belong to a single piston and live in that piston's JSON — globals live **outside the
JSON as a shared list** (a global is used by many pistons, so it cannot belong to any one
piston's JSON). Globals are reachable from any screen via the header `[Global Variables]`
button (hardware/modal permitting), not only from Settings.

At the picker and JSON level, **device globals behave identically to local device
variables** — same picker, same handling of entity_ids written into the JSON. That
mechanism is specified in EDITOR_WIZARD_SPEC.md and is not restated here.

**Types use WebCoRE names.** The wizard presents WebCoRE's variable types (integer,
decimal, string, boolean, datetime, device) — the same vocabulary used everywhere in
PistonCore. **Translating a WebCoRE type to whatever Home Assistant needs is the
compiler's job** (out of scope for this document) — the compiler makes HA match the
piston's intent. This document never names HA input helpers or their entity-id formats;
that is a compiler concern.

```
Global Variables                              [+ New Global]
─────────────────────────────────────────────────────────────
  @Exterior_Doors     device      3 entities    [✎] [🗑]
  @Motion_Count       integer     12            [✎] [🗑]
  @Night_Mode         boolean     off           [✎] [🗑]
```

Columns: internal name (@ prefix), WebCoRE type, current value (or entity count for device
type), edit, delete.

**[+ New Global]** opens an inline form:
```
Name:    [@_______________]    (@ prefix always shown — user types the rest)
Type:    [integer ▼]            (WebCoRE type names)
Default: [0              ]
         [Create Global]  [Cancel]
```

- Name validation: lowercase, underscores only, no spaces. Error shown inline if violated.
- `@ prefix` is always prepended — the user cannot create a global without the @ prefix.
- After create, the new global appears in the list immediately.
- If HA is disconnected: block creation with message *"Can't create global — HA
  disconnected. Try again when reconnected."*

**[✎ Edit]** for a device global opens the device picker inline — same picker as the wizard.
**[✎ Edit]** for a non-device global opens an inline value field.
**Display name edit:** Display name is editable (separate from internal name). Click the
name to edit inline.

**On save — deploy choice.** Because a global is used by multiple pistons, editing one can
affect every piston that references it. When the user saves a global edit, a prompt appears:

```
┌─────────────────────────────────────────────────┐
│  '@Exterior_Doors' is used by 3 pistons.        │
│  Update them now, or deploy each yourself later? │
│                                                  │
│        [Update all now]    [I'll deploy later]   │
└─────────────────────────────────────────────────┘
```

- **[Update all now]** — auto-deploys every piston that references this global.
- **[I'll deploy later]** — saves the global; the user deploys affected pistons manually.

**Reference tracking** — each global object carries a `used_by` field: an array of objects, each holding a piston's UUID and display name (e.g. `[{uuid:"abc123", name:"Alarm Check"}, ...]`). This list powers the "3 pistons reference it" count in the deploy prompt and the Update-all-now redeploy path.

**How the list stays current — backend scan at piston save.** The frontend save call already sends the full piston JSON to the backend. When the backend receives a save, it scans every `role_tokens` array in the piston JSON for entries beginning with `@` — those are global variable references. For each found `@GlobalName`, it ensures `{uuid, name}` for this piston is present in that global's `used_by`. For any global that previously listed this piston but is no longer referenced in the scan, it removes the entry. No extra data needs to be sent from the frontend — the backend derives the complete reference set from the saved JSON.

**Piston delete cleanup.** When a piston is deleted, the backend removes that piston's UUID from `used_by` on every global object.

**Drift healing — Recalculate button.** The globals page has a `[Recalculate References]` button (low-prominence, e.g. small text link below the list). Clicking it triggers a backend full-scan: walk every saved piston JSON, rebuild all `used_by` lists from scratch. This is a safety net for cases where the list drifts out of sync (e.g. after a manual file edit or a failed save). It does not change any piston or global value — only the `used_by` lists.

`[DECISION: scan at piston save — backend-side; @-prefix in role_tokens is the discriminator; uuid+name pair stored on global for deploy prompt; full-scan recalculate as safety net]`

**[🗑 Delete]:**
- *"Delete '@Exterior_Doors'? 3 pistons reference it. Those pistons will need to be edited
  to remove the reference."* `[Delete]` `[Cancel]`

---

## Piston List — Folder Management

### Create Folder

`[+ New Folder]` at the bottom of the list expands an inline text input:
```
[____________________] [✓ Create] [✕]
```
- Enter: confirms creation
- Escape or `[✕]`: cancels
- Validation: name must not be empty, must not duplicate an existing folder name (case-insensitive)
  - Duplicate: show inline error: *"A folder with that name already exists."*
  - Empty: the `[✓ Create]` button is disabled until at least one character is entered
- On create: folder appears in the list (empty, alphabetical position), sorted alphabetically
- Folder names are not slugified — display names are stored as-is

### Rename Folder

Right-clicking a folder header shows a context menu:
```
Rename folder
Delete folder
```

`Rename folder` turns the folder header into an inline edit:
```
[Outdoor Lighting___]  [✓] [✕]
```
Same validation as create. Renaming preserves all pistons in the folder.

### Delete Folder

Right-clicking → `Delete folder` shows confirmation:
*"Delete 'Outdoor Lighting'? The 3 pistons inside will be moved to Uncategorized."*
`[Delete Folder]` `[Cancel]`

Pistons are never deleted when a folder is deleted. They move to Uncategorized automatically.

### Move Piston to Folder

Two methods, both supported:

**Method 1 — Status page folder dropdown:**
Each piston's status page has a `Folder: [Dropdown ▼]` that lists all existing folders plus "Uncategorized". Selecting reassigns immediately (no deploy required).

**Method 2 — Piston row drag and drop:**
A piston row can be dragged and dropped onto a folder header. On drop, the piston moves to that folder. No confirmation needed.

Both methods update the piston's `folder` field in the JSON immediately.

### Folder Sort Order

Folders are always sorted alphabetically (A-Z). Uncategorized is always last, regardless of alphabetical position.

### Empty Folder Behavior

Empty folders are shown in the list (not hidden). The piston count shows `(0)`.

### Collapsed/Expanded State

Folder sections can be collapsed by clicking the folder header. Collapsed state is saved to `localStorage` keyed by folder name. On next load, each folder restores its previous collapsed/expanded state. Default is expanded.

---

## Snapshot and Backup Export

Two export types exist. They use different buttons, different file names, and serve different purposes. The distinction must be unmistakable to the user.

### Snapshot Export — Safe to Share

Replaces entity IDs with domain placeholders. Keeps all structure and context. Safe to post publicly.

**Triggered from:** Status page `[📷 Snapshot]` button, or Editor `[📷 Snapshot]` button.

**What happens:**
1. Backend walks the piston's full tree (triggers, conditions, restrictions, statements recursively).
2. On every condition, action, and for_each node: replaces `entity_ids` with `["__placeholder_<domain>__"]` where domain is derived from the first entity_id's domain prefix. If entity_ids was already empty, writes `["__placeholder_unknown__"]`. Time conditions (role: "time") and other non-device nodes with permanently empty entity_ids are left as `[]`.
3. `role_tokens` is **kept intact** on every node — the import wizard depends on it.
4. `compiled_value` is stripped from every condition node — installation-specific HA state strings.
5. For device-type variables (`var_type: "device"` or `"devices"`): `initial_value` is replaced with `["__fill_devices__"]`. All other variable fields kept.
6. Runtime fields stripped: `id` (piston wrapper), `log`, `last_ran`, `last_result`, `last_variables`, `compile_check`, `stale`, `deployed`.
7. All other fields kept: `role`, `display_value`, `attribute`, `attribute_type`, `device_class`, `operator`, `aggregation`, `group_operator`, all statement structure, all non-device variable data.
8. Result is the Snapshot JSON format per DESIGN.md Section 6.10.
9. Browser downloads the file immediately. No confirmation dialog needed.

**File naming:** `{slugified-piston-name}-snapshot.json`
- Slug rules: lowercase, spaces → hyphens, strip all non-alphanumeric except hyphens
- Example: "Front Door Chime" → `front-door-chime-snapshot.json`

**Button appearance:** Green label — `[📷 Snapshot]` with tooltip: *"Share-safe export — device IDs are replaced with placeholders."*

### Backup Export — Personal Use Only

Preserves all entity_ids intact. Not safe to share publicly.

**Triggered from:** Status page `[📷 Backup]` button, or Editor `[📷 Backup]` button.

**What happens:**
1. Backend writes the full piston JSON as-is — no stripping.
2. Browser downloads immediately. No confirmation dialog.

**File naming:** `{slugified-piston-name}-backup-{YYYY-MM-DD}.json`
- Example: "Front Door Chime" → `front-door-chime-backup-2026-05-24.json`

**Button appearance:** Red/amber label — `[📷 Backup]` with tooltip: *"Full export including your device IDs — keep this private."*

### Bulk Backup — All Pistons

**Triggered from:** Settings page → `[Backup All Pistons]` button.

**What happens:**
1. Backend zips all piston JSON files (backend implementation detail — not specced here).
2. No stripping — full format for every piston.
3. Browser downloads the zip.

**File naming:** `pistoncore-backup-{YYYY-MM-DD}.zip`

**No confirmation dialog** — bulk backup is always safe to trigger.

### Restore / Import

Both Snapshot and Backup files import through the same Import dialog (FRONTEND_SPEC.md Import Dialog section). Format is auto-detected by checking whether any node has a placeholder in `entity_ids` (any entry matching `__placeholder_*`) — see Format Detection above.

**Backup restore — ID behavior:**
When importing a Backup file, show a choice before saving:

```
┌─────────────────────────────────────────────────────┐
│  Import backup — how do you want to handle this?    │
├─────────────────────────────────────────────────────┤
│  ● Restore original   — keeps the piston's original │
│    ID. Replaces any existing piston with that ID.   │
│                                                     │
│  ○ Import as new copy — assigns a new ID. Original  │
│    piston (if it still exists) is untouched.        │
│                                                     │
│                         [Cancel]  [Import]          │
└─────────────────────────────────────────────────────┘
```

Default selection is "Import as new copy" — safer for most scenarios.

**Snapshot import:** Always assigns a new ID. No choice presented.

### API Endpoints

- `GET /api/pistons/{uuid}/snapshot` — returns Snapshot JSON (entity_ids stripped)
- `GET /api/pistons/{uuid}/backup` — returns full piston JSON
- `GET /api/pistons/backup-all` — returns zip of all piston JSON files

---

## Integration Settings API

Two endpoints for the Integrations section of the Settings page.

**`GET /api/integrations/available`**
Queries HA and returns the current lists of available alarm panels and TTS engines.
Called when the Integrations section opens or the user presses `[↻ Refresh]`.

Response shape:
```json
{
  "alarm_panels": [
    { "entity_id": "alarm_control_panel.home", "name": "Home Alarm" }
  ],
  "tts_engines": [
    { "engine_id": "tts.cloud", "name": "Home Assistant Cloud" },
    { "engine_id": "tts.piper", "name": "Piper" }
  ]
}
```
- `alarm_panels` — from HA state API, domain `alarm_control_panel`, includes entity_id and `friendly_name`
- `tts_engines` — from HA service API, domain `tts`, service name becomes the engine_id
- If HA is disconnected: returns `{"error": "ha_disconnected"}`

**`GET /api/settings/integrations`**
Returns the currently saved integration selections.

Response shape:
```json
{
  "alarm_panel": "alarm_control_panel.home",
  "tts_engine": "tts.cloud"
}
```
Both fields may be `null` if not yet configured.

**`POST /api/settings/integrations`**
Saves the user's selections. Body matches the GET response shape.
Returns the saved object on success.

Stored in PistonCore's settings JSON on the volume alongside other user settings.
The editor loads integration settings at open time via `GET /api/settings/integrations`
so the wizard has the TTS engine id available without a separate fetch.

---

## Future Spec — Fast Pre-Check Validation (Post-v1)

**Status:** Deferred to post-v1. Not a v1 requirement. The compile-time MISSING_ENTITY
check (COMPILER_SPEC.md Section 8 and 13) is the v1 validation gate.

When implemented, the behavior must be:

- On each wizard step, after the user selects a device: call
  `GET /api/entities/{entity_id}/exists` — a lightweight backend endpoint that checks
  the entity registry without a full context build.
- If entity does not exist: show inline warning in the wizard:
  *"This device wasn't found in Home Assistant — it may have been removed or renamed."*
- Warning does not block Next. The wizard can complete with the stale selection. The
  compile-time check is the hard enforcement gate.
- On the attribute selection step: validate that the selected attribute still exists
  on the entity using the capabilities API. Same pattern — warn, don't block.
- Fast pre-check is always advisory — never blocking in the wizard.

---

## Post-v1 Hardening

Non-blocking for v1. Address before public release.

- **_esc() consistency** — the _esc() sanitization helper exists but its usage is not
  100% consistent across all raw HTML insertions. Audit all innerHTML assignments
  before v1 public release.
- **sessionStorage for API key** — acceptable for same-origin. An XSS surface if the
  application is ever exposed to untrusted content. Not a concern for the current
  local-only deployment model.
- **Full re-renders on editor operations** — _render() is called on many operations.
  Acceptable for v1 scale. Consider targeted partial re-renders for deeply nested
  pistons if lag becomes observable.
- **Google Fonts import** — consider self-hosting or switching to system fonts for
  offline/air-gapped HA installs.
- **No CSP in index.html** — Content Security Policy would add a layer of XSS protection.
- **No ARIA labels** on many interactive elements (drag handles, context menus, wizard
  steps). Accessibility pass deferred to post-v1.
- **No test suite** — a small set of golden sample pistons with a basic compile-check
  script. Low effort, high value.

---

## Open Items — Not Yet Defined

Do not implement these until they are decided. Everything else in this spec is fully defined
and ready to build.

1. **Exact backend API signatures** — to be confirmed with backend developer.
2. **Undo/Redo** — command pattern on piston JSON history stack. Not v1 scope — deferred.
3. **Wizard draft state recovery** — browser refresh mid-edit behavior. Not v1 scope — deferred.
4. **Deep nesting performance** — virtual rendering strategy for 10+ levels. Not v1 scope — monitor.
5. **Keyboard navigation** — arrow keys, Enter to edit, Delete. Not v1 scope — deferred.
6. **Mobile/tablet responsiveness** — desktop-first in v1. Deferred.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
