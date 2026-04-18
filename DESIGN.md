# PistonCore Design Document

**Version:** 0.5
**Status:** Draft — In Design, Not Yet In Development
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
* **PistonCore never touches files it did not create.** Your existing hand-written automations, scripts, and YAML files are completely safe. PistonCore only ever writes to its own subfolder.
* **Shareable by design.** Pistons are stored and shared as plain JSON. Paste them anywhere — a forum post, a GitHub Gist, a Discord message, a text file. Import from a URL or paste directly. No account required, no server involved.
* **AI-friendly from day one.** The piston JSON format is simple and fully documented so AI assistants can generate valid pistons from a plain English description. A user can describe what they want to an AI and paste the result straight into the editor.
* **Open and community driven.** MIT licensed. Anyone can host, fork, modify, or contribute. The project belongs to the community.
* **Familiar to WebCoRE users.** The piston concept, structure, and terminology are intentionally close to WebCoRE so experienced users can pick it up immediately with minimal relearning.
* **Plain English everywhere, icons plus labels for universal actions.** Logic operators, conditions, and descriptive text are always written in plain English. Buttons that perform actions use an icon paired with a plain English label — never an icon alone (for users who cannot read English) and never a label alone on universal actions (for users who cannot read the language). See Section 7 for UI rules.
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

### Capability-Driven Attribute Selection

After picking a device, the user picks which capability or attribute they want to act on or evaluate. This list is fetched live from HA for that specific device — it is never a hardcoded list maintained by PistonCore. The list always reflects exactly what HA reports for that device at that moment.

This is a multi-step flow:
1. Pick the device (by friendly name, device name, or area)
2. Pick the capability or attribute from the live list HA returns for that device
3. Pick the comparison or action based on that capability

Entity resolution — determining which underlying HA entity handles the selected capability — is done internally by PistonCore. The user never sees or selects entity IDs.

### Why This Requires Full Device Profiles from the Companion

The companion integration must fetch full device capability profiles from HA — not just entity lists. Every attribute, every supported state, every available service for every device. The condition wizard and action builder depend entirely on this data being complete and current.

---

## 6. Piston Structure

Every piston has the following sections in order. All sections except the header are collapsible.

### 6.1 Header

* **Name** — human readable, becomes the filename when compiled
* **Description** — optional, shown in piston list and sharing previews
* **Folder** — which user-defined folder this piston lives in
* **Mode** — what happens if the piston triggers while already running:
  * *Single* — ignore new triggers while running (default)
  * *Restart* — cancel current run and start fresh
  * *Queued* — finish current run then start next
  * *Parallel* — run multiple instances simultaneously
* **Enabled / Disabled** — pause a piston without deleting it

### 6.2 Piston Variables

Optional. Defined at the top, available throughout this piston only.
Clearly labeled: *"Temporary — forgotten when this piston finishes running."*

### 6.3 Triggers

What starts the piston. One or more triggers. Types include:

* Device or entity state change
* Numeric threshold
* Time (specific time of day)
* Sunrise / Sunset with optional offset
* Time pattern (every X minutes, every X hours)
* HA event
* Webhook
* Called by another piston
* Manual only

Trigger setup uses the same device-level picker and live capability list described in Section 5.

### 6.4 Conditions

Checked after a trigger fires. If conditions are not met the piston stops silently.

Conditions use plain English operators written out in full — never symbols:

* equals / does not equal
* is greater than / is less than / is between
* is on / is off
* contains / does not contain
* is before / is after (for times)

Multiple conditions are grouped with **AND** or **OR** — written in full, never symbols.

Condition setup uses the same device-level picker and live capability list described in Section 5.

### 6.5 Action Tree

A top-to-bottom sequence of actions that can branch:

* **Call service** — any HA service for the selected device, populated from live HA data
* **If / Then / Else** — branch based on any condition
* **Set variable** — assign or modify a piston variable or global variable
* **Wait** — pause for a fixed amount of time
* **Wait for state** — pause until an entity reaches a specific state, with optional timeout
* **Repeat** — loop a block of actions a set number of times or while a condition is true
* **Call another piston** — trigger a different piston by name
* **Log message** — write a plain English message to the piston log
* **Stop** — end the piston run immediately

---

## 7. The Editor UI

### Overall Feel

