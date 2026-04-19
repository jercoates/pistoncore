# PistonCore Design Document

**Version:** 0.6
**Status:** Draft — Ready for Development
**Last Updated:** April 2026

---

## 1. What Is PistonCore?

PistonCore is an open-source visual automation builder for Home Assistant, designed to feel immediately familiar to anyone who has used WebCoRE on SmartThings or Hubitat. It lets you build complex automations — called **pistons** — through a structured UI using dropdowns populated directly from your actual HA devices, without ever writing YAML or Python manually.

**PistonCore is not a home automation platform. It is a tool for building automations on top of one.**

It does not add devices, manage integrations, or extend HA's capabilities in any way. It reads what HA already has, gives you a better way to write logic against it, and compiles that logic to native HA files that run permanently and independently.

**PistonCore does not need to be running for your automations to work.** Compiled files are standard HA automation files. If you uninstall PistonCore tomorrow, every piston you built keeps running forever. No lock-in, no dependency on a running engine, no proprietary runtime format.

---

## 2. Core Philosophy

These principles guide every design decision:

* **No required central server.** PistonCore runs locally on Unraid, a Raspberry Pi, any Docker host, or optionally on a cloud server someone else hosts. Nothing depends on servers controlled by the project maintainers.
* **Automations are yours.** Compiled files are standard HA files. PistonCore is the source of truth for your pistons — the compiled files on HA are just the output.
* **PistonCore never touches files it did not create.** Your existing hand-written automations, scripts, and YAML files are completely safe. PistonCore only ever writes to its own subfolder. This rule is enforced architecturally via file signature checking — see Section 12.
* **Shareable by design.** Pistons are stored and shared as plain JSON. Paste them anywhere — a forum post, a GitHub Gist, a Discord message, a text file. Import from a URL or paste directly. No account required, no server involved.
* **AI-friendly from day one.** The piston JSON format is simple and fully documented so AI assistants can generate valid pistons from a plain English description. A user can describe what they want to an AI and paste the result straight into the editor.
* **Open and community driven.** MIT licensed. Anyone can host, fork, modify, or contribute. The project belongs to the community.
* **Familiar to WebCoRE users.** The piston concept, structure, terminology, keywords, and logging behavior are intentionally close to WebCoRE so experienced users can pick it up immediately with minimal relearning.
* **Plain English everywhere, icons plus labels for universal actions.** Logic operators, conditions, and descriptive text are always written in plain English. Buttons that perform actions use an icon paired with a plain English label — never an icon alone and never a label alone on universal actions. See Section 7 for UI rules.
* **Silent by default.** PistonCore generates no debug output unless the user explicitly activates tracing for a specific piston. System stability takes priority over UI updates.
* **Minimum footprint in HA.** PistonCore touches only what is absolutely necessary. It uses the HA REST API for reads and the companion integration for writes. It is architecturally prohibited from touching HA core files.

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

PistonCore automatically decides what to compile to based on what your piston does. You never choose — it detects it:

* **Simple piston → compiles to a HA YAML automation file**
  * No variables used
  * Simple conditions, no deep nesting
  * No loops, no waits mid-piston
  * Straightforward service calls

* **Complex piston → compiles to a PyScript `.py` file**
  * Variables used
  * Nested if/else trees
  * Loops or repeating actions
  * Wait for a set time mid-piston
  * Wait for an entity to reach a state (with optional timeout)
  * Counters or computed values

Both compile targets are native HA files and run without PistonCore being active.

---

## 4. Variables

PistonCore has two types of variables, both important and both included in v1.

### 4.1 Global Variables

Defined once at the PistonCore level. Available to every piston. Persist permanently until you change them.

**These are house-level settings.** Real world examples:

* A **battery check piston** reads a global Devices variable containing all your battery-powered sensors. Add a new sensor to the house, add it to the global once — the piston picks it up automatically.
* An **announcement piston** reads a global Device variable pointing to your speaker setup. Change your speakers, update the global once, every piston that uses it updates automatically.
* A **house mode** global Text variable ("home", "away", "vacation", "night") that dozens of pistons can check.

**Storage and sync:** Global variables are stored in a JSON file on the Docker volume. This JSON file is the permanent master record. When a user saves a change to a global variable in the PistonCore UI, the value is written to the JSON file and immediately pushed to HA's live memory in the same operation. No manual sync step is required.

**Startup sync:** On HA startup, an init script reads the globals JSON and pushes all values into HA live memory to restore state. If the globals file cannot be found at startup, a persistent notification appears in the HA UI: "CRITICAL: PistonCore storage not found. Using default failsafe values." Safe hardcoded defaults prevent automations from running in an unknown state.

