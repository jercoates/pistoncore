# PistonCore Design Document

**Version:** 0.9.1
**Status:** Draft — Ready for Development
**Last Updated:** April 2026

---

## 1. What Is PistonCore?

PistonCore is an open-source visual automation builder for Home Assistant, designed to feel immediately familiar to anyone who has used WebCoRE on SmartThings or Hubitat. It lets you build complex automations — called **pistons** — through a structured UI using dropdowns populated directly from your actual HA devices, without ever writing YAML or Python manually.

**PistonCore is not a home automation platform. It is a tool for building automations on top of one.**

It does not add devices, manage integrations, or extend HA's capabilities in any way. It reads what HA already has, gives you a better way to write logic against it, and compiles that logic to native HA files that run permanently and independently.

**PistonCore does not need to be running for your automations to work.** Compiled files are standard HA automation files. If you uninstall PistonCore tomorrow, every piston you built keeps running — as long as the relevant runtime (native HA scripts or PyScript) remains installed. Native HA script pistons are unconditionally permanent. PyScript pistons require PyScript to remain installed.

---

## 2. Core Philosophy

* **No required central server.** PistonCore runs locally on Unraid, a Raspberry Pi, any Docker host, or optionally on a cloud server someone else hosts. Nothing depends on servers controlled by the project maintainers.
* **Automations are yours.** Compiled files are standard HA files. PistonCore is the source of truth for your pistons — the compiled files on HA are just the output.
* **PistonCore never touches files it did not create.** Your existing hand-written automations, scripts, and YAML files are completely safe. PistonCore only ever writes to its own subfolder. This rule is enforced architecturally via file signature checking — see Section 12.
* **Compiled files are compiler-owned artifacts.** Files written by PistonCore to HA directories are deployment artifacts, not source files. They may be replaced wholesale on recompile. The piston JSON on the Docker volume is always the source of truth — never the compiled HA file. Users who hand-edit compiled files will be warned at next deploy via the hash check, but editing them is explicitly discouraged because recompilation overwrites changes without mercy.
* **Shareable by design.** Pistons are stored and shared as plain JSON. Paste them anywhere — a forum post, a GitHub Gist, a Discord message, a text file. Import from a URL or paste directly. No account required, no server involved.
* **AI-friendly from day one.** The piston JSON format is simple and fully documented so AI assistants can generate valid pistons from a plain English description.
* **Open and community driven.** MIT licensed. Anyone can host, fork, modify, or contribute.
* **Familiar to WebCoRE users.** The piston concept, structure, terminology, keywords, and logging behavior are intentionally close to WebCoRE so experienced users can pick it up immediately.
* **Plain English everywhere, icons plus labels for universal actions.** Logic operators and descriptive text are always written in plain English. Buttons use an icon paired with a plain English label — never an icon alone.
* **Silent by default.** PistonCore generates no debug output unless the user explicitly activates tracing for a specific piston.
* **Minimum footprint in HA.** PistonCore touches only what is absolutely necessary and only what the user explicitly confirms during setup.
* **Incomplete but correct is better than complete but wrong.** The wizard must prefer showing fewer options over showing incorrect options. PistonCore is allowed to not know something. It is not allowed to guess wrong.
* **The compiler absorbs Home Assistant churn.** When Home Assistant changes YAML syntax, script structure, or field naming, PistonCore recompiles existing pistons against the updated templates. Users never manually migrate automations — that is PistonCore's job. The piston JSON stays stable; the emitted HA artifacts change to match whatever the current HA version expects.

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

PistonCore automatically decides what to compile to based on what your piston does. You never choose — it detects it using the rules defined in Section 3.1.

* **Most pistons → compile to a native HA script + automation pair**
* **Edge-case pistons → compile to a PyScript `.py` file**

Both compile targets produce files that run without PistonCore being active. Native HA script pistons are unconditionally permanent. PyScript pistons require PyScript to remain installed in HA.

**Native HA Script is the primary compile target.** It is completed and stabilized before the PyScript compiler. A working native-script-only PistonCore is more useful to more users than a half-working dual-mode system.

### 3.1 Auto-Detection Boundary — What Forces PyScript

The compiler uses native HA scripts for everything they can handle — which covers roughly 95% of real-world pistons. PyScript is only used when a piston requires features that have no native equivalent.

**Features that force PyScript compilation:**

1. `break` — interrupt a loop mid-iteration. No native HA script equivalent.
2. `cancel_pending_tasks` — cancel async tasks in flight. No native HA script equivalent.
3. `on_event` — execute a block only when a specific event fires inside a running script. No native HA script equivalent.
4. Direct Python logic genuinely not expressible in Jinja2 templates.

**Everything else compiles to native HA scripts**, including: local variables, all loop types (repeat/while/until/for_each/counted), waits with timeout, wait_for_trigger, if/then/else, choose/switch, parallel execution, fire custom events, call another script, stop, log, and all HA service calls.

**When a piston crosses the boundary mid-build:** If a user adds a statement that forces PyScript and their piston is currently native-script-bound, PistonCore prompts: *"This feature requires converting your piston to a PyScript piston. Your logic will be preserved. Continue?"* The user must confirm. The compile target indicator in the editor updates visibly.

**Note on globals and variables:** Global variables compile to native HA helpers managed by the companion. Local piston variables use the native HA script `variables:` action. Neither requires PyScript.

**Variable scope caveat:** The native HA script `variables:` action does not reliably propagate changes from inside a loop or if block back to the outer scope. This is a known HA limitation. The compiler handles this automatically using Jinja2 namespace patterns where needed — the user does not need to know about it, but it constrains how the compiler generates Set Variable statements inside loops. See COMPILER_SPEC.md for the exact handling.

---

## 4. Variables

### 4.1 Global Variables

Defined once at the PistonCore level. Available to every piston. Persist permanently until changed.