The editor is a structured document viewed top to bottom. Logic is always visible — not hidden behind collapsed accordions by default. Indentation shows nesting. It should feel like reading a well-formatted script, not filling out a web form.

A user who has used WebCoRE should be able to build a basic piston within a few minutes without reading documentation.

### UI Rules — No Exceptions

1. **No pictograms for logic.** AND/OR is written "AND" and "OR". Equals is written "equals". Greater than is written "is greater than". No symbols that require learning a visual language.
2. **No entity IDs ever visible to the user.** All entity references show the friendly name, device name, and area. Entity IDs are handled internally.
3. **All dropdowns populated from live HA data.** You never type a device name or service name. You always pick from what HA reports.
4. **Sections are collapsible** with clear plain English text labels — not icons alone.
5. **Errors are plain English.** "Action 3 failed: the device you selected was not found in Home Assistant" — not technical error codes.
6. **Buttons that perform actions use icon plus plain English label.** Never icon alone, never label alone on universal actions. This supports users who cannot read English (they recognize the icon) and users who can (they read the label). Example: 📷 Snapshot, 📷 Backup, ▶ Test, ✎ Edit.
7. **Automatic validation on save.** When a piston is saved, PistonCore immediately checks for problems and displays any warnings or errors on the status page without the user having to ask. Example: a banner stating "This piston has no triggers. It will never run on its own."

### Frontend Framework

The frontend framework is not prescribed. React, Vue, Svelte, or plain HTML/JS — whatever best produces the structured document editor feel described above. The feel requirement takes priority over any technology preference. Review session2_archive for prior React work before making this decision.

### Piston List Screen