**Version checking:** The globals JSON includes a PistonCore version field. The startup sync script checks that the file format matches the running version before loading. A mismatch triggers a notification rather than loading potentially incompatible data.

**Manual edit warning:** The globals JSON file includes a prominent comment warning that manual edits are at the user's own risk and may corrupt piston behavior. PistonCore always treats the file as the master — if it is corrupted, PistonCore will detect this and alert rather than silently load bad data.

**PyScript variable tracking:** When a piston compiles to a `.py` file and uses global variables, the compiled file includes a comment header listing every global variable it references. This allows PistonCore to scan the compiled folder and know which globals are in use without maintaining a separate database.

### 4.2 Piston Variables

Defined inside a single piston. Only exist while that piston is running. Forgotten when the piston finishes.

**These are piston-level temporary state.** Real world examples:

* A motion lighting piston tracks whether the light was already on before motion fired — so it can restore the original state when motion clears.
* A temperature piston tracks the last reading to compare against the current one to detect rapid changes.
* A counter tracking how many times something happened within one piston run.

### 4.3 Variable Types

Both global and piston variables use the same types:

| Type | Description | Example |
|---|---|---|
| Text | A word or sentence | "away", "Good morning" |
| Number | Any numeric value | 75, 0.5, -10 |
| Yes/No | True or false, on or off | Yes, No |
| Date/Time | A point in time or duration | 10:30 PM, 45 minutes |
| Device | A single HA entity reference | Your driveway light |
| Devices | A collection of HA entity references | All your battery sensors, all your announcement speakers |

**Device and Devices variables always show the friendly name, never the entity ID.**

**Devices variables can contain mixed device types** — your emergency announcement Devices variable can contain both Sonos speakers and Alexa devices in the same list.

---

## 5. Device and Entity Model

### Device-Level Picker

PistonCore operates at the device level, not the entity level. One physical device (such as a Sonos speaker) exposes multiple entities in HA — media player, volume sensor, shuffle state, and so on. These all share the same friendly name because they represent the same physical thing.

The user always picks a physical device, not an entity ID. PistonCore never exposes entity IDs to the user.

The device picker supports search by friendly name, device name, or area. It is a type-to-filter field, not a static dropdown.

### Capability-Driven Attribute Selection

After picking a device, the user picks which capability or attribute they want to act on or evaluate. This list is fetched live from HA for that specific device — it is never a hardcoded list maintained by PistonCore. The list always reflects exactly what HA reports for that device at that moment.

This is a multi-step flow:
1. Pick the device (by friendly name, device name, or area)
2. Pick the capability or attribute from the live list HA returns for that device
3. Pick the comparison or action based on that capability

Entity resolution — determining which underlying HA entity handles the selected capability — is done internally by PistonCore. The user never sees or selects entity IDs.

### Unknown Device Fallback

PistonCore always attempts to pull capability data from HA first. This covers the vast majority of devices.

If HA returns no usable capability data for a device, PistonCore shows a one-time **"Define this device"** screen for that specific device. The user labels each entity exposed by that device in plain English ("This is the motion sensor", "This is the battery level", "This is the tamper alert"). PistonCore stores that definition locally on the Docker volume.

From that point on, the device behaves exactly like any HA-known device in the picker — the user's labels appear in capability dropdowns. The definition is editable at any time from a **"My Device Definitions"** screen in PistonCore settings.

This fallback triggers once per device, not once per piston. Users who add devices regularly will see it occasionally for new unknown devices only.

### Why This Requires Full Device Profiles from the Companion

The companion integration must fetch full device capability profiles from HA — not just entity lists. Every attribute, every supported state, every available service for every device. The condition wizard and action builder depend entirely on this data being complete and current.

---

## 6. Piston Structure

Every piston has the following sections in order. All sections except the header are collapsible.

A piston is built from **Statements**. There are two kinds:

* **Decisional statements** — control the flow of execution: `if`, `else if`, `else`, `end if`, `repeat`, `for each`, `while`, `end repeat`
* **Executive statements** — execute things: `with [device] do [action]`, `set variable`, `wait`, `wait for state`, `log message`, `call another piston`, `stop`

This maps directly to WebCoRE's statement model and uses the same keywords.

### 6.1 Header

* **Name** — human readable, becomes the filename when compiled
* **Description** — optional, shown in piston list and sharing previews
* **Folder** — which user-defined folder this piston lives in (set here or on the status page)
* **Mode** — what happens if the piston triggers while already running:
  * *Single* — ignore new triggers while running (default)
  * *Restart* — cancel current run and start fresh
  * *Queued* — finish current run then start next
  * *Parallel* — run multiple instances simultaneously