**Storage:** Global variables are stored as native HA helpers, created and managed by the companion. The companion creates the appropriate helper type for each variable type when the user defines a global in PistonCore's UI.

| PistonCore Type | HA Helper Type |
|---|---|
| Text | input_text |
| Number (integer) | input_number |
| Number (decimal) | input_number |
| Yes/No | input_boolean |
| Date and Time | input_datetime |
| Date | input_datetime (date only) |
| Time | input_datetime (time only) |
| Device | No helper — resolved to entity ID at compile time |
| Devices | No helper — resolved to a literal list of entity IDs at compile time |

**Device and Devices globals are compile-time values, not runtime lookups.**

When a piston is compiled, Device and Devices globals are resolved from PistonCore's device_map and baked directly into the compiled YAML as literal entity references. There is no runtime group lookup, no HA helper, no external dependency. The compiled piston is self-contained.

Example: a Devices global "Smoke Detectors" containing three devices compiles to:
```yaml
repeat:
  for_each:
    - binary_sensor.smoke_detector_kitchen
    - binary_sensor.smoke_detector_hallway
    - binary_sensor.smoke_detector_bedroom
```
Not a template that looks up a group at runtime — a literal list baked in at deploy time.

**What this means for users:** If you add a new device to a Devices global, existing deployed pistons do not automatically pick it up. You need to update the global in PistonCore and redeploy the affected pistons. This is intentional and matches how WebCoRE handled device groups — explicit control, no hidden magic.

**Stale piston tracking for Device/Devices globals:**

PistonCore tracks which pistons reference each Device or Devices global. When the device list in a global changes, PistonCore flags all affected pistons as stale and shows a banner on the piston list page:

*"'Smoke Detectors' was updated — 3 pistons need redeployment to pick up your changes."*
`[Redeploy All]` `[Review]`

`[Redeploy All]` recompiles and deploys all affected pistons in sequence. `[Review]` opens the list so the user can choose which ones to redeploy individually. This banner persists until all affected pistons are redeployed or the user explicitly dismisses it.

The stale state is stored in PistonCore's `config.json` on the Docker volume — not in HA.

**Why helpers for non-device types:** Text, Number, Yes/No, and Date/Time globals need to persist between piston runs and be changeable without redeploying every piston. HA helpers are native entities — compiled pistons read them via standard HA template syntax (`states()`, `state_attr()`), no file I/O or Docker dependency. Helper values survive PistonCore uninstall with their current values intact. Changing a helper value takes effect immediately on the next piston run — no redeployment needed.

**Why compile-time for Device/Devices:** Device references in HA automations are entity IDs in YAML — there is no clean runtime equivalent of "look up this named device group." Baking the list in at compile time is simpler, more reliable, and produces cleaner YAML. The stale-tracking system handles the only real downside.
* On global create → companion creates the corresponding HA helper via HA API
* On global rename → companion updates the helper label (entity ID stays stable, based on the internal variable ID)
* On global value change → companion calls the appropriate helper set service
* On global delete → companion deletes the helper with a confirmation warning listing every piston that references it

**Companion boot-time integrity check:** On companion startup, scan all PistonCore-managed helpers and compare against the companion's internal manifest. If a mismatch is detected (helper deleted or modified outside PistonCore), prompt the user:
*"The following PistonCore-managed helpers appear to have been modified outside of PistonCore. Would you like to restore them?"*
`[Show diff]` `[Restore]` `[Keep manual changes]`
Non-blocking — if dismissed, PistonCore continues with current state.

**Companion helper manifest — format and storage:**

The manifest is a JSON file stored at `<ha_config>/pistoncore/helper_manifest.json`. It is written by the companion and lives in HA's config directory (not the Docker volume) so it persists independently of the Docker container.

Format:
```json
{
  "version": "1.0",
  "managed_helpers": {
    "pistoncore_uuid_abc123": {
      "entity_id": "input_text.pistoncore_uuid_abc123",
      "display_name": "Away Mode Text",
      "type": "input_text",
      "created": "2026-04-20T10:30:00Z",
      "last_verified": "2026-04-20T10:30:00Z"
    }
  }
}
```

**If the manifest file is missing on startup:** The companion treats all helpers with the `pistoncore_` entity ID prefix as potentially PistonCore-managed. It prompts the user:
*"PistonCore's helper manifest is missing. Would you like to scan for PistonCore-managed helpers and rebuild it?"*
`[Scan and rebuild]` `[Skip — I'll manage manually]`
If skipped, the boot-time integrity check is disabled until the manifest is rebuilt.

**If the manifest exists but a listed helper is absent from HA:** The companion flags this as a missing helper in the integrity check prompt. It does not automatically recreate it — recreating could overwrite a user's intentional deletion.

**Helper naming convention:** All PistonCore-managed helpers use a stable entity ID derived from the variable's internal UUID, not its display name. This means renaming a global in PistonCore does not break existing compiled pistons.

**If a helper is missing at runtime:** The compiled piston reads a missing helper as `unknown`. The piston logs a plain English error and stops gracefully.

**PyScript comment header (PyScript pistons only):** Every compiled `.py` file includes a comment header listing every global variable it references. This allows PistonCore to scan the compiled folder and determine global variable usage without a database.

### 4.2 Piston Variables

Defined inside a single piston. Only exist while that piston is running. Forgotten when the piston finishes.

Compiled using the native HA script `variables:` action. Only visible in Advanced mode.

### 4.3 Variable Types

The following types are implemented in v1.

| Type | Description | Notes |
|---|---|---|
| Text | A word or sentence | "away", "Good morning" |
| Number (integer) | A whole number | 75, -10, 0 |
| Number (decimal) | A decimal number | 0.5, 22.4 |
| Yes/No | True or false | **HA boolean helpers only.** Not for device states. |
| Date and Time | A specific point in time | 2026-04-20 10:30 PM |
| Date | A date only | 2026-04-20 |
| Time | A time only | 10:30 PM |
| Device | A single HA entity reference | Your driveway light |
| Devices | A collection of HA entity references | All your battery sensors |

