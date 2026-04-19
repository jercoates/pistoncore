# PistonCore Design Document

**Version:** 0.7
**Status:** Draft — Ready for Development
**Last Updated:** April 2026

---

## 1. What Is PistonCore?

PistonCore is an open-source visual automation builder for Home Assistant, designed to feel immediately familiar to anyone who has used WebCoRE on SmartThings or Hubitat. It lets you build complex automations — called **pistons** — through a structured UI using dropdowns populated directly from your actual HA devices, without ever writing YAML or Python manually.

**PistonCore is not a home automation platform. It is a tool for building automations on top of one.**

It does not add devices, manage integrations, or extend HA's capabilities in any way. It reads what HA already has, gives you a better way to write logic against it, and compiles that logic to native HA files that run permanently and independently.

**PistonCore does not need to be running for your automations to work.** Compiled files are standard HA automation files. If you uninstall PistonCore tomorrow, every piston you built keeps running — as long as the relevant runtime (YAML native or PyScript) remains installed. Simple YAML pistons are unconditionally permanent. Complex PyScript pistons require PyScript to remain installed.

---

## 2. Core Philosophy

* **No required central server.** PistonCore runs locally on Unraid, a Raspberry Pi, any Docker host, or optionally on a cloud server someone else hosts. Nothing depends on servers controlled by the project maintainers.
* **Automations are yours.** Compiled files are standard HA files. PistonCore is the source of truth for your pistons — the compiled files on HA are just the output.
* **PistonCore never touches files it did not create.** Your existing hand-written automations, scripts, and YAML files are completely safe. PistonCore only ever writes to its own subfolder. This rule is enforced architecturally via file signature checking — see Section 12.
* **Shareable by design.** Pistons are stored and shared as plain JSON. Paste them anywhere — a forum post, a GitHub Gist, a Discord message, a text file. Import from a URL or paste directly. No account required, no server involved.
* **AI-friendly from day one.** The piston JSON format is simple and fully documented so AI assistants can generate valid pistons from a plain English description.
* **Open and community driven.** MIT licensed. Anyone can host, fork, modify, or contribute.
* **Familiar to WebCoRE users.** The piston concept, structure, terminology, keywords, and logging behavior are intentionally close to WebCoRE so experienced users can pick it up immediately.
* **Plain English everywhere, icons plus labels for universal actions.** Logic operators and descriptive text are always written in plain English. Buttons use an icon paired with a plain English label — never an icon alone.
* **Silent by default.** PistonCore generates no debug output unless the user explicitly activates tracing for a specific piston.
* **Minimum footprint in HA.** PistonCore touches only what is absolutely necessary and only what the user explicitly confirms during setup.
* **Incomplete but correct is better than complete but wrong.** The wizard must prefer showing fewer options over showing incorrect options. PistonCore is allowed to not know something. It is not allowed to guess wrong.

---

## 3. Core Concepts

### What is a Piston?

A piston is a self-contained automation rule. It has a name, optional variables, one or more triggers, optional conditions, and an action tree with if/then/else logic. This maps directly to how WebCoRE pistons worked.

### Key Terms

| PistonCore Term | WebCoRE Equivalent | Meaning |
|---|---|---|
| Piston | Piston | A complete automation rule |
| Trigger | Trigger | What starts the piston |
| Condition | Condition | A check that must pass before actions run |
| Action | Action/Command | Something that happens |
| Statement | Statement | Any single block in the piston — control flow or task |
| Global Variable | Global Variable | A value shared across all pistons |
| Piston Variable | Local Variable | A temporary value used only within one piston run |
| Role | Device placeholder | An abstract device slot filled with a real entity at import time |
| Compile | Parse | Convert piston JSON to native HA files |
| Snapshot | — | Anonymized export safe to share publicly |
| Backup | — | Full export including entity mappings, for personal restore only |

### Simple vs Complex Pistons

PistonCore automatically decides what to compile to based on what your piston does. You never choose — it detects it using explicit rules defined in Section 3.1.

* **Simple piston → compiles to a HA YAML automation file**
* **Complex piston → compiles to a PyScript `.py` file**

Both compile targets are native HA files and run without PistonCore being active. Simple YAML pistons run permanently and unconditionally. Complex PyScript pistons require PyScript to remain installed in HA.

**PyScript is the primary compile target.** It is completed and stabilized before the YAML compiler. A working PyScript-only PistonCore is more useful to more users than a half-working dual-mode system.

### 3.1 Auto-Detection Boundary — Explicit Rules

The compiler uses an ordered list of conditions to decide compile target. If **any** condition is true, the piston compiles to PyScript. No judgment calls. The list is unambiguous and testable.

**Conditions that force PyScript compilation:**

1. The piston defines one or more piston variables
2. The piston reads or writes any global variable
3. The action tree contains a Repeat block
4. The action tree contains a For Each block
5. The action tree contains a Wait for State action (with or without timeout)
6. The action tree contains a Wait action that is not the last action (mid-piston wait)
7. The action tree contains a Call Another Piston action where the piston needs to wait for completion
8. The action tree contains if/else nesting deeper than two levels
9. The action tree contains more than one If block at the top level
10. TEP or TCP advanced options are set on any statement

If none of the above are true, the piston compiles to YAML.

**When a piston crosses the boundary mid-build:** If a user adds a statement that would force PyScript compilation and their piston is currently YAML-bound, PistonCore prompts: *"This feature requires converting your piston to a Complex piston (PyScript). Your logic will be preserved. Continue?"* The user must confirm. The compile target indicator in the editor updates visibly when the target changes.

---

## 4. Variables

### 4.1 Global Variables

Defined once at the PistonCore level. Available to every piston. Persist permanently until changed.

**Storage:** Global variables are stored in `<ha_config>/pistoncore/globals.json`. This file is written by the companion whenever the user saves a change in the PistonCore UI. It lives in HA's config directory — not in the Docker volume — so compiled PyScript files can read it at runtime without any Docker dependency.