* **Enabled / Disabled** — pause a piston without deleting it

### 6.2 Piston Variables

Optional. Defined at the top, available throughout this piston only.
Clearly labeled: *"Temporary — forgotten when this piston finishes running."*
Only visible in Advanced mode.

### 6.3 Triggers

What starts the piston. One or more triggers. Uses the same multi-step wizard as conditions and actions (see Section 8).

Trigger types:
* Device or entity state change — `changes`, `changes to`, `changes from`, `changes from X to Y`
* Numeric — `rises above`, `drops below`
* State with duration — `changes to [value] and stays for [duration]` — compiles to HA's native `for:` parameter
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

Conditions use plain English operators written out in full — never symbols. Multiple conditions are grouped with **AND** or **OR** — written in full, never symbols. XOR is not supported.

Condition setup uses the same device-level picker and live capability list described in Section 5.

### 6.5 Action Tree

A top-to-bottom sequence of statements that can branch. Uses `with / do / end with` and `if / then / else / end if` keywords matching WebCoRE. See Section 8 for the wizard that builds each statement.

---

## 7. The Editor UI

### Overall Feel

The editor is a **structured document viewed top to bottom**. Logic is always visible — indentation shows nesting. It reads like a well-formatted script, not a web form. A user who has used WebCoRE should be able to build a basic piston within a few minutes without reading documentation.

Keywords like `if`, `then`, `else if`, `else`, `end if`, `with`, `do`, `end with`, `repeat`, `for each`, `only when` are the structural anchors — matching WebCoRE's keywords exactly.

Indentation increases with nesting depth. Deeply nested logic is deeply indented.

### UI Rules — No Exceptions

1. **No pictograms for logic.** AND/OR is written "AND" and "OR". Equals is written "equals". Greater than is written "is greater than". No symbols that require learning a visual language.
2. **No entity IDs ever visible to the user.** All entity references show the friendly name, device name, and area. Entity IDs are handled internally.
3. **All dropdowns populated from live HA data.** You never type a device name or service name. You always pick from what HA reports.
4. **Sections are collapsible** with clear plain English text labels — not icons alone.
5. **Errors are plain English.** "Action 3 failed: the device you selected was not found in Home Assistant" — not technical error codes.
6. **Buttons that perform actions use icon plus plain English label.** Example: `📷 Snapshot`, `📷 Backup`, `▶ Test`, `✎ Edit`. Never icon alone.
7. **Automatic validation on save.** When a piston is saved, PistonCore immediately checks for problems and displays any warnings or errors on the status page without the user having to ask.
8. **Compiled output is never shown to the user.** The YAML or PyScript output is hidden. It is an implementation detail, not a user-facing feature.

### Frontend Framework

The frontend framework is not prescribed. The feel requirement — structured document editor, indented logic tree, inline ghost text insertion, wizard modals — takes priority over any technology preference. The session2_archive contains prior React scaffolding but it is not required. Use whatever framework best produces this feel.

### Inline Ghost Text — Primary Insertion Method

At every valid insertion point in the document, ghost text appears inline:
* `+ add a new statement`
* `+ add a new task`
* `+ add a new restriction`

Clicking any ghost text opens the multi-step wizard modal for that insertion point. This is the primary way statements are added — not a toolbar.

### Simple / Advanced Mode Toggle

A single toggle at the top of the editor. Default is Simple.

* **Simple mode** — hides piston variables, limits to most common trigger and action types, plain English presentation throughout
* **Advanced mode** — shows everything: piston variables, all trigger types, all action types, loops, wait-for-state, nested if/else to any depth, call another piston, TEP/TCP policy options in wizard

Switching modes never breaks a piston. Advanced pistons open correctly in simple mode — advanced features just cannot be edited until switching back to advanced.

**This is the only global mode control.** There are no per-block show/hide toggles in the document itself.

### Per-Statement Advanced Options (Cog in Wizard)

Each statement wizard modal has a **cog icon** in the bottom right corner with tooltip "Show/Hide advanced options". Clicking it expands additional options for that specific statement — Task Execution Policy, Task Cancellation Policy, Execution Method (sync/async). These are always accessible regardless of Simple/Advanced mode but are hidden until needed.

### Drag and Drop

Statements can be dragged and reordered within the document. Exact drag behavior (whether cross-block dragging is permitted) to be determined during implementation based on what produces the most natural feel.

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

* Folders created from this page only — not from inside the editor or wizard
* New pistons land in Uncategorized automatically — no folder prompt on creation
* Pause/Resume available per piston from this list
* True/false last evaluation result shown per piston (✅/❌)
* Global Variables drawer accessible from this page
* Import button (paste JSON, URL, or file upload)