```
┌─────────────────────────────────────────────────────┐
│  PistonCore                    [Copy AI Prompt] [+ New] │
│  [Search pistons...]                                │
├──────────────────┬──────────────────────────────────┤
│  FOLDERS         │  Outdoor Lighting                │
│                  │  ─────────────────────────────── │
│  Outdoor    ──▶  │  ● Driveway Lights at Sunset      │
│  Lighting        │    Last ran: 10 minutes ago       │
│                  │                                   │
│  Indoor          │  ● Side Gate Motion Light         │
│  Lighting        │    Last ran: 2 hours ago          │
│                  │                                   │
│  Security        │  ○ Holiday Lights (disabled)      │
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

### Piston Status Page

The status page is the hub for every piston. Navigation flow: List → Status Page → Editor → Status Page.

The status page shows:

* **Status panel** — active or paused, Pause/Resume button, folder assignment
* **Quick Facts** — last executed, next scheduled, subscriptions, devices used, memory used
* **Validation banner** — any warnings or errors detected on last save, displayed automatically. Example: "This piston has no triggers. It will never run on its own."
* **Script panel** — the compiled output (YAML or PyScript), with buttons: ✎ Edit, ▶ Test, 📷 Snapshot, 📷 Backup, ⧉ Copy, Trace, 🗑 Delete
* **Logs panel** — recent run history in plain English
* **Variables panel** — current piston variable state

**[TO BE DECIDED — Next Session]:** Does the compiled script output display on the status page, or is it hidden from users by default?

### Trace / Live Debug

Trace is a toggle on the status page. When active and the piston runs (or Test is pressed), timing annotations appear overlaid on the compiled script — showing each step, elapsed time, and pass/fail result inline. Trace output is transmitted via a custom PistonCore WebSocket event and is never written to the main HA system log. When Trace is off, no debug data is generated or transmitted.

### Piston Editor Screen

```
┌─────────────────────────────────────────────────────┐
│  PistonCore                    [My Pistons] [+ New] │
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
├─────────────────────────────────────────────────────┤
│  ▼ CONDITIONS                               [+ Add] │
│  (none — piston runs on every trigger)              │
├─────────────────────────────────────────────────────┤
│  ▼ ACTIONS                                  [+ Add] │
│  1. Turn On → Driveway Main Light                   │
│     Brightness: 100%                                │
│  2. Wait until 11:00 PM                             │
│  3. Turn Off → Driveway Main Light                  │
├─────────────────────────────────────────────────────┤
│  [▶ Test]  [Deploy to HA]  [📷 Snapshot] [📷 Backup]│
└─────────────────────────────────────────────────────┘
```

### Simple / Advanced Mode

A toggle at the top of the editor. Default is Simple.

* **Simple mode** — hides piston variables, limits to most common trigger and action types, most plain English presentation
* **Advanced mode** — shows everything: piston variables, all trigger types, all action types, loops, wait-for-state, nested if/else, call another piston

Switching modes never breaks a piston. Advanced pistons open correctly in simple mode — advanced features just cannot be edited until you switch back.

---

## 8. The Condition and Action Wizard

When a user adds or edits a condition or action, a multi-step modal wizard opens. Each step's options are generated from HA based on what was selected in the previous step. PistonCore never maintains its own device capability database — it always asks HA.

**Condition wizard flow:**
1. What to compare — pick Physical Device or other source
2. Pick the device — searchable by name or area
3. Pick the capability or attribute — list fetched live from HA for that device
4. Pick the kind of comparison — list appropriate to the selected capability
5. Compare to — value, another device, a variable, or a time

**Action wizard flow:**
1. Pick the device
2. Pick the capability or service — list fetched live from HA for that device
3. Configure the service call parameters — fields generated from HA's service schema

---

## 9. Export and Import

### Export — Snapshot (📷 green)

Exports an anonymized version of the piston with all entity mappings stripped. The logic, structure, roles, and role labels are preserved. Safe to post on forums, GitHub, Discord, or share with anyone. Recipients map their own devices on import.

### Export — Backup (📷 red)

Exports the full piston including entity mappings. Intended for personal restore only. Should not be shared publicly as it contains installation-specific entity IDs. Labeled clearly in the UI: "For your own restore only — do not share."

### Import — Device Mapping

When a piston is imported and contains unmapped roles, PistonCore displays the device mapping screen. Each unmapped role is highlighted and presented with a dropdown of live devices from HA. The user maps each role to a real device before the piston can be saved or deployed. This is the standard commissioning flow for any shared piston.

### Import Methods

* Paste JSON directly into the import dialog
* Paste a URL pointing to any raw JSON file
* Upload a `.piston` file
* AI-generated JSON pasted from any AI assistant

---

## 10. AI Prompt Feature

The main piston list page has a **Copy AI Prompt** button. Clicking it copies the PistonCore JSON format specification to the clipboard. No user data, entity information, or global variables are included — only the format specification. The user pastes it into any AI assistant, describes what they want the piston to do, and the AI generates a valid PistonCore JSON template with role placeholders. The user imports that template and maps the placeholders to their real devices in the editor.

This keeps user data private and produces a template the user completes locally — not a ready-to-deploy piston with someone else's entity IDs.

---

## 11. Logging and Debugging

### Automatic Validation on Save

When a piston is saved, PistonCore runs basic validation and displays results on the status page immediately. Warnings and errors appear without the user asking. Examples:

* "This piston has no triggers. It will never run on its own."
* "Action 2 references a device that could not be found in Home Assistant."
* "This piston uses global variable house_mode which has not been defined."

### Live Piston Log

Every piston has a log panel showing recent run history. Each entry shows:

* When the piston triggered and what triggered it
* Each condition checked and whether it passed or failed — in plain English
* Each action taken and whether it succeeded
* Any errors in plain English
* How long the run took

### Trace Mode

A toggle on the status page. When active, Test or a real trigger execution overlays timing annotations on the compiled script inline — each step labeled with elapsed time and result. Trace data is sent via a custom PistonCore WebSocket event. It is never written to the main HA system log. When Trace is off, no debug data is generated or transmitted at all.

### Test / Dry Run

The Test button on the status page and editor fires the piston manually. In dry run mode it shows what actions would have been called without actually calling them.

### Error Handling

When a piston fails mid-run:

* The error is logged in plain English
* The piston stops at the point of failure
* Remaining actions are not executed
* An optional notification can be configured per piston
* The piston stays enabled and will try again on the next trigger
* Errors are never silent

**[TO BE DECIDED — Next Session]:** Where is the per-piston failure notification configured, and what does it send?

---

## 12. Compilation and Deployment

### Output File Locations

* Simple pistons → `<ha_config>/automations/pistoncore/<piston_name>.yaml`
* Complex pistons → `<ha_config>/pyscript/pistoncore/<piston_name>.py`
* PistonCore never writes outside its own subfolders
* PistonCore never modifies, moves, or deletes any file it did not create
* Filenames come from the piston name

### PyScript Comment Header

Every compiled `.py` file includes a comment header listing:

* Piston name, author, created date, modified date, build number
* Every global variable the piston references

This allows PistonCore to scan the compiled folder and determine global variable usage without a database.

### Deployment Flow

1. User clicks **Deploy to HA**
2. PistonCore compiles the piston JSON to the appropriate format
3. File is sent to the companion integration
4. Companion writes the file to the correct HA config directory
5. Companion calls the HA reload service
6. Automation is live within seconds
7. PistonCore confirms success or reports failure in plain English

### Manual Edit Warning

If a compiled file is manually edited outside PistonCore it will run fine — until that piston is deployed again, which overwrites manual changes. PistonCore detects this and warns clearly before overwriting.

---

## 13. Safety Rules — Core Lockdown

PistonCore is strictly a generator and API client. These restrictions are architectural — they cannot be configured away or overridden by any user action:

**PistonCore is forbidden from:**
* Modifying `.storage/` folders
* Editing `configuration.yaml` directly
* Accessing `home-assistant_v2.db`
* Writing to any directory it did not create
* Calling any undocumented HA internal API

**The only HA-side additions** are a small set of lines added to HA config during companion setup, handled through the normal HACS installation process. These additions are minimal and documented.

**Corruption detection:** If the globals JSON file is detected as corrupt on startup, PistonCore posts a persistent HA notification and uses safe hardcoded defaults. It never silently loads corrupt data.

---

## 14. The Two Components

### 14.1 PistonCore Editor (Docker Container)

* **Tech stack:** Python (FastAPI) backend, frontend framework TBD (see Section 7)
* **Runs on:** Any Docker host — Unraid, Raspberry Pi, NAS, cloud VPS
* **Default port:** 7777 (configurable)
* **Piston storage:** JSON files in a mounted Docker volume
* **No internet required** for local use

Unraid Community Apps template planned for one-click installation.

### 14.2 First-Run Setup — Two Phase

**Phase 1 — Editor only (immediate):**
On first launch, the user enters their HA URL and a long-lived HA access token. PistonCore uses the HA REST API to pull all devices, entities, capabilities, areas, and services. The user can begin building and editing pistons immediately. No companion required for this phase.

**Phase 2 — Companion (prompted when needed):**
When the user first attempts to deploy a piston to HA, PistonCore detects that the companion is not installed and prompts the user to install it via HACS. The companion is required only for writing compiled files to HA config directories and for the startup YAML additions. Until deployment is needed, the companion is not required.

### 14.3 PistonCore Companion (HA Custom Integration)

Installed into Home Assistant via HACS.

Provides a local API that the editor uses to:

* Fetch full device capability profiles from HA (all attributes, all supported states, all services per device)
* Write compiled piston files to the correct HA directories
* Trigger HA reload after deployment
* Report piston run status back to the editor
* Transmit Trace debug data via custom WebSocket event

Requires a long-lived HA access token configured once at setup.

---

## 15. The JSON Sharing Format

Pistons are stored internally and shared externally as plain JSON. The format is intentionally simple and human readable.

### Key Design Decisions

* Device references use **roles** — named placeholders like `motion_sensor` or `driveway_light` — not hard entity IDs
* The actual entity IDs live in a `device_map` section that belongs to your installation and is never included in a Snapshot export
* The JSON schema is fully documented so AI tools can generate valid pistons
* The format is versioned so future PistonCore updates can handle older pistons gracefully

**[TO BE DECIDED — Next Session]:** How are piston IDs generated and what happens on an ID collision at import?

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
      "type": "call_service",
      "service": "light.turn_on",
      "target_role": "driveway_light",
      "data": { "brightness_pct": 100 }
    },
    {
      "type": "wait",
      "until": "23:00:00"
    },
    {
      "type": "call_service",
      "service": "light.turn_off",
      "target_role": "driveway_light"
    }
  ]
}
```