**List variants** (Dynamic list, Text list, Boolean list, Number list, etc.) are deferred to v2.

**Yes/No is restricted to actual HA boolean helpers only.** Device states use the native values HA reports — on/off, open/closed, detected/clear, active/inactive — never a yes/no abstraction. The wizard fetches and displays real native values from HA for each specific device.

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
* If capability data is present but ambiguous or inconsistent, PistonCore prompts the user to review and define the missing context manually (see Section 5.4)
* The wizard never crashes or shows incorrect options — it always degrades to showing less rather than showing wrong

### 5.3 Unknown Device Fallback

If HA returns no usable capability data for a device, PistonCore shows a one-time **"Define this device"** screen for that specific device. The user labels each entity in plain English. PistonCore stores that definition locally on the Docker volume.

From that point on the device behaves like any HA-known device in the picker. Definitions are editable from the **"My Device Definitions"** screen in PistonCore settings.

This triggers once per device, not once per piston.

### 5.4 Manual Context Lookup for Ambiguous Data

If PistonCore fetches capability data that is present but unclear, the wizard must not guess.

**Required behavior:** PistonCore prompts the user to look up the device behavior and define the missing context manually. The user-defined context is stored locally and reused for that device on future runs.

---

## 6. Piston Structure

Every piston has the following sections in order. All sections except the header are collapsible.

A piston is built from **Statements**. Two kinds:

* **Decisional statements** — control flow: `if`, `else if`, `else`, `end if`, `repeat`, `for each`, `while`, `end repeat`
* **Executive statements** — execute things: `with [device] do [action]`, `set variable`, `wait`, `wait for state`, `log message`, `call another piston`, `stop`, `cancel all pending tasks`

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

Operators are plain English, written in full. Device states use native HA values. Multiple conditions grouped with AND or OR — written in full, never symbols. AND and OR appear at the same indent level as the conditions themselves.

### 6.5 Action Tree

Top-to-bottom sequence of statements. The entire action tree is wrapped in an `execute / end execute;` block — this is a top-level rendering wrapper, not a data node in the JSON (see Section 18).

Full document structure order when rendered:
1. Comment header (piston name, author, created, modified, build, version, piston ID)
2. `settings / end settings;` — only shown when non-empty, omitted when empty
3. `define / end define;` — piston variables, only shown when variables exist
4. Section comments (user-added comments)
5. `execute` — starts the action tree
6. All action statements indented inside
7. `end execute;` — closes the action tree

**settings / end settings block:** Exists in WebCoRE. Contents not yet defined for PistonCore — do not implement until defined. See Section 26 open items.

Statement keywords match WebCoRE exactly: `if`, `then`, `else if`, `else`, `end if`, `with`, `do`, `end with`, `repeat`, `for each`, `only when`, `execute`, `end execute`, `define`, `end define`, `settings`, `end settings`.

**Two views of the if/else structure:**

Editor display (while building):
```
if
  [condition]
  {
    when true
      [statements]
    when false
      [statements]
  }
```

Saved/export format (status page read-only view, Snapshot export):
```
if
  [condition]
then
  [statements]
end if;
```

Both are correct for their context. The editor uses `when true / when false` while building. The saved format and status page read-only view use `then / end if`.

**repeat / until structure:** The `until` condition appears at the BOTTOM of the repeat block, not the top:
```
repeat
do
  [statements]
until
  [condition]
end repeat;
```

---

## 7. The Editor UI

### Overall Feel

The editor is a **structured document viewed top to bottom**. Logic is always visible — indentation shows nesting. It reads like a well-formatted script. Keywords match WebCoRE exactly.

### Frontend Technology

**Vanilla JS, HTML, and CSS.** No framework. This keeps the dependency footprint minimal and makes the code readable by any contributor without framework knowledge.

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
* `+ add a new trigger`
* `+ add a new condition`
* `+ add a new restriction`

Clicking opens the multi-step wizard modal for that insertion point. This is the primary way statements are added.

### Simple / Advanced Mode Toggle

Single global toggle at the top of the editor. Default is Simple.

* **Simple** — hides piston variables, limits to most common types, plain English throughout
* **Advanced** — shows everything including piston variables, all types, loops, wait-for-state, deep nesting, TEP/TCP in wizard

This is the only global mode control. No per-block toggles. Switching modes never breaks a piston.

### Per-Statement Advanced Options (Cog in Wizard)

Each wizard modal has a cog icon (bottom right, tooltip: "Show/Hide advanced options") expanding:
* Task Execution Policy (TEP)
* Task Cancellation Policy (TCP)
* Execution Method (sync/async)

Available regardless of Simple/Advanced mode but hidden until needed. TEP and TCP are only relevant for PyScript pistons — PistonCore shows a note if these are set on a native-script-bound piston.

### Drag and Drop

Statements can be dragged to reorder within their containing block only. Dragging across block boundaries (into or out of an if/else branch, into or out of a repeat) is not supported in v1 — the user must cut and re-add at the new location. This simplifies the data model significantly. Cross-block drag is a v2 feature.

Valid drop targets highlight on hover. No undo for drag operations in v1.

### Piston List Screen

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

**Single scrolling list.** Folder names appear as inline section headers with piston count: "Outdoor Lighting (3)". No sidebar column. Last run time shown as a timestamp (e.g., "08:46:25") not a relative time. True/false last evaluation result shown inline (✅/❌/—).

