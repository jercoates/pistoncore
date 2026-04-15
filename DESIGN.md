# PistonCore — Design Document
**Version:** 0.3
**Status:** Draft — In Development
**Last Updated:** April 2026

---

## 1. What Is PistonCore?

PistonCore is an open-source visual automation builder for Home Assistant, designed to feel immediately familiar to anyone who has used WebCoRE on SmartThings or Hubitat. It lets you build complex automations — called **pistons** — through a form-driven UI using dropdowns populated directly from your actual HA devices, without ever writing YAML or Python manually.

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

### Simple vs Complex Pistons

PistonCore automatically decides what to compile to based on what your piston does:

- **Simple piston → HA YAML automation file**
- **Complex piston → PyScript `.py` file**

Complex if: variables used, nested if/else trees, loops, wait-for-state, counters or computed values.

---

## 4. Variables

### 4.1 Global Variables

Defined once at the PistonCore level. Available to every piston. Persist permanently until changed.

Real world examples:
- A **battery check piston** reads a global Devices variable containing all battery-powered sensors
- An **announcement piston** reads a global Device variable pointing to speaker setup
- A **house mode** global Text variable ("home", "away", "vacation", "night")

Global variables are managed in PistonCore's main settings screen, completely separate from individual pistons.

**Global variables are also visible as a read-only reference panel in the piston editor** — a collapsible right sidebar showing each global's name, type, and current value or entity list. This lets you reference what's available while building a piston without leaving the editor.

### 4.2 Piston Variables

Defined inside a single piston. Only exist while that piston is running. Forgotten when the piston finishes. Labeled clearly: *"Temporary — forgotten when this piston finishes running."*

### 4.3 Variable Types

| Type | Description | Example |
|---|---|---|
| Text | A word or sentence | "away", "Good morning" |
| Number | Any numeric value | 75, 0.5, -10 |
| Yes/No | True or false, on or off | Yes, No |
| Date/Time | A point in time or duration | 10:30 PM, 45 minutes |
| Device | A single HA entity reference | Your driveway light |
| Devices | A collection of HA entity references | All battery sensors, all announcement speakers |

**Device and Devices variables always show the friendly name, never the entity ID.**

**Devices variables can contain mixed device types** — Sonos speakers and Alexa devices in the same list.

**Devices variables work as action targets.** A call_service action targeting a Devices variable acts on every entity in the collection. Example: "Turn off {Device_Lights}" turns off all lights in that variable.

---

## 5. Piston Structure

Every piston has the following sections in order. All sections except the header are collapsible.

### 5.1 Header
- **Name** — human readable, becomes the filename when compiled
- **Description** — optional
- **Folder** — which user-defined folder this piston lives in
- **Mode** — what happens if the piston triggers while already running:
  - *Single* — ignore new triggers while running (default)
  - *Restart* — cancel current run and start fresh
  - *Queued* — finish current run then start next
  - *Parallel* — run multiple instances simultaneously
- **Enabled / Disabled** — pause a piston without deleting it

### 5.2 Piston Variables
Optional. Advanced mode only. Temporary — forgotten when piston finishes.

### 5.3 Triggers
What starts the piston. Types:
- Device or entity state change
- Numeric threshold
- Time (specific time of day)
- Sunrise / Sunset (with optional offset)
- Time pattern (every X minutes/hours)
- HA event
- Webhook
- Called by another piston
- Manual only

### 5.4 Conditions
Checked after trigger fires. Plain English operators only:
- equals / does not equal
- is greater than / is less than / is between
- is on / is off
- contains / does not contain
- is before / is after

Multiple conditions joined with **AND** or **OR** — written in full, never symbols.

### 5.5 Action Tree

The action tree is the core of the editor. It is a top-to-bottom sequence of actions that can branch and nest arbitrarily deep.

**Key interaction model:**

Every level of the action tree — including inside every if/then/else branch at every depth — has a visible `+ Add action` prompt at the bottom of that level's list. The user never has to hunt for where to add something. It is always right there below the last item.

```
ACTIONS
  1. Turn On → Driveway Light
  2. If / Then / Else
       IF
         [condition]
         [condition]
         + Add condition
       THEN
         [action]
         [action]
         + Add action        ← always here, inside this branch
       ELSE
         [action]
         + Add action        ← always here, inside this branch
  3. Wait until 11:00 PM
  + Add action               ← always here, at the top level
```

Indentation communicates nesting depth. There is no limit on nesting depth.

**Action group restrictions ("Only when"):**

Individual action groups can have an optional condition that gates just that group, without requiring a full if/then wrapper. This matches WebCoRE's "only when" concept — a lightweight restriction on a specific set of actions.

**Action types:**