**Runtime access by PyScript pistons:** Compiled PyScript files read globals.json directly at runtime using Python file I/O. **This must be validated in sandbox before the compiler is written.** Known risks:

* Plain `open()` / `json.load()` may block HA's event loop in the async PyScript environment
* Permission failures are possible on supervised installs or restricted Docker volume mounts
* AppArmor restrictions on some HA installation types

**Three fallback solutions to test in priority order:**
* Solution A: Wrap file read in `task.executor()` — runs blocking I/O in a thread pool without blocking HA (preferred)
* Solution B: Cache globals in `hass.data` on companion startup and read from there at runtime
* Solution C: Expose globals via a PyScript module at `<ha_config>/pyscript/modules/pistoncore_globals.py` that PyScript auto-reloads when changed

The compiler template must implement whichever solution sandbox confirms works. Do not write the compiler until this is resolved.

**If globals.json is missing at runtime:** The piston logs a plain English error and stops gracefully. It does not silently fall back to hidden defaults.

**PyScript comment header:** Every compiled `.py` file includes a comment header listing every global variable it references. This allows PistonCore to scan the compiled folder and determine global variable usage without a database.

**Manual edit warning:** The globals.json file includes a prominent comment warning that manual edits are at the user's own risk. If the file is detected as corrupt on startup, PistonCore posts a persistent HA notification and uses safe hardcoded defaults. It never silently loads corrupt data.

### 4.2 Piston Variables

Defined inside a single piston. Only exist while that piston is running. Forgotten when the piston finishes.

Only visible in Advanced mode.

### 4.3 Variable Types

| Type | Description | Notes |
|---|---|---|
| Text | A word or sentence | "away", "Good morning" |
| Number | Any numeric value | 75, 0.5, -10 |
| Yes/No | True or false | **HA boolean helpers only.** Not for device states. |
| Date/Time | A point in time or duration | 10:30 PM, 45 minutes |
| Device | A single HA entity reference | Your driveway light |
| Devices | A collection of HA entity references | All your battery sensors |

**Yes/No is restricted to actual HA boolean helpers only.** Device states use the native values HA reports — on/off, open/closed, detected/clear, active/inactive — never a yes/no abstraction. The capability-driven wizard fetches and displays real native values from HA for each specific device. No translation layer.

**Device and Devices variables always show the friendly name, never the entity ID.**

**Devices variables can contain mixed device types.**

---

## 5. Device and Entity Model

### Device-Level Picker

PistonCore operates at the device level, not the entity level. The user always picks a physical device by friendly name, device name, or area. PistonCore never exposes entity IDs.

The device picker is a type-to-filter search field, not a static dropdown.

### Capability-Driven Attribute Selection

After picking a device, the user picks which capability or attribute to act on. This list is fetched live from HA for that specific device using the WebSocket API commands listed in Section 5.1. It is never a hardcoded list maintained by PistonCore.

Multi-step flow:
1. Pick the device (by friendly name, device name, or area)
2. Pick the capability or attribute — list fetched live from HA
3. Pick the comparison or action based on that capability

Entity resolution is handled internally by PistonCore. The user never sees or selects entity IDs.

### 5.1 WebSocket API — Required Commands

All device, entity, capability, trigger, condition, and service data is fetched via the HA WebSocket API. The REST API is used only for simple one-off calls (such as automation/reload) that do not require a persistent connection.

PistonCore opens a WebSocket connection to HA using the long-lived access token on first launch and keeps it open during the session.

Key WebSocket commands the wizard depends on:
* `get_triggers_for_target` — all valid triggers for a specific device
* `get_conditions_for_target` — all valid conditions for a specific device
* `get_services_for_target` — all valid services for a specific device
* `config/entity_registry/list_for_display` — optimized entity list for UI display

### 5.2 Capability Data Quality and Graceful Degradation

The WebSocket commands return best-effort data. Output quality varies by device type and integration. Known problem areas: Zigbee (ZHA/Zigbee2MQTT), Z-Wave, MQTT, media players, custom/community integrations.

**Required behavior:**
* If capability data is clear, the wizard uses it directly
* If capability data is returned but incomplete, the wizard shows what it has and adds an *"Other / Manual"* option at the bottom of each list
* If HA returns no usable capability data at all, the Unknown Device Fallback triggers (see Section 5.3)
* If capability data is present but ambiguous, unusual, or inconsistent with normal expectations for that device class, PistonCore prompts the user to review and define the missing context manually (see Section 5.4)
* The wizard never crashes or shows incorrect options — it always degrades to showing less rather than showing wrong

A small curated fallback layer for device types HA handles poorly is acceptable and does not violate the design philosophy. This layer is built incrementally based on real gaps found during sandbox testing.

### 5.3 Unknown Device Fallback

If HA returns no usable capability data for a device, PistonCore shows a one-time **"Define this device"** screen for that specific device. The user labels each entity in plain English. PistonCore stores that definition locally on the Docker volume.

From that point on the device behaves like any HA-known device in the picker. Definitions are editable from the **"My Device Definitions"** screen in PistonCore settings.

This triggers once per device, not once per piston.

### 5.4 Manual Context Lookup for Ambiguous Data

If PistonCore fetches capability data that is present but unclear — unusual attribute names, unexpected units of measurement, values at unexpected scale, raw data without enough meaning to safely determine valid operators or comparisons — the wizard must not guess.

**Required behavior:** PistonCore prompts the user to look up the device behavior and define the missing context manually. The user-defined context is stored locally and reused for that device on future runs.

This keeps the system honest. PistonCore is allowed to be incomplete. It is not allowed to invent meaning that HA did not provide and the user did not confirm.

---

## 6. Piston Structure

Every piston has the following sections in order. All sections except the header are collapsible.

A piston is built from **Statements**. Two kinds:

