# PistonCore — Claude Session Starter Prompt

Paste this at the start of every new Claude session to restore context.
Update the "Last session" and "This session" sections each time.

---

I am building an open source project called PistonCore — a WebCoRE-style
visual automation builder for Home Assistant.

GitHub repo: https://github.com/jercoates/pistoncore

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

- **No required central server.** Runs locally on Unraid, Raspberry Pi, any Docker host.
- **Automations are yours.** Compiled files are standard HA files.
- **PistonCore never touches files it did not create.** Hard rule, no exceptions.
- **Shareable by design.** Pistons are plain JSON. Paste anywhere, import from URL.
- **AI-friendly from day one.** Piston JSON format is documented for AI generation.
- **Open and community driven.** MIT licensed.
- **Familiar to WebCoRE users.** Piston concept, structure, and terminology intentionally close to WebCoRE.
- **Plain English everywhere.** No pictograms, no symbols, no icon-only controls.

---

## 3. Core Concepts

### What is a Piston?
A piston is a self-contained automation rule. It has a name, optional variables, one or more triggers, optional conditions, and an action tree with if/then/else logic.

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

Auto-detected — user never chooses:
- **Simple → HA YAML automation**
- **Complex → PyScript .py file**

Complex if: variables used, nested if/else, loops, wait-for-state, counters.

---

## 4. Variables

### Global Variables
- Defined at PistonCore level, available to every piston, persist permanently
- Managed from main settings screen, separate from individual pistons
- Changing a global value takes effect for all pistons — no redeployment needed
- **The global variables panel is visible as a sidebar while editing a piston** (collapsible right panel, reference only — not editable from the editor)

### Piston Variables
- Defined inside a single piston, only exist while that piston is running
- Clearly labeled: "Temporary — forgotten when this piston finishes running"

### Variable Types
| Type | Description |
|---|---|
| Text | A word or sentence |
| Number | Any numeric value |
| Yes/No | True or false |
| Date/Time | A point in time or duration |
| Device | A single HA entity reference |
| Devices | A collection of HA entity references (supports mixed entity types) |

**Device and Devices variables always show the friendly name, never the entity ID.**
**Devices variables work as action targets** — "Turn off {Device_Lights}" acts on all entities in the collection.

---

## 5. Piston Structure

### Header
Name, description, folder, mode (single/restart/queued/parallel), enabled/disabled.

### Piston Variables
Optional. Temporary, forgotten when piston finishes.

### Triggers
Types: state change, numeric threshold, time, sunrise/sunset, time pattern, HA event, webhook, called by another piston, manual only.

### Conditions
Checked after trigger fires. Plain English operators (equals, does not equal, is greater than, is less than, is between, is on, is off, contains, does not contain, is before, is after). Multiple conditions joined with AND or OR — written in full.

### Action Tree

**This is the core of the editor. Key interaction model from WebCoRE:**

- Every level of the action tree has a visible `+ Add action` at the bottom
- If/Then/Else branches each have their own `+ Add action` inline
- Actions can be nested arbitrarily deep inside if/then/else branches
- Each action group can have an "Only when" restriction (a condition that gates just that group, without a full if/then)
- Indentation visually communicates nesting depth
- The `+ Add` prompt is always visible at every valid insertion point — user never hunts for where to add

**Action types:**
- Call service (any HA service, target a role or Devices variable)
- If / Then / Else (recursive, same structure at every depth)
- Set variable
- Wait (fixed duration or until a specific time)
- Wait for state (with optional timeout)
- Repeat (count or while condition)
- Call another piston
- Log message
- Stop

---

## 6. The JSON Sharing Format

Pistons stored and shared as plain JSON. Device references use **roles** — named placeholders. Actual entity IDs live in `device_map` (never shared). When importing, PistonCore prompts user to map each role to a real entity via dropdown.

### Sharing Methods
Paste JSON, URL import, file (.piston extension), AI generation.

---

## 7. The Editor UI

### UI Rules — No Exceptions
1. No pictograms for logic. AND/OR written as "AND" and "OR". No symbols.
2. No entity IDs ever visible to the user.
3. All dropdowns populated from live HA data.
4. Sections are collapsible with plain English labels.
5. Errors are plain English.
6. **Global variables visible in a collapsible right sidebar while editing** — reference only, shows name, type, and current value/entities.

### Piston List Screen
- Category/folder headers with piston count (e.g. "Lights (13)")
- Each row: colored status dot, piston name, enabled/disabled state, last run time (right-aligned, only shown if run)
- Inline enable/disable toggle without opening editor
- Clean, dense list — no cards, no thumbnails

### Piston Editor Screen
- Top toolbar: back to list, save button, advanced mode toggle
- Header section (name, description, folder, mode, enabled)
- Collapsible sections: Piston Variables (advanced only), Triggers, Conditions, Actions
- Right sidebar: Global Variables panel (collapsible, reference only)
- Footer: Preview compiled output, Deploy to Home Assistant

### Simple / Advanced Mode
Toggle at top. Simple hides variables, limits trigger/action types. Switching never breaks a piston.

---

## 8. Logging and Debugging (Per-Piston Detail View)

Each piston has a detail/status view (accessible from the list without opening the editor):

- **Status card:** enabled/paused, one-click pause/resume
- **Quick facts:** last ran, next scheduled run, number of triggers, devices referenced
- **Run log:** each execution with expandable detail showing each action, pass/fail, duration
- **Pause/resume** from this view without opening the editor

Future (not session 3): per-action timing markers in the run log.

---

## 9. Compilation and Deployment

