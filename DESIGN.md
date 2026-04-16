# PistonCore — Design Document
**Version:** 0.5
**Status:** Draft — In Development
**Last Updated:** April 2026

---

## 1. What Is PistonCore?

PistonCore is an open-source visual automation builder for Home Assistant, designed to feel immediately familiar to anyone who has used WebCoRE on SmartThings or Hubitat. It lets you build complex automations — called **pistons** — through a structured visual editor using dropdowns populated directly from your actual HA devices, without ever writing YAML or Python manually.

**PistonCore is not a home automation platform. It is a tool for building automations on top of one.**

It does not add devices, manage integrations, or extend HA's capabilities in any way. It reads what HA already has, gives you a better way to write logic against it, and compiles that logic to native HA files that run permanently and independently.

**PistonCore does not need to be running for your automations to work.** Compiled files are standard HA automation files. If you uninstall PistonCore tomorrow, every piston you built keeps running forever. No lock-in, no dependency on a running engine, no proprietary runtime format.

---

## 2. Core Philosophy

These principles guide every design decision:

- **No required central server.** PistonCore runs locally on Unraid, a Raspberry Pi, any Docker host, or optionally on a cloud server someone else hosts. Nothing depends on servers controlled by the project maintainers.
- **Automations are yours.** Compiled files are standard HA files. PistonCore is the source of truth for your pistons — the compiled files on HA are just the output.
- **PistonCore never touches files it did not create.** Your existing hand-written automations, scripts, and YAML files are completely safe. PistonCore only ever writes to its own subfolder.
- **Shareable by design.** Pistons are stored and shared as plain JSON. Paste them anywhere — a forum post, a GitHub Gist, a Discord message, a text file. Import from a URL or paste directly. No account required, no server involved.
- **AI-friendly from day one.** The piston JSON format is simple and fully documented so AI assistants can generate valid pistons from a plain English description.
- **Open and community driven.** MIT licensed. Anyone can host, fork, modify, or contribute.
- **Familiar to WebCoRE users.** The piston concept, structure, and terminology are intentionally close to WebCoRE so experienced users can pick it up immediately with minimal relearning.
- **Plain English everywhere.** No pictograms, no cryptic icons, no symbols that require learning a visual language. Every toggle, every operator, every option is labeled in plain English.
- **PistonCore never maintains its own device capability database.** It always asks HA what a device can do and displays exactly what HA reports — nothing more, nothing less. This ensures automatic compatibility with every current and future device type HA supports without any PistonCore updates required.

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
| Define | Define | The section where piston variables are declared and devices assigned |

### Simple vs Complex Pistons

PistonCore automatically decides what to compile to based on what your piston does. The user never chooses.

**Simple piston → HA YAML automation file**
- No variables used
- No loops or repeats
- No wait for state
- Simple conditions, no deep nesting

**Complex piston → PyScript `.py` file**
- Any variables used (piston or global)
- Any loops or repeats
- Any wait for state
- Deeply nested if/else
- Any math or computed values

**Why both outputs matter:**
Simple pistons compile to YAML — a format with thousands of YouTube tutorials and a huge HA community. Beginners can open the compiled file and find help easily. Complex pistons compile to PyScript which handles logic YAML cannot reliably express. Most users will never know PyScript exists. The auto-detection serves the right output to the right user automatically.

### Global Variables and PyScript

Global variables are only available in complex pistons. Any piston that uses a global variable is automatically complex and compiles to PyScript. Global variable values persist in PyScript's own variable store — no HA helpers required. This keeps globals reliable, unlimited in size, and invisible to the HA UI.

---

## 4. Variables

### 4.1 Global Variables

Defined once at the PistonCore level. Available to every piston that uses them. Persist permanently until changed. Any piston referencing a global automatically compiles to PyScript.

Real world examples:
- A **battery check piston** reads a global Devices variable containing all battery-powered sensors — add a new sensor to the global once and every piston that uses it picks it up automatically
- An **announcement piston** reads a global Device variable pointing to your speaker setup — update the global when your speakers change and every piston stays current without redeployment
- A **house mode** global Text variable ("home", "away", "vacation", "night") that dozens of pistons can check

