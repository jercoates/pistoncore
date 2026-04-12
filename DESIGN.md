# PistonCore Design Document
**Version:** 0.2  
**Status:** Draft — Ready for Development  
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
- **AI-friendly from day one.** The piston JSON format is simple and fully documented so AI assistants can generate valid pistons from a plain English description. A user can describe what they want to an AI and paste the result straight into the editor.
- **Open and community driven.** MIT licensed. Anyone can host, fork, modify, or contribute. The project belongs to the community.
- **Familiar to WebCoRE users.** The piston concept, structure, and terminology are intentionally close to WebCoRE so experienced users can pick it up immediately with minimal relearning.
- **Plain English everywhere.** No pictograms, no cryptic icons, no symbols that require learning a visual language. Every toggle, every operator, every option is labeled in plain English. A piston should be readable by anyone who looks at it six months later.

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

PistonCore automatically decides what to compile to based on what your piston does. You never choose — it detects it:

- **Simple piston → compiles to a HA YAML automation file**
  - No variables used
  - Simple conditions, no deep nesting
  - No loops, no waits mid-piston
  - Straightforward service calls

- **Complex piston → compiles to a PyScript `.py` file**
  - Variables used
  - Nested if/else trees
  - Loops or repeating actions
  - Wait for a set time mid-piston
  - Wait for an entity to reach a state (with optional timeout)
  - Counters or computed values

Both compile targets are native HA files and run without PistonCore being active.

---

## 4. Variables

PistonCore has two types of variables, both important and both included in v1. They solve different problems.

### 4.1 Global Variables

Defined once at the PistonCore level. Available to every piston. Persist permanently until you change them.

**These are house-level settings.** Real world examples of why they matter:

- A **battery check piston** reads a global Devices variable containing all your battery-powered sensors. When you add a new sensor to the house you add it to the global once — the piston automatically picks it up without any changes to the piston itself.
- A **regular announcement piston** reads a global Device variable pointing to your announcement speaker setup (Sonos amp upstairs, basement speaker, garage bookshelf). If you change your speaker setup you update the global once and every piston that uses it is automatically updated.
- An **emergency announcement piston** reads a different global Devices variable containing all speakers including Alexas. Same principle — update the global, all pistons stay current.
- A **house mode** global Text variable ("home", "away", "vacation", "night") that dozens of pistons can check.

Global variables are managed in PistonCore's main settings, completely separate from individual pistons.

### 4.2 Piston Variables

Defined inside a single piston. Only exist while that piston is running. Forgotten when the piston finishes.

**These are piston-level temporary state.** Real world examples:

- A motion lighting piston tracks whether the light was already on before motion fired — so it can restore the original state when motion clears.
- A temperature piston tracks the last reading to compare against the current one to detect rapid changes.
- A counter tracking how many times something happened within one piston run.

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

**Devices variables can contain mixed device types** — your emergency announcement Devices variable can contain both Sonos speakers and Alexa devices in the same list. PistonCore stores the entity references. What HA can do with each entity is HA's business, not PistonCore's.

---

## 5. Piston Structure

Every piston has the following sections in order. All sections except the header are collapsible to keep the view manageable.

### 5.1 Header
- **Name** — human readable, becomes the filename when compiled
- **Description** — optional, shown in piston list and sharing previews
- **Folder** — which user-defined folder this piston lives in
- **Mode** — what happens if the piston triggers while already running:
  - *Single* — ignore new triggers while running (default)
  - *Restart* — cancel current run and start fresh
  - *Queued* — finish current run then start next
  - *Parallel* — run multiple instances simultaneously
- **Enabled / Disabled** — pause a piston without deleting it

### 5.2 Piston Variables
Optional. Defined at the top, available throughout this piston only.
Clearly labeled: *"Temporary — forgotten when this piston finishes running."*

### 5.3 Triggers
What starts the piston. One or more triggers. Types include:

- **Device or entity state change** — an entity changes to a specific state or any state
- **Numeric threshold** — a sensor value goes above or below a value
- **Time** — a specific time of day
- **Sunrise / Sunset** — with optional offset in minutes before or after
- **Time pattern** — every X minutes, every X hours
- **HA event** — any Home Assistant event fires
- **Webhook** — an incoming webhook call
- **Called by another piston**
- **Manual only** — only runs when you click the test button

### 5.4 Conditions
Checked after a trigger fires. If conditions are not met the piston stops silently.

Conditions use plain English operators written out in full — never symbols:
- equals / does not equal
- is greater than / is less than / is between
- is on / is off
- contains / does not contain
- is before / is after (for times)

