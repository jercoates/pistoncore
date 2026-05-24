# PistonCore Design Document

**Version:** 1.3
**Status:** Authoritative — All architecture decisions locked for v1 development
**Last Updated:** May 2026 (Session 57 — startup sequence, multi-entity compilation, Snapshot format v2, import flow redesigned, open items updated)

---

## 1. What Is PistonCore?

PistonCore is an open-source visual automation builder for Home Assistant, designed to feel immediately familiar to anyone who has used WebCoRE on SmartThings or Hubitat. It lets you build complex automations — called **pistons** — through a structured UI using dropdowns populated directly from your actual HA devices, without ever writing YAML or Python manually.

**PistonCore is not a home automation platform. It is a tool for building automations on top of one.**

It does not add devices, manage integrations, or extend HA's capabilities in any way. It reads what HA already has, gives you a better way to write logic against it, and compiles that logic to native HA files that run permanently and independently.

**PistonCore does not need to be running for your automations to work.** Compiled files are standard HA automation files. If you uninstall PistonCore tomorrow, every piston you built keeps running — as long as the relevant runtime (native HA scripts or PyScript) remains installed. Native HA script pistons are unconditionally permanent. PyScript pistons require PyScript to remain installed.

---

## 2. Core Philosophy

* **No required central server.** PistonCore runs locally as a native HA addon or on any Docker host. Nothing depends on servers controlled by the project maintainers.
* **Automations are yours.** Compiled files are standard HA files. PistonCore is the source of truth for your pistons — the compiled files on HA are just the output.
* **PistonCore never touches files it did not create.** Your existing hand-written automations, scripts, and YAML files are completely safe. PistonCore only ever writes to its own subfolder. This rule is enforced architecturally via file signature checking — see Section 13.
* **Compiled files are compiler-owned artifacts.** Files written by PistonCore to HA directories are deployment artifacts, not source files. They may be replaced wholesale on recompile. The piston JSON is always the source of truth — never the compiled HA file. Users who hand-edit compiled files will be warned at next deploy via the hash check.
* **Structured JSON is the internal master format.** Every piston is stored as a structured JSON object. The wizard writes structured data for every statement. The editor renders display text from that data — text is always generated from the JSON, never the other way around. This is the same proven model WebCoRE used. The compiler reads structured JSON directly — no text parsing required. Sharing and AI import use the Snapshot format — structured JSON with role name placeholders and no entity IDs. No text parsing required on import. Nothing drifts because the structured JSON is always the single source of truth.
* **Shareable by design.** Pistons are stored and shared as plain JSON. Paste them anywhere — a forum post, a GitHub Gist, a Discord message. Import from a URL or paste directly. No account required, no server involved.
* **AI-friendly from day one.** The piston JSON format is simple and fully documented so AI assistants can generate valid pistons from a plain English description.
* **Open and community driven.** MIT licensed. Anyone can host, fork, modify, or contribute.
* **Familiar to WebCoRE users.** The piston concept, structure, terminology, keywords, and logging behavior are intentionally close to WebCoRE so experienced users can pick it up immediately.
* **Plain English everywhere, icons plus labels for universal actions.** Logic operators and descriptive text are always written in plain English. Buttons use an icon paired with a plain English label — never an icon alone.
* **Silent by default.** PistonCore generates no debug output unless the user explicitly activates tracing for a specific piston.
* **Minimum footprint in HA.** PistonCore touches only what is absolutely necessary and only what the user explicitly confirms during setup.
* **Incomplete but correct is better than complete but wrong.** The wizard must prefer showing fewer options over showing incorrect options. PistonCore is allowed to not know something. It is not allowed to guess wrong.
* **The compiler absorbs Home Assistant churn.** When Home Assistant changes YAML syntax, script structure, or field naming, PistonCore recompiles existing pistons against the updated templates. Users never manually migrate automations — that is PistonCore's job. The piston JSON stays stable; the emitted HA artifacts change to match whatever the current HA version expects.
* **Frontend never touches HA directly.** All HA communication goes through the PistonCore backend only. The frontend calls PistonCore API endpoints. The backend calls HA. The supervisor token (addon) and long-lived token (Docker) never reach the browser. This is a security invariant — any frontend code that fetches from HA directly is a bug, not a feature.

---

## 3. Two Products — Addon First, Docker Later

PistonCore ships as two distinct products. They share the same frontend, the same backend core, the same piston JSON format, and the same compiler. The differences are deployment packaging and auth method.

### Product 1: PistonCore Addon (PRIMARY — Build This First)

* **Runs on:** HA OS, HA Supervised
* **Install:** User adds the PistonCore GitHub repo URL to HA addon store, installs like any other addon
* **Auth:** Gets the HA supervisor token automatically from the environment — zero user setup
* **File writing:** Writes directly to `/config/automations/pistoncore/` and `/config/pyscript/pistoncore/`, calls `automation/reload` via REST API
* **No HACS companion needed. No separate integration needed.**
* **Distribution:** GitHub addon repository

### Product 2: PistonCore Docker (SECONDARY — Build After Addon Is Solid)

* **Runs on:** Unraid, NAS, any Docker host, Docker-based HA installs (homeassistant/home-assistant container)
* **Install:** Docker Hub / Unraid Community Apps
* **Target audience:** Power users comfortable with external Docker deployment
* **Auth:** Long-lived HA token entered once in PistonCore settings
* **File writing:** Calls HA REST API directly with token — no companion needed
* **Complex pistons:** Compiled to PyScript permanently (see Section 3.2)
* **Distribution:** Docker Hub, Unraid Community Apps, GitHub
* **This is a full product, not a lite version.** Docker users lose nothing vs addon users except the v2 native runtime, which they don't need — PyScript covers complex pistons permanently for Docker.

### Docker HA Users (homeassistant/home-assistant container)

Users running HA in Docker cannot install HA addons — no supervisor exists. They will use the Docker version of PistonCore when it is built. REST API still works fine for them with the same token approach. It is reasonable to tell them "Docker version coming later" during the addon-first development phase.

### Dev Environment

Development happens in Docker on Unraid during the entire v1 build phase. Addon packaging is a future step. Build and validate all core functionality in Docker first, then package as an addon. This does not mean Docker is the primary product — it means Docker is the convenient dev environment.

---

## 3.1 Compiler Output Targets — Extensible List

The compiler selects an output target based on piston complexity and deployment type. This is an extensible list — adding a new output target in the future is an addition, not a rewrite. The piston JSON does not change when a new output target is added.

### v1 Output Targets

| Piston Type | Output Target | Notes |
|---|---|---|
| Simple | Native HA YAML automation + script | Primary target — ~95% of pistons |
| Complex | PyScript `.py` file | Fallback for break, cancel_pending_tasks, on_event |

### Output Target by Deployment — Long Term

**Addon target:**
* v1: Simple → Native YAML, Complex → PyScript (requires HACS install, user prompted if not found)
* v2: Simple → Native YAML, Complex → PistonCore native internal runtime (PyScript no longer needed)
* v3: PyScript output target removed from addon

**Docker target:**
* v1: Simple → Native YAML, Complex → PyScript (permanent, never deprecated for Docker)
* v2+: Same as v1 — no native runtime planned for Docker
* Docker users are power users comfortable with HACS — PyScript fits this audience permanently

PyScript is a permanent, long term supported output target for Docker. It is only deprecated for the addon target in v2. Any document language implying PyScript is deprecated everywhere is incorrect.

### Auto-Detection Boundary — Data-Driven, Not Hardcoded

The boundary between what compiles to native HA YAML and what forces PyScript is **not hardcoded in Python**. It lives in an external JSON file in the customize volume:

```
pistoncore-customize/
  compiler/
    target-boundary.json
    AI-UPDATE-GUIDE.md
```

Example `target-boundary.json`:

```json
{
  "version": "1.0",
  "pistoncore_version_min": "1.0",
  "description": "Features that force PyScript compilation. Update this file as HA gains new native capabilities or testing reveals assumptions that were wrong.",
  "forces_pyscript": [
    {
      "feature": "break",
      "reason": "No native HA script equivalent for mid-loop interruption",
      "ha_version_added_native": null
    },
    {
      "feature": "cancel_pending_tasks",
      "reason": "No native HA script equivalent for cancelling async tasks",
      "ha_version_added_native": null
    },
    {
      "feature": "on_event",
      "reason": "No native HA script equivalent for event-conditional blocks inside a running script",
      "ha_version_added_native": null
    }
  ]
}
```

**Why this must be external and not hardcoded — two reasons this list will change:**

1. **HA keeps expanding native script capabilities.** A feature that forces PyScript today may compile natively in a future HA version. When that happens, the user or community updates `target-boundary.json` — no PistonCore release needed. The `ha_version_added_native` field records when this happens.

2. **Some assumptions about what native HA scripts can handle will be wrong when tested.** The compiler spec was written against documentation, not running code. When something breaks in real testing, it needs to move to PyScript immediately — not wait for a code release. External config makes this a one-line file edit.

PistonCore loads `target-boundary.json` at startup. The compiler reads from it at compile time. The file ships with sensible defaults and is copied to the customize volume on first launch. Container updates never overwrite it.

Everything else compiles to native HA scripts — local variables, all loop types, waits, wait_for_trigger, if/then/else, choose/switch, parallel execution, fire custom events, call another script, stop, log, and all HA service calls — unless `target-boundary.json` says otherwise.

### Hybrid Output Model — Permanent Architecture Decision

**Simple pistons compile to native HA YAML forever. This is not a stepping stone — it is the permanent answer.**

The reasoning, locked:

* Native YAML pistons are owned by HA. Traces work in HA natively. They survive PistonCore uninstall. HA keeps improving them. There is no upside to routing simple pistons through PistonCore's runtime.
* The v2 native runtime is being built regardless — for complex pistons on the addon target. That work does not change the calculus for simple pistons.
* A full native runtime replacing YAML for simple pistons would add a permanent dependency on PistonCore being running for automations that don't need it. That violates the independence guarantee.
* User feedback may influence roadmap priorities — it will not change this decision.

The output model by piston type is permanent:

| Piston Type | Output | Status |
|---|---|---|
| Simple | Native HA YAML automation + script | Permanent |
| Complex — addon v1 | PyScript | Until v2 |
| Complex — addon v2+ | PistonCore native runtime | Permanent for complex |
| Complex — Docker | PyScript | Permanent |

Do not re-open the question of routing simple pistons through the native runtime.

### Compile Target Is Always Compiler-Owned — Never User-Controlled

The compiler re-scans the `statements` array on every save and sets `compile_target` automatically based on `target-boundary.json`. The user never manually sets or overrides the compile target. When a statement is added that forces PyScript, the editor shows an informational indicator explaining why the target changed. This indicator is read-only — it is not a button or a user action. Any reference in earlier drafts to a "Convert — one click" button described this indicator only. The one-click action was the compiler detecting the change; the button was just the explanation shown to the user.

If a user later removes the statement that forced PyScript, the compiler re-scans on the next save and automatically restores the native HA Script target if no other PyScript-forcing statements remain. The user is never asked to manually downgrade.

---

## 3.2 PyScript Detection and Setup Prompt

Before allowing complex piston deployment to HA, PistonCore must detect whether PyScript is installed:

* On HA connect, check for PyScript integration via HA REST API (`GET /api/services` checking for `pyscript` domain)
* If PyScript is not found and the user attempts to deploy a complex piston: show a clear setup prompt

> *"Complex pistons require PyScript — a free HACS integration. Install it in Home Assistant first, then come back and deploy."*
> `[Open PyScript on HACS]` `[I've installed it — check again]` `[Cancel]`

* Link goes directly to the PyScript HACS page
* "Check again" re-runs the detection without a full reconnect
* Once v2 native runtime ships for addon users, this prompt goes away entirely for addon users

The wizard should also show a subtle warning while building if a complex feature is selected and PyScript is not detected — not just at deploy time. A small indicator in the editor is sufficient.