- **Call service** — any HA service. Target can be a role (single entity) or a Devices variable (all entities in the collection).
- **If / Then / Else** — branch based on any condition. Recursive — same structure at every depth.
- **Set variable** — assign or modify a piston variable or global variable
- **Wait** — pause for a fixed duration or until a specific time of day
- **Wait for state** — pause until an entity reaches a state, with optional timeout
- **Repeat** — loop a block of actions a set number of times or while a condition is true
- **Call another piston** — trigger a different piston by name
- **Log message** — write a plain English message to the piston log
- **Stop** — end the piston run immediately

---

## 6. The JSON Sharing Format

Pistons are stored internally and shared externally as plain JSON. Device references use **roles** — named placeholders — not hard entity IDs. The `device_map` section is never included when sharing. When importing, PistonCore prompts the user to map each role to a real entity via dropdown.

### Sharing Methods
- **Paste** — copy JSON, paste into the import dialog
- **URL import** — paste a URL pointing to any raw JSON file
- **File** — export/import as a `.piston` file
- **AI generation** — ask an AI to write a piston in PistonCore JSON format, paste directly into import

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

## 7. The Editor UI

### Overall Feel

The editor feels like WebCoRE's piston editor — a structured form, top to bottom, that builds logic through dropdowns and plain English input fields. A user who has used WebCoRE should be able to build a basic piston within a few minutes without reading documentation.

### UI Rules — No Exceptions

1. **No pictograms for logic.** AND/OR is written "AND" and "OR". Equals is written "equals". No symbols.
2. **No entity IDs ever visible to the user.** All entity references show the friendly name.
3. **All dropdowns populated from live HA data.** You never type a device name or service name.
4. **Sections are collapsible** with plain English text labels.
5. **Errors are plain English.** "Action 3 failed: the device you selected was not found in Home Assistant" — not error codes.
6. **Global variables are always visible in a right sidebar while editing.** The sidebar is collapsible and shows each global's name, type, and current value or entity list. It is read-only from the editor — globals are managed on the Globals page. This lets the user see what globals are available without leaving the editor.

### Piston List Screen

Pistons are displayed as a flat list with **inline category/folder headers** — not a separate folder sidebar. Each folder appears as a colored header row with the piston count, followed by its pistons. This matches the WebCoRE dashboard pattern that existing users are already familiar with.