### Piston Status Page

**Navigation flow: List → Status Page → Editor → Status Page**

The status page is the hub for every piston. Saving in the editor returns here.

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

**Compiled output (YAML or PyScript) is NOT shown on this page.** It is an internal implementation detail.

**Failure notification toggle:** When enabled, a piston failure fires a persistent notification in the HA UI (visible in the HA bell/notification panel until dismissed) AND sets a visible flag/badge on the piston in the PistonCore UI if the Docker container is running. Configured per piston via the `⚠ Notify` toggle on this page.

**Trace toggle:** When enabled and Test is pressed or the piston fires naturally, trace numbers appear overlaid on log entries matching each condition and action line number — exactly as WebCoRE did. Test must be pressed at least once before Trace becomes available on a new piston.

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
├─────────────────────────────────────────────────────┤
│  ▼ PISTON VARIABLES                         [+ Add] │
│  Temporary — forgotten when this piston finishes    │
│  (none)                                             │
├─────────────────────────────────────────────────────┤
│  ▼ TRIGGERS                                 [+ Add] │
│  Sun event — Sunset — no offset                     │
│  + add a new trigger                                │
├─────────────────────────────────────────────────────┤
│  ▼ CONDITIONS                               [+ Add] │
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

**Save returns the user to the status page for this piston.** It does not stay in the editor.

**Log Level** is set per piston at the bottom of the editor: None / Minimal / Full.
* If log level is None: saving clears the log
* If log level is Minimal or Full: saving preserves the log
* This matches WebCoRE behavior exactly

---

## 8. The Condition, Trigger, and Action Wizard

When a user clicks any `+ add a new...` ghost text, or clicks to edit an existing statement, a **multi-step modal wizard** opens. Triggers, conditions, and actions all use this same wizard pattern.

Each step's options are generated from HA based on what was selected in the previous step. PistonCore never maintains its own device capability database — it always asks HA.

The wizard builds a plain English sentence at the top as the user goes through each step. This sentence is the breadcrumb — it shows what has been selected so far and grows with each step.

**Condition wizard flow:**
1. What to compare — pick: Physical Device, Variable, Time, Date, Location/Presence, HA System
2. Pick the device — searchable by name or area
3. Pick the capability or attribute — list fetched live from HA for that device
4. Pick the operator — list appropriate to the selected capability (see Section 9)
5. Compare to — value, another device, a variable, or a time

**Action wizard flow (with block):**
1. Pick the device
2. Pick the capability or service — list fetched live from HA for that device
3. Configure the service call parameters — fields generated from HA's service schema

**Trigger wizard flow:**
Same as condition wizard with trigger-specific operators available (changes to, rises above, etc.) and an optional duration field ("and stays for [duration]") that appears when relevant.

**Wizard cog — advanced options:**
Each wizard modal has a cog icon (bottom right, tooltip: "Show/Hide advanced options") that expands:
* Task Execution Policy (TEP) — Always execute / Execute on condition state change only / Execute on piston state change only
* Task Cancellation Policy (TCP) — Cancel on condition change (default) / Cancel on piston state change / Cancel on either / Never cancel
* Execution Method — Synchronous (default) / Asynchronous

TEP and TCP are only relevant for PyScript (complex) pistons. PistonCore shows a note if these are set on a piston that compiles to YAML.

---

## 9. Comparison Operators — Full Supported Set

All operators are written in plain English. Symbols are never used for logic.

### Condition Operators (evaluate current state)

| Operator | Plain English Label |
|---|---|
| is / is not | is / is not |
| is any of / is not any of | is any of / is not any of |
| is between / is not between | is between / is not between |
| is greater than | is greater than |
| is less than | is less than |
| is greater than or equal to | is greater than or equal to |
| is less than or equal to | is less than or equal to |
| was true for at least (duration) | was true for at least — PyScript only |
| was false for at least (duration) | was false for at least — PyScript only |
| is before (time) | is before |
| is after (time) | is after |
| is between (times) | is between |
| date is before | date is before |
| date is after | date is after |
| date is between | date is between |

### Trigger Operators (fire when something happens)

| Operator | Notes |
|---|---|
| changes | any value change |
| changes to | specific value |
| changes from | specific previous value |
| changes from X to Y | specific transition |
| rises above | numeric |
| drops below | numeric |
| changes to [value] and stays for [duration] | compiles to HA native `for:` — not a separate operator |
| gets [event] | button/momentary device, specific event |
| gets any | button/momentary device, any event |
| receives [attribute value] | specific attribute subscription |
| event occurs | any event on attribute |

### Logical Group Operators

* AND
* OR