Global variables are managed from PistonCore's main Globals page, completely separate from individual pistons. Changing a global value takes effect immediately for all pistons — no redeployment needed.

**Global variables are visible as a read-only reference panel in the piston editor** — a collapsible right sidebar showing each global's name, type, and current value or entity list. Reference only — not editable from the editor. Matches the WebCoRE globals panel.

### 4.2 Piston Variables — The Define Section

Defined in the **define section** at the top of the piston. Only exist while that piston is running. Forgotten when the piston finishes.

The define section is where you:
- Declare variable types and names with optional default values
- Assign devices to named placeholders used throughout the piston

**Why the define section matters:** If you hardcode device references directly in your action logic and your setup changes, you have to hunt through every line to find and update them. The define section centralizes all device assignments so you change them once at the top and everything below automatically reflects the change. This is one of the most important habits a piston builder can develop — always use define for devices you reference more than once.

The define section is always visible when it contains variables. It can be hidden via the toolbar X button when empty. Hidden in simple mode — only visible in advanced mode.

### 4.3 Variable Types

| Type | Description | Example |
|---|---|---|
| string | A word or sentence | "away", "Good morning" |
| integer | A whole number | 75, 0, -10 |
| decimal | A number with decimals | 0.5, 98.6 |
| boolean | True or false | true, false |
| datetime | A point in time or duration | 10:30 PM, 45 minutes |
| device | A single HA entity reference | Your driveway light |
| devices | A collection of HA entity references | All battery sensors, all announcement speakers |

**Device and devices variables always show the friendly name, never the entity ID.**

**Devices variables can contain mixed device types** — Sonos speakers and Alexa devices in the same list.

**Devices variables work as action targets.** A call_service action targeting a devices variable acts on every entity in the collection.

---

## 5. Piston Structure

Every piston has the following sections in document order. The piston editor displays these as a structured document — always visible top to bottom, readable like a file, not a form with hidden dropdowns.

### 5.1 Settings

Always visible. Never collapsible. Contains:
- **Name** — human readable, becomes the filename when compiled
- **Description** — optional
- **Mode** — what happens if the piston triggers while already running:
  - *Single* — ignore new triggers while running (default). Best for most automations.
  - *Restart* — cancel current run and start fresh. Essential for pistons with timers or waits — if the trigger fires again the timer resets from zero.
  - *Queued* — finish current run completely, then run again
  - *Parallel* — run multiple instances simultaneously
- **Execution Method** — Synchronous (default)
- **Task Cancellation Policy** — what happens to waiting tasks when piston is cancelled
- **Task Execution Policy** — when tasks execute relative to trigger

### 5.2 Define (Piston Variables)

Contains local variable declarations and device assignments. Always visible when populated. Hidden via toolbar X button when empty. Advanced mode only — hidden in simple mode.

Each entry shows variable type, variable name, and assigned value or device in plain English.

### 5.3 Only When (Restrictions)

Optional. A top-level restriction that gates the entire piston before any trigger evaluation. If the restriction is not met the piston does nothing regardless of triggers. Can be hidden via toolbar filter toggle when not in use.

### 5.4 Execute (Action Tree)

The core of the piston. A top-to-bottom sequence of statements that can branch and nest arbitrarily deep. Always visible — cannot be hidden.

---

## 5.5 The Execute Section — Statements and Interaction Model

### Adding Statements

Clicking `+ add a new statement` at any valid insertion point opens the **Add a new statement** modal. This modal presents all available statement types in two groups with plain English descriptions and colored Add buttons.

**Basic statements:**
- **If Block** — the simplest decisional block. Executes different actions depending on conditions you set.
- **Action** — controls devices and executes tasks
- **Timer** — triggers execution at set time intervals