Multiple conditions are grouped with **AND** or **OR** — written in full, not symbols.

### 5.5 Action Tree
A top-to-bottom sequence of actions that can branch. Action types:

- **Call service** — call any HA service that HA exposes. Dropdowns show available services for the selected entity.
- **If / Then / Else** — branch based on any condition. Plain English throughout.
- **Set variable** — assign or modify a piston variable or global variable
- **Wait** — pause for a fixed amount of time
- **Wait for state** — pause until an entity reaches a specific state, with optional timeout
- **Repeat** — loop a block of actions a set number of times or while a condition is true
- **Call another piston** — trigger a different piston by name
- **Log message** — write a plain English message to the piston log for debugging
- **Stop** — end the piston run immediately

---

## 6. The JSON Sharing Format

Pistons are stored internally and shared externally as plain JSON. The format is intentionally simple and human readable.

### Key Design Decisions

- Device references use **roles** — named placeholders like `motion_sensor` or `driveway_light` — not hard entity IDs.
- The actual entity IDs live in a `device_map` section that belongs to your installation and is never included when sharing.
- When importing a shared piston, PistonCore reads the roles and prompts you to map each one to a real entity from your HA instance using a dropdown. You never type an entity ID.
- The JSON schema is fully documented so AI tools can generate valid pistons from plain English descriptions.
- The format is versioned so future PistonCore updates can handle older pistons gracefully.

### Sharing Methods

- **Paste** — copy JSON text, paste into the PistonCore import dialog
- **URL import** — paste a URL pointing to any raw JSON file (GitHub Gist, forum attachment, your own server, anywhere)
- **File** — export/import as a `.piston` file (JSON with a custom extension)
- **AI generation** — ask an AI to write a piston in PistonCore JSON format, paste result directly into the import dialog

No account needed. No central server. Works completely offline.

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

The editor should feel like WebCoRE's piston editor — a structured form, top to bottom, that builds logic through dropdowns and plain English input fields. A user who has used WebCoRE should be able to build a basic piston within a few minutes without reading documentation.

### UI Rules — No Exceptions

1. **No pictograms for logic.** AND/OR is written "AND" and "OR". Equals is written "equals". Greater than is written "is greater than". No symbols that require learning.
2. **No entity IDs ever visible to the user.** All entity references show the friendly name, device name, and area. Entity IDs are handled internally.
3. **All dropdowns populated from live HA data.** You never type a device name or service name. You always pick from what HA reports.
4. **Sections are collapsible** with clear plain English text labels — not icons.
5. **Errors are plain English.** "Action 3 failed: the device you selected was not found in Home Assistant" — not technical error codes.

### Piston List Screen