---

## 4. HAClient Abstraction — Auth Architecture

All HA communication goes through a single `HAClient` class. This is how auth differences between addon and Docker are handled — everywhere else in the codebase, nothing knows or cares which auth mode is active.

```python
HAClient(auth_mode="supervisor" | "token", token=None)
```

* **Supervisor mode (addon):** Token is injected via `SUPERVISOR_TOKEN` environment variable — never stored, never user-visible
* **Token mode (Docker):** Long-lived token entered once by user in PistonCore settings, stored in `config.json` on the volume
* **All HA API calls go through this class** — nothing else in the backend calls HA directly
* **Frontend never receives the token** — all HA calls are proxied through PistonCore backend endpoints

HAClient must be implemented before addon packaging work begins. It is the foundation that makes addon and Docker behave identically from the rest of the codebase's perspective.

---

## 5. Core Concepts

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

PistonCore automatically decides what to compile to based on what your piston does. You never choose — it detects it using the rules in Section 3.1. A compile target indicator in the editor updates live as you build.

---

## 6. Piston JSON — The Permanent Master Format

### Two Formats — One Clear Purpose Each

**Internal stored format:** Structured JSON — every statement is a typed data object. The wizard writes structured data. The editor renders display text from that data. The compiler reads structured JSON directly. This is the working format — the source of truth for everything PistonCore does with a piston.

**Shared/export/AI format (Snapshot JSON):** Structured JSON with empty `device_map` arrays and role name placeholders. Used for AI import, community sharing, and WebCoRE migration. The same structured JSON the compiler and editor already use — just with personal device mappings removed. See Section 6.2.

These two formats serve different purposes. The internal format is for the compiler and editor. The Snapshot format is for humans, AI, and community sharing.

### 6.1 Internal Stored Format

The internal piston file contains a wrapper plus a `statements` array of structured JSON objects. This is the same proven model WebCoRE used, adapted for Home Assistant.

**The statements array is a nested tree.** Control flow nodes own their children directly — `then`, `else`, `statements`, `else_ifs`, and `cases` contain child statement objects embedded inline. There are no ID references between statements. The tree structure is explicit and self-contained. This guarantees that what is stored is exactly what renders in the editor, with no lookup step that can fail or go stale.

**The editor must render from this JSON correctly 100% of the time, every time, without fail.** This is the non-negotiable foundation of the project.

```json
{
  "id": "d4e2f9a1",
  "name": "New Door / Window Chime",
  "logic_version": 1,
  "ui_version": 1,
  "compile_target": "pyscript",
  "has_missing_devices": false,
  "device_map": {
    "Doors": ["binary_sensor.front_door", "binary_sensor.back_door"],
    "Announcement_Sonos": ["media_player.sonos_living_room"]
  },
  "variables": [
    { "type": "device", "name": "Doors" },
    { "type": "string", "name": "Message" }
  ],
  "statements": [
    {
      "id": "stmt_001",
      "type": "if",
      "conditions": [
        {
          "id": "cond_001",
          "is_trigger": true,
          "aggregation": "any",
          "role": "Doors",
          "attribute": "contact",
          "attribute_type": "binary",
          "device_class": "door",
          "operator": "changes to",
          "value": "open"
        }
      ],
      "condition_operator": "and",
      "then": [
        {
          "id": "stmt_002",
          "type": "set_variable",
          "variable": "Message",
          "value": { "type": "literal", "data": "" },
          "description": null,
          "disabled": false
        }
      ],
      "else_ifs": [],
      "else": [],
      "description": null,
      "disabled": false
    }
  ]
}
```

**The `statements` array is what the compiler reads. The editor renders display text from it. Nothing is ever parsed from display text during normal operation.**

### 6.2 Snapshot Format — The Share and AI Format

When a piston is exported as a Snapshot, shared in a forum post, or generated
by an AI, the format is the internal structured JSON with two differences:
- `device_map` values are empty arrays — roles are preserved, entity IDs stripped
- A new piston ID is assigned on import

No `piston_text`. No text parser. The same structured JSON the compiler and
editor already use — just with the personal device mappings removed.

```json
{
  "id": "d4e2f9a1",
  "name": "New Door / Window Chime",
  "logic_version": 1,
  "ui_version": 1,
  "compile_target": "native_script",
  "device_map": {
    "Doors": [],
    "Announcement_Sonos": []
  },
  "device_map_meta": {
    "Doors": { "cardinality": "multi" },
    "Announcement_Sonos": { "cardinality": "single" }
  },
  "variables": [
    { "id": "var_001", "name": "message", "display_name": "Message", "type": "string", "default_value": "" }
  ],
  "statements": [
    {
      "id": "stmt_a3f8c2d1",
      "type": "if",
      "conditions": [
        {
          "id": "cond_b7e2f941",
          "is_trigger": true,
          "aggregation": "any",
          "role": "Doors",
          "attribute": "contact",
          "attribute_type": "binary",
          "device_class": "door",
          "operator": "changes to",
          "display_value": "Open",
          "compiled_value": "on",
          "group_operator": "and"
        }
      ],
      "condition_operator": "and",
      "then": [
        {
          "id": "stmt_c1d4e823",
          "type": "set_variable",
          "variable": "message",
          "value": { "type": "literal", "data": "" },
          "description": null,
          "disabled": false
        }
      ],
      "else_ifs": [],
      "else": [],
      "disabled": false
    }
  ]
}
```

**`device_map` values are always empty arrays in Snapshot format.** The role
names are preserved as keys so the import dialog knows what to ask the user
to map. `device_map_meta` is preserved so cardinality is known on import.

This is what `write-a-piston.md` teaches AI assistants to generate.
This is what `migrate-from-webcore.md` teaches AI assistants to produce
from a WebCoRE screenshot.

---

### 6.3 Import Flow — Role Mapping

When a user imports a Snapshot (from AI, from sharing, from the community),
the flow is:

1. User opens the Import dialog and pastes Snapshot JSON (or imports from URL or file)
2. PistonCore validates the JSON format and version fields
3. PistonCore detects that `device_map` has empty arrays — role mapping required
4. For each role, the dialog shows the device picker — same component used throughout the wizard
5. User maps each role to a real HA device from their Home Assistant
6. As each role is mapped, `device_map` is populated with real entity IDs
7. Piston opens in the editor fully built — no parsing, no guessing

**This is the same import flow for all sources:**
- AI-generated pistons (from `write-a-piston.md`)
- Community-shared Snapshots
- WebCoRE migrations (from `migrate-from-webcore.md`)

One path handles everything. The role mapping step is skipped entirely if
`device_map` is already populated (Backup import or internal copy/duplicate).

---

### 6.4 Wrapper Fields

| Field | Internal | Snapshot | Backup | Purpose |
|---|---|---|---|---|
| `id` | ✅ | new on import | ✅ preserved | Immutable UUID |
| `name` | ✅ | ✅ | ✅ | Piston list display |
| `logic_version` | ✅ | ✅ | ✅ | Statement format version |
| `ui_version` | ✅ | ✅ | ✅ | Editor layout version |
| `compile_target` | ✅ | ✅ | ✅ | `"native_script"` or `"pyscript"` |
| `has_missing_devices` | ✅ | — | — | Warning flag, set on load |
| `device_map` | ✅ | empty arrays | ✅ full | Role → entity ID list |
| `device_map_meta` | ✅ | ✅ | ✅ | Role cardinality metadata |
| `variables` | ✅ | ✅ | ✅ | Variable definitions |
| `statements` | ✅ | ✅ | ✅ | Structured statement objects |

**`logic_version` and `ui_version` are separate and change independently.**
A drag-and-drop library swap bumps `ui_version` only. A new statement type
bumps `logic_version` only. Never collapse them into one field.

---

### 6.5 What Each Consumer Does

| Consumer | Reads | Does |
|---|---|---|
| Editor | `statements` | Renders display text from structured data |
| Wizard | `statements` | Reads structured data to pre-populate edit, writes structured data on save |
| Compiler | `statements` + `device_map` | Reads typed statement objects directly — no text parsing |
| Import dialog | Snapshot JSON | Validates format, detects empty device_map, runs role mapping flow |
| Piston list | Wrapper only | Reads `name`, `id`, `has_missing_devices` — never touches statements |
| Snapshot export | `statements` + wrapper | Strips entity IDs from device_map, clears id for reassignment |
| Backup export | Everything | Returns full internal format including populated `device_map` |

---

### 6.6 Editor Render Model

The editor never stores or reads display text. It renders display text from
structured data on the fly — the same way WebCoRE did with its
`renderComparison()` and `renderTask()` functions. Every statement type has
a defined render function that produces the corresponding plain English
display line.

**Example:** A structured condition object:
```json
{
  "operator": "changes to",
  "role": "Doors",
  "attribute": "contact",
  "compiled_value": "on",
  "display_value": "Open",
  "is_trigger": true
}
```
Renders as: `⚡ Any of {Doors}'s contact changes to Open`

Render functions live in the frontend. They are called by the editor for
display and by the status page for the read-only script panel.
Snapshot export does NOT use render functions — it exports the structured
JSON directly with device_map emptied.

---

### 6.7 Piston Identity Rule — Core Invariant

* Every piston gets a UUID on creation — **this UUID never changes**, even if the piston is renamed
* HA automation ID is always `pistoncore_{uuid}`
* HA automation filename is always `pistoncore_{uuid}.yaml`
* HA script key and entity ID is always `pistoncore_{uuid}` — callable as `script.pistoncore_{uuid}`
* HA script filename is always `pistoncore_{uuid}.yaml`
* PyScript file is always `pistoncore_{uuid}.py`
* The piston slug (name-derived) is used ONLY for the automation `alias:` field
* All HA artifact names derive from UUID — never from piston name

### 6.9 Versioning

* `logic_version` — tracks statement format changes. Bump when statement schema changes.
* `ui_version` — tracks editor layout changes. Bump when editor rendering structure changes.
* These change independently — never collapse into one field
* If either is missing, treat as v1
* If either is from the future, warn and refuse to load — never silently corrupt

---

### 6.10 Snapshot Format — Logic Version 2 (Current)

> This section defines the current Snapshot format for logic_version 2 pistons.
> Section 6.2 above is marked superseded — it described the logic_version 1 format
> which used `device_map`. This section replaces it as the authoritative Snapshot spec.

**What a Snapshot is:** A piston exported for sharing, AI generation, or community distribution. Entity IDs are stripped. Role labels are preserved on nodes so the import dialog knows what to ask the user to map.

**What a Snapshot is NOT:** A backup. Use Backup export for personal restore — it preserves all entity_ids and should never be shared publicly.

#### Snapshot Wrapper

Identical to the internal format wrapper (PISTON_FORMAT.md v2.1) with two differences:
- A new `id` is assigned on import (not preserved from the Snapshot)
- No `entity_ids` on any node (stripped on export)

```json
{
  "id": "00000000",
  "name": "Door Chime",
  "description": "",
  "folder": null,
  "mode": "single",
  "enabled": true,
  "logic_version": 2,
  "ui_version": 1,
  "compile_target": "native_script",
  "created_at": "2026-05-01T08:00:00Z",
  "modified_at": "2026-05-01T08:00:00Z",
  "variables": [],
  "statements": [ ... ]
}
```

#### Snapshot Node Rules

**Condition nodes:** `entity_ids` is always an empty array `[]`. `role` is preserved.
```json
{
  "id": "cond_a3f8c2d1",
  "is_trigger": true,
  "role": "Front Door",
  "entity_ids": [],
  "aggregation": "any",
  "attribute": "contact",
  "attribute_type": "binary",
  "device_class": "door",
  "operator": "changes to",
  "display_value": "Open",
  "compiled_value": "on",
  "group_operator": "and"
}
```