**Advanced statements (hidden in simple mode):**
- **Switch** — compares an operand against a set of values and executes corresponding statements
- **Do Block** — organizes several statements into a single named block
- **On event** — executes statements only when certain events happen
- **For Loop** — executes the same statements for a set number of iteration cycles
- **For Each Loop** — executes the same statements for each device in a device list
- **While Loop** — executes the same statements as long as a condition is met
- **Repeat Loop** — executes the same statements until a condition is met
- **Break** — interrupts the innermost switch, for loop, each loop, while loop, or repeat loop
- **Exit** — interrupts the piston execution and exits immediately

Note: See Section 14 for which statement types are in scope for V1.

### The If Block

Clicking to add or edit an if block opens a modal presenting two choices:

- **Condition** — a single comparison between two or more operands. The basic building block of a decisional statement.
- **Group** — a collection of conditions with a logical operator between them, allowing for complex decisional statements.

Additional options on an existing if block: Delete, Convert to new group, Settings, Save.

### Building a Condition — The Multi-Step Wizard

Conditions are built through a multi-step wizard. Each step's options are dynamically generated from the previous step's selection. **PistonCore never maintains its own device capability list — it always asks HA what a device can do and shows exactly what HA reports.**

**Step 1 — What to compare:**
Select the comparison type (Physical device(s), variable, time, etc.)

**Step 2 — Select device(s):**
A searchable device picker opens:
- Search box at top — type to filter instantly, no submit required
- Filters on both friendly name AND area/room — typing "outdoor" surfaces all outdoor devices regardless of their individual names
- SelectAll / DeselectAll buttons for multi-device conditions
- Full alphabetical list of friendly names only — no entity IDs ever shown
- Multiple devices selectable

**Step 3 — Select attribute:**
After selecting a device, a dropdown shows every attribute that specific device type supports — pulled live from HA, not from a PistonCore database. A light switch shows different options than a motion sensor or a lock. Examples for a light switch: switch, power, last activity, room name, pushed button, held button, double tapped button, released button, $status, numberOfButtons.

**Step 4 — Interaction type (where applicable):**
For some attributes: Any interaction, Physical interaction, or Programmatic interaction.

**Step 5 — Comparison operator:**
Operators grouped into Conditions and Triggers, dynamically generated for the selected attribute:

*Conditions:* changed, did not change, is, is not, is any of, is not any of, was, was not, was any of, was not any of

*Triggers:* changes, changes to, changes away from, changes to any of, changes away from any of, event occurs, is any and stays any of, is away and stays away from, is away and stays away from any of, is not and stays not, and additional operators depending on attribute type

**Step 6 — Compare to:**
Value picker shows only valid values for the selected device and attribute — pulled from HA. For a switch: on/off. For a lock: locked/unlocked. For a numeric sensor: a number input. The user never sees options that don't apply to the selected device.

**Back button** available at every step to go up a level without losing previous selections.
**Add more** button adds another condition to the same group without closing the modal.

### Only When Restrictions

Available on individual statement groups as a lightweight condition that gates just that group without a full if/then wrapper. Shown as `only when` in the document. Hidden via toolbar filter toggle.

### Indentation and Nesting

Indentation communicates nesting depth. No limit on nesting depth. Every level — including inside every branch at every depth — has a visible `+ add a new statement` prompt. The user never hunts for where to add something.

---

## 6. The JSON Sharing Format

Pistons stored and shared as plain JSON. Device references use **roles** — named placeholders — not entity IDs. The `device_map` is never included when sharing. When importing, PistonCore walks the user through mapping each role to a real entity via the device picker.

### Sharing Methods
- **Paste** — copy JSON, paste into import dialog
- **URL import** — paste a URL pointing to any raw JSON file
- **File** — export/import as a `.piston` file (JSON with custom extension)
- **Duplicate** — copy an existing piston as a starting point for a new one
- **AI generation** — ask an AI to write a piston in PistonCore JSON format, paste directly into import

### Safe vs Full Export

From the piston status page, two export buttons are always available:

- **Green camera — Safe share export:** Strips all device IDs, replaces with role placeholders. Safe to paste anywhere publicly. Never contains personal device information.
- **Red camera — Full export:** Includes your actual entity IDs in the device_map. For personal backup or trusted sharing only. Do not share publicly.

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
    { "type": "sun", "event": "sunset", "offset_minutes": 0 }
  ],
  "conditions": [],
  "actions": [
    {
      "type": "call_service",
      "service": "light.turn_on",
      "target_role": "driveway_light",
      "data": { "brightness_pct": 100 }
    },
    { "type": "wait", "until": "23:00:00" },
    {
      "type": "call_service",
      "service": "light.turn_off",
      "target_role": "driveway_light"
    }
  ]
}
```

---

## 7. The Editor UI

### Two Distinct UI Styles

**Piston list and navigation screens** — clean, modern, polished. This is the face of the application.

**Piston editor** — structured document model. Complete piston logic always visible top to bottom, indented to show nesting depth, readable like a well structured file. Similar in feel to viewing code in a text editor, but without ever typing code directly. A completed piston should be readable by anyone top to bottom without clicking anything to expand or reveal hidden logic.

### UI Rules — No Exceptions

1. No pictograms for logic. AND/OR written as "AND" and "OR". No symbols.
2. No entity IDs ever visible to the user. All references show friendly name.
3. All dropdowns populated from live HA data. Never type a device name, attribute, or service name.
4. Errors are plain English. Never error codes.
5. Global variables always visible in a collapsible right sidebar while editing. Read-only from editor.
6. Frontend framework is not prescribed. UI feel requirements take priority.

### Toolbar

The toolbar appears at the top of the editor. It contains independent visibility toggles — turn off what you don't need, the document gets cleaner. Turn it back on when you need it.

| Button | Label | Function |
|---|---|---|
| X | Variables | Show/hide define section (only changes visually when define is empty) |
| P | Pause | Pause/resume piston without leaving editor |
| Filter | Restrictions | Show/hide all only when restrictions in the document |
| Complex ifs | Conditions | Show/hide nested condition detail inside if blocks |
| Arrows | Move | Enable drag and drop — shows handles on each moveable block |
| Undo/Redo | | Standard undo and redo |

### Piston List Screen

Flat list with inline category/folder headers. Each folder is a colored header row with piston count, followed by its pistons. Matches WebCoRE dashboard pattern.

Each piston row shows:
- Colored status dot
- Piston name
- Last evaluation result (true/false) — whether piston conditions were met on last run
- Last run time — right-aligned, only shown if piston has run
- Inline pause/resume toggle

### Creating a New Piston

New Piston button opens a modal with four options:
- Create a blank piston
- Create a duplicate piston
- Restore a piston using a backup code (paste JSON)
- Import a piston from a backup file

### Piston Status / Troubleshoot Page

The hub for every piston. Accessed by clicking a piston in the list. Every piston interaction passes through this page.

**Navigation flow:**
List → click piston → Status page → Edit button → Editor → exit → back to Status page

**Status page contains:**
- Piston name and description
- **Folder assignment** — pistons are assigned to folders here, not in the editor
- Enabled/paused status with one-click pause/resume
- **Green camera** — safe share export
- **Red camera** — full export including device IDs
- Quick facts: last ran, next scheduled run, number of triggers, devices referenced
- Run log: each execution with expandable plain English detail
- Edit button

### Piston Editor Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  [X] [P] [≡] [↕] [↩] [↪]              [Cancel] [Delete] [Save]  │
├────────────────────────────────────────────┬─────────────────────┤
│  settings                                  │  GLOBAL VARIABLES   │
│    Name: Driveway Lights at Sunset         │  ─────────────────  │
│    Mode: Single                            │  @Alert_Lights      │
│  end settings                              │  Devices            │
│                                            │  Pauls light,       │
│  define                                    │  Master Light,      │
│    device driveway_light = Driveway Light  │  Naomi's Light      │
│    + add a new variable                    │                     │
│  end define                                │  @HouseMode         │
│                                            │  Text · "home"      │
│  only when                                 │                     │
│    + add a new restriction                 │  @Speakers          │
│                                            │  Devices · 4 items  │
│  execute                                   │                     │
│    only when                               │  [collapse ▲]       │
│      + add a new restriction               │                     │
│    if                                      │                     │
│      [condition]                           │                     │
│      + add a new condition                 │                     │
│    then                                    │                     │
│      do Turn On → {driveway_light}         │                     │
│      + add a new statement                 │                     │
│    end if                                  │                     │
│    + add a new statement                   │                     │
│  end execute                               │                     │
│                                            │                     │
│  [Preview compiled output] [Deploy to HA]  │                     │
└────────────────────────────────────────────┴─────────────────────┘
```