```
┌─────────────────────────────────────────────────────┐
│  PistonCore                              [+ New]    │
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
│  [+ New Folder]  │                                   │
└──────────────────┴──────────────────────────────────┘
```

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
│  [▶ Test / Dry Run]  [Deploy to HA]  [Export JSON]  │
└─────────────────────────────────────────────────────┘
```

### Simple / Advanced Mode

A toggle at the top of the editor. Default is Simple.

- **Simple mode** — hides piston variables, limits to the most common trigger and action types, most plain English presentation of conditions
- **Advanced mode** — shows everything: piston variables, all trigger types, all action types, loops, wait-for-state, nested if/else, call another piston

Switching modes never breaks a piston. Advanced pistons open correctly in simple mode — advanced features just cannot be edited until you switch back to advanced.

---

## 8. Logging and Debugging

### Live Piston Log

Every piston has a log panel showing recent run history. Each entry shows:

- When the piston triggered and what triggered it
- Each condition checked and whether it passed or failed — in plain English
- Each action taken and whether it succeeded
- Any errors in plain English
- How long the run took

### Test / Dry Run

A button in the editor that fires the piston manually right now. In dry run mode it shows what actions *would* have been called without actually calling them. Essential for verifying logic before deploying to a live home.

### Error Handling

When a piston fails mid-run:

- The error is logged in plain English
- The piston stops at the point of the error
- Remaining actions are not executed
- An optional notification can be sent (configured per piston)
- The piston stays enabled and will try again on the next trigger
- Errors are never silent — they are always visible in the log

---

## 9. Compilation and Deployment

### Output File Locations

- Simple pistons → `<ha_config>/automations/pistoncore/<piston_name>.yaml`
- Complex pistons → `<ha_config>/pyscript/pistoncore/<piston_name>.py`
- **PistonCore never writes outside its own subfolders**
- **PistonCore never modifies, moves, or deletes any file it did not create**
- Filenames come from the piston name
- The editor's folder structure does not need to be mirrored on disk — HA files are output, not source

### Deployment Flow

1. User clicks **Deploy to HA**
2. PistonCore compiles the piston JSON to the appropriate format
3. File is sent to the companion integration
4. Companion writes the file to the correct HA config directory
5. Companion calls the HA reload service
6. Automation is live within seconds
7. PistonCore confirms success

### Manual Edit Warning

If a compiled file is manually edited outside PistonCore it will run fine — until that piston is deployed again from PistonCore, which overwrites manual changes. PistonCore will detect this and warn clearly before overwriting.

---

## 10. The Two Components

### 10.1 PistonCore Editor (Docker Container)

- **Tech stack:** Python (FastAPI) backend, React frontend
- **Runs on:** Any Docker host — Unraid, Raspberry Pi, NAS, cloud VPS
- **Default port:** 7777 (configurable)
- **Piston storage:** JSON files in a mounted Docker volume — persists across container updates
- **No internet required** for local use

Unraid Community Apps template provided for one-click installation.

### 10.2 PistonCore Companion (HA Custom Integration)

Installed into Home Assistant via HACS.

Provides a local API that the editor uses to:
- Fetch all entities, devices, areas, and available services from HA
- Write compiled piston files to the correct HA directories
- Trigger HA reload after deployment
- Report piston run status back to the editor

Requires a long-lived HA access token configured once at setup. Works with any HA installation type.

---

## 11. AI Generation

Because the piston JSON format is open and documented, any AI assistant can generate valid pistons from a plain English description.

### How It Works for a User

1. Tell an AI: *"Write me a PistonCore piston that turns on the porch light when motion is detected after sunset and turns it off 5 minutes after motion stops"*
2. AI generates valid piston JSON
3. Paste into PistonCore's Import dialog
4. Editor shows unmapped roles with plain English prompts: *"Which device is your porch light?"*
5. Pick devices from dropdowns
6. Deploy

A prompt template for generating PistonCore pistons will be maintained in the GitHub repo so users can paste it into any AI and get consistent results.

---

## 12. Global Variables Management

Managed from PistonCore's main settings screen, separate from any individual piston.

The global variables screen shows:
- All defined globals with their current values and types
- Which pistons reference each global (so you understand the impact of changes)
- Add, edit, and delete globals

Changing a global value takes effect for all pistons that read it — no redeployment needed.

---

## 13. Distribution Plan

| Channel | Purpose | When |
|---|---|---|
| GitHub (public, MIT license) | Source code, issues, docs, contributions | Day 1 |
| Docker Hub | Container image for self-hosting | First working build |
| Unraid Community Apps | One-click install template | After Docker image is stable |
| HACS | Companion integration | After companion works |
| HA Community Forums | Announcement and feedback | After MVP works end to end |

---

## 14. Out of Scope for V1

- Mobile app
- Multi-user authentication
- Central cloud server maintained by the project
- Direct WebCoRE piston import
- Piston marketplace or registry
- HA dashboard status cards
- Version history and rollback
- Nested folders (v1 is single level)

---

## 15. Development Log

*Updated at the start and end of every development session.*

---

### Session 1 — April 2026

**What was decided:**

- Project conceived: WebCoRE-style visual automation builder for Home Assistant
- Name: **PistonCore** — recognizable to WebCoRE community, no trademark issues
- Mission statement: *"PistonCore is not a home automation platform. It is a tool for building automations on top of one."*
- PistonCore pulls all data from HA — adds nothing of its own
- Auto-detected compilation: simple pistons → YAML, complex pistons → PyScript
- Sharing: plain JSON with roles, no central server required
- Both variable types kept: Global (house level, permanent, all pistons) and Piston (temporary, one piston run only)
- Variable types confirmed: Text, Number, Yes/No, Date/Time, Device, **Devices** (WebCoRE called it Devices not List)
- Devices type supports mixed entity types in one collection
- UI rule: plain English everywhere, no pictograms, no symbols
- Organization: user-defined folders in editor, flat pistoncore/ subfolder on HA disk
- PistonCore never touches files it did not create — hard rule
- Logging, enable/disable, and manual test/dry run are v1 essentials
- Errors always visible in plain English, never silent
- AI generation is a first-class feature
- Checked for competing projects — AutoNest exists but is completely different (floor plan visual, cloud hosted, YAML only, freemium). No direct competition exists.

**Next steps:**

1. Create GitHub repository (public, MIT license)
2. Add DESIGN.md, README.md, LICENSE to repo
3. Scaffold the Docker app folder structure
4. Begin FastAPI backend skeleton
5. Begin React frontend skeleton

---

*PistonCore is an independent open-source project. It is not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