* Folders created via `[+ New Folder]` button — opens inline text input
* New pistons land in Uncategorized automatically — no folder prompt on creation
* Pause/Resume available per piston from this list
* Global Variables drawer accessible from this page (slide-out panel, read-only)
* Import button (paste JSON, URL, or file upload)
* Mode indicator visible: Native Script Only / PyScript Available

**Native Script Only mode notice (subtle, footer):**
*"PistonCore manages automations in its own subfolder. Automations created directly in Home Assistant are not visible or managed here."*

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
│  Compile target: Native HA Script / PyScript        │
│  Last ran: 08:46:25                                 │
│  Next scheduled: sunset today                       │
│  Devices used: Driveway Main Light                  │
├─────────────────────────────────────────────────────┤
│  PISTON SCRIPT (read-only)                          │
│  execute                                            │
│  1  with                                            │
│  2    (Driveway Main Light)                         │
│  3  do                                              │
│  4    Turn On                                       │
│  5      Brightness: 100%                            │
│  6  end with;                                       │
│  7  wait until 11:00 PM;                            │
│  8  with                                            │
│  9    (Driveway Main Light)                         │
│  10 do                                              │
│  11   Turn Off                                      │
│  12 end with;                                       │
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

**Piston Script panel:** Shows the piston in read-only form — the same visual document the editor shows, rendered with statement numbers and syntax highlighting. This is PistonCore's own visual format, NOT compiled output (YAML or PyScript). Compiled output is never shown to the user.

**Compiled output is never shown on this page.**

**Test button label differs by compile target:**
* Native HA Script piston: `[▶ Test — Live Fire ⚠]`
* PyScript piston: `[▶ Test — Live Fire ⚠]`

Both compile targets execute real device actions when tested. There is no preview/dry-run mode for either target. The user must know before clicking that test fires real actions. A confirmation dialog appears before firing.

**Failure notification toggle:** When enabled, a piston failure fires a persistent notification in the HA UI AND sets a visible badge on the piston in PistonCore.

**Trace toggle:** When Trace is on and the piston runs, trace numbers overlay log entries matching statement numbers in the document. Test must be pressed at least once on a new piston before Trace becomes available.

### Piston Editor Screen

```
┌─────────────────────────────────────────────────────┐
│  PistonCore                    [← Status] [+ New]   │
├─────────────────────────────────────────────────────┤
│  Piston Name: [____________________________]        │
│  Description: [____________________________]        │
│  Folder: [Outdoor Lighting ▼]                       │
│  Mode: [Single ▼]                                   │
│  [● Enabled]              [Simple / Advanced]       │
│  Compile target: [Native HA Script ▼] ← updates live│
├─────────────────────────────────────────────────────┤
│  ▼ PISTON VARIABLES              [+ Add] (Adv only) │
├─────────────────────────────────────────────────────┤
│  ▼ TRIGGERS                                         │
│  Sun event — Sunset — no offset                     │
│  + add a new trigger                                │
├─────────────────────────────────────────────────────┤
│  ▼ CONDITIONS                                       │
│  (none — piston runs on every trigger)              │
│  + add a new condition                              │
├─────────────────────────────────────────────────────┤
│  ▼ ACTIONS                                          │
│  execute                                            │
│  with                                               │
│    (Driveway Main Light)                            │
│  do                                                 │
│    Turn On                                          │
│      Brightness: 100%                               │
│  end with;                                          │
│  + add a new task                                   │
│  wait until 11:00 PM;                              │
│  + add a new statement                              │
│  with                                               │
│    (Driveway Main Light)                            │
│  do                                                 │
│    Turn Off                                         │
│  end with;                                          │
│  + add a new statement                              │
│  end execute;                                       │
├─────────────────────────────────────────────────────┤
│  [▶ Test]  [💾 Save]  [📷 Snapshot] [📷 Backup]     │
│  Log Level: [Full ▼]                                │
└─────────────────────────────────────────────────────┘
```

**Save returns the user to the status page.** It does not stay in the editor.

**Log Level** per piston: None / Minimal / Full. If None, saving clears the log. If Minimal or Full, saving preserves the log. Matches WebCoRE behavior exactly.

---

## 8. The Condition, Trigger, and Action Wizard

When a user clicks any ghost text or edits an existing statement, a **multi-step modal wizard** opens. Triggers, conditions, and actions all use this same wizard pattern.

Each step's options are generated from HA based on what was selected in the previous step. PistonCore never maintains its own device capability database — it always asks HA via WebSocket.

The wizard builds a plain English sentence at the top as the user progresses. This sentence is the breadcrumb.

### 8.1 First Step — Condition or Group

The condition wizard does NOT go straight to device picker. The first step presents two choices:

**Condition** — "a single comparison between two or more operands, the basic building block of a decisional statement"
`[Add a condition]`

**Group** — "a collection of conditions, with a logical operator between them, allowing for complex decisional statements"
`[Add a group]`

Groups are first-class objects, not just chained conditions. This is how WebCoRE handles complex AND/OR logic.

### 8.2 Condition Wizard Flow

1. Condition or Group (see 8.1)
2. What to compare — Physical Device / Variable / Time / Date / Location / HA System
3. Pick the device — searchable by name or area
4. Pick the capability or attribute — live from HA WebSocket
5. Pick the operator — trigger group (⚡) or condition group, appropriate to the selected capability
6. Compare to — value, another device, a variable, or a time

### 8.3 Action Wizard Flow

1. Pick the device
2. Pick the capability or service — live from HA WebSocket
3. Configure the service call parameters — fields generated from HA's service schema

### 8.4 Trigger Wizard Flow

Same as condition wizard with trigger-specific operators and an optional duration field ("and stays for [duration]") when relevant.

### 8.5 Wizard Capability Map

The capability map that drives operator selection based on attribute type is defined in full in WIZARD_SPEC.md. That document is the authoritative reference for the wizard implementation.

### 8.6 Which Interaction Step — Physical vs Programmatic