**Action nodes:** `entity_ids` is always an empty array `[]`. `role` is preserved.
```json
{
  "id": "stmt_b7e2f941",
  "type": "action",
  "role": "Announcement Speaker",
  "entity_ids": [],
  "tasks": [ ... ],
  "description": null,
  "disabled": false
}
```

**Time conditions and non-device conditions:** unchanged — they have no `entity_ids` to begin with.

#### Role Name Uniqueness Rule

Role names must be unique within a Snapshot. If two action nodes in the same piston use `"role": "Lights"`, they will both be mapped together in the import dialog — the same entity selection applies to both. This is intentional: the role name is the mapping key. If different lights need different entity mappings, they need different role names.

---

### 6.11 Snapshot Import Flow — Logic Version 2

> Section 6.3 above is marked superseded. This section defines the redesigned import
> flow for logic_version 2 Snapshots. This spec is sufficient for implementation.
> MISSING_SPECS.md Item 21 is resolved by this section.

#### Step 1 — Validate and Detect

User pastes Snapshot JSON (or imports from URL/file). PistonCore validates:
- Valid JSON
- Has required wrapper fields (`logic_version`, `statements`, `name`)
- `logic_version` is not from the future
- If `logic_version: 1`: warn that this is a legacy format, offer to convert or cancel

#### Step 2 — Collect Unique Roles

Walk the entire `statements` tree recursively. Collect every unique `role` value from:
- Condition nodes where `entity_ids` is empty and `role` is not `"time"` / `"date"` / `"mode"` / system subjects
- Action nodes where `entity_ids` is empty

Build a deduplicated list of role names. Preserve order of first appearance.

**Example:** A piston with 3 condition nodes and 2 action nodes all using `"role": "Doors"` and `"role": "Speaker"` → two roles to map: `["Doors", "Speaker"]`.

#### Step 3 — Role Mapping Dialog

For each unique role, show the device picker in sequence:

```
Map your devices — Step 1 of 2

Role: "Doors"
Used as: trigger (changes to Open), condition (is Open)

[Device picker — search and multi-select]
Selected: [front door ×] [back door ×]

← Back    Skip    Next →
```

- The dialog shows where the role is used (trigger, condition, action) to give context
- Multi-select is always available — the user decides whether one or many devices fill a role
- Skip is available for roles the user doesn't want to map yet — piston imports with empty entity_ids, can be filled later in the editor
- Back returns to the previous role

#### Step 4 — Populate entity_ids

After the user maps all roles, PistonCore walks the statement tree again and writes the selected entity_ids to every node whose `role` matches a mapped role:
- All condition nodes with `role: "Doors"` → `entity_ids: ["binary_sensor.front_door", "binary_sensor.back_door"]`
- All action nodes with `role: "Doors"` → same entity_ids

This is a single pass — every node with the same role name gets the same entity_ids. This is why role name uniqueness matters (Section 6.10).

#### Step 5 — Assign New ID and Save

- Generate new UUID for the piston (Snapshots never preserve the original ID)
- Set `created_at` and `modified_at` to now
- Save to `/pistoncore-userdata/pistons/{new_uuid}.json`
- Update piston index
- Open in editor — user sees the fully mapped piston

#### Backup Import (No Role Mapping)

Backup files preserve all `entity_ids` — no role mapping dialog appears. PistonCore detects this by checking whether any condition or action node has a non-empty `entity_ids` array. If all nodes have entity_ids already populated, skip Steps 2–3 and go directly to Step 5 (with the original UUID preserved for Backup imports).

---

## 7. Variables

### 7.1 Global Variables

Defined once at the PistonCore level. Available to every piston.

**Global Variable Model — Summary**

PistonCore uses two different mechanisms for global variables depending on type, with PyScript as the fallback for edge cases the native model cannot handle cleanly:

* **Device and Devices globals** — compile-time only. Entity IDs are baked directly into each compiled YAML file that references the global. No runtime lookup, no shared external store. When the global's device list changes, affected pistons are flagged stale and must be redeployed.
* **Non-device globals** (Text, Number, Yes/No, Date/Time) — backed by HA input helpers with a `pistoncore_` prefix. Compiled pistons read these live via HA template syntax at runtime. PistonCore creates and manages the helpers — the user never touches them directly.
* **Edge cases over threshold** — if a global variable usage pattern cannot be expressed cleanly in native YAML (e.g., a device global used in a loop with dynamic iteration), the piston is a candidate for PyScript compilation per `target-boundary.json`.

This model was a deliberate decision. Device globals being compile-time eliminates runtime race conditions entirely. Non-device globals being HA helpers means they work in HA's native UI, HA history, and HA automations written outside PistonCore. Do not relitigate this model.

**Storage — two-part model:**

* PistonCore maintains a reference list of all global variables in `globals.json` on the volume. This is the management record — display name, type, internal UUID.
* Non-device types (Text, Number, Yes/No, Date/Time) are pushed to HA as native input helpers via REST API. The helper entity ID uses a `pistoncore_` prefix derived from the variable's internal UUID: `input_text.pistoncore_{uuid}`. Compiled pistons read helpers live via HA template syntax — no PistonCore involvement at runtime.
* Device and Devices globals are **compile-time values only**. When a piston is deployed, device entity IDs are baked directly into the compiled YAML as a literal inline list. There is no runtime group lookup and no shared external file. This eliminates any possible bugs from referencing a shared folder or variable store at runtime. A v2 native runtime approach can add PistonCore-file-based device groups later if needed.

**Global variable naming rules:**
* Must be lowercase, underscores only, no spaces — enforced in UI at creation time with a clear error message
* PistonCore prefixes all HA helper entity IDs with `pistoncore_` to prevent collisions with existing user helpers
* Example: global named `motion_count` → HA helper entity `input_number.pistoncore_motion_count`
* Renaming a global updates the display name only — the helper entity ID is based on the internal UUID and never changes

| PistonCore Type | HA Helper Type | Runtime Behavior |
|---|---|---|
| Text | input_text | Read live by compiled piston via `states()` |
| Number (integer) | input_number | Read live by compiled piston via `states()` |
| Number (decimal) | input_number | Read live by compiled piston via `states()` |
| Yes/No | input_boolean | Read live by compiled piston via `states()` |
| Date and Time | input_datetime | Read live by compiled piston via `states()` |
| Device | No helper | Entity ID baked inline into compiled YAML at deploy time |
| Devices | No helper | Entity ID list baked inline into compiled YAML at deploy time |

**Stale piston tracking for Device/Devices globals:**

PistonCore tracks which pistons reference each Device or Devices global via
`/pistoncore-userdata/globals_index.json` — a map of global variable ID to the list
of piston IDs that reference it. Updated on every successful compile.

### Global Device Edit — Save Flow

When the user saves changes to a Device or Devices global (adds, removes, or replaces
any entity in the list), PistonCore must:

**Step 1 — Check the index**
Look up the global's ID in `globals_index.json`. Get the list of piston IDs that
reference it.

**Step 2 — If no pistons reference this global**
Save and close. No prompt needed.

**Step 3 — If one or more pistons reference this global**
Save the global change first. Then immediately show a permission prompt — do not
proceed without user acknowledgement:

> **"[Global name]" was updated**
> *[N] piston(s) bake this device list at deploy time and are now running with the
> old list. Redeploy them now to pick up the change?*
>
> **[Redeploy All Now]** — redeploy all affected pistons immediately, in sequence.
> If a piston is currently running, wait for it to finish before redeploying (or
> restart-mode pistons will be restarted).
>
> **[I'll Do It Later]** — close the prompt. Affected pistons are flagged stale
> on the piston list. The user can redeploy individually or in bulk later.
>
> **[Show Me Which Pistons]** — expand the prompt to list piston names before
> committing to redeploy.

**Never auto-redeploy without user permission.** The user may be editing globals
at an inconvenient time and a mass redeploy could interrupt running automations.

### Stale Flag — How It Looks

Pistons flagged stale due to a global device change show on the piston list with:
- ⚠ indicator on the piston row
- Tooltip/subtitle: *"Device list outdated — global '[name]' was changed"*
- This is distinct from `entity_missing` (entity gone from HA) and `manually_edited`
  (compiled file was hand-edited)

The `piston_index.json` entry gets a `stale_globals: ["global_id_1"]` field listing
which globals caused the stale state. Cleared when the piston is successfully redeployed.

### Redeploy All Flow

When the user chooses **[Redeploy All Now]** (from the prompt or from the piston list
banner):

1. Show a progress modal: *"Redeploying 3 pistons..."*
2. Redeploy each affected piston in sequence (not parallel — avoids HA reload race conditions)
3. For each piston:
   - Compile → yamllint → deploy → reload
   - If success: mark piston as no longer stale, show ✓ in progress modal
   - If failure: show ✗ with the error, continue with remaining pistons
4. When all done: summary — *"3 redeployed, 0 failed"* or *"2 redeployed, 1 failed — see details"*
5. User can retry failed pistons individually from the piston list

### Piston List Banner

When any pistons are stale due to global changes, show a persistent banner at the
top of the piston list (below the HA connection status):

*"'[Global name]' was updated — [N] pistons need redeployment."*
`[Redeploy All]` `[Review]`

If multiple globals were changed and each affects different pistons, group by global:

*"2 globals were updated — [N] pistons total need redeployment."*
`[Redeploy All]` `[Review]`

### Full Spec

Full UX flow, progress modal layout, and error handling are in MISSING_SPECS.md Item 24.
That item must be resolved before the globals edit UI (G-4) is built.

### 7.2 Piston Variables

Defined inside a single piston. Only exist while that piston is running. Compiled using the native HA script `variables:` action. Only visible in Advanced mode.

### 7.3 Variable Types

| Type | Description | Notes |
|---|---|---|
| Text | A word or sentence | |
| Number (integer) | A whole number | |
| Number (decimal) | A decimal number | |
| Yes/No | True or false | HA boolean helpers only — not for device states |
| Date and Time | A specific point in time | |
| Date | A date only | |
| Time | A time only | |
| Device | A single HA entity reference | Compile-time only — baked inline at deploy |
| Devices | A collection of HA entity references | Compile-time only — baked inline at deploy |

List variants (Dynamic list, Text list, etc.) are deferred to v2.

**Device and Devices variables always show the friendly name, never the entity ID.**

**Variable naming conventions — enforced throughout the UI:**
- `@variableName` — global variables. The `@` prefix is always shown in the editor, define block, variable picker, and expressions.
- `$variableName` — local piston variables and system variables. The `$` prefix is always shown.
- These prefixes are not optional decoration — they are part of the variable name as displayed to the user, matching WebCoRE exactly.

---

## 8. Device and Entity Model

### Device-Level Picker

PistonCore operates at the device level, not the entity level. The user always picks a physical device by friendly name, device name, or area. PistonCore never exposes entity IDs to the user in any screen.

The device picker is a type-to-filter search field, not a static dropdown.

### Capability-Driven Attribute Selection

After picking a device, the user picks which capability or attribute to act on. This list is fetched live from HA for that specific device via the WebSocket API. It is never a hardcoded list maintained by PistonCore.

Multi-step flow:
1. Pick the device (by friendly name, device name, or area)
2. Pick the capability or attribute — fetched live from HA
3. Pick the comparison or action based on that capability

### WebSocket API — Required Commands

All device, entity, capability, trigger, condition, and service data is fetched via the HA WebSocket API. The REST API is used only for simple one-off calls (automation/reload, file writes, version check) that do not require a persistent connection.

Key WebSocket commands the wizard depends on:
* `get_triggers_for_target` — all valid triggers for a specific device
* `get_conditions_for_target` — all valid conditions for a specific device
* `get_services_for_target` — all valid services for a specific device
* `config/entity_registry/list_for_display` — optimized entity list for UI display

### Capability Data Quality and Graceful Degradation

Known problem areas: Zigbee, Z-Wave, MQTT, media players, custom integrations.

Required behavior:
* If capability data is clear → use it directly
* If capability data is incomplete → show what exists plus an *"Other / Manual"* option
* If HA returns no usable capability data → Unknown Device Fallback triggers (see below)
* The wizard never crashes or shows incorrect options — always degrades to showing less rather than showing wrong

### Unknown Device Fallback

If HA returns no usable capability data for a device, PistonCore shows a one-time **"Define this device"** screen for that specific device. The user labels each entity in plain English. PistonCore stores that definition locally on the volume. From that point on the device behaves like any HA-known device. Definitions are editable from **My Device Definitions** in PistonCore settings.

### Multi-Entity Compilation — Confirmed HA Native Support

**HA natively accepts an array of entity IDs in both triggers and action targets.**
PistonCore does not need to expand multi-device groups into multiple trigger or action blocks.

**Triggers — pass entity_ids array directly:**
```yaml
- trigger: state
  entity_id:
    - binary_sensor.front_door
    - binary_sensor.back_door
  to: "on"
```
One trigger block fires when ANY entity in the list changes. This is HA-native behavior — no expansion required.

**Actions — pass entity_ids array directly:**
```yaml
- action: light.turn_on
  target:
    entity_id:
      - light.living_room
      - light.kitchen
  data:
    brightness_pct: 100
```
One action block applies to all entities simultaneously. This is HA-native behavior — no expansion required.

**Conditions — no native multi-entity support.**
HA `state` conditions only accept a single entity. For multi-entity conditions PistonCore compiles to a Jinja2 template using `any()`, `all()`, or `none()`:
```yaml
- condition: template
  value_template: >
    {{ ['binary_sensor.front_door', 'binary_sensor.back_door']
       | map('states') | select('eq', 'on') | list | count > 0 }}
```

**Aggregation mapping:**

| PistonCore aggregation | Trigger | Condition |
|---|---|---|
| `any` | `entity_id: [list]` — fires on any | Jinja2 `any(map('states') \| select('eq', value))` |
| `all` | N/A — use template trigger | Jinja2 `all(map('states') \| select('eq', value))` |
| `none` | N/A — use template trigger | Jinja2 `none(map('states') \| select('eq', value))` |

For `all` and `none` aggregation on triggers, the compiler must use a template trigger since HA state triggers do not support ALL-match semantics natively. This is a known compiler complexity point — document in COMPILER_SPEC.md when the condition compiler is built.

**This is a locked compilation decision. Do not reopen.**

---

## 9. HA Version Detection

On every HA connect (startup and reconnect):
1. Call `GET /api/` — returns HA version in the response
2. Store detected version in PistonCore config/memory
3. Use version to select the correct template folder (see Section 14)
4. Display detected HA version in PistonCore settings/status area
5. Re-check on reconnect in case HA was updated between connections

This is required infrastructure for the versioned template system. It must be wired in before the compiler template system is built.

---

## 9.1 Startup Sequence

On every PistonCore startup (container start or restart), the following steps run in order before the UI becomes available. Each step is logged. Failures are surfaced clearly — they never silently corrupt state.

### Step 1 — Connect to HA

Establish HA WebSocket connection and run Section 9 version detection. If HA is unreachable, start in degraded mode: piston list is readable, wizard and deploy are blocked, UI shows a persistent "HA disconnected" banner.

### Step 2 — Build Piston Index

Scan `/pistoncore-userdata/pistons/` and build an in-memory index of all piston files:
- Read each JSON file's wrapper fields only (id, name, compile_target, logic_version, enabled, folder)
- Write summary to `/pistoncore-userdata/piston_index.json`
- This index is what the piston list page reads — never the raw piston files directly
- If a piston file is corrupt or unreadable: log the error, add an error entry to the index, continue

### Step 3 — Orphan Detection (HA → PistonCore)

Scan the HA compiled output directories for PistonCore files that no longer have a corresponding piston in the piston index:
- Scan `<ha_config>/automations/pistoncore/` for `pistoncore_*.yaml` files
- Scan `<ha_config>/scripts/pistoncore/` for `pistoncore_*.yaml` files
- Scan `<ha_config>/pyscript/pistoncore/` for `pistoncore_*.py` files
- For each file: extract UUID from `pc_piston_id` in the signature header, check against piston index
- If UUID not in index: **flag as orphan in the piston index — do NOT delete**
- If file has no signature header: leave it completely alone — PistonCore did not create it

**Orphaned compiled files are NEVER auto-deleted.** PistonCore shows them on the piston list as "Orphaned automation — no piston found" with a ⚠ indicator. The user decides what to do: either restore the piston or explicitly delete the compiled file from the status page. Auto-deletion risks destroying a running automation the user cares about — a wiped volume or a restore-from-backup scenario must never silently kill live automations.

### Step 4 — Manual Edit Detection

For every piston that has a compiled output file, check the file hash:
- Read the `pc_hash` value from the file's signature header
- Recompute the hash of the file content below the header
- If hashes differ: mark the piston as `manually_edited: true` in the index
- Show ⚠ on piston list, warning banner on status page:
  *"This piston's compiled file was edited manually. PistonCore will overwrite it on next deploy."*
- Do NOT auto-revert. Do NOT block the user. Inform only.

### Step 5 — Entity Validation (Background)

For every deployed piston, validate its `entity_ids` against the current HA entity registry:
- Run asynchronously — do not block startup completion
- For each condition and action node in each piston: check every entity_id against the entity registry from HA
- **Missing means not in the registry at all** — the entity_id no longer exists in HA (device removed, renamed, integration deleted). A device that is offline, unavailable, or has a dead battery still exists in the registry — it is NOT missing and does NOT trigger this flag.
- If any entity_id is genuinely missing from the registry: mark piston as `entity_missing: true` in the index
- Show ⚠ on piston list. Status page shows which entity is missing by its last known role label.
- This is informational only — the piston keeps running in HA. The compiled file is untouched. Nothing is deleted or modified.
- The user decides what to do: fix the entity reference in the editor and redeploy, or leave it as-is.

### Step 6 — configuration.yaml Check

Check for PistonCore include directives (see Section 19). If missing, append them and set `ha_restart_required: true`.

### Startup Completion

After all steps complete (or fail gracefully): mark startup complete, unlock UI, log summary.

---

## 9.2 Scheduled Background Checks

After startup, PistonCore runs lightweight background checks on a schedule. These never block the UI.

### Entity Validation — Every 30 Minutes

Repeat Step 5 from Section 9.1 for all deployed pistons. This catches devices whose entity_id was removed from HA (renamed, deleted, integration removed) between deploys. If a new missing entity is detected, update the piston index and show ⚠ on piston list.

**Unavailable is not missing.** A device that is offline, dead battery, or temporarily unavailable still exists in the HA entity registry and does NOT trigger this flag. Only entities that no longer exist in the registry at all are flagged.

**Why 30 minutes:** Frequent enough to catch changes within a reasonable window without hammering HA's entity registry. Configurable in `config.json` (`entity_check_interval_minutes`, default 30).

### HA Connection Health — Every 60 Seconds

Ping the HA WebSocket connection. If it drops: attempt reconnect with exponential backoff (1s, 2s, 4s, 8s, max 60s). Show connection status in UI header throughout.

### Orphan Check — On Every HA Reconnect

Re-run Step 3 from Section 9.1 whenever HA WebSocket reconnects. Updates the orphan flags in the piston index. Never auto-deletes anything.

### Piston Index Rebuild — On Every Piston Save or Delete

The piston index is always kept current — not just at startup. Every save and delete operation updates the index immediately.

---

## 10. Piston Structure

Every piston has the following sections in order. All sections except the header are collapsible.

A piston is built from **Statements**. Two kinds:
* **Decisional statements** — control flow: `if`, `else if`, `else`, `end if`, `repeat`, `for each`, `while`, `end repeat`
* **Executive statements** — execute things: `with [device] do [action]`, `set variable`, `wait`, `wait for state`, `log message`, `call another piston`, `stop`, `cancel all pending tasks`

### 10.1 Header

* **Name** — human readable, becomes the filename when compiled
* **Description** — optional
* **Folder** — set here or on the status page
* **Mode** — Single (default) / Restart / Queued / Parallel
* **Enabled / Disabled**

### 10.2 Piston Variables

Optional. Only visible in Advanced mode. Labeled: *"Temporary — forgotten when this piston finishes running."*

### 10.3 Triggers

One or more triggers. Uses the same multi-step wizard as conditions and actions.

**How triggers are stored in the structured JSON:**

Triggers are stored as condition objects inside `if` statement blocks, with `"is_trigger": true` on the condition object. This flag is what distinguishes a trigger from a condition — not position, not operator name guessing.

In the editor display, trigger conditions are shown with a ⚡ indicator. The ⚡ is rendered from the `is_trigger` flag in the structured data — it is not parsed from text.

The wizard knows whether the user is adding a trigger or a condition based on which section they clicked — it sets `is_trigger` accordingly when writing the structured data. Triggers and conditions use the same wizard flow; the operator list is divided into trigger operators (shown with ⚡) and condition operators.

Trigger types:
* Device or entity state change — `changes`, `changes to`, `changes from`, `changes from X to Y`
* Numeric — `rises above`, `drops below`
* State with duration — `changes to [value] and stays for [duration]`
* Button/momentary device — `gets [event]`, `gets any`
* Time — `happens daily at [time]`
* Sunrise / Sunset — `happens at $sunrise + [offset]` / `happens at $sunset + [offset]`
* Time pattern — `happens every [X] minutes` / `happens every [X] hours`
* HA event — `event [event_name] fires`
* Webhook — `webhook [id] is called`
* Called by another piston — `is called by another piston`
* Manual only — only runs when Test is pressed

### 10.4 Conditions

Checked after a trigger fires. If conditions are not met the piston stops silently.

Operators are plain English. Device states use native HA values. Multiple conditions grouped with AND or OR — written in full, never symbols.

### 10.5 Action Tree

Top-to-bottom sequence of statements. The entire action tree is wrapped in an `execute / end execute;` block — this is a rendering wrapper only, not a data node in the JSON.

**execute / end execute is a rendering artifact.** The execute block body is stored as the `statements` array in the internal JSON — the editor renders the `execute` and `end execute;` wrapper lines automatically around the action statements. They are display elements only, not stored as separate data nodes.

Full document structure order when rendered:
1. Comment header (piston name, author, created, modified, build, version, piston ID)
2. `settings / end settings;` — only shown when non-empty
3. `define / end define;` — piston variables, only shown when variables exist
4. `execute` — starts the action tree
5. All action statements indented inside
6. `end execute;` — closes the action tree

Statement keywords match WebCoRE exactly: `if`, `then`, `else if`, `else`, `end if`, `with`, `do`, `end with`, `repeat`, `for each`, `only when`, `execute`, `end execute`, `define`, `end define`, `settings`, `end settings`.

---

## 11. The Editor UI

### Overall Feel

The editor is a **structured document viewed top to bottom**. Logic is always visible — indentation shows nesting. It reads like a well-formatted script. Keywords match WebCoRE exactly.

### Frontend Technology

**Vanilla JS, HTML, and CSS.** No framework. Minimal dependency footprint, readable by any contributor.

### UI Rules — No Exceptions

1. No pictograms for logic. AND/OR, equals, greater than — always written in plain English.
2. No entity IDs ever visible to the user.
3. All dropdowns populated from live HA data.
4. Sections are collapsible with plain English labels.
5. Errors are plain English.
6. Buttons use icon plus plain English label. Never icon alone.
7. Automatic validation on save.
8. Compiled output is never shown to the user in the editor or status page.

### Simple / Advanced Mode Toggle

Single global toggle. **Default is Advanced.**

* **Simple** — hides piston variables, limits to most common types, plain English throughout
* **Advanced** — shows everything including piston variables, all types, loops, wait-for-state, TEP/TCP in wizard

Mode preference saved to localStorage (`pc_simpleMode`). Switching modes never destroys data.

### Compile Target / Complexity Indicator

The editor shows the current compile target (Native HA Script or PyScript) based on auto-detection. Updates live as the user adds statements. If the target changes from Native HA Script to PyScript mid-build, show an inline notification:

*"This piston now requires PyScript compilation."*

For Docker users building complex pistons: show a subtle indicator that PyScript must be installed via HACS for deployment. Informational only — does not block building.

### Addon vs Docker Feature Flags

The backend reports `deployment_type: "addon" | "docker"` in the config response. The frontend uses this to conditionally show or hide relevant UI:

* **Addon:** Supervisor token is automatic — no token entry UI shown
* **Docker:** Token entry field shown in settings
* **PyScript requirement indicator:** Shown on Docker for complex pistons; suppressed on addon v2+ when native runtime replaces PyScript
* Feature flags are informational — the editor never blocks building based on deployment type

---

## 12. The Condition, Trigger, and Action Wizard

When a user clicks any ghost text or edits an existing statement, a **multi-step modal wizard** opens. Triggers, conditions, and actions all use this same wizard pattern.

Each step's options are generated from HA based on what was selected in the previous step. PistonCore never maintains its own device capability database — it always asks HA via WebSocket.

The wizard builds a plain English sentence at the top as the user progresses.

Full wizard capability map, operator lists, and value input types are defined in WIZARD_SPEC.md. That document is the authoritative reference for the wizard implementation.

### Wizard Rules — No Exceptions

* **Never two modals open at once.** If-block selection goes to condition builder first. Only inserts the if_block after the condition is completed. Uses `_extra['block-id']` exclusively as the unified mechanism.
* **Backdrop is transparent.** No dark overlay. Modal is centered, floats over the document.
* **Modal size:** 720px wide, fills most of screen height. wiz-body scrolls, modal does not grow.
* **One screen for conditions** — device, attribute, operator, and value all visible at once.
* **Operator order:** Triggers first with ⚡ prefix, conditions second.
* **Device picker opens as inline panel** below the device row with search — not a separate modal.

---

## 13. File Signature and Manual Edit Detection

Every compiled file written by PistonCore includes a signature header:

```
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: a3f8c2d1 | pc_version: 1.0 | pc_hash: [hash of compiled content]
```

The hash covers all file content below the two header lines. PistonCore only operates on files that contain its own signature. It never touches any other file.

### On Startup — Informational Scan

On startup, PistonCore checks the hash of every deployed compiled file (see Section 9.1 Step 4). If a file's hash does not match what PistonCore last recorded:
- Mark the piston as `manually_edited: true` in the piston index
- Show ⚠ on the piston list row
- Show a warning banner on the piston's status page:
  *"This piston's compiled file was edited manually since it was last deployed by PistonCore. Your changes will be overwritten on next deploy."*
- **Do NOT revert automatically. Do NOT block the user. Inform only.**
- The manually edited version keeps running in HA until the user redeploys.

### On Deploy — Interactive Diff

On deploy, if the existing file's hash does not match what PistonCore expects, it stops and shows a diff of exactly what changed, then asks: **Overwrite** or **Cancel**.

This is a second, interactive check at deploy time — distinct from the informational startup scan. Both serve different purposes: startup tells you about the problem; deploy requires your explicit decision before overwriting.

### Hash Storage

The hash is stored in two places:
1. In the compiled file header itself (`pc_hash` field) — lets PistonCore verify the file without any external record
2. In the `compile_index` SQLite table (`file_hash` column, see MISSING_SPECS.md Item 7) — lets startup scan compare without reading every file's content, only the header line

If the `compile_index` table is missing or corrupt, fall back to reading headers from compiled files directly.

---

## 14. Compiler Template System

### Template Folder Structure

Compiler templates are Jinja2 files stored in the customize volume, organized by HA version. This allows PistonCore to adapt to HA schema changes without a code release:

```
pistoncore-customize/
  templates/
    ha_2024.x/
      automation.j2
      condition.j2
      action.j2
      manifest.json
    ha_2025.x/
      automation.j2
      condition.j2
      action.j2
      manifest.json
```

* PistonCore detects HA version at connect (Section 9) and loads the matching template folder
* If no exact match exists, falls back to the nearest older version
* Community can submit template packs for new HA versions without a PistonCore release
* Users can edit templates in PistonCore's built-in code editor (CodeMirror), or via the HA file editor if the addon exposes the folder

### Template Folder Manifest

Every versioned template folder must contain a `manifest.json`:

```json
{
  "ha_version_min": "2025.1",
  "ha_version_max": "2025.12",
  "pistoncore_version_min": "1.0",
  "description": "Templates for HA 2025.x automation schema",
  "compatibility_warnings": [
    "2025.6: service call syntax changed for light.turn_on"
  ],
  "checksum": "sha256:abc123"
}
```

* PistonCore reads the manifest before loading any template
* If `pistoncore_version_min` is higher than installed: show clean error "Please update PistonCore"
* If HA version is outside supported range: warn user, don't silently fall back
* `compatibility_warnings` — shown in PistonCore UI as informational notes
* `checksum` — sha256 of the template folder contents for community pack validation (enforcement optional until post-v1)
* Same manifest requirement applies to `ha_api/` versioned folders

### Template Update Flow

* PistonCore shows a "Template update available for HA X.Y" banner when newer templates exist on GitHub
* User clicks to pull — no PistonCore restart needed
* Fallback: manual zip upload through PistonCore UI for offline installs

### Fat Compiler Context Object

The compiler passes a "fat" context object to every Jinja2 template. Logic that selects or transforms data lives in the template (Jinja2), not in the Python core. Python fetches and passes; the template decides what to use.

**Standard compiler context object — contract for template authors:**

```python
{
    "piston":             { ... },   # Full piston JSON
    "device_map":         { ... },   # role → entity_id mapping
    "entity_states":      { ... },   # entity_id → current state/attributes from HA
    "services":           { ... },   # available services for referenced domains
    "ha_version":         "2025.6",  # detected HA version string
    "pistoncore_version": "1.0",
    "global_variables":   [ ... ],   # all defined globals with type and helper entity_id
    "piston_variables":   [ ... ],   # variables defined in this piston
    "areas":              { ... },   # area_id → area name
    "zones":              [ ... ],   # all HA zones
}
```

Templates receive all of this on every compile. They use what they need and ignore the rest.

---

## 15. HA API Externalization

All HA REST API endpoint URLs and response field names are externalized to config files in the customize volume. When HA changes an endpoint path or response format, the user updates a config file — no PistonCore code release required.

### ha_api Folder Structure

```
pistoncore-customize/
  ha_api/
    ha_2025.x/
      endpoints.json
      manifest.json
    ha_2026.x/
      endpoints.json
      manifest.json
```

### endpoints.json Format

```json
{
  "get_states": {
    "url": "/api/states",
    "headers": {
      "Authorization": "Bearer {token}",
      "Content-Type": "application/json"
    }
  },
  "get_version": {
    "url": "/api/",
    "headers": { "Authorization": "Bearer {token}" }
  },
  "call_service": {
    "url": "/api/services/{domain}/{service}",
    "headers": {
      "Authorization": "Bearer {token}",
      "Content-Type": "application/json"
    }
  },
  "reload_automations": {
    "url": "/api/services/automation/reload",
    "headers": { "Authorization": "Bearer {token}" }
  },
  "write_automation": {
    "url": "/api/config/automation/config/{automation_id}",
    "headers": {
      "Authorization": "Bearer {token}",
      "Content-Type": "application/json"
    }
  }
}
```

* Token value is injected at runtime by HAClient — never stored in the file
* Addon and Docker can define different headers without Python changes
* `ha_client.py` loads `endpoints.json` on startup — no hardcoded URLs in Python

**When to implement:** During the `ha_client.py` refactor for HAClient abstraction (Section 4). Not before, not after — at the same time.

---

## 15.5 Editor Render Functions — Frontend Responsibility

The editor renders display text from structured statement data using a set of render functions. These functions are the authoritative mapping from the internal structured format to the plain English text the user sees.

### What Render Functions Do

Each statement type has a corresponding render function. The function receives the structured statement object and returns the display text string. Example:

```javascript
// Input (structured data):
{ type: "condition", is_trigger: true, aggregation: "any", role: "Doors",
  attribute: "contact", operator: "changes to", value: "open" }

// Output (display text):
"⚡ Any of {Doors}'s contact changes to Open"
```

### Where Render Functions Live

Render functions live entirely in the frontend JavaScript. The backend never renders display text. The backend reads and writes structured JSON only.

### Render Functions Are Also Used for Export

When exporting a piston as a Snapshot (shared format), the frontend render functions
produce the display text shown in the Snapshot preview. The Snapshot itself is structured
JSON — not piston_text. Render functions are used for display only, not as the export format.
piston_text is retired as a v1 format — see Section 6.2.

### Reference

WebCoRE's `renderComparison()` and `renderTask()` functions in `piston.module.html` are the reference implementation for how this works. PistonCore's render functions follow the same concept adapted for HA and the PistonCore statement type list.

The complete statement type list and their required render patterns are defined in WIZARD_SPEC.md.

---

## 15.6 Missing Device Handling

### Single-Device Statements — Hard Flag, Block Redeploy

If a statement, trigger, condition, or action depends on exactly one device and
that device is missing from HA, this is a hard error — not a graceful degradation.

**Why:** A single-device trigger with a missing entity may cause HA to error and
disable the automation entirely. A single-device condition may return unknown state.
A single-device action will fail at the HA service call. Deploying a piston with a
known broken single-device reference risks HA errors on every run — which is worse
than not running at all.

**Behavior:**
- PistonCore will not redeploy the piston while a single-device role is missing
- The last successfully deployed version remains active in HA unchanged
- The piston list shows ⚠️ and the status page shows a hard error banner naming the
  missing device by its last known friendly name
- The user is not blocked from building — they are blocked from deploying a
  known-broken configuration

**⚠️ Validation required before implementation:** Actual HA behavior when an
automation references a missing entity must be tested before implementing this logic.
Does HA error and disable the automation? Skip the broken trigger silently? Behave
differently for triggers vs conditions vs actions? Results go in HA_LIMITATIONS.md
and may affect how the hard flag is implemented. Do not code this path until tested.

### Multi-Device Statements — Degrade Gracefully

**Pistons with multi-device roles run with whatever devices are available.** If a
role contains multiple devices and one or more are missing, the piston compiles and
runs against the remaining devices. Batteries die, sensors get replaced, life happens.
A piston that breaks because one device out of four is temporarily unavailable is
worse than useless.

If ALL devices in a multi-device role are missing, treat it as a single-device-missing
hard flag (see above) — not a silent skip.

### User Communication — Two Different States

Missing device situations must be communicated differently depending on severity:

* **Single device missing** (hard flag) — ⚠️ on piston list, hard error banner on
  status page, Deploy button disabled, last good deployed version still running.
  Message: *"[Device name] is missing. Remap this device before redeploying."*

* **Multi-device role partially missing** (degraded-but-functional) — ⚠️ on piston
  list, warning banner on status page, Deploy button enabled. Message:
  *"[Device name] is missing from [role]. Piston is running on [N] of [M] devices."*

These are different states. Do not treat them the same in the UI.

### Detection — V1

On every HA connect, PistonCore checks if any entity in any piston's device_map
still exists in HA. Simple loop against the entity list already fetched.

For each missing entity, PistonCore checks whether the role it belongs to is a
single-device role or a multi-device role — this determines hard flag vs warning.

### Fix Flow — Same as Import Role Mapping

No new UI flow needed. The fix flow IS the import role mapping flow — the same
device picker component already built for import. When a device is missing:

1. ⚠️ icon on piston list — user sees something needs attention
2. User opens the piston in the editor
3. Missing device role shows with a warning indicator
4. User clicks it — same device picker opens that already exists
5. User picks the replacement or removes the device from the role
6. Save and redeploy

One well-built component handles both import role mapping and missing device
replacement. Less code, less to test, less to maintain.

### Change Tracking and Debug Data

Last known friendly name for every device in every piston's device_map is
already stored as part of change tracking and the debug/trace page. Missing
device notification uses this existing data — it is not stored separately.

---

## 16. Orphan Automation Cleanup

### PistonCore → HA (Delete Flow)

When a piston is deleted in PistonCore:
1. Call HA to delete the automation (`DELETE /api/config/automation/config/{automation_id}`)
2. Delete the PyScript file if one exists
3. Call `automation/reload`
4. If HA is offline, queue the cleanup in `pending_cleanup.json` and retry on next connect

On every HA reconnect, PistonCore checks `pending_cleanup.json` and retries any queued cleanup operations.

### HA → PistonCore (Startup Orphan Scan)

On startup, PistonCore scans its compiled output directories for files whose UUID does not match a known piston in the piston index. This covers the case where:
- The PistonCore userdata volume was wiped or restored from backup
- A piston file was manually deleted from the userdata volume
- Files were manually moved or copied

**Orphan scan behavior:**
- Find all `pistoncore_*.yaml` and `pistoncore_*.py` files in HA compiled directories
- For each: check the `pc_piston_id` in the signature header against the piston index
- If not found in index: **flag as orphan — show on piston list as "Orphaned automation — no piston found"**
- If file has no signature header: leave it completely alone — PistonCore did not create it

**HARD RULE — PistonCore never auto-deletes compiled HA files it discovers are orphaned.**
The compiled automation is still running in HA. The user may have wiped their volume by mistake, or restored from a partial backup, or the piston JSON may just be temporarily missing. Auto-deletion would silently kill a live automation. The user must make an explicit decision:
- **Restore:** If the user still has the piston JSON, they can reimport it and the UUID will match
- **Delete:** From the orphan entry on the piston list, the user can explicitly request deletion — PistonCore then runs the normal delete flow (Section 16 PistonCore→HA)
- **Ignore:** Leave the orphan running in HA as-is. PistonCore stops managing it.

The same pending_cleanup.json queue used for explicit user-initiated deletes handles the "Delete" action from an orphan entry. The queue is only ever populated by explicit user action, never by automated detection.

See Section 9.1 Step 3 for the full startup sequence context.

---

## 17. Test Compile / Preview Mode

Test Compile is a required feature — not optional.

* Available on every piston from the status page: `[Test Compile]` button
* Shows the full compiled YAML (or PyScript) output in a read-only code view
* Does NOT deploy to HA — purely a preview
* Compiler errors and warnings shown inline below the preview
* Template editors get live preview as they edit

**This is the only place compiled output is ever shown to the user.** The editor and status page always show PistonCore's own visual format — never raw YAML or Python.

---

## 18. Pre-Save Validation Pipeline

### On Save (always runs — no HA involvement)

Stage 1 — Internal validation:
* No triggers defined
* Action references a device not found in HA
* Global variable referenced but not defined
* Required role not mapped

Results appear as warnings/errors on the status page validation banner immediately after save.

Validation rules live in `/pistoncore-customize/validation-rules/` as JSON files — updateable without code changes.

### On Deploy (runs as a separate action after save)

Stage 2 — Compile to temporary strings in memory (not written to disk yet)

Stage 3 — Syntax check:
* Native HA Script pistons: `yamllint` against compiled strings
* PyScript pistons: `py_compile` syntax check

Stage 4 — Deploy and validate:
* Write compiled files to production directories
* Call `automation.reload` and `script.reload`
* If HA rejects the file on reload, catch the error and return it to PistonCore
* The old deployed version (if any) remains active — HA does not swap in a broken file

Stage 5 — Decision:
* Reload succeeded → hash written to header, user sees success on status page
* Reload failed → HA error shown in validation banner in plain English, old version still running

### Compiler Error/Warning Contract

The compiler always returns a structured result:

```json
{
  "yaml": "...",
  "errors": [
    {
      "level": "error",
      "code": "TRIGGER_FORMAT_MISMATCH",
      "message": "Human readable explanation shown directly to the user",
      "context": "which piston block caused this"
    }
  ],
  "warnings": []
}
```

* `level`: `"error"` | `"warning"` | `"info"`
* `code`: machine-readable for future localization
* `message`: plain English, shown directly to the user
* `context`: optional, identifies the piston block

The UI has one error display component that handles all compiler output uniformly.

### Background Compile / Debounce

* Compilation runs as a background job — never blocks the UI thread
* Deploy to HA is separate from save — user explicitly deploys
* Show compile status indicator in editor: Compiling... / Compiled ✓ / Error ✗
* Auto-deploy debounce window: 2 seconds after last change (off by default)

### Save Pipeline — Confirmed Flow

1. Frontend validates piston has a name — if empty, stop and highlight the field
2. Frontend sends piston JSON to backend via POST
3. Save button shows loading state: "Saving to PistonCore..."
4. Backend writes piston JSON to volume, runs Stage 1 validation
5. Backend returns success or failure plus any validation warnings
6. If success → navigate to status page, warnings appear in banner if any
7. If write fails → stay in editor, error banner: "Save failed — your work is preserved. Try again."

---

## 19. Safety Rules — Core Lockdown

PistonCore is architecturally forbidden from:
* Modifying `.storage/` folders
* Editing `configuration.yaml` directly
* Accessing `home-assistant_v2.db`
* Writing to any directory it did not create
* Writing to any file that does not contain its own signature header
* Calling any undocumented HA internal API

### Exception — First-Run configuration.yaml Setup

PistonCore makes one limited exception to the "no editing configuration.yaml"
rule: on startup, if the PistonCore include directives are not present in
configuration.yaml, PistonCore appends them. This is a setup action on
PistonCore's own behalf — not interference with user config.

The two lines PistonCore adds, and only these two lines:

```
# Added by PistonCore — required for deploy to work. Do not remove.
automation pistoncore: !include_dir_merge_list automations/pistoncore/
script pistoncore: !include_dir_merge_named scripts/pistoncore/
```

Rules governing this exception:

* PistonCore checks for its own include lines on every startup. If present,
  it does nothing. If missing, it appends them. The check is idempotent.
* PistonCore never modifies any other line in configuration.yaml.
* PistonCore never removes or rewrites lines it previously added.
* This only runs if ha_config_path is configured. If the path is not set,
  the check is skipped silently.
* After adding the lines, PistonCore sets ha_restart_required: true in its
  own config. Deploying a script piston while this flag is set returns a
  clear error: "HA restart required before script pistons can be deployed —
  configuration.yaml was updated on startup. Restart HA once to complete
  setup."
* Automation pistons are unaffected by this flag — automation.reload is
  sufficient and does not require a full restart.
* PyScript pistons require no configuration.yaml change — PyScript
  auto-scans the pyscript/ directory and all subdirectories.
* The ha_restart_required flag clears automatically on the first successful
  script piston deploy, proving HA loaded the new config.

### First-Run Warning — Required

When PistonCore adds the include lines to configuration.yaml, it must
display a prominent warning in the UI that persists until a script piston
deploys successfully:

> ⚠ PistonCore has updated your configuration.yaml to register its
> automation and script folders with Home Assistant. A one-time HA
> restart is required before script pistons can be deployed.
> Automation pistons can be deployed immediately without a restart.
> [Dismiss — I will restart HA]

This warning must also appear:
* In the PistonCore log on startup when the lines are added
* At the top of the status page for any script piston while the flag is set
* In the deploy response when a script piston deploy is attempted while
  the flag is set

### Documentation Requirement

The README, setup guide, and any first-run onboarding documentation must
include this notice prominently — before any other setup instructions:

> IMPORTANT: On first startup, PistonCore will automatically add two
> lines to your Home Assistant configuration.yaml file to register its
> automation and script folders. A one-time Home Assistant restart is
> required after this happens before script pistons can be deployed.
> Automation pistons work immediately without a restart. You will see
> a warning in the PistonCore UI until a script piston deploys
> successfully.

---

## 20. Security

### Token Scope and Minimal Privilege

* Users should create a dedicated HA user for PistonCore with only necessary permissions — not an admin account
* PistonCore settings page shows guidance on recommended token scope during initial setup
* Long-lived token (Docker): stored in `config.json` on the volume — never logged, never sent to frontend
* Supervisor token (addon): injected via environment variable — never stored, never user-visible, never leaves the backend

### Token Rotation

* Settings page includes token rotation guidance
* Replacing a long-lived token in PistonCore settings immediately replaces it in HAClient — no restart needed

### Frontend/Backend Security Boundary — Hard Rule

**The frontend never calls HA directly.** No exceptions:
* Frontend calls PistonCore API endpoints only
* Backend proxies all HA calls and returns processed results
* Supervisor token never reaches the browser
* Any frontend fetch to an HA URL is a bug and must be treated as such in code review

---

## 21. Logging and Debugging

### Log Level — Per Piston

Set at the bottom of the editor: None / Minimal / Full.

* **None** — no logging. Saving clears the existing log.
* **Minimal** — trigger events and errors only
* **Full** — every condition checked, every action, pass/fail, timing

### Trace Mode

Toggle on status page. Test must be pressed at least once on a new piston before Trace becomes available.

v1 Trace shows:
* Run start — which trigger fired, at what time
* Any explicit `log_message` statements the user added
* Run complete — success, or the last known action before failure

Trace data arrives via `PISTONCORE_LOG` and `PISTONCORE_RUN_COMPLETE` WebSocket events. Never written to the main HA system log.

### Run Status Reporting

Compiled pistons fire a standard HA event at completion:

```yaml
- event: PISTONCORE_RUN_COMPLETE
  event_data:
    piston_id: "{{ piston_id }}"
    status: "success"
```

PistonCore listens for this event via WebSocket. HA event delivery is best-effort — the UI shows "Status unknown" rather than wrong information when an event is missed.

---

## 22. Compilation and Deployment

### Compile Targets

**Native HA Script (primary — ~95% of pistons):**

Each piston compiles to two files:
* `<ha_config>/automations/pistoncore/pistoncore_{uuid}.yaml` — automation wrapper
* `<ha_config>/scripts/pistoncore/pistoncore_{uuid}.yaml` — script body

The automation's action is a single line: `action: script.pistoncore_{uuid}`

**PyScript (fallback for addon v1, permanent for Docker):**
* `<ha_config>/pyscript/pistoncore/pistoncore_{uuid}.py`

**PyScript comment header:** Every compiled `.py` file includes a comment header listing every global variable it references. This allows PistonCore to scan the compiled folder and determine global variable usage without a database.

### Minimum HA Version

**Required: Home Assistant 2023.1 or later.**

Features establishing this floor: `repeat: for_each:`, `if: / then: / else:` in scripts, `parallel:`, `continue_on_error:`, `stop:`, `wait_for_trigger:` inside scripts.

---

## 23. Addon Architecture

### Distribution

Installed by adding the PistonCore GitHub repo URL to the HA addon store. No HACS required for the addon itself.

### Ingress and Direct Port — Both Supported

PistonCore addon supports both:
* **Default: Ingress enabled** — HA-recommended, auth handled by HA, cleaner for most users
* **Option: Direct port exposure** — for users who need direct URL access outside the HA frontend

BASE_URL handling (Section 24) covers the path prefix differences transparently. **Both paths must be tested thoroughly before release.**

### Addon Permissions — Minimum Required Only

Defined in `config.json` (addon manifest):

| Permission | Why Needed |
|---|---|
| `homeassistant` API access | Service calls and state reads |
| Filesystem access to `/config` | Writing automation and script files |
| `hassio_api` | Accessing supervisor token |

Request only what is needed, nothing more.

### First-Run Setup

**Phase 1 — Immediate:**
Addon starts, gets supervisor token automatically, connects to HA via WebSocket. User can begin building pistons immediately — no setup required.

**Phase 2 — On first deploy of a complex piston:**
If PyScript is not detected, show the setup prompt (Section 3.2). User installs PyScript via HACS, returns, deploys.

---

## 24. Frontend BASE_URL and Ingress Compatibility

### The Problem

HA addon ingress proxies traffic through a path prefix (e.g., `/api/hassio_ingress/abc123/`). Hardcoded paths like `/api/pistons` break under ingress. Fixing this after the fact across 15+ JS files is painful.

### The Solution

A single `BASE_URL` constant in the frontend. **All connections must use it — no exceptions:**

```javascript
// frontend/js/config.js
const BASE_URL = window.PISTONCORE_BASE_URL || '';
```

* Docker version: `BASE_URL` is empty string — zero change to current behavior
* Addon ingress version: `BASE_URL` is injected by the backend at page serve time

**BASE_URL applies to ALL frontend connections:**
* All `fetch()` API calls: `fetch(BASE_URL + '/api/pistons')`
* All WebSocket connections: `new WebSocket(BASE_URL.replace('http', 'ws') + '/ws')`
* Any dynamically constructed static asset paths

Any hardcoded path anywhere in frontend JS is a bug that will break under ingress.

### Ingress Testing Requirement

Testing under Docker alone is insufficient for the addon target. Before any UI feature is considered done for the addon release:
* Tested under Docker ✓
* Tested under HA addon ingress ✓

Ingress testing is a first-class development requirement, not an afterthought.

---

## 25. Export and Import

### Snapshot (green label)

Anonymized export. All entity mappings stripped. Roles and logic preserved. Safe to post publicly. New piston ID generated on import.

### Backup (red label)

Full export including entity mappings. Labeled clearly: *"For your own restore only — do not share."* Original piston ID preserved on import.

### Import Methods

* Paste JSON directly
* Paste a URL pointing to any raw JSON file
* Upload a `.piston` file
* AI-generated JSON pasted from any AI assistant

---

## 26. Volume and File Structure

### Docker Volume Structure

```
/pistoncore-userdata/
  pistons/                    piston JSON files (one per piston, named {uuid}.json)
  piston_index.json           lightweight index of all pistons — rebuilt on startup and
                              updated on every save/delete. Piston list reads this, not raw files.
                              Fields per entry: id, name, compile_target, logic_version,
                              enabled, folder, manually_edited, entity_missing, last_compiled_at,
                              stale_globals (array of global IDs whose device list changed
                              since last deploy — empty array if current)
  globals.json                global variable definitions (reference list)
  globals_index.json          piston-to-global reference index (auto-maintained)
  pistoncore.db               SQLite database — run log, entity state cache, compile index
                              (see MISSING_SPECS.md Item 7 for schema)
  device-definitions/         custom device definitions
  config.json                 PistonCore settings (ha_url, ha_token, deployment_type,
                              entity_check_interval_minutes)
  pending_cleanup.json        queued orphan cleanup operations
  logs/
    pistoncore.log

/pistoncore-customize/
  templates/
    ha_2025.x/
      automation.j2
      condition.j2
      action.j2
      manifest.json
      AI-UPDATE-GUIDE.md
  ha_api/
    ha_2025.x/
      endpoints.json
      manifest.json
      AI-UPDATE-GUIDE.md
  compiler/
    target-boundary.json    what features force PyScript — data-driven, not hardcoded
    AI-UPDATE-GUIDE.md
  validation-rules/
    internal-checks.json
    error-translations.json
    AI-UPDATE-GUIDE.md
  README.md
```

Default file behavior: container ships with defaults, copies them to volume on first launch only if files do not already exist. Container updates never overwrite user files.

### Addon File Paths

When running as an addon, PistonCore writes compiled output to:
* `/config/automations/pistoncore/pistoncore_{uuid}.yaml`
* `/config/scripts/pistoncore/pistoncore_{uuid}.yaml`
* `/config/pyscript/pistoncore/pistoncore_{uuid}.py` (if PyScript is installed)

---

## 27. v2 Runtime Engine

### Direction — Decided, Closed

**AppDaemon is ruled out.** Three fatal mismatches for PistonCore specifically:

1. **Programming model mismatch** — AppDaemon expects static Python classes. PistonCore needs dynamic pistons loaded from JSON at runtime. You end up building a runtime layer inside AppDaemon that ignores its intended model.
2. **Observability is impossible** — PistonCore must replicate WebCoRE's logs, traces, and execution visibility. You cannot get clean observability riding on top of another runtime you don't control. This single point rules out AppDaemon.
3. **Three-layer debugging** — PistonCore logic → AppDaemon → HA means users cannot tell which layer caused a failure. Unacceptable for a product targeting non-technical users.

Do not re-open this question.

### What to Build (v2)

**Slim purpose-built async runtime.** Scope:
* HA WebSocket client with reconnection logic
* Event router (state_changed, time, etc.)
* Execution engine that walks piston JSON
* Scheduler for delays and time triggers
* Estimated build time: 2–4 weeks of focused backend work

**Optional spike approach (reduces risk):** Use AppDaemon briefly as a throwaway spike to validate event model and test piston execution concepts. Learn from it. Then build the real thing from scratch. The spike is disposable — not the foundation.

### State Rehydration on HA Restart

Defined now so the v2 runtime is designed with defined behavior from the start:
* On HA reconnect, runtime resubscribes to all active piston triggers
* In-flight executions at time of disconnect are abandoned — not resumed
* Pistons that were mid-delay restart from the beginning on next trigger
* State cache is rebuilt from HA on reconnect, not from memory
* UI shows reconnection status clearly

### PyScript in v2

* Addon: PyScript deprecated in v2 (native runtime replaces it), removed in v3
* Docker: PyScript permanent — no deprecation planned
* Piston JSON does not change between v1 and v2 — same file, different output target

---

## 28. V1 Core Feature Set

**Statement types:**
If Block, With/Do block, Only When restrictions, Wait (fixed duration or until time), Wait for state with timeout, Set variable, Repeat loop, For Each loop, While loop, Switch, Do Block, On Event (PyScript only), For Loop, Break (PyScript only), Cancel All Pending Tasks (PyScript only), Log message, Call another piston, Control another piston / HA automation, Stop

**Editor features:**
Structured document editor, inline ghost text insertion, WebCoRE-matching keywords, execute/end execute rendering wrapper, define/end define block for piston variables, drag and drop block reordering (within block only), Global Variables drawer, Simple/Advanced mode toggle (default Advanced), compile target indicator (updates live), complexity indicator for PyScript requirement, per-statement cog in wizard (TEP/TCP/Execution Method), Snapshot and Backup export, duplicate piston, import from JSON/URL/file, status page with Test Compile button, save returns to status page, run log with plain English detail, log level per piston, log message action, trace mode via WebSocket, test required before trace, test always labeled Live Fire ⚠ with confirmation dialog, pause/resume, versioned Jinja2 compiler templates (user-replaceable), device picker with type-to-filter search, unknown device fallback define screen, dynamic capability-driven multi-step wizard, full operator set (see WIZARD_SPEC.md), copy AI prompt button, automatic validation on save, pre-deploy validation pipeline (yamllint + py_compile + HA reload validation), file signature and hash system, failure notification toggle, My Device Definitions screen, BASE_URL frontend standard, PyScript detection with setup prompt, background compile with status indicator

---

## 29. Out of Scope for V1

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
* `range` trigger operator
* Cross-block drag and drop
* Variable list types (Dynamic list, String list, etc.)
* Expression editor for advanced value inputs
* Full step-through simulator / dry run
* Location mode restrictions
* Timer statement (evaluate overlap with HA scheduler before including)
* v2 native runtime engine (addon target only, post-v1)
* Docker product (after addon is solid)

---

## 30. Independence Guarantee

### Native HA Script pistons
* Run forever after PistonCore uninstall ✅
* Not affected by PyScript removal ✅
* Require HA 2023.1 or later ⚠

### PyScript pistons
* Run after PistonCore uninstall ✅ (PyScript still installed)
* Stop if PyScript is removed ❌

### Global variables (helper-backed)
* Still readable by compiled pistons after PistonCore uninstall ✅
* Helper values persist in HA after uninstall ✅
* Helper management stops after uninstall ⚠ (values stay, management UI gone)

---

## 31. AI Instruction Files

PistonCore maintains two categories of AI instruction file. Neither is optional — both must be kept current as the project evolves.

### Category 1 — Per-Folder AI Update Guides

Every folder in the customize volume that contains user-editable files ships with an `AI-UPDATE-GUIDE.md`. These are for technical users who want an AI to help them update that folder's files. Each guide is self-contained — the AI should be able to do the task after reading only that guide plus the file it is updating.

**Required guides and what each must contain:**

`pistoncore-customize/templates/ha_YYYY.x/AI-UPDATE-GUIDE.md`
- What HA version this template set covers
- The full fat compiler context object (copy from Section 14) — what variables the template can use
- How to hand-verify compiled YAML output against real HA behavior before submitting
- The manifest.json format and required fields
- What not to change (signature header format, file naming)

`pistoncore-customize/ha_api/ha_YYYY.x/AI-UPDATE-GUIDE.md`
- What HA version this API definition covers
- The endpoints.json format with all fields explained
- Where to find current HA REST API documentation
- How to verify an endpoint change is real (link to HA developer docs)
- The manifest.json format

`pistoncore-customize/compiler/AI-UPDATE-GUIDE.md`
- What target-boundary.json controls and why
- The full field spec for each entry in forces_pyscript
- How to verify that a feature genuinely has no native HA equivalent before removing it
- How to record when HA adds native support (ha_version_added_native field)

`pistoncore-customize/validation-rules/AI-UPDATE-GUIDE.md`
- The error object shape (copy from Section 18)
- How to add a new internal check to internal-checks.json
- How to add a plain English translation to error-translations.json
- Error code naming conventions (SCREAMING_SNAKE_CASE, descriptive)

### Category 2 — User-Facing AI Prompt Files

These are prompts a user copies from the PistonCore UI and pastes into any AI assistant to get help with a specific task. They live in the container (not the customize volume) and are served by the backend. They are updated when the piston JSON format or template format changes.

```
pistoncore/prompts/
  write-a-piston.md       Help an AI generate a Snapshot JSON piston for import
  migrate-from-webcore.md Help an AI convert a WebCoRE screenshot to Snapshot JSON
```

**write-a-piston.md** must contain:
- The complete Snapshot JSON format (Section 6.2 of this document)
- The full list of valid statement types and their JSON schemas
- The condition object schema including display_value/compiled_value split
- The operator reference (from WIZARD_SPEC.md)
- Role placeholder rules — device_map keys with empty arrays
- compile_target rules (when to use pyscript vs native_script)
- System variables reference
- A complete working example in Snapshot JSON format
- Plain English instructions to the user: "paste this into any AI, describe what you want, then import the JSON"
- Plain English instructions on import: "use the Import button, PistonCore will walk you through mapping devices"
- A note that entity IDs must never appear — the AI uses role names, user maps them on import

**migrate-from-webcore.md** must contain:
- Instructions to paste the prompt plus a WebCoRE screenshot into the AI
- The same Snapshot JSON output format as write-a-piston.md
- WebCoRE → PistonCore statement type mapping table
- Role extraction rules (curly brace devices from WebCoRE display become role names)
- Handling for WebCoRE-specific features with no PistonCore equivalent (flag as comment)
- The same import instructions as write-a-piston.md

**Both prompts are specced in AI_PROMPT_SPEC.md before being written.**
Write the prompts only after the Snapshot JSON import flow is tested end-to-end.

**UI entry point:** Main menu page has an "AI Help" button that opens a modal. The modal shows the prompt text in a read-only textarea with a `[Copy to clipboard]` button and plain English instructions. See FRONTEND_SPEC.md for the modal spec.

**Future prompts to add (not v1 scope):**
- Help an AI update a compiler template for a new HA version
- Help an AI write a PyScript template
- Help an AI explain what an existing piston does

### COMPILER_SPEC.md — Current (updated through Session 24)

COMPILER_SPEC.md has been updated through Session 24. Field names, global_variables
structure, and output format are current. The companion references and old schema_version
fields noted as stale in earlier sessions have been removed. Compiler coding proceeds
against the current spec.

---

## 32. Open Items Blocking Coding

1. **COMPILER_SPEC.md** — current as of Session 55 (v1.2). No longer blocking. Update for_each list_role resolution before B-1 coding.
2. **AI-REVIEW-PROMPT.md** — update to reflect current architecture before next external review.
3. **settings / end settings block contents** — research WebCoRE behavior, define before implementing.
4. **AI Prompt feature** — AI_PROMPT_SPEC.md must be rewritten for logic_version 2 (device_map references are stale). write-a-piston.md cannot be written until AI_PROMPT_SPEC.md is updated. Blocked until Snapshot format (Section 6.10) is stable.
5. **Which-interaction step feasibility** — evaluate PyScript context tracking in sandbox before building the wizard step.
6. **Timer statement** — evaluate overlap with HA scheduler before including in v1.
7. **on_event wizard warning** — wizard must display blocking behavior warning when user adds on_event block. See STATEMENT_TYPES.md Section 10.
8. **on_event user documentation** — "PistonCore can't do this because HA can't do it" section needed in user docs covering on_event async limitation.
9. **STATEMENT_TYPES.md action schema** — Section 1 (action) still shows old `devices: [role_name]` format. Must be updated to `role + entity_ids` before W-S8 wizard coding. Same for Section 19 condition object schema (lacks `entity_ids` field).
10. **MISSING_SPECS.md Items 7 and 8** — reference old device_map terminology. Must be updated before storage/missing-device handler work.
11. **HA_LIMITATIONS.md Section 3** — references device_map and has_missing_devices. Should be updated. Not blocking any immediate session.
12. **WIZARD_SPEC.md globals picker** — still says "deferred until globals implemented." Globals are now implemented (Sessions 48–50). Update before W-S8.
13. **for_each list_role architecture** — how does for_each resolve its device list under logic_version 2? Decision needed before B-1 compiler coding. See Section 6.11 note above.

---

## 33. Standing Questions and Validation Workflow

### Logic Validation Rule — Before Any New Spec or Code

Any new technical approach, HA behavior assumption, or logic choice must be validated against real HA behavior BEFORE it is written into a spec or implemented in code.

What must be validated:
* How HA returns state values for any entity type
* Whether a native HA script feature works the way the spec assumes
* Whether a WebSocket API command returns the data structure expected
* Any compiler output pattern that has not been hand-verified against real HA YAML

When bringing in feedback from other AIs: other AIs can be confidently wrong about HA-specific behavior. Validate all HA behavior claims against real HA docs before acting on them.

---

## 34. Development Log

### Sessions 1–7 — April 2026
Project conceived. Design document written. Backend scaffolded. React frontend replaced with vanilla JS. Full design review. Native HA Script confirmed as primary target. Globals architecture defined. DESIGN.md v0.9, COMPILER_SPEC.md v0.1, WIZARD_SPEC.md v0.3.

### Sessions 8–14.5 — April 2026
Design, backend, Docker, frontend scaffold. Editor + wizard rewrites. Variable wizard, define block, mode persistence, condition picker, if_block unified mechanism, wizard structural bug fixes.

### Session 15 — April 2026
Wizard improvements: larger modal, device search panel, domain caps map, context-aware value inputs, aggregation banner. HA settings page with WebSocket connection. Real devices loading. Domain filter + label disambiguator in backend.

### Session 16 — April 2026
Architecture pivot. HACS companion dropped — replaced by direct REST API. Primary target shifted to native HA Addon. Docker secondary. PyScript kept for v1 and permanently for Docker. Native runtime engine planned for v2 — AppDaemon ruled out per item 28. 28 design decisions documented. No code written.

### Session 17 — May 2026
All four repo docs rewritten to v1.0 incorporating all 28 design decisions. Data-driven compile target boundary added. Hybrid-permanent architecture decision locked. AI instruction file system defined. write-a-piston.md prompt file created. COMPILER_SPEC.md and AI-REVIEW-PROMPT.md flagged as stale. No code written.

### Session 18 — May 2026
Major architecture decision: internal piston format changed from piston_text-as-truth to structured JSON-as-truth. Decision driven by reviewing the WebCoRE source code (piston.module.html, app.js) — WebCoRE used structured JSON internally and rendered display text from it. That model is proven at scale and is the right foundation for PistonCore's compiler. Key decisions locked: (1) Internal format is structured JSON — wizard writes typed statement objects, editor renders display text from them, compiler reads structured data directly. (2) Share/export/AI format was set to piston_text at this session — superseded in Session 22 (see below). (3) wizard_context concept retired. (4) Render functions are a frontend responsibility. DESIGN.md updated. COMPILER_SPEC.md, WIZARD_SPEC.md, FRONTEND_SPEC.md flagged for update in next session. Statement type reference document to be created before compiler work begins.

### Session 19 — May 2026
All spec work. No code written. DESIGN.md: compile target ownership rule, missing device rule split, global variable model summary. COMPILER_SPEC.md: boolean/state value quoting, wait_for_trigger timeout, trigger/platform distinction, continue_on_error, trigger id field. HA_LIMITATIONS.md: Section 8 and 9 updated. FRONTEND_SPEC.md: AST/pure projection invariant, wizard_context retirement notice, AI Import dialog spec. PISTON_FORMAT.md: new canonical piston JSON schema file created.

### Session 20 — May 2026
WIZARD_SPEC.md and FRONTEND_SPEC.md cleanup. Five changes to WIZARD_SPEC: output invariant section, __type/system_var bug fix, interaction field added to condition schema, operator reference clarifying note, transient state note. One change to FRONTEND_SPEC: Friendly Name Resolution on Piston Load section added. PISTON_FORMAT.md: value_to field added to condition schema.

### Session 21 — May 2026
Full code audit against specs. Major field name alignment pass across wizard.js, editor.js, status.js, compiler.py, api.js. All old type names (with_block, if_block, repeat_loop, etc.) replaced with spec names (action, if, repeat, etc.). All old field names (then_actions, else_actions, p.actions, __type, target_role, etc.) replaced with spec names (then, else, statements, type, devices, etc.). wizard.js _buildConditionNode rewritten to produce spec-compliant condition JSON including binary sensor display/compiled value split, role name storage, value_to for between operators, correct 8-char hex ID format. Compiler device_map lookups updated to handle list values. Condition compiler compatibility shim added for flat vs nested condition format. api.js companion comment removed.

### Session 22 — May 2026
Major share format decision: piston_text retired as v1 share/AI format. Snapshot JSON (structured JSON with empty device_map) is now the single share format for community sharing, AI generation, and WebCoRE migration. Reasons: (1) eliminates the fragile piston_text parser on import, (2) large LLMs generate structured JSON reliably when given a clear schema, (3) Snapshot JSON is already the internal format — no conversion needed on import, only role mapping. piston_text deferred to v2 as a possible human-writable convenience format. Two AI prompt files planned: write-a-piston.md (generate new piston) and migrate-from-webcore.md (convert WebCoRE screenshot). Both target Snapshot JSON output. AI_PROMPT_SPEC.md created to define requirements before prompts are written. DESIGN.md Sections 6.2–6.7 rewritten. FRONTEND_SPEC.md import dialog updated. Session prompt updated.

### Session 24 — May 2026
compiler.py field name alignment pass — all field names brought in line with PISTON_FORMAT.md and COMPILER_SPEC.md. Fixed: devices/ha_service/parameters in with_block; duration+duration_unit in wait; conditions array in if/while/repeat/wait_for_state; list_role+variable+statements in for_each; start+end+counter_variable+statements in for; description+statements in do; expression+cases[].statements+default in switch; variable+value operand object in set_variable; message operand object in log_message. New _resolve_operand() helper added. PYSCRIPT_COMPILER_SPEC.md created and all 6 gaps resolved: on_event schema defined (blocking wait — HA limitation documented), global_variables array structure defined in COMPILER_SPEC.md Section 7, list_role/until_conditions/cancel_pending_tasks/switch schemas confirmed. STATEMENT_TYPES.md Section 10 (on_event) rewritten with full schema, limitation notice, wizard warning requirement, and ON_EVENT_BLOCKING compiler warning. Stale piston_text and COMPILER_SPEC stale references cleaned up across DESIGN.md and STATEMENT_TYPES.md.

### Session 25 — May 2026
Full session of spec and task management. No code written. External Design Claude review (AIReviews5-6-26.md) processed and all action items incorporated. TASKS.md: all Stage 1 and 2 Upload lines updated with required spec files; S1-7 Compiler Bug Fixes (2 sessions) added — session 1 before S1-5 to fix triggers and condition indentation before any HA write; S1-6 Fat Compiler Context Assembly added between S1-5 and S1-7 session 2; S3-2 Deferred Validation Testing added after S3-1; S4-15 Operational Hardening added; S4-0 reordered with Error States Inventory first; S4-10 write-a-piston.md blocker noted; Gap A–G from Grok repo review incorporated. MISSING_SPECS.md: Items 13 (Fat Compiler Context), 14 (Time Condition Compiler Path), 15 (write-a-piston.md) added. PISTON_FORMAT.md: "Two Formats" intro corrected to reference Snapshot JSON; piston_text field added to wrapper table with warning block and "fail loudly on render failure" rule; "What This Format Is Not" updated. HA_LIMITATIONS.md: state value quoting (Bug 11), wait_for_trigger timeout (Bug 3), parallel branch continue_on_error (Bug 12) moved from "already handled" to "known gaps" — were incorrectly marked as handled. DESIGN.md: duplicate Section 32 heading fixed (Standing Questions → Section 33, Development Log → Section 34). STATEMENT_TYPES.md Section 16 header confirmed present — was already fixed, no change needed.

### Session 57 — May 2026 (Spec Audit)
Full cross-document audit. No code. Key findings and changes:

**DESIGN.md → v1.3:**
- Section 8: Added Multi-Entity Compilation section confirming HA natively supports entity_id arrays in both triggers (state trigger) and action targets. No expansion needed. Conditions still require Jinja2 template for any/all/none. Aggregation mapping table added. This is a locked compilation decision.
- Sections 9.1 and 9.2 added: Full startup sequence spec (6 steps: HA connect, piston index build, orphan scan, manual edit detection, entity validation, configuration.yaml check) and scheduled background checks (entity validation every 30 min, HA health every 60 sec, orphan check on reconnect).
- Section 13 expanded: Manual edit detection now specifies startup behavior (informational scan → ⚠ flag) distinct from deploy behavior (interactive diff → Overwrite/Cancel). Hash stored in both file header and compile_index SQLite table.
- Section 16 expanded: Added HA→PistonCore orphan scan direction (startup scan for compiled files whose UUID is not in the piston index).
- Sections 6.10 and 6.11 added: Snapshot format under logic_version 2 fully specced (node rules, role uniqueness, wrapper). Import flow redesigned for logic_version 2 (5-step role collection → mapping dialog → entity_ids population). MISSING_SPECS.md Item 21 resolved.
- Section 26: Volume structure updated — piston_index.json and pistoncore.db added.
- Section 32: Open items updated — 13 items, stale entries corrected.

**Audit findings documented in session chat (not yet fixed — need their own sessions):**
- STATEMENT_TYPES.md Section 1 (action) still uses old devices/role_name format — fix before W-S8
- STATEMENT_TYPES.md Section 19 condition schema lacks entity_ids — fix before W-S8
- MISSING_SPECS.md Items 7 and 8 reference device_map terminology — fix before S4-2
- AI_PROMPT_SPEC.md entirely written against old device_map model — fix before AI prompt work
- WIZARD_SPEC.md globals picker still says "deferred" — fix before W-S8
- HA_LIMITATIONS.md Section 3 references device_map and has_missing_devices — fix anytime
- for_each list_role architecture under logic_version 2 undefined — decision needed before B-1

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