### Output File Locations
- Simple pistons → `<ha_config>/automations/pistoncore/<piston_name>.yaml`
- Complex pistons → `<ha_config>/pyscript/pistoncore/<piston_name>.py`
- PistonCore NEVER writes outside its own subfolders

### Deployment Flow
1. User clicks Deploy to HA
2. PistonCore compiles piston JSON to appropriate format
3. File sent to companion integration
4. Companion writes file to HA config directory
5. Companion calls HA reload service
6. Automation is live within seconds

---

## 10. The Two Components

### PistonCore Editor (Docker Container)
- Python FastAPI backend, React frontend
- Default port: 7777
- Piston storage: JSON files in mounted Docker volume
- Unraid Community Apps template planned

### PistonCore Companion (HA Custom Integration)
- Installed via HACS
- Provides local API for: fetching HA entity/device/area/service data, writing compiled files, triggering reloads, reporting run status

---

## 11. Distribution
GitHub (MIT license), Docker Hub, Unraid Community Apps, HACS, HA Community Forums.

---

## 12. Out of Scope for V1
Mobile app, multi-user auth, central cloud server, direct WebCoRE piston import, piston marketplace, HA dashboard cards, version history/rollback, nested folders.

---

## 15. Development Log

---

### Session 1 — April 2026

**What was decided:**
- Project conceived, name PistonCore chosen
- Full design document written (see above)
- GitHub repo created: https://github.com/jercoates/pistoncore
- DESIGN.md, README.md, LICENSE (MIT), CLAUDE_SESSION_PROMPT.md added to repo

---

### Session 2 — April 2026

**What was built:**

Full folder structure scaffolded for both components.

**Backend (FastAPI) — all tested and verified:**
- `main.py` — app entry point, CORS, all routers
- `core/config.py` — env-var config (PISTONCORE_HA_URL, PISTONCORE_HA_TOKEN, etc.)
- `core/storage.py` — piston CRUD as JSON files, globals, settings. Round-trip tested.
- `models/piston.py` — complete Pydantic models for every concept in the design doc
- `models/entity.py` — Entity and EntitySummary models
- `services/ha_client.py` — HA API client with caching, plain English error messages
- `services/entity_service.py` — raw HA states → friendly-name entity objects, grouped by domain
- `services/compiler.py` — auto-detects simple vs complex. Simple → valid HA YAML. Complex → PyScript stub.
- 19 API endpoints registered and verified

**Compiler verified:** Design doc example piston (Driveway Lights at Sunset) compiled to correct HA YAML with entity IDs resolved from device map.

**Companion integration (HA side):**
- manifest.json, config_flow.py, const.py, __init__.py, api.py
- HTTP endpoints: health check, deploy (write file + trigger reload), delete
- Hard constraint enforced: only writes inside automations/pistoncore/ or pyscript/pistoncore/

**Frontend (React + Vite):**
- Full routing: Piston List, Editor, Globals, Settings pages
- AppLayout with nav sidebar
- All editor sections: PistonHeader, PistonVariables, PistonTriggers, PistonConditions, PistonActions
- EntityPicker — live HA data, friendly names grouped by domain, no entity IDs shown
- CollapsibleSection — shared wrapper used throughout
- CompilePreviewModal — shows compiled output with copy button
- GlobalsPage — add/edit/remove global variables
- SettingsPage — HA URL/token config with connection test
- api.js — all backend calls centralized

**What does NOT work yet:**
- If/Then/Else nested action editor (stub only — "coming next session" message shown)
- PyScript compiler (stub only)
- Import/role-mapping UI
- End-to-end deploy (compile → companion → HA file write)
- Piston log/status panel
- Global variables right sidebar in editor
- hacs.json for companion

---

### Session 3 — Goals

**UI design decisions made between sessions (from WebCoRE screenshot analysis):**

1. **Piston list:** Switch from folder sidebar to inline category headers with count (WebCoRE style — "Lights (13)") — more familiar to target audience, denser, more scannable
2. **Global variables sidebar:** Add collapsible right panel to the editor showing all globals (name, type, value/entities) — reference only while editing, not editable from there
3. **If/Then/Else interaction model:** Inline `+ Add condition` and `+ Add action` at every valid insertion point inside every branch, recursive nesting, indentation shows depth
4. **"Only when" restrictions:** Individual action groups can have a condition that gates just that group without a full if/then wrapper — add this as an optional per-action-group feature
5. **Devices variable as action target:** Devices globals/variables must work as targets in call_service actions (acts on all entities in the collection)
6. **Piston detail/status view:** Accessible from list without opening editor — status, quick facts, run log, pause/resume

**Priority build order for session 3:**
1. Refactor piston list to inline category headers (drop sidebar)
2. Build if/then nested action editor with recursive `+ Add` interaction
3. Add global variables right sidebar to editor
4. Piston detail/status view (status card + quick facts + run log skeleton)
5. Import/role-mapping UI
6. Connect end-to-end deploy (editor → compile → companion → HA)

**Tech stack:**
- Python FastAPI backend
- React frontend (Vite, React Query, Zustand, React Router)
- Piston storage as JSON files in Docker volume
- Default port 7777
- MIT license
- Compiles simple pistons to HA YAML, complex to PyScript

**Key file locations:**
- Backend entry: `editor/backend/main.py`
- All routes: `editor/backend/api/routes/`
- Piston models: `editor/backend/models/piston.py`
- Compiler: `editor/backend/services/compiler.py`
- Storage: `editor/backend/core/storage.py`
- Frontend pages: `editor/frontend/src/pages/`
- Piston editor sections: `editor/frontend/src/components/piston/`
- Shared components: `editor/frontend/src/components/shared/`
- API client: `editor/frontend/src/utils/api.js`

---

*PistonCore is an independent open-source project. It is not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