XOR is not supported. `followed by` (sequence detection) is not supported — no HA equivalent exists.

### Multi-Device Aggregation

When a Devices variable or multiple devices are selected:
* any of [devices] is/are
* all of [devices] are
* none of [devices] are

---

## 10. Export and Import

### Export — Snapshot (📷 green label)

Exports an anonymized version of the piston with all entity mappings stripped. The logic, structure, roles, and role labels are preserved. Safe to post on forums, GitHub, Discord, or share with anyone. Recipients map their own devices on import.

### Export — Backup (📷 red label)

Exports the full piston including entity mappings. Intended for personal restore only. Labeled clearly in the UI: "For your own restore only — do not share." The compiled file hash is included.

### Import — Snapshot Flow

A Snapshot import always contains unmapped role placeholders. On import PistonCore shows the device mapping screen — each unmapped role is presented with a dropdown of live devices from HA. The user maps each role before the piston can be saved or deployed. A new piston ID is generated on import.

### Import — Backup Flow

A Backup import contains real entity mappings. If those entities exist in the importing HA instance, PistonCore uses them as-is and treats the import as a restore. The original piston ID is preserved. If entities are not found, PistonCore falls through to the role mapping screen exactly like a Snapshot import.

### Import Methods

* Paste JSON directly into the import dialog
* Paste a URL pointing to any raw JSON file
* Upload a `.piston` file
* AI-generated JSON pasted from any AI assistant

---

## 11. AI Prompt Feature

The main piston list page has a **Copy AI Prompt** button. Clicking it copies the PistonCore JSON format specification to the clipboard. No user data, entity information, or global variables are included — only the format specification. The user pastes it into any AI assistant, describes what they want, and the AI generates a valid PistonCore JSON template with role placeholders. The user imports that template and maps the placeholders to their real devices.

User data stays private. The AI never sees entity IDs or personal configuration.

---

## 12. File Signature and Manual Edit Detection

Every compiled `.yaml` and `.py` file written by PistonCore includes a signature header block:

```
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: a3f8c2d1 | pc_version: 0.6 | pc_hash: [hash of compiled file content]
```

The hash is computed from the compiled file content (YAML or PyScript). This is how PistonCore enforces the "never touch files it did not create" rule — it only operates on files that contain its own signature.

**On deploy:** PistonCore reads the existing file's hash before writing. If the hash does not match what PistonCore expects, it stops and shows the user a **diff** of exactly what lines changed, then asks:
* **Overwrite** — deploy and replace manual changes with the new compiled version
* **Cancel** — do nothing, preserve the manual edits

This gives users full control over their files while ensuring PistonCore never silently destroys manual work.

---

## 13. Pre-Save Validation Pipeline

When a user saves a piston and Deploy to HA is triggered, PistonCore runs a validation pipeline before writing anything to the production HA directories.

**Stage 1 — Internal validation (always runs):**
PistonCore checks the piston JSON for obvious problems before compiling:
* No triggers defined
* Action references a device not found in HA
* Global variable referenced but not defined
* Required role not mapped

Results appear as warnings/errors on the status page validation banner immediately after save — even before deployment is attempted.

**Stage 2 — Compile to sandbox (on deploy):**
PistonCore compiles the piston to a temporary sandbox location, not the production HA directories.

**Stage 3 — HA validation:**
* YAML pistons: companion calls `hass --script check_config` against the sandbox. This is a full HA-native validation. HA keeps running — no restart, no disruption.
* PyScript pistons: companion runs Python syntax check (`py_compile`) against the sandbox. This catches syntax errors but not all runtime errors — PyScript validation is best-effort by nature.

**Stage 4 — Decision:**
* If validation passes → file moves from sandbox to production directory, hash is computed and written to the file header, piston JSON is updated, user lands on status page with success confirmation.
* If validation fails → nothing is written to production. User sees the validation error.

**Error display:**
Raw error text is shown as returned by HA or Python. For known common errors, a plain English explanation is shown below the raw error. Unknown errors show raw only — the user can copy and paste to an AI for translation. The plain English lookup table grows over time via community contributions to the repo.

---

## 14. Safety Rules — Core Lockdown

PistonCore is strictly a generator and API client. These restrictions are architectural — they cannot be configured away or overridden by any user action:

**PistonCore is forbidden from:**
* Modifying `.storage/` folders
* Editing `configuration.yaml` directly
* Accessing `home-assistant_v2.db`
* Writing to any directory it did not create
* Writing to any file that does not contain its own signature header
* Calling any undocumented HA internal API

**The only HA-side additions** are a small set of lines added to HA config during companion setup, handled through the normal HACS installation process.