---

## 16. Global Variables Management

Managed from PistonCore's main settings screen, separate from any individual piston.

The global variables screen shows:

* All defined globals with their current values and types
* Which pistons reference each global (scanned from PyScript comment headers)
* Add, edit, and delete globals

Changing a global value writes to the JSON file and pushes to HA live memory immediately — no redeployment of pistons needed.

---

## 17. Folders

Pistons are organized into user-defined single-level folders. Nested folders are out of scope for v1.

Pistons with no folder assigned appear in an **Uncategorized** bucket. Folder assignment is not mandatory at creation — it can be set or changed from the status page at any time.

**[TO BE DECIDED — Next Session]:** Is folder assignment prompted on new piston creation or always optional?

---

## 18. V1 Core Feature Set

Build only these in V1. Everything else is a future feature.

**Statement types:**
* If Block (Condition and Group)
* Action
* Timer / Wait
* Wait for state with timeout
* Only when restrictions
* Repeat loop with condition
* Nested ifs to any depth

**Editor features:**
* Toolbar with visibility toggles
* Drag and drop block reordering
* Global variables right sidebar (read-only reference)
* Simple / Advanced mode toggle
* 📷 Snapshot and 📷 Backup export
* Duplicate piston
* Import from JSON paste, URL, and file
* Piston status page as hub
* Run log with plain English detail
* Trace mode for live debug
* Pause/resume from list and status page
* Compiler templates (external, user replaceable)
* Device picker with type-to-filter search by name and area
* Dynamic capability-driven multi-step condition and action wizard
* True/false last evaluation result on piston list
* Copy AI Prompt button on piston list
* Automatic validation warnings on save