After selecting a device and attribute, the wizard may show:

**Which interaction:**
* Any interaction
* Physical interaction
* Programmatic interaction

This distinguishes between a state change caused by a person physically using a device vs a state change caused by an automation or app. Implementable in PyScript via context tracking. Evaluate feasibility in sandbox before committing to this in the wizard flow.

### 8.7 Call Another Piston — Warning Timing

If the piston is native-script-bound and the user adds a Call Another Piston statement with wait-for-completion, immediately show — **before the user picks the target piston:**

*"Waiting for a called piston to finish requires converting this piston to PyScript."*
`[Convert and continue]` `[Use fire-and-forget]` `[Cancel]`

This prompt must appear before the user picks the target — not after they have finished the wizard.

---

## 9. Comparison Operators — Full Supported Set

All operators written in plain English. Symbols never used for logic. Device states use native HA values — never yes/no abstraction. Full operator detail including input types is defined in WIZARD_SPEC.md.

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
| was true for at least [duration] | |
| was false for at least [duration] | |
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

AND and OR appear at the same indent level as the conditions they connect. XOR not supported. `followed by` not supported. `range` deferred to v2.

### Multi-Device Aggregation

* any of [devices] is/are
* all of [devices] are
* none of [devices] are

---

## 10. Export and Import

### Snapshot (📷 green label)

Anonymized export. All entity mappings stripped. Roles and logic preserved. Safe to post publicly. New piston ID generated on import.

**Deliberate divergence from WebCoRE:** WebCoRE used a short alphanumeric import code generated by a central server. PistonCore uses the piston ID instead. Sharing is done via Snapshot/Backup export — no central server required, no account needed.

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

**The problem:** Copying only the JSON format spec gives an AI no context about the user's actual devices or intent. The AI produces generic output that still requires significant manual work.

**Revised design (to be finalized):**
The copied prompt must include at minimum:
* The PistonCore JSON format specification
* The role labels defined in the piston being worked on (if editing an existing piston)
* A plain English summary of the user's mapped devices by friendly name — not entity IDs

**User data privacy rule: No entity IDs are ever included.** Friendly names only. The AI never sees HA-internal identifiers.

**This feature must be redesigned in detail before implementation.**

---

## 12. File Signature and Manual Edit Detection

Every compiled file written by PistonCore includes a signature header:

```
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: a3f8c2d1 | pc_version: 0.9 | pc_hash: [hash of compiled content]
```

On deploy, if the existing file's hash does not match what PistonCore expects, it stops and shows a **diff** of exactly what changed, then asks: **Overwrite** or **Cancel**.

PistonCore only operates on files that contain its own signature. It never touches any other file.

---

## 13. Pre-Save Validation Pipeline

### On Save (always runs — no HA involvement)

Stage 1 — Internal validation (Docker only):
* No triggers defined
* Action references a device not found in HA
* Global variable referenced but not defined
* Required role not mapped

Results appear as warnings/errors on the status page validation banner immediately after save.

Validation rules live in `/pistoncore-customize/validation-rules/` as JSON files — updateable without code changes. See Section 17.2 for the full folder structure.

### On Deploy (runs after save, before writing to HA)

Stage 2 — Compile to sandbox (temporary location, not production HA directories)

Stage 3 — Syntax check (Docker):
* **Native HA Script pistons:** `yamllint` against both the automation and script sandbox files
* **PyScript pistons:** `py_compile` syntax check against the sandbox

Stage 4 — HA semantic validation (optional, only if companion installed):
* **Native HA Script pistons:** companion calls `script.reload` against the sandbox file. HA validates the script on load via its internal config validation layer. If the script is malformed, HA rejects it with a structured error at reload time. This is scoped to just the new file — faster and cleaner than `hass --script check_config` for the full config.
* **PyScript pistons:** Stage 4 is dropped entirely.

Stage 5 — Decision:
* Pass → files move to production, hash written to header, user lands on status page with success
* Fail → nothing written to production, user sees validation error (raw error shown plus plain English explanation for known errors)

### Save Pipeline — Confirmed Flow

1. Frontend validates piston has a name — if empty, stop and highlight the field
2. Frontend sends piston JSON to backend via POST
3. Save button shows loading state: "Saving..."
4. Backend writes piston JSON to Docker volume
5. Backend runs Stage 1 internal validation
6. Backend returns success or failure plus any validation warnings
7. If success — navigate to status page, warnings appear in banner if any
8. If write fails — stay in editor, show error banner: "Save failed — your work is preserved. Try again."

Save does not touch HA at all. Deploy is a separate action.

---

## 14. Safety Rules — Core Lockdown

PistonCore is architecturally forbidden from:
* Modifying `.storage/` folders
* Editing `configuration.yaml` directly (except the one-time labeled include addition during companion setup, which requires explicit user confirmation — see Section 17.4)
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
* Trace numbers overlay log entries matching statement numbers in the document (statement numbers, not line numbers)
* Trace data transmitted via custom PistonCore WebSocket event
* Trace data never written to the main HA system log
* When Trace is off, no debug data generated or transmitted at all

### Test — Behavior

Both compile targets (Native HA Script and PyScript) execute real device actions when tested. There is no dry-run or preview mode for either target. Button label for both: `[▶ Test — Live Fire ⚠]`

A confirmation dialog always appears before firing: *"This will execute real actions on your devices. Are you sure?"*

### Run Status Reporting

Compiled pistons fire a standard HA event at completion (success or failure) using the native script `event:` action:

```yaml
- event: PISTONCORE_RUN_COMPLETE
  event_data:
    piston_id: "{{ piston_id }}"
    status: "success"
```

The companion listens for `PISTONCORE_RUN_COMPLETE` events via WebSocket and relays run status to the PistonCore Docker. The run log updates from this data.