* **Decisional statements** — control flow: `if`, `else if`, `else`, `end if`, `repeat`, `for each`, `while`, `end repeat`
* **Executive statements** — execute things: `with [device] do [action]`, `set variable`, `wait`, `wait for state`, `log message`, `call another piston`, `stop`

### 6.1 Header

* **Name** — human readable, becomes the filename when compiled
* **Description** — optional
* **Folder** — set here or on the status page
* **Mode** — Single (default) / Restart / Queued / Parallel
* **Enabled / Disabled**

### 6.2 Piston Variables

Optional. Only visible in Advanced mode. Labeled: *"Temporary — forgotten when this piston finishes running."*

### 6.3 Triggers

One or more triggers. Uses the same multi-step wizard as conditions and actions.

Trigger types:
* Device or entity state change — `changes`, `changes to`, `changes from`, `changes from X to Y`
* Numeric — `rises above`, `drops below`
* State with duration — `changes to [value] and stays for [duration]` — compiles to HA native `for:` parameter
* Button/momentary device — `gets [event]`, `gets any`
* Time — a specific time of day
* Sunrise / Sunset with optional offset in minutes
* Time pattern — every X minutes, every X hours
* HA event — any Home Assistant event fires
* Webhook — an incoming webhook call
* Called by another piston
* Manual only — only runs when Test is pressed

### 6.4 Conditions

Checked after a trigger fires. If conditions are not met the piston stops silently.

Operators are plain English, written in full. Device states use native HA values — on/off, open/closed, detected/clear, etc. — never a yes/no abstraction. Multiple conditions grouped with AND or OR — written in full, never symbols.

### 6.5 Action Tree

Top-to-bottom sequence of statements using `with / do / end with` and `if / then / else / end if` keywords matching WebCoRE.

---

## 7. The Editor UI

### Overall Feel

The editor is a **structured document viewed top to bottom**. Logic is always visible — indentation shows nesting. It reads like a well-formatted script. Keywords match WebCoRE exactly: `if`, `then`, `else if`, `else`, `end if`, `with`, `do`, `end with`, `repeat`, `for each`, `only when`.

### Frontend Technology

**Vanilla JS, HTML, and CSS.** No framework. This keeps the dependency footprint minimal and makes the code readable by any contributor without framework knowledge. The cousin's working implementations use this stack and are the basis for integration.

### UI Rules — No Exceptions

1. No pictograms for logic. AND/OR, equals, greater than — always written in plain English.
2. No entity IDs ever visible to the user.
3. All dropdowns populated from live HA data.
4. Sections are collapsible with plain English labels.
5. Errors are plain English.
6. Buttons use icon plus plain English label. Never icon alone.
7. Automatic validation on save. Warnings appear on the status page without the user asking.
8. Compiled output is never shown to the user.

### Inline Ghost Text — Primary Insertion Method

At every valid insertion point in the document, ghost text appears inline:
* `+ add a new statement`
* `+ add a new task`
* `+ add a new restriction`

Clicking opens the multi-step wizard modal for that insertion point. This is the primary way statements are added.

### Simple / Advanced Mode Toggle

Single global toggle at the top of the editor. Default is Simple.

* **Simple** — hides piston variables, limits to most common types, plain English throughout
* **Advanced** — shows everything including piston variables, all types, loops, wait-for-state, deep nesting, TEP/TCP in wizard

This is the only global mode control. No per-block toggles.

Switching modes never breaks a piston.

### Per-Statement Advanced Options (Cog in Wizard)

Each wizard modal has a cog icon (bottom right, tooltip: "Show/Hide advanced options") expanding:
* Task Execution Policy (TEP)
* Task Cancellation Policy (TCP)
* Execution Method (sync/async)

Available regardless of Simple/Advanced mode but hidden until needed. TEP and TCP are only relevant for PyScript pistons — PistonCore shows a note if these are set on a YAML-bound piston.

### Drag and Drop

**This must be designed before the editor data model is built.** See Section 7.1.

### Role Creation During Piston Building

**This must be decided before the editor data model is built.** See Section 7.2.

### Navigation and State Transitions

**This must be defined before frontend coding begins.** See Section 7.3.

### Piston List Screen

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

* Folders created from this page only
* New pistons land in Uncategorized automatically — no folder prompt on creation
* Pause/Resume available per piston from this list
* True/false last evaluation result shown per piston (✅/❌)
* Global Variables drawer accessible from this page
* Import button (paste JSON, URL, or file upload)
* Mode indicator visible: PyScript Only / Full Mode

**PyScript-only mode notice (subtle, footer or sidebar):**
*"PistonCore manages automations in its own subfolder. Automations created directly in Home Assistant are not visible or managed here."*

**Full Mode notice (prominent):**
*"PistonCore is running in Full Mode (YAML + PyScript). Creating automations directly in the Home Assistant GUI may cause unexpected behavior. Manage all automations through PistonCore."*

### Piston Status Page

**Navigation: List → Status Page → Editor → Status Page**

The status page is the hub for every piston. Saving in the editor always returns here.

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
│  Compile target: PyScript / YAML                    │
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

Compiled output (YAML or PyScript) is **not** shown on this page.

**Failure notification toggle:** When enabled, a piston failure fires a persistent notification in the HA UI AND sets a visible badge on the piston in PistonCore.

**Trace toggle:** When Trace is on and the piston runs, trace numbers overlay log entries matching line numbers in the document. Test must be pressed at least once on a new piston before Trace becomes available.

### Piston Editor Screen