---

## 19. Out of Scope for V1

* Mobile app
* Multi-user authentication
* Central cloud server maintained by the project
* Direct WebCoRE piston import
* Piston marketplace or registry
* HA dashboard status cards
* Version history and rollback
* Nested folders
* Direct WebCoRE piston migration

---

## 20. Open Questions — To Be Resolved Next Design Session

These items are intentionally left open. Prompt the user on each of these at the start of the next design session before writing any code.

1. **Compiled script visibility** — Does the compiled YAML or PyScript output display on the status page, or is it hidden from users by default?
2. **Per-piston failure notification** — Where is this configured and what does it send?
3. **Piston ID generation and collision handling** — How are IDs generated and what happens when an imported piston has the same ID as an existing one?
4. **Folder assignment on creation** — Is the user prompted to assign a folder when creating a new piston, or is it always optional and done later?
5. **Navigation after save in editor** — When the user saves in the editor, do they stay in the editor or return to the status page?
6. **Trigger wizard flow** — The condition wizard flow is defined in Section 8. Does the trigger setup use the same multi-step wizard pattern, or is it structured differently?

---

## 21. Distribution Plan

| Channel | Purpose | When |
|---|---|---|
| GitHub (public, MIT license) | Source code, issues, docs, contributions | Day 1 |
| Docker Hub | Container image for self-hosting | First working build |
| Unraid Community Apps | One-click install template | After Docker image is stable |
| HACS | Companion integration | After companion works |
| HA Community Forums | Announcement and feedback | After MVP works end to end |

---

## 22. Development Log

### Session 1 — April 2026
Project conceived. Design document written. GitHub repo created.

### Session 2 — April 2026
FastAPI backend scaffolded. React frontend scaffolded. Companion skeleton built. 19 API endpoints verified. Compiler verified against example piston. All code now in session2_archive.

### Session 2 Strategy Review — April 2026
Extensive WebCoRE screenshot review. Design rewritten as v0.5. Major changes to UI model, architecture, and scope. Frontend decoupled from React. Condition wizard redesigned as dynamic multi-step. Status page established as piston hub. Compiler template system designed. V1 scope tightened.

### Session 3 — April 2026
Design refined through WebCoRE screenshot analysis and structured topic review. Key decisions made:
- Device picker operates at device level, not entity level. Capability selection is live from HA, never from a PistonCore-maintained list.
- Trace mode is a user toggle on the status page. Debug data goes via WebSocket, never to HA system log.
- Global variables write to JSON and push to HA live memory immediately on save. JSON is always the master.
- Safety lockdown is architectural — PistonCore cannot touch HA core files regardless of user intent.
- PyScript comment headers track global variable usage without a database.
- AI Prompt button copies format spec only — no user data included.
- Export is Snapshot (anonymized, shareable) and Backup (full, personal only), both using camera icon plus plain English label.
- Two-phase setup: Phase 1 uses HA REST API only, Phase 2 prompts for companion installation when deployment is first attempted.
- Automatic validation on save displays warnings on status page without user action.
- Six open questions documented in Section 20 for next session.

DESIGN.md updated to v0.5. No code written this session.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