**Important:** HA event delivery is best-effort, not guaranteed. The UI must handle missing status gracefully — show *"Status unknown"* rather than wrong information. Run log entries timestamp when received.

---

## 16. Compilation and Deployment

### Compile Targets

**Native HA Script (primary — ~95% of pistons):**
Each piston compiles to two files:
* `<ha_config>/automations/pistoncore/<piston_name>.yaml` — automation wrapper (triggers + conditions + single script call)
* `<ha_config>/scripts/pistoncore/<piston_name>.yaml` — script body (all action logic)

The automation's action is a single line: `action: script.pistoncore_<piston_name>`

Script entity IDs follow the pattern `script.pistoncore_<piston_name>`. Script key names use lowercase letters and underscores only — no capitals, no dashes.

**configuration.yaml addition required (one line, labeled to avoid conflicts):**
```yaml
script pistoncore: !include_dir_merge_named scripts/pistoncore/
```

This labeled key avoids conflict with the user's existing `script:` include. It is the only configuration.yaml change needed for native script pistons.

**PyScript (fallback — edge cases only):**
* `<ha_config>/pyscript/pistoncore/<piston_name>.py`

**Warning on in-progress scripts:** If a piston's script is currently running when the user deploys an update, PistonCore warns before proceeding. Calling `script.reload` stops running script instances.

### Call Another Piston — Mode Limitations

* **Native Script → Native Script:** Supported. Direct call (`action: script.pistoncore_<name>`) waits for completion. `script.turn_on` fires without waiting.
* **Native Script → Native Script (fire-and-forget):** Use `action: script.turn_on` with target.
* **Any → PyScript or mixed:** Forces conversion to PyScript for the calling piston.
* **Wait for completion across any boundary:** Requires PyScript.

**Control Another Piston / HA Automation:** Starting, stopping, enabling, disabling, and triggering other pistons or HA automations is a first-class feature, implemented entirely through native HA services:
* `automation.turn_on` / `automation.turn_off`
* `automation.trigger`
* `automation.reload`
* `script.turn_on` / `script.turn_off`

These survive PistonCore uninstall completely.

### Deployment Flow

1. User clicks Deploy to HA
2. Pre-save validation pipeline runs (Section 13)
3. If validation passes, companion writes files to production directories
4. Companion calls `automation.reload` and `script.reload`
5. Automation and script are live within seconds
6. PistonCore confirms success or reports failure in plain English

### Minimum HA Version

**Required: Home Assistant 2023.1 or later.**

Features used that establish this floor: `repeat: for_each:`, `if: / then: / else:` in scripts, `parallel:`, `continue_on_error:`, `stop:`, `wait_for_trigger:` inside scripts. All present and stable from 2023.1 onward. Document this clearly in the README.

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

### 17.2 Docker Volume Folder Structure

Two top-level folders. Names are self-explanatory without reading documentation.

```
/pistoncore-userdata/               YOUR DATA — pistons, globals, settings
  pistons/                          your piston JSON files
  device-definitions/               your custom device definitions
  config.json                       your PistonCore settings
  logs/
    pistoncore.log

/pistoncore-customize/              CUSTOMIZE PISTONCORE — templates, rules
  compiler-templates/
    native-script/
      automation.yaml.j2            Jinja2 template for automation wrapper
      script.yaml.j2                Jinja2 template for script body
      AI-UPDATE-GUIDE.md            paste into any AI to update native script templates
      README.md
    pyscript/
      piston.py.j2                  Jinja2 template for PyScript pistons
      ha-stubs.py                   mock HA objects for Docker validation
      AI-UPDATE-GUIDE.md            paste into any AI to update PyScript templates
      README.md
  validation-rules/
    internal-checks.json            what PistonCore checks and error messages
    error-translations.json         plain English explanations for raw errors
    AI-UPDATE-GUIDE.md              paste into any AI to update validation rules
    README.md
  README.md                         explains the two folder system in plain English
```

Default file behavior: container ships with defaults, copies them to volume on first launch only if files do not already exist. Container updates never overwrite user files.

**Note:** globals.json is no longer stored in the Docker volume. Global variables are stored as native HA helpers managed by the companion. The companion's helper manifest is stored in the companion's own HA storage, not in the Docker volume.

### 17.3 Validation Rules Files

Lives in `/pistoncore-customize/validation-rules/`. Two files:
* `internal-checks.json` — what PistonCore checks internally and the error messages it produces
* `error-translations.json` — plain English explanations for raw compiler/linter errors

Edit the file, restart the container — no code changes needed. Community can contribute error translations via pull requests.

### 17.4 First-Run Setup — Two Phase

**Phase 1 — Editor only (immediate):**
User enters HA URL and long-lived access token. PistonCore opens a WebSocket connection to HA and pulls all devices, entities, capabilities, areas, and services. The user can begin building and editing pistons immediately. No companion required.

**Phase 2 — Companion (prompted when needed):**
When the user first attempts to deploy a piston to HA, PistonCore detects that the companion is not installed and prompts installation via HACS.

### 17.5 PistonCore Companion (HA Custom Integration)

Installed into Home Assistant via HACS.

#### Setup

Before making any changes to HA, the companion presents a plain English summary of exactly what it will do and requires the user to confirm.

**Changes made during setup:**
1. Add `script pistoncore: !include_dir_merge_named scripts/pistoncore/` to configuration.yaml — allows PistonCore scripts to load without conflicting with the user's existing scripts
2. Create the `scripts/pistoncore/` and `automations/pistoncore/` directories in HA config
3. Optionally add `pyscript: allow_all_imports: true` if the user enables PyScript support

PyScript support is opt-in. If the user never builds a PyScript piston, the companion never touches PyScript configuration.

#### Confirmation Screen

Before making any changes, PistonCore displays a plain English summary of every change it is about to make. User must click **I Agree — Make These Changes** to proceed, or **Cancel** to abort with nothing changed.