```
┌─────────────────────────────────────────────────────┐
│  PistonCore                    [← Status] [+ New]   │
├─────────────────────────────────────────────────────┤
│  Piston Name: Driveway Lights at Sunset             │
│  Description: Turns on at sunset, off at 11pm       │
│  Folder: [Outdoor Lighting ▼]                       │
│  Mode: [Single — ignore new triggers while running] │
│  [● Enabled]              [Simple mode / Advanced]  │
│  Compile target: [PyScript]                         │
├─────────────────────────────────────────────────────┤
│  ▼ PISTON VARIABLES                         [+ Add] │
│  Temporary — forgotten when this piston finishes    │
│  (none)                                             │
├─────────────────────────────────────────────────────┤
│  ▼ TRIGGERS                                         │
│  Sun event — Sunset — no offset                     │
│  + add a new trigger                                │
├─────────────────────────────────────────────────────┤
│  ▼ CONDITIONS                                       │
│  (none — piston runs on every trigger)              │
├─────────────────────────────────────────────────────┤
│  ▼ ACTIONS                                          │
│  with                                               │
│    (Driveway Main Light)                            │
│  do                                                 │
│    Turn On                                          │
│      Brightness: 100%                               │
│  end with;                                          │
│  + add a new task                                   │
│  wait until 11:00 PM;                               │
│  + add a new statement                              │
│  with                                               │
│    (Driveway Main Light)                            │
│  do                                                 │
│    Turn Off                                         │
│  end with;                                          │
│  + add a new statement                              │
├─────────────────────────────────────────────────────┤
│  [▶ Test]  [💾 Save]  [📷 Snapshot] [📷 Backup]     │
│                                                     │
│  Log Level: [Full ▼]                                │
└─────────────────────────────────────────────────────┘
```

**Save returns the user to the status page.** It does not stay in the editor.

**Log Level** per piston: None / Minimal / Full. If None, saving clears the log. If Minimal or Full, saving preserves the log. Matches WebCoRE behavior exactly.

---

## 7.1 Drag and Drop Rules — MUST BE DEFINED BEFORE EDITOR DATA MODEL

**Status: Open — blocking editor implementation.**

Drag and drop behavior affects the document data model, undo/redo, and state management. It cannot be deferred to implementation.

**Questions to resolve:**
* Can statements be dragged freely across any boundary, or only within their containing block?
* Can a statement be dragged into or out of an if/else branch?
* Can a statement be dragged into or out of a repeat block?
* What happens to indentation and nesting when a statement is dropped at a new level?
* Is undo supported for drag operations? If so, how many levels?
* What is the visual affordance for a valid vs invalid drop target?

**Proposed conservative default (to be confirmed):**
* Statements can be freely reordered within their containing block
* Dragging across block boundaries (into or out of an if/else branch, into or out of a repeat) is not supported in v1 — the user must cut and re-add at the new location
* This simplifies the data model significantly and avoids complex nesting mutation logic
* Add cross-block drag as a v2 feature once the data model is stable

**This must be confirmed before the editor data model (Section 7.2) is designed.**

---

## 7.2 Nested Statement Tree Data Structure — MUST BE DEFINED BEFORE EDITOR DATA MODEL

**Status: Open — blocking editor and compiler implementation.**

The editor manipulates a tree of statements in memory. This tree is serialized to piston JSON on save. A developer cannot build the editor without this defined.

**Proposed structure (to be confirmed and expanded):**

Every statement node has at minimum:
```json
{
  "id": "stmt_001",
  "type": "if_block",
  "condition": { ... },
  "true_branch": [ /* array of statement nodes */ ],
  "false_branch": [ /* array of statement nodes */ ],
}
```

```json
{
  "id": "stmt_002",
  "type": "with_block",
  "target_role": "driveway_light",
  "tasks": [ /* array of task nodes */ ]
}
```

```json
{
  "id": "stmt_003",
  "type": "repeat_block",
  "condition": { ... },
  "body": [ /* array of statement nodes */ ]
}
```

```json
{
  "id": "stmt_004",
  "type": "wait",
  "until": "23:00:00"
}
```

**Open questions to resolve:**
* How is else_if represented — as a nested structure within the false_branch, or as a sibling node with its own condition?
* How are Only When restrictions attached to a statement — as a child property or a sibling node?
* What is the maximum nesting depth enforced by the editor vs the compiler?
* How does the editor generate and maintain unique statement IDs during editing (add, delete, reorder)?
* How does the compiler walk this tree — depth-first recursive descent?

**This structure must be finalized before any editor or compiler code is written.**

---

## 7.3 Navigation and State Transitions — MUST BE DEFINED BEFORE FRONTEND CODING

**Status: Open — blocking frontend implementation.**

**Unsaved changes:**
If a user navigates away from the editor with unsaved changes, PistonCore shows a prompt: *"You have unsaved changes. Save, Discard, or Cancel?"* Cancel returns the user to the editor. Discard navigates away without saving. Save triggers the save pipeline then navigates.

**Back button behavior:**
The back button on the status page returns the user to the folder their piston is in — not always the root piston list. If the piston is in Uncategorized, the back button returns to the list with Uncategorized selected.

**Browser refresh:**
On refresh, PistonCore restores: the currently open folder in the piston list, the last viewed status page (if on the status page), and the editor state if in the editor (from local browser storage — unsaved changes preserved).

**WebSocket drop while in editor:**
If the WebSocket connection to HA drops while the user is in the editor: show a reconnecting banner at the top of the editor, disable the Deploy button, disable wizard capability fetching, preserve all unsaved work in local browser storage. When the connection is restored, remove the banner and re-enable all features.

---

## 7.4 Role Creation During Piston Building — MUST BE DECIDED BEFORE EDITOR DATA MODEL

**Status: Open — blocking editor data model.**

When a user picks a device in the wizard while building a piston from scratch, what is created internally — a named role or a hard entity reference?

**Options:**
* **Always create roles automatically** — every device picked gets an auto-generated role name (e.g., `device_1`, `driveway_light`). This makes every piston inherently shareable but adds friction for single-user builds.
* **Always use hard entity references internally, convert to roles on Snapshot export** — the editor stores real entity IDs internally. On Snapshot export, PistonCore automatically generates roles from the entity references and strips the IDs. The user never manages roles unless they explicitly share.
* **Ask the user** — on first device pick, ask: *"Are you building this piston just for yourself, or to share?"* Shareable path creates roles; personal path creates hard references.