### Simple / Advanced Mode

Toggle in toolbar. Default is Simple.

- **Simple** — hides define section, hides advanced statement types, basic if/action/timer only
- **Advanced** — shows everything: define, all statement types, loops, switch, do blocks, on event

Switching modes never breaks a piston.

---

## 8. Trace and Debugging

### Piston Run Log

On the Status page. Each execution shows:
- When triggered and what triggered it
- Each condition checked — pass or fail in plain English
- Each action taken and whether it succeeded
- Any errors in plain English
- Total run duration

### Trace Mode (Future Feature)

Trace annotates the piston document itself with timing and state data inline — not just a separate log. When trace is active the document shows timing on each executed line (e.g. `+77ms 4m` — time since trigger and time spent on that action) and colored condition result indicators. Planned post-MVP.

### Error Handling

- Error logged in plain English at point of failure
- Piston stops at point of error
- Remaining statements not executed
- Optional notification per piston
- Piston stays enabled and tries again on next trigger
- Errors are never silent

---

## 9. Compilation and Deployment

### Compiler Templates

The compiler references external YAML and PyScript template files stored in the PistonCore data volume. When HA changes their automation YAML format, users generate a replacement template using any AI tool and drop it into the templates folder — no app update required.

PistonCore ships with two reference files in the templates folder:
- A plain English **schema document** listing every variable available to the template with descriptions
- The current **working default template** as a functional example

Both files together give any AI tool everything it needs to generate a valid replacement template. The schema document also serves as the primary reference for contributors who want to understand the compiler.

### Output File Locations

- Simple pistons → `<ha_config>/automations/pistoncore/<piston_name>.yaml`
- Complex pistons → `<ha_config>/pyscript/pistoncore/<piston_name>.py`
- PistonCore NEVER writes outside its own subfolders
- PistonCore NEVER modifies, moves, or deletes any file it did not create

### Deployment Flow

1. User clicks Deploy to HA
2. PistonCore auto-detects simple vs complex
3. Compiles using current template files
4. Sends to companion integration
5. Companion writes file to HA config directory
6. Companion calls HA reload service
7. Live within seconds
8. PistonCore confirms success and shows which format was used

---

## 10. The Two Components

### 10.1 PistonCore Editor (Docker Container)

- **Backend:** Python (FastAPI)
- **Frontend:** Framework not prescribed — must meet UI feel requirements in Section 7
- **Default port:** 7777
- **Piston storage:** JSON files in mounted Docker volume
- **Templates folder:** External compiler templates in Docker volume — user replaceable
- Unraid Community Apps template provided

### 10.2 PistonCore Companion (HA Custom Integration)

Installed via HACS. Provides a local API for:
- Fetching all entities, devices, areas, services from HA
- **Fetching full device capability profiles** — every attribute and supported state for each entity. The condition wizard depends on this. Not just entity lists.
- Writing compiled piston files to HA directories
- Triggering HA reload after deployment
- Reporting piston run status back to the editor

---

## 11. AI Generation

Piston JSON format is open and documented. Any AI can generate valid pistons from plain English. A prompt template is maintained in the repo. Safe share exports (no device IDs) are designed for community sharing — paste publicly, others import and map to their own devices.

---

## 12. Global Variables Management

Managed from PistonCore's main Globals page:
- All defined globals with current values and types
- Which pistons reference each global
- Add, edit, delete globals

Changing a global value takes effect immediately — no redeployment needed.

---

## 13. Distribution Plan

| Channel | Purpose | When |
|---|---|---|
| GitHub (MIT license) | Source, issues, docs, contributions | Day 1 |
| Docker Hub | Container image | First working build |
| Unraid Community Apps | One-click install | After Docker image is stable |
| HACS | Companion integration | After companion works |
| HA Community Forums | Announcement | After MVP works end to end |