#### Existing Configuration Detection

Before setup, the companion scans existing HA configuration and warns if any conflicts are detected. Never assumes a clean configuration.

#### Companion Capabilities

* Fetch full device capability profiles from HA
* Write compiled piston files to the correct HA directories
* Create, update, and delete global variable helpers via HA API
* Maintain a manifest of all PistonCore-managed helpers
* Perform boot-time integrity check of managed helpers
* Execute `yamllint` for script/automation syntax checking
* Validate native scripts via `script.reload` against sandbox
* Call `automation.reload` and `script.reload` after deployment
* Listen for `PISTONCORE_RUN_COMPLETE` events via WebSocket and relay to the Docker editor
* Transmit Trace debug data via custom WebSocket event

#### Compiler Template System

**Status: Not yet defined — do not write compiler code until designed.**

Compiler templates are Jinja2 files stored in `/pistoncore-customize/compiler-templates/`. The format, placeholders, and how the compiler walks the piston tree to fill them in will be defined in a dedicated COMPILER_SPEC.md document. This is the primary blocker for all backend coding.

---

## 18. The JSON Sharing Format

### Role System and Piston ID

* Device references use **roles** — named placeholders, not hard entity IDs
* The actual entity IDs live in a `device_map` — never included in Snapshot exports
* Format is versioned

**Role creation during piston building:** Hard entity references internally; auto-roles generated on Snapshot export. The user never manages roles unless they explicitly share. Role system remains fully functional — it just happens automatically on export rather than during building.

**execute / end execute is a rendering artifact, not a data node.** The piston JSON `actions` array IS the execute block. The editor renders `execute / end execute;` around the actions array automatically when displaying the document. No execute node exists in the serialized JSON. The compiler treats the actions array as the execute block body directly.

**Piston IDs:**
* Snapshot import always generates a new ID
* Backup import preserves the original ID

### Example Piston JSON