**Recommendation for discussion:** Option B (hard references internally, auto-roles on export) is the simplest user experience and avoids surfacing the role concept to users who never share. The role system remains fully functional for sharing — it just happens automatically on export rather than during building.

**This must be decided before the editor data model is designed.**

---

## 8. The Condition, Trigger, and Action Wizard

When a user clicks any ghost text or edits an existing statement, a **multi-step modal wizard** opens. Triggers, conditions, and actions all use this same wizard pattern.

Each step's options are generated from HA based on what was selected in the previous step. PistonCore never maintains its own device capability database — it always asks HA via WebSocket.

The wizard builds a plain English sentence at the top as the user progresses. This sentence is the breadcrumb.

**Condition wizard flow:**
1. What to compare — Physical Device, Variable, Time, Date, Location/Presence, HA System
2. Pick the device — searchable by name or area
3. Pick the capability or attribute — live from HA WebSocket
4. Pick the operator — appropriate to the selected capability (Section 9)
5. Compare to — value, another device, a variable, or a time

**Action wizard flow:**
1. Pick the device
2. Pick the capability or service — live from HA WebSocket
3. Configure the service call parameters — fields generated from HA's service schema

**Trigger wizard flow:**
Same as condition wizard with trigger-specific operators and an optional duration field ("and stays for [duration]") when relevant.

### 8.1 Wizard Capability Map — MUST BE DEFINED BEFORE WIZARD CODING

**Status: Open — blocking wizard implementation.**

A developer needs a map of: given a device of type X with capability Y, what operators are valid, what value types are valid for comparison, and what service parameters appear in the action wizard. This is the core logic that makes the wizard context-aware.

**Questions to resolve:**
* Is this map stored as a data file the wizard reads, or as code logic inside the wizard?
* How does the map handle capability types not in the map — fall through to "Other / Manual"?
* How does the map version — if HA changes what a capability supports, does the map update?
* Who maintains this map — is it community-contributed to the repo?

**This must be defined before wizard coding begins.**

---

## 9. Comparison Operators — Full Supported Set

All operators written in plain English. Symbols never used for logic. Device states use native HA values — never yes/no abstraction.

### Condition Operators

| Operator | Notes |
|---|---|
| is / is not | |
| is any of / is not any of | |
| is between / is not between | |
| is greater than | |
| is less than | |
| is greater than or equal to | |
| is less than or equal to | |
| was true for at least [duration] | PyScript only |
| was false for at least [duration] | PyScript only |
| is before [time] | |
| is after [time] | |
| is between [times] | |
| date is before | |
| date is after | |
| date is between | |

### Trigger Operators

| Operator | Notes |
|---|---|
| changes | any value change |
| changes to | specific value |
| changes from | specific previous value |
| changes from X to Y | specific transition |
| rises above | numeric |
| drops below | numeric |
| changes to [value] and stays for [duration] | compiles to HA native `for:` |
| gets [event] | button/momentary, specific event |
| gets any | button/momentary, any event |
| receives [attribute value] | specific attribute subscription |
| event occurs | any event on attribute |

### Logical Group Operators

* AND
* OR

XOR not supported. `followed by` not supported. `range` deferred to v2.

### Multi-Device Aggregation

* any of [devices] is/are
* all of [devices] are
* none of [devices] are

---

## 10. Export and Import

### Snapshot (📷 green label)

Anonymized export. All entity mappings stripped. Roles and logic preserved. Safe to post publicly. New piston ID generated on import.

### Backup (📷 red label)

Full export including entity mappings. Labeled clearly: *"For your own restore only — do not share."* Original piston ID preserved on import. If entities exist in the importing HA instance they are used as-is. If not, falls through to role mapping screen.

### Import Methods

* Paste JSON directly
* Paste a URL pointing to any raw JSON file
* Upload a `.piston` file
* AI-generated JSON pasted from any AI assistant

---

## 11. AI Prompt Feature

The main piston list page has a **Copy AI Prompt** button. **This feature needs redesign before implementation.**

**The problem with the v0.6 design:** Copying only the JSON format spec gives an AI no context about the user's actual devices or intent. The AI produces generic output that still requires significant manual work.

**Revised design (to be finalized):**
The copied prompt must include at minimum:
* The PistonCore JSON format specification
* The role labels defined in the piston being worked on (if editing an existing piston)
* A plain English summary of the user's mapped devices by friendly name — not entity IDs

User data privacy rule: **No entity IDs are ever included.** Friendly names only. The AI never sees HA-internal identifiers.

**This feature must be redesigned in detail before implementation.**

---

## 12. File Signature and Manual Edit Detection

Every compiled file written by PistonCore includes a signature header:

```
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: a3f8c2d1 | pc_version: 0.7 | pc_hash: [hash of compiled content]
```

On deploy, if the existing file's hash does not match what PistonCore expects, it stops and shows a **diff** of exactly what changed, then asks: **Overwrite** or **Cancel**.

PistonCore only operates on files that contain its own signature. It never touches any other file.

---

## 13. Pre-Save Validation Pipeline

### On Save (always runs — no HA involvement)

Stage 1 — Internal validation:
* No triggers defined
* Action references a device not found in HA
* Global variable referenced but not defined
* Required role not mapped

Results appear as warnings/errors on the status page validation banner immediately after save.

### On Deploy (runs after save, before writing to HA)

Stage 2 — Compile to sandbox (temporary location, not production HA directories)

Stage 3 — HA validation:
* **YAML pistons:** `hass --script check_config` validates the entire HA config including the sandbox file. **This is slow and runs on the full config, not just the piston file.** It runs only on deploy, not on save. If this proves too disruptive during implementation testing, fall back to deploy-time only with a clear user note that YAML validation is best-effort.
* **PyScript pistons:** `py_compile` syntax check against the sandbox. Best-effort — catches syntax errors but not all runtime errors.