### Reference Resources for Contributors

WebCoRE video series by BeardedTechGuy — watch before making UI decisions:
- Introduction to webCoRE: https://www.youtube.com/watch?v=Dh5CSp-xdfM
- Dashboard Deep Dive: https://www.youtube.com/watch?v=HIzgoXgLUxQ
- Conditions vs Triggers: https://www.youtube.com/watch?v=L4axJ4MCYRU
- Variables: https://www.youtube.com/watch?v=6d3wtjjCLiM
- Advanced Light Control: https://www.youtube.com/watch?v=UAUGlDVjT1Q

---

## 14. V1 Scope

### In Scope for V1

**Statement types:**
- If Block (Condition and Group)
- Action
- Timer / Wait
- Wait for state with timeout
- Only when restrictions
- Repeat loop with condition
- Nested ifs to any depth

**Editor features:**
- Toolbar visibility toggles (define, restrictions, complex ifs, move mode)
- Drag and drop block reordering
- Global variables right sidebar
- Simple / Advanced mode toggle
- Safe share export (green camera) and full export (red camera)
- Duplicate piston
- Import from backup code (paste JSON)
- Import from backup file
- Piston status / troubleshoot page as hub
- Run log with plain English detail
- Pause/resume from list and status page
- Folder assignment from status page
- Compiler templates (external, user replaceable with AI assistance)
- EntityPicker with type-to-filter search on name and area
- Dynamic capability-driven condition wizard
- Multi-step condition building modal
- True/false last evaluation result on piston list

### Planned Future Features (Out of Scope for V1)

- Switch statement
- Do Block
- On event
- For Loop (count based)
- For Each Loop (device list iteration)
- While Loop
- Break / Exit
- Trace mode with inline timing annotations
- Evaluation console
- Raw code block insertion
- Version history and rollback
- Mobile app
- Multi-user authentication
- Central cloud server
- Direct WebCoRE piston import
- Piston marketplace
- HA dashboard status cards
- Nested folders

---

## 15. Development Log

### Session 1 — April 2026
- Project conceived, name chosen, mission statement written
- Full design document written (v0.1)
- GitHub repo created with DESIGN.md, README.md, LICENSE, CLAUDE_SESSION_PROMPT.md

### Session 2 — April 2026
- Full folder structure scaffolded
- FastAPI backend: all routes, models, storage, HA client, entity service, compiler — all tested
- React frontend: routing, layout, all pages, all editor sections, EntityPicker, CompilePreviewModal
- Companion integration skeleton: manifest, config flow, HTTP API for file writes and reloads
- Compiler verified against design doc example piston
- 19 API endpoints registered and verified

### Session 3 Strategy — April 2026

Extensive WebCoRE screenshot review revealed significant gaps. v0.5 is a major rewrite. Key changes:

**UI/UX corrections:**
- Editor is a structured document (like a text editor), not a form
- Toolbar provides per-layer visibility toggles, not collapsible section headers
- Status page is the hub — folder assignment, export, and run log live here
- Navigation flow: List → Status → Editor → back to Status
- True/false on piston list is last evaluation result, not enabled/disabled
- New piston modal has four options including duplicate and restore from backup code
- Green/red camera exports live on status page

**Architectural corrections:**
- Condition building is a dynamic multi-step wizard, not a static dropdown form
- Device capability discovery is fully dynamic — companion fetches full capability profiles
- PistonCore never maintains its own capability database
- Global variables stored in PyScript variable store, not HA helpers
- Compiler uses external replaceable template files

**Scope:**
- Full statement type list documented, most moved to future features
- V1 core set based on real world usage identified
- Trace, evaluation console, raw code block all moved to future features
- Frontend framework decoupled from React

**New additions:**
- Device capability database rule added to core philosophy
- Define section philosophy and importance documented
- Piston mode descriptions with real world examples
- Contributor video reference series added
- Both YAML and PyScript output rationale documented

---

*PistonCore is an independent open-source project. It is not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