**Corruption detection:** If the globals JSON file is detected as corrupt on startup, PistonCore posts a persistent HA notification and uses safe hardcoded defaults. It never silently loads corrupt data.

---

## 15. Logging and Debugging

### Log Level — Per Piston

Each piston has an independent log level set at the bottom of the editor:
* **None** — no logging. Saving with this level set clears the existing log.
* **Minimal** — trigger events and errors only
* **Full** — every condition checked, every action taken, pass/fail, timing

If log level is Minimal or Full, saving preserves the existing log — exactly as WebCoRE did.

### Log Panel (Status Page)

Most recent runs at the top. Each entry shows:
* When the piston triggered and what triggered it
* Each condition checked and whether it passed or failed — in plain English
* Each action taken and whether it succeeded
* Any errors in plain English
* How long the run took
* Clear Log button

### Log Message Action

A "Log message" statement type can be added anywhere in the action tree. The user selects a message type:
* Info (default color)
* Warning (yellow)
* Error (red)
* Debug (gray)
* Trace (blue)

Manual log messages always appear in the log regardless of log level setting — even when log level is None. This matches WebCoRE behavior exactly.

### Trace Mode

A toggle on the status page. Test must be pressed at least once on a new piston before Trace becomes available.

When Trace is on and the piston runs (via Test or natural trigger):
* Trace numbers appear overlaid on log entries
* Numbers align with condition and action line numbers in the document
* Allows line-by-line follow-along to see exactly where a problem occurred
* Trace data is transmitted via a custom PistonCore WebSocket event
* Trace data is never written to the main HA system log
* When Trace is off, no debug data is generated or transmitted at all

### Test / Dry Run

The Test button on the status page and editor fires the piston manually right now. In dry run mode it shows what actions would have been called without actually calling them.

### Error Handling

When a piston fails mid-run:
* The error is logged in plain English
* The piston stops at the point of failure
* Remaining actions are not executed
* If failure notification is enabled: persistent notification fires in the HA UI AND a badge appears on the piston in PistonCore
* The piston stays enabled and tries again on the next trigger
* Errors are never silent

---

## 16. Compilation and Deployment

### Output File Locations

* Simple pistons → `<ha_config>/automations/pistoncore/<piston_name>.yaml`
* Complex pistons → `<ha_config>/pyscript/pistoncore/<piston_name>.py`
* PistonCore never writes outside its own named subfolders
* PistonCore never modifies, moves, or deletes any file that does not contain its own signature header
* Filenames come from the piston name

### PyScript Comment Header

Every compiled `.py` file includes a comment header listing:
* Piston name, created date, modified date, PistonCore version, build number
* Every global variable the piston references

This allows PistonCore to scan the compiled folder and determine global variable usage without a database.

### Deployment Flow

1. User clicks **Deploy to HA**
2. Pre-save validation pipeline runs (see Section 13)
3. If validation passes, companion writes file to production directory
4. Companion calls the HA reload service
5. Automation is live within seconds
6. PistonCore confirms success or reports failure in plain English

### Manual Edit Warning

If a compiled file's hash does not match on deploy, PistonCore shows a diff and asks Overwrite or Cancel before touching anything. See Section 12.

---

## 17. The Two Components

### 17.1 PistonCore Editor (Docker Container)

* **Backend:** Python (FastAPI)
* **Frontend:** Framework not prescribed — must produce the structured document editor feel described in Section 7
* **Runs on:** Any Docker host — Unraid, Raspberry Pi, NAS, cloud VPS
* **Default port:** 7777 (configurable)
* **Piston storage:** JSON files in a mounted Docker volume
* **No internet required** for local use

Unraid Community Apps template planned for one-click installation.

### 17.2 First-Run Setup — Two Phase

**Phase 1 — Editor only (immediate):**
On first launch, the user enters their HA URL and a long-lived HA access token. PistonCore uses the HA REST API to pull all devices, entities, capabilities, areas, and services. The user can begin building and editing pistons immediately. No companion required.

**Phase 2 — Companion (prompted when needed):**
When the user first attempts to deploy a piston to HA, PistonCore detects that the companion is not installed and prompts the user to install it via HACS. The companion is required only for writing compiled files and validation. Until deployment is needed, the companion is not required.

### 17.3 PistonCore Companion (HA Custom Integration)

Installed into Home Assistant via HACS.

Provides a local API that the editor uses to:
* Fetch full device capability profiles from HA (all attributes, all supported states, all services per device)
* Write compiled piston files to the correct HA directories
* Execute `hass --script check_config` for YAML validation
* Execute `py_compile` for PyScript syntax checking
* Trigger HA reload after deployment
* Report piston run status back to the editor
* Transmit Trace debug data via custom WebSocket event