Stage 4 — Decision:
* Pass → file moves to production, hash written to header, user lands on status page with success
* Fail → nothing written to production, user sees validation error (raw error shown plus plain English explanation for known errors)

---

## 14. Safety Rules — Core Lockdown

PistonCore is architecturally forbidden from:
* Modifying `.storage/` folders
* Editing `configuration.yaml` directly (except the one-time additions during companion setup, which require explicit user confirmation — see Section 17.3)
* Accessing `home-assistant_v2.db`
* Writing to any directory it did not create
* Writing to any file that does not contain its own signature header
* Calling any undocumented HA internal API

---

## 15. Logging and Debugging

### Log Level — Per Piston

Set at the bottom of the editor: None / Minimal / Full.

* **None** — no logging. Saving clears the existing log.
* **Minimal** — trigger events and errors only
* **Full** — every condition checked, every action, pass/fail, timing

If Minimal or Full, saving preserves the existing log — exactly as WebCoRE did.

### Log Message Action

A "Log message" statement can be added anywhere in the action tree. Message types: Info / Warning / Error / Debug / Trace (color-coded). Manual log messages always appear regardless of log level setting, even when level is None. Matches WebCoRE behavior exactly.

### Trace Mode

Toggle on status page. Test must be pressed at least once on a new piston before Trace becomes available.

When Trace is on and the piston runs:
* Trace numbers overlay log entries matching condition and action line numbers
* Trace data transmitted via custom PistonCore WebSocket event
* Trace data never written to the main HA system log
* When Trace is off, no debug data generated or transmitted at all

### Test / Dry Run — Behavior Differs by Compile Target

**YAML pistons:** Dry run is fully supported — shows what actions would be called without calling them.

**PyScript pistons:** Dry run executes the logic but attempts to skip service calls by wrapping them in a dry-run flag that the compiled template checks. **If this proves too complex or unreliable during implementation, fall back to:** PyScript test mode fires the piston live with a clear warning: *"This will execute real actions on your devices."* No silent fake dry run.

This difference must be clearly documented in the UI. Developer to assess the dry-run flag approach viability before committing to it.

### Run Status Reporting

Compiled pistons fire a standard HA event at completion (success or failure):
* PyScript: `hass.bus.fire` in the compiled template
* YAML: `event:` action at the end of the automation

The companion listens for these events via its own WebSocket subscription to HA and relays run status to the PistonCore Docker. The run log updates from this data.

**Important:** HA event delivery is best-effort, not guaranteed. Under load or during WebSocket reconnection, events can be lost. The UI must handle missing status gracefully — show *"Status unknown"* rather than wrong information. Run log entries timestamp when received, not just when the piston ran.

**Open question:** Confirm that YAML automations can fire a custom event on completion and document the exact syntax. Confirm `hass.bus.fire` works as expected in compiled PyScript files.

---

## 16. Compilation and Deployment

### Output File Locations

* Simple pistons → `<ha_config>/automations/pistoncore/<piston_name>.yaml`
* Complex pistons → `<ha_config>/pyscript/pistoncore/<piston_name>.py`
* Globals → `<ha_config>/pistoncore/globals.json`
* PistonCore never writes outside its own named subfolders
* PistonCore never writes to any file that does not contain its own signature header

### Call Another Piston — Mode Limitations

* **PyScript → PyScript:** Supported, implement cleanly
* **YAML → YAML:** Fire-and-forget only. The called piston is triggered but PistonCore cannot wait for it to complete. User is warned of this limitation in the wizard: *"Calling another piston from a Simple piston will trigger it but will not wait for it to finish. Switch to Advanced mode if you need to wait for the called piston to complete."*
* **YAML → PyScript or mixed:** If the user needs to call another piston and wait, this forces conversion to PyScript. The conversion prompt applies.

### Deployment Flow

1. User clicks Deploy to HA
2. Pre-save validation pipeline runs (Section 13)
3. If validation passes, companion writes file to production directory
4. Companion calls the HA reload service
5. Automation is live within seconds
6. PistonCore confirms success or reports failure in plain English

### Manual Edit Warning

If a compiled file's hash does not match on deploy, PistonCore shows a diff and asks Overwrite or Cancel before touching anything.

---

## 17. The Two Components

### 17.1 PistonCore Editor (Docker Container)

* **Backend:** Python (FastAPI)
* **Frontend:** Vanilla JS, HTML, and CSS — no framework
* **Runs on:** Any Docker host — Unraid, Raspberry Pi, NAS, cloud VPS
* **Default port:** 7777 (configurable)
* **Piston storage:** JSON files in a mounted Docker volume
* **No internet required** for local use

Unraid Community Apps template planned.

### 17.2 First-Run Setup — Two Phase

**Phase 1 — Editor only (immediate):**
User enters HA URL and long-lived access token. PistonCore opens a WebSocket connection to HA and pulls all devices, entities, capabilities, areas, and services. The user can begin building and editing pistons immediately. No companion required.

**Phase 2 — Companion (prompted when needed):**
When the user first attempts to deploy a piston to HA, PistonCore detects that the companion is not installed and prompts installation via HACS.

### 17.3 PistonCore Companion (HA Custom Integration)

Installed into Home Assistant via HACS.

#### Setup Mode Selection

Before making any changes to HA, the companion presents three options:

**Option A — PyScript Only (Recommended for existing installations)**
*"PistonCore will compile all pistons to PyScript. Your existing automations are completely untouched. No changes to your automation configuration are made. This is the safest choice for existing HA installations."*
* No `!include_dir_merge_list` change needed
* No conflict with existing or future GUI automations
* PyScript custom integration must be installed via HACS
* Full PistonCore feature set available