```json
{
  "pistoncore_version": "1.0",
  "id": "a3f8c2d1",
  "name": "Driveway Lights at Sunset",
  "description": "Turns on driveway lights at sunset and off at 11pm",
  "mode": "single",
  "compile_target": "native_script",
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

Note: `compile_target` updated from `"yaml"` to `"native_script"` to reflect the new architecture.

---

## 19. Global Variables Management

Managed from PistonCore's main settings screen.

The global variables screen shows:
* All defined globals with their current values and types
* Which pistons reference each global
* Add, edit, and delete globals

### Non-Device Globals (Text, Number, Yes/No, Date/Time)

Changing a value calls the appropriate HA helper set service immediately — no redeployment needed. The compiled pistons read the helper value live at runtime via HA template syntax. The change takes effect on the very next piston run.

### Device and Devices Globals

These are compile-time values. Changing which devices are in a Device or Devices global does not automatically update deployed pistons — the entity IDs are baked into the compiled YAML at deploy time.

**When the device list changes:**
PistonCore flags all affected pistons as stale. A banner appears on the piston list page:

*"'Smoke Detectors' was updated — 3 pistons need redeployment to pick up your changes."*
`[Redeploy All]` `[Review]`

`[Redeploy All]` — recompiles and deploys all affected pistons in sequence, one at a time, reporting success or failure for each.
`[Review]` — opens the affected pistons list so the user can choose which ones to redeploy individually. Each piston shows a ⚠ stale badge until redeployed.

The stale banner persists until all affected pistons are redeployed or the user explicitly dismisses it. Dismissing hides the banner but the stale badges on individual pistons remain visible on the list page.

### Global Variables Drawer

Accessible from the main piston list page as a read-only slide-out panel. Shows all globals with current values. Device and Devices globals show the current device list with friendly names.

---

## 20. Folders

Single-level user-defined folders. Nested folders out of scope for v1.

* Created from the main piston list page only
* New pistons land in **Uncategorized** automatically — no prompt on creation
* Folder assignment via dropdown on status page or in editor header
* Pistons with no folder appear in Uncategorized in the list

---

## 21. V1 Core Feature Set

**Statement types:**
If Block, With/Do block, Only When restrictions, Wait (fixed duration or until time), Wait for state with timeout, Set variable, Repeat loop (repeat/do/until/end repeat), For Each loop, While loop, Switch (pattern matching against a set of values), Do Block (groups statements), On Event (executes only when certain events happen — PyScript only), For Loop (count-based iteration), Break (interrupts inner loop — PyScript only), Cancel All Pending Tasks (PyScript only), Log message (five color-coded types), Call another piston (fire-and-forget or wait for completion), Control another piston / HA automation (Start/Stop/Enable/Disable/Trigger), Stop

**Editor features:**
Structured document editor — indented tree, inline ghost text insertion, WebCoRE-matching keywords, execute/end execute rendering wrapper, settings/end settings block (contents TBD), define/end define block for piston variables, drag and drop block reordering (within block only), Global Variables drawer on main list page, Simple/Advanced mode toggle, per-statement cog in wizard (TEP/TCP/Execution Method), Snapshot and Backup export, duplicate piston, import from JSON/URL/file, piston status page as hub (including read-only piston script view), save returns to status page, run log with plain English detail, log level per piston with WebCoRE-matching save behavior, log message action, trace mode via WebSocket (statement numbers not line numbers), test required before trace available, test button always labeled Live Fire ⚠ with confirmation dialog, pause/resume, compiler templates (external Jinja2 user-replaceable), device picker with type-to-filter search, unknown device fallback one-time define screen, dynamic capability-driven multi-step wizard, condition-or-group first step in wizard, trigger wizard with duration field, which-interaction step (physical vs programmatic), full operator set (Section 9), true/false last evaluation result on list, copy AI prompt button (redesign required), automatic validation on save, pre-deploy validation pipeline (Docker-only stages 1-3, companion stage 4 optional), file signature and hash system, failure notification toggle, My Device Definitions screen, piston ID system, call-another-piston fire-and-forget warning shown before wizard completes

**Action philosophy:** PistonCore never maintains its own integration or command list. The action wizard pulls live services from HA's service registry. PistonCore only defines explicitly the system commands that are NOT HA services — Wait, Set variable, Execute piston, Cancel all pending tasks, etc. All HA integrations are inherited automatically.

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
* Variable list types (Dynamic list, String list, etc.) — deferred to v2
* Expression editor for advanced value inputs — deferred to v2
* Full step-through simulator / dry run — deferred to v2
* Location mode restrictions ("Only during these modes") — HA users handle via conditions and if blocks. Deliberate divergence from WebCoRE — documented.
* Timer statement — may overlap with HA's scheduler, evaluate before implementing

---

## 23. Independence Guarantee

### Native HA Script pistons
* Run forever after PistonCore uninstall ✅
* Run with HA app only ✅
* Not affected by PyScript removal ✅
* Require HA 2023.1 or later ⚠

### PyScript pistons
* Run after PistonCore uninstall ✅ (PyScript still installed)
* Run with HA app only ✅ (PyScript still installed)
* Stop if PyScript is removed ❌

### Global variables (helper-backed)
* Still readable by compiled pistons after PistonCore uninstall ✅
* Helper values persist in HA after uninstall ✅
* Helpers remain visible and editable in HA UI after uninstall ✅
* Companion helper management stops working after uninstall ⚠ (values stay, management UI gone)

### HA service calls from pistons (notifications, device control, etc.)
* All work after PistonCore uninstall ✅
* All work with HA app only ✅

This table is shown in the experimental warning at first launch. Documentation must be clear about which promise applies to which piston type.

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
All six open questions resolved. Full design review against WebCoRE wiki. Frontend framework confirmed as vanilla JS/HTML/CSS. DESIGN.md updated to v0.6. No code written.

### Session 5 — April 2026
DESIGN.md v0.7, FRONTEND_SPEC.md v0.1, and WIZARD_SPEC.md v0.1 produced. WebCoRE screenshots reviewed — 8 corrections captured. Docker volume structure, validation rules file, AI-UPDATE-GUIDE concept, and compiler template format (Jinja2) finalized. No code written.

### Session 6 — April 2026
DESIGN.md v0.8, FRONTEND_SPEC.md v0.2, and WIZARD_SPEC.md v0.2 produced incorporating all Session 5 notes file corrections (32 items). No code written.

### Session 7 — April 2026
Architecture confirmed: Native HA Script as primary compile target, PyScript as fallback for break/cancel_pending_tasks/on_event only. Five HA script capability gaps researched and resolved. Perplexity conversation reviewed. Added "Compiled files are compiler-owned artifacts" and "The compiler absorbs Home Assistant churn" to Section 2 Core Philosophy. Globals architecture updated from globals.json file to companion-managed native HA helpers. Setup mode complexity eliminated. Minimum HA version floor established at 2023.1. Test button unified to Live Fire ⚠. DESIGN.md updated to v0.9. COMPILER_SPEC.md v0.1 written. WIZARD_SPEC.md updated to v0.3 — binary sensor on/off validation catch, display_value/compiled_value separation. AI-REVIEW-PROMPT.md written. Section 27 expanded with logic validation rule. DESIGN.md bumped to v0.9.1.

---

## 26. Open Items Blocking Coding

Do not write production code until these are resolved:

1. **COMPILER_SPEC.md** — primary blocker. Design the native HA script compiler first (automation wrapper + script body Jinja2 templates). Hand-write the driveway lights piston output by hand, work backwards to define template format and compiler tree walk.
2. **settings / end settings block contents** — research WebCoRE behavior, define contents before implementing
3. **AI Prompt feature redesign** — needs friendly name context without entity IDs (Section 11)
4. **Which-interaction step feasibility** — evaluate PyScript context tracking in sandbox (Section 8.6)
5. **Timer statement** — evaluate overlap with HA scheduler before including in v1

Note: globals.json sandbox validation (formerly item 3) is resolved — globals now use helper-backed storage, eliminating the file I/O problem entirely. PyScript dry-run flag (formerly item 6) is resolved — both targets use Live Fire ⚠ with a confirmation dialog.

---

## 27. Standing Questions and Validation Workflow

### The Three Standing Questions — Ask Every AI Reviewing This Design

* What technical assumptions in this design are most likely to be wrong?
* What features described here cannot work the way they are described?
* What has been left undefined that will block a developer from writing code?

See `AI-REVIEW-PROMPT.md` in the repo root for the full external AI review prompt,
including a fourth compiler-specific question and rules for how to interpret responses.

### Logic Validation Rule — Before Any New Spec or Code

**Any new technical approach, HA behavior assumption, or logic choice must be validated
against real HA behavior BEFORE it is written into a spec or implemented in code.**

This rule exists because incorrect assumptions propagate through all downstream documents
and code. It is always cheaper to validate first than to rewrite a spec or debug compiled
output later.

**What must be validated:**
- How HA returns state values for any entity type (e.g. binary sensors return "on"/"off",
  not friendly labels like "open"/"closed" — caught in Session 7)
- Whether a native HA script feature works the way the spec assumes
- Whether a WebSocket API command returns the data structure expected
- Any compiler output pattern that has not been hand-verified against real HA YAML

**How to validate:**
Search current HA documentation, fetch HA source or developer docs, or check real HA
community examples. Run the validation before writing any new spec content or code.

**When bringing in feedback from other AIs:**
Other AIs can be confidently wrong about HA-specific behavior. Any HA behavior claim
from an external AI review must be validated against real HA docs before it is acted on.
Bring all external AI feedback to the primary session for evaluation before updating specs.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