```
┌─────────────────────────────────────────────────────┐
│  PistonCore                              [+ New]    │
│  [Search pistons...]                                │
├─────────────────────────────────────────────────────┤
│  Uncategorized (3)                                  │
│  ● Back Yard Light          enabled    2 hrs ago    │
│  ● Basement Light           enabled                 │
│  ○ Holiday Lights           disabled                │
│                                                     │
│  Lights (5)                                         │
│  ● Driveway Lights at Sunset  enabled  10 min ago   │
│  ● Side Gate Motion Light     enabled  2 hrs ago    │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

Each piston row shows:
- Colored status dot (● enabled, ○ disabled)
- Piston name
- Enabled/disabled state label
- Last run time — right-aligned, only shown if the piston has run
- Click anywhere on the row to open the editor
- Inline enable/disable toggle without opening the editor

### Piston Detail / Status View

Accessible from the piston list without opening the editor. Shows:

- **Status card** — enabled or paused, with a one-click pause/resume button
- **Quick facts** — last ran, next scheduled run, number of triggers, number of devices referenced
- **Run log** — each execution with expandable detail: each action, pass/fail result, duration. Plain English throughout.

This matches the WebCoRE "troubleshooter" view — a lightweight status screen separate from the full editor.

### Piston Editor Screen

```
┌──────────────────────────────────────────────────────────────────┐
│  ← My Pistons          [Advanced mode]              [Save]       │
├────────────────────────────────────────────┬─────────────────────┤
│  Piston Name: Driveway Lights at Sunset    │  GLOBAL VARIABLES   │
│  Description: Turns on at sunset, off 11pm │  ─────────────────  │
│  Folder: [Outdoor Lighting ▼]              │  @Alert_Lights      │
│  Mode: [Single ▼]   [● Enabled]            │  Devices · 3 lights │
│                                            │                     │
│  ▼ PISTON VARIABLES (advanced)    [+ Add]  │  @HouseMode         │
│                                            │  Text · "home"      │
│  ▼ TRIGGERS                       [+ Add]  │                     │
│  Sun event — Sunset                        │  @Speakers          │
│                                            │  Devices · 4 items  │
│  ▼ CONDITIONS                     [+ Add]  │                     │
│  (none)                                    │  [collapse ▲]       │
│                                            │                     │
│  ▼ ACTIONS                        [+ Add]  │                     │
│  1. Turn On → Driveway Main Light          │                     │
│  2. Wait until 11:00 PM                   │                     │
│  3. Turn Off → Driveway Main Light         │                     │
│  + Add action                              │                     │
│                                            │                     │
│  [Preview compiled output]  [Deploy to HA] │                     │
└────────────────────────────────────────────┴─────────────────────┘
```

### Simple / Advanced Mode

Toggle at the top of the editor. Default is Simple.

- **Simple mode** — hides piston variables, limits to most common trigger and action types
- **Advanced mode** — shows everything: variables, all trigger types, all action types, loops, wait-for-state, nested if/else, call another piston

Switching modes never breaks a piston.

---

## 8. Logging and Debugging

### Piston Detail View (accessible from list)

Each piston has a status/log view showing:

- When the piston triggered and what triggered it
- Each condition checked and whether it passed or failed — in plain English
- Each action taken and whether it succeeded
- Any errors in plain English
- How long the run took

### Test / Dry Run

A button in the editor that fires the piston manually. In dry run mode it shows what actions *would* have been called without actually calling them.

### Error Handling

When a piston fails mid-run:
- Error logged in plain English
- Piston stops at the point of error
- Remaining actions not executed
- Optional notification per piston
- Piston stays enabled, will try again on next trigger
- Errors are never silent

---

## 9. Compilation and Deployment

### Output File Locations

- Simple pistons → `<ha_config>/automations/pistoncore/<piston_name>.yaml`
- Complex pistons → `<ha_config>/pyscript/pistoncore/<piston_name>.py`
- **PistonCore never writes outside its own subfolders**
- **PistonCore never modifies, moves, or deletes any file it did not create**

### Deployment Flow

1. User clicks **Deploy to HA**
2. PistonCore compiles piston JSON to appropriate format
3. File sent to companion integration
4. Companion writes file to correct HA config directory
5. Companion calls HA reload service
6. Automation is live within seconds
7. PistonCore confirms success

---

## 10. The Two Components

### 10.1 PistonCore Editor (Docker Container)

- **Tech stack:** Python (FastAPI) backend, React frontend
- **Default port:** 7777
- **Piston storage:** JSON files in a mounted Docker volume
- Unraid Community Apps template provided

### 10.2 PistonCore Companion (HA Custom Integration)

Installed via HACS. Provides a local API for:
- Fetching all entities, devices, areas, and services from HA
- Writing compiled piston files to HA directories
- Triggering HA reload after deployment
- Reporting piston run status back to the editor

---

## 11. AI Generation

Piston JSON format is open and documented. Any AI can generate valid pistons from plain English. A prompt template is maintained in the repo.

---

## 12. Global Variables Management

Managed from PistonCore's main settings screen. Shows:
- All defined globals with current values and types
- Which pistons reference each global
- Add, edit, delete globals

Changing a global value takes effect for all pistons — no redeployment needed.

---

## 13. Distribution Plan

| Channel | Purpose | When |
|---|---|---|
| GitHub (MIT license) | Source, issues, docs, contributions | Day 1 |
| Docker Hub | Container image | First working build |
| Unraid Community Apps | One-click install | After Docker image is stable |
| HACS | Companion integration | After companion works |
| HA Community Forums | Announcement | After MVP works end to end |

---

## 14. Out of Scope for V1

- Mobile app
- Multi-user authentication
- Central cloud server
- Direct WebCoRE piston import
- Piston marketplace or registry
- HA dashboard status cards
- Version history and rollback
- Nested folders (v1 is single level)
- Per-action timing markers in run log (backlog for later)

---

## 15. Development Log

### Session 1 — April 2026
- Project conceived, name chosen, mission statement written
- Full design document written
- GitHub repo created, DESIGN.md, README.md, LICENSE (MIT), CLAUDE_SESSION_PROMPT.md added

### Session 2 — April 2026
- Full folder structure scaffolded
- FastAPI backend: all routes, models, storage, HA client, entity service, compiler — all tested
- React frontend: routing, layout, all pages, all editor sections, EntityPicker, CompilePreviewModal
- Companion integration skeleton: manifest, config flow, HTTP API for file writes and reloads
- Compiler verified against design doc example piston — correct HA YAML output confirmed
- 19 API endpoints registered and verified

### Between Sessions 2 and 3 — Design decisions from WebCoRE screenshot review
- **Piston list:** Switched from folder sidebar to inline category headers with count (WebCoRE style)
- **Global variables sidebar:** Added collapsible right panel to editor — reference only, read-only
- **If/Then/Else interaction model:** Inline `+ Add condition` and `+ Add action` at every valid insertion point, recursive nesting, indentation shows depth
- **"Only when" restrictions:** Optional per-action-group condition without a full if/then wrapper
- **Devices as action targets:** Devices variables/globals must work as call_service targets
- **Piston detail view:** Status card + quick facts + run log accessible from list without opening editor

---

*PistonCore is an independent open-source project. It is not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