**Option B — Full Mode (Recommended for new/fresh HA installations only)**
*"PistonCore will support both Simple (YAML) and Complex (PyScript) pistons. This requires a change to your configuration.yaml that may affect how your existing GUI automations behave. Recommended only for new HA installations or users prepared to manage their existing automations carefully."*
* Requires `!include_dir_merge_list` configuration.yaml change
* May affect GUI automation editor behavior — confirmed real-world risk
* Requires double confirmation (two separate screens)

**Option C — Cancel**
*"Make no changes. Exit setup. Your HA installation is unchanged."*

The chosen mode is stored in PistonCore settings and displayed prominently in both the PistonCore UI and the HA companion card. Changing modes later requires going through the same warning and confirmation flow again.

#### Confirmation Screen — All Modes

Before making any changes, PistonCore displays a plain English summary of every change it is about to make:

*"PistonCore needs to make the following changes to your Home Assistant installation. Please review and confirm:*

* *Add `pyscript: allow_code_remote: true` to your configuration.yaml — this allows PistonCore to reload PyScript files after deployment without restarting HA.*
* *Create folder `<ha_config>/automations/pistoncore/` — compiled YAML automations will be written here. (Full Mode only)*
* *Create folder `<ha_config>/pyscript/pistoncore/` — compiled PyScript automations will be written here.*
* *Create file `<ha_config>/pistoncore/globals.json` — global variables will be stored here.*
* *(Full Mode only) Add `automation: !include_dir_merge_list automations/` to your configuration.yaml — this allows HA to load automations from subfolders, including the pistoncore subfolder.*

*No other changes will be made. PistonCore will never modify any file it did not create."*

User must click **I Agree — Make These Changes** to proceed, or **Cancel** to abort with nothing changed.

#### Double Confirmation for Full Mode

Full Mode users see two separate confirmation screens before any changes:

**Screen 1:** Everything in the confirmation screen above, specific to Full Mode changes.

**Screen 2:** *"Important — going forward, creating automations directly in the Home Assistant GUI may cause unexpected behavior with PistonCore's YAML pistons. We recommend managing all automations through PistonCore from this point. Do you understand and wish to continue?"*

Both confirmations are logged in PistonCore settings for support reference.

#### Existing Configuration Detection

Before presenting the mode selection screen, the companion scans existing HA configuration and warns specifically if complex existing YAML automation includes or GUI automations are detected. Never assumes a clean configuration.

#### configuration.yaml Additions (exact lines)

Full Mode:
```yaml
automation: !include_dir_merge_list automations/
```

All modes (PyScript):
```yaml
pyscript:
  allow_code_remote: true
```

These are the only configuration.yaml modifications PistonCore ever makes. After this one-time setup, deploying new pistons requires only writing the file and calling the appropriate reload service — no further configuration.yaml changes ever needed.

#### Companion Capabilities

* Fetch full device capability profiles from HA (all attributes, all supported states, all services per device)
* Write compiled piston files to the correct HA directories
* Write globals.json to `<ha_config>/pistoncore/`
* Execute `hass --script check_config` for YAML validation
* Execute `py_compile` for PyScript syntax checking
* Call `automation/reload` after YAML deployment
* Call `pyscript.reload` after PyScript deployment
* Listen for PistonCore run status events via WebSocket subscription and relay to the Docker editor
* Transmit Trace debug data via custom WebSocket event

#### Compiler Template System

**Status: Not yet defined — do not write compiler code until this is designed.**

The design mentions compiler templates as external and user-replaceable but has not defined: the template format, where they live on the Docker volume, how the compiler fills them in from piston JSON, or what "user replaceable" means in practice. This requires a dedicated design discussion before coding.

---

## 18. The JSON Sharing Format

### Role System and Piston ID

* Device references use **roles** — named placeholders, not hard entity IDs
* The actual entity IDs live in a `device_map` — never included in Snapshot exports
* Format is versioned

**Role creation during piston building:** See Section 7.4 — this decision is open and must be made before the editor data model is designed.

**Piston IDs:**
* Snapshot import always generates a new ID
* Backup import preserves the original ID and restores if entities exist in the importing HA instance

### Example Piston JSON

```json
{
  "pistoncore_version": "1.0",
  "id": "a3f8c2d1",
  "name": "Driveway Lights at Sunset",
  "description": "Turns on driveway lights at sunset and off at 11pm",
  "mode": "single",
  "compile_target": "yaml",
  "roles": {
    "driveway_light": {
      "label": "Driveway Light",
      "domain": "light",
      "required": true
    }
  },
  "device_map": {
    "driveway_light": "light.driveway_main"
  },
  "variables": [],
  "triggers": [
    {
      "type": "sun",
      "event": "sunset",
      "offset_minutes": 0
    }
  ],
  "conditions": [],
  "actions": [
    {
      "id": "stmt_001",
      "type": "with_block",
      "target_role": "driveway_light",
      "tasks": [
        {
          "type": "call_service",
          "service": "light.turn_on",
          "data": { "brightness_pct": 100 }
        }
      ]
    },
    {
      "id": "stmt_002",
      "type": "wait",
      "until": "23:00:00"
    },
    {
      "id": "stmt_003",
      "type": "with_block",
      "target_role": "driveway_light",
      "tasks": [
        {
          "type": "call_service",
          "service": "light.turn_off"
        }
      ]
    }
  ]
}
```

---

## 19. Global Variables Management

Managed from PistonCore's main settings screen.

The global variables screen shows:
* All defined globals with their current values and types
* Which pistons reference each global (scanned from PyScript comment headers)
* Add, edit, and delete globals

Changing a global value writes to globals.json immediately — no redeployment of pistons needed.

A **Global Variables drawer** is accessible from the main piston list page as a read-only reference panel.

---

## 20. Folders

Single-level user-defined folders. Nested folders out of scope for v1.

* Created from the main piston list page only
* New pistons land in **Uncategorized** automatically — no prompt on creation
* Folder assignment via dropdown on status page or in editor header
* Pistons with no folder appear in Uncategorized in the folder sidebar