Requires a long-lived HA access token configured once at setup.

---

## 18. The JSON Sharing Format

Pistons are stored internally and shared externally as plain JSON.

### Key Design Decisions

* Device references use **roles** — named placeholders like `motion_sensor` or `driveway_light` — not hard entity IDs
* The actual entity IDs live in a `device_map` section that belongs to your installation and is never included in a Snapshot export
* The JSON schema is fully documented so AI tools can generate valid pistons
* The format is versioned so future PistonCore updates can handle older pistons gracefully

### Piston ID Generation and Collision Handling

* Piston IDs are short hashes generated at creation time
* **Snapshot import:** always generates a new ID — the piston is always a new separate piston
* **Backup import:** preserves the original ID and treats the import as a restore of the same piston. If the entity mappings in the backup exist in the current HA instance, they are used as-is. If not, the role mapping screen is shown.

### Example Piston JSON

```json
{
  "pistoncore_version": "1.0",
  "id": "a3f8c2d1",
  "name": "Driveway Lights at Sunset",
  "description": "Turns on driveway lights at sunset and off at 11pm",
  "mode": "single",
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
      "type": "wait",
      "until": "23:00:00"
    },
    {
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

Managed from PistonCore's main settings screen, separate from any individual piston.

The global variables screen shows:
* All defined globals with their current values and types
* Which pistons reference each global (scanned from PyScript comment headers)
* Add, edit, and delete globals

Changing a global value writes to the JSON file and pushes to HA live memory immediately — no redeployment of pistons needed.

A **Global Variables drawer** is also accessible from the main piston list page as a read-only reference panel — matching the WebCoRE right sidebar.

---

## 20. Folders

Pistons are organized into user-defined single-level folders. Nested folders are out of scope for v1.

**Folder creation:** Folders are created from the main piston list page only. There is no inline folder creation in the editor or wizard.

**Folder assignment:** Folder assignment is never mandatory. New pistons land in **Uncategorized** automatically — no prompt on creation. Folder assignment is done via a dropdown on the piston status page or in the editor header. This matches how WebCoRE handled folder assignment on the piston overview/debug page.

Pistons with no folder assigned appear in the **Uncategorized** bucket in the folder sidebar.

---

## 21. V1 Core Feature Set

Build only these in V1. Everything else is a future feature.

**Statement types:**
* If Block (with when true / when false branches)
* With / Do block (action execution)
* Only When restrictions (per statement)
* Wait (fixed duration)
* Wait for state with timeout
* Set variable
* Repeat loop with condition
* For each (iterate over a Devices variable)
* Log message
* Call another piston
* Stop

**Editor features:**
* Structured document editor — indented tree, inline ghost text insertion
* WebCoRE-matching keywords: if / then / else if / else / end if / with / do / end with / repeat / for each / only when
* Drag and drop block reordering
* Global variables right sidebar (read-only reference) on main list page
* Simple / Advanced mode toggle
* Per-statement advanced options cog in wizard (TEP, TCP, Execution Method)
* 📷 Snapshot and 📷 Backup export
* Duplicate piston
* Import from JSON paste, URL, and file
* Piston status page as hub — navigation: List → Status → Editor → Status
* Save returns to status page
* Run log with plain English detail
* Log level per piston (None / Minimal / Full) with WebCoRE-matching save behavior
* Log message action with five color-coded types
* Trace mode via WebSocket
* Test must be run once before Trace is available (WebCoRE behavior)
* Pause/resume from list and status page
* Compiler templates (external, user replaceable)
* Device picker — type-to-filter search by name and area
* Unknown device fallback — one-time define screen, stored locally, editable
* Dynamic capability-driven multi-step wizard for triggers, conditions, and actions
* Trigger wizard with optional duration field (stays for)
* Full operator set (see Section 9) — XOR and followed-by excluded
* True/false last evaluation result on piston list
* Copy AI Prompt button on piston list
* Automatic validation warnings on save (status page banner)
* Pre-deploy validation pipeline — HA check_config for YAML, py_compile for PyScript
* File signature and hash system — manual edit detection with diff display
* Failure notification — HA persistent notification + PistonCore badge
* My Device Definitions screen for unknown device definitions
* Piston ID system — new ID on Snapshot import, preserved ID on Backup restore

---

## 22. Out of Scope for V1

* Mobile app
* Multi-user authentication
* Central cloud server maintained by the project
* Direct WebCoRE piston import / migration
* Piston marketplace or registry
* HA dashboard status cards
* Version history and rollback
* Nested folders
* `followed by` sequence operator
* XOR logical operator
* `range` trigger operator (numeric range entry/exit) — deferred to v2

---

## 23. Distribution Plan

| Channel | Purpose | When |
|---|---|---|
| GitHub (public, MIT license) | Source code, issues, docs, contributions | Day 1 |
| Docker Hub | Container image for self-hosting | First working build |
| Unraid Community Apps | One-click install template | After Docker image is stable |
| HACS | Companion integration | After companion works |
| HA Community Forums | Announcement and feedback | After MVP works end to end |

---

## 24. Development Log

### Session 1 — April 2026
Project conceived. Design document written. GitHub repo created.

### Session 2 — April 2026
FastAPI backend scaffolded. React frontend scaffolded. Companion skeleton built. 19 API endpoints verified. Compiler verified against example piston. All code now in session2_archive.

### Session 2 Strategy Review — April 2026
Extensive WebCoRE screenshot review. Design rewritten as v0.5. Major changes to UI model, architecture, and scope. Frontend decoupled from React. Condition wizard redesigned as dynamic multi-step. Status page established as piston hub. Compiler template system designed. V1 scope tightened.

### Session 3 — April 2026
Design refined through WebCoRE screenshot analysis and structured topic review. Key decisions made:
- Device picker operates at device level, not entity level
- Capability selection is live from HA, never from a PistonCore-maintained list
- Trace mode is a user toggle on the status page via WebSocket
- Global variables write to JSON and push to HA live memory immediately on save
- Safety lockdown is architectural
- PyScript comment headers track global variable usage without a database
- AI Prompt button copies format spec only — no user data
- Export is Snapshot (anonymized) and Backup (full, personal only)
- Two-phase setup: Phase 1 REST API only, Phase 2 companion on first deploy
- Automatic validation on save displays warnings on status page
- Six open questions documented for next session

DESIGN.md updated to v0.5. No code written this session.

### Session 4 — April 2026
All six open questions from Section 20 resolved. Full design review against WebCoRE wiki and documentation. Key decisions made:

- **Compiled output hidden** — not shown on status page
- **Save returns to status page** — not stay in editor
- **Trigger wizard** — same multi-step wizard as conditions and actions
- **Folder assignment** — no prompt on creation, lands in Uncategorized, assigned via dropdown on status page (matches WebCoRE behavior)
- **Piston ID on import** — Snapshot always gets new ID; Backup preserves original ID and restores if entities exist in HA
- **Failure notification** — HA persistent notification + PistonCore badge, toggle per piston on status page
- **Unknown device fallback** — HA first always; if no capability data returned, one-time Define screen per device, stored locally, editable
- **File signature and hash system** — every compiled file gets signature header, hash of compiled content, manual edit detection shows diff before asking Overwrite/Cancel
- **Pre-save validation pipeline** — Stage 1 internal checks; Stage 2 sandbox compile; Stage 3 HA check_config (YAML) or py_compile (PyScript); Stage 4 commit or stop
- **Editor document model** — structured document, indented tree, WebCoRE keywords, inline ghost text insertion, single global Simple/Advanced toggle, per-statement cog in wizard for TEP/TCP/Execution Method
- **Full WebCoRE operator set reviewed** — XOR removed, followed-by removed, range deferred to v2, geofence handled naturally via changes-to on person/zone entity
- **Logging** — implemented as close to WebCoRE as HA allows: log level per piston, save behavior matches WebCoRE, five log message types, Trace via WebSocket with line number overlay, Test required before Trace available
- **Frontend framework** — not prescribed, cousin's working implementation to be integrated; framework to be confirmed
- **Three pages defined**: Main list page, Status page (hub), Editor page — full content of each documented in Section 7

DESIGN.md updated to v0.6. No code written this session.

---

## 25. IMPORTANT — Pending Corrections (Read Before Coding)

**A corrections and additions file exists in this repo called "Notes for next session."**

**This file contains confirmed corrections to this document. Where the notes conflict with anything written above, the notes take priority.**

**Do not write code against the following sections until the notes have been read and reconciled:**

- Section 4.1 and Section 19 — Global variables storage (correction pending)
- Section 4.3 — Yes/No variable type (correction pending)
- Section 5 and Section 17.2 — Phase 1 data fetching (correction pending — WebSocket not REST)
- Section 17.3 — Companion setup details (significant additions pending)
- Section 11 — Dry run behavior differs between YAML and PyScript (correction pending)
- Compiler template system — not yet fully defined, do not write compiler code until next design session
- Call another piston — YAML limitations documented in notes
- Piston run status reporting — mechanism defined in notes, not yet in this document

**DESIGN.md v0.7 will incorporate all of these. Until then the notes file is authoritative for these sections.**
---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