---

## 21. V1 Core Feature Set

**Statement types:**
If Block, With/Do block, Only When restrictions, Wait (fixed duration), Wait for state with timeout, Set variable, Repeat loop, For each, Log message, Call another piston, Stop

**Editor features:**
Structured document editor — indented tree, inline ghost text insertion, WebCoRE-matching keywords, drag and drop block reordering, Global variables drawer on main list page, Simple/Advanced mode toggle, per-statement cog in wizard (TEP/TCP/Execution Method), Snapshot and Backup export, duplicate piston, import from JSON/URL/file, piston status page as hub, save returns to status page, run log with plain English detail, log level per piston with WebCoRE-matching save behavior, log message action with five color-coded types, trace mode via WebSocket, test required before trace available, pause/resume, compiler templates (external, user replaceable — format TBD), device picker with type-to-filter search, unknown device fallback — one-time define screen, dynamic capability-driven multi-step wizard, trigger wizard with duration field, full operator set (Section 9), true/false last evaluation result on list, copy AI prompt button (redesign required), automatic validation on save, pre-deploy validation pipeline, file signature and hash system, failure notification, My Device Definitions screen, piston ID system

---

## 22. Out of Scope for V1

* Mobile app
* Multi-user authentication
* Central cloud server
* Direct WebCoRE piston import / migration
* Piston marketplace or registry
* HA dashboard status cards
* Version history and rollback
* Nested folders
* `followed by` sequence operator
* XOR logical operator
* `range` trigger operator — deferred to v2
* Cross-block drag and drop — deferred to v2

---

## 23. PyScript Independence Warning

The "uninstall PistonCore and automations keep running forever" promise is unconditional for Simple YAML pistons. For Complex PyScript pistons it depends on PyScript remaining installed.

**Simple YAML pistons:** Permanently independent. Truly run forever without PistonCore or PyScript.

**Complex PyScript pistons:** Require PyScript to remain installed. If PyScript is removed: all complex pistons stop running, trace/status reporting stop working, globals.json reads fail.

This is an acceptable known risk. The experimental warning at first launch covers this. Documentation must be clear about which promise applies to which piston type.

---

## 24. Distribution Plan

| Channel | Purpose | When |
|---|---|---|
| GitHub (public, MIT license) | Source code, issues, docs, contributions | Day 1 |
| Docker Hub | Container image for self-hosting | First working build |
| Unraid Community Apps | One-click install template | After Docker image is stable |
| HACS | Companion integration | After companion works |
| HA Community Forums | Announcement and feedback | After MVP works end to end |

---

## 25. Development Log

### Session 1 — April 2026
Project conceived. Design document written. GitHub repo created.

### Session 2 — April 2026
FastAPI backend scaffolded. React frontend scaffolded. Companion skeleton built. 19 API endpoints verified. Compiler verified against example piston. All code now in session2_archive.

### Session 2 Strategy Review — April 2026
Extensive WebCoRE screenshot review. Design rewritten as v0.5. Major changes to UI model, architecture, scope. Frontend decoupled from React. Condition wizard redesigned as dynamic multi-step. Status page established as piston hub. Compiler template system designed. V1 scope tightened.

### Session 3 — April 2026
Design refined through WebCoRE screenshot analysis. Six open questions documented for next session. DESIGN.md updated to v0.5. No code written.

### Session 4 — April 2026
All six open questions resolved. Full design review against WebCoRE wiki. Frontend framework confirmed as vanilla JS/HTML/CSS (cousin's implementation). DESIGN.md updated to v0.6. No code written.

### Session 5 — April 2026
DESIGN.md v0.7 produced incorporating all corrections from notes files and Claude Projects review. Key changes from v0.6:

- **Global variables storage corrected** — companion writes globals.json to `<ha_config>/pistoncore/`, PyScript reads at runtime (sandbox validation required first, three fallback solutions defined)
- **Yes/No variable type corrected** — restricted to HA boolean helpers only; device states use native HA values
- **Phase 1 data fetching corrected** — WebSocket API, not REST API; specific required commands listed
- **Dry run corrected** — YAML gets preview, PyScript gets live-fire with warning or dry-run flag (developer to assess viability)
- **Setup flow redesigned** — PyScript Only vs Full Mode as explicit choice; double confirmation for Full Mode; existing config detection required
- **PyScript is primary compile target** — YAML compiler is secondary
- **Auto-detection boundary made explicit** — ten testable conditions that force PyScript; no judgment calls
- **Companion setup made explicit** — exact configuration.yaml lines, plain English confirmation screen, per-item change list
- **Four Gemini gaps documented** — navigation state (7.3), nested tree structure (7.2), save pipeline (Section 13 stage notes), wizard capability map (8.1)
- **Four Claude Projects findings added** — auto-detection rules (3.1), check_config scope note (Section 13), AI prompt redesign (Section 11), role creation open question (7.4), drag and drop must be defined before data model (7.1)
- **PyScript independence warning added** — Section 23 clarifies which independence promise applies to which piston type
- **Run status reporting mechanism defined** — HA events, companion WebSocket relay, best-effort delivery acknowledged
- **Call another piston limitations documented** — per compile target
- **Frontend confirmed** — vanilla JS, HTML, CSS

**Open items blocking coding:**
1. Drag and drop rules (Section 7.1)
2. Nested statement tree data structure (Section 7.2)
3. Role creation during piston building (Section 7.4)
4. Wizard capability map (Section 8.1)
5. Compiler template system (Section 17.3)
6. globals.json sandbox validation (Section 4.1)
7. AI Prompt feature redesign (Section 11)
8. Editor save pipeline (Section 13 — on-save stage needs more detail)

No code written this session.

---

## 26. Standing Questions — Ask Every AI Reviewing This Design

* What technical assumptions in this design are most likely to be wrong?
* What features described here cannot work the way they are described?
* What has been left undefined that will block a developer from writing code?

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
