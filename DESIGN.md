# PistonCore Design Document

**Version:** 1.0
**Status:** Authoritative — All architecture decisions locked for v1 development
**Last Updated:** May 2026

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
* **Piston text is the permanent master format.** The editor saves its own text directly — what the user sees is what is stored. A tiny JSON wrapper holds only the fields the system needs without opening the piston (id, compile_target, device_map, has_missing_devices). The compiler is the only translator — it reads the plain English piston text and produces HA YAML at deploy time. The editor never translates. Nothing drifts.
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

### The Core Rule — Simple, No Exceptions

**The piston text is saved exactly as the editor displays it. What the user sees is what is stored. What is stored is what opens in the editor. It never drifts.**

The saved format has two parts:

1. **A tiny wrapper** — just what the system needs to manage the piston without opening it
2. **piston_text** — the exact text content of the editor, including the header block

```json
{
  "id": "d4e2f9a1",
  "compile_target": "pyscript",
  "has_missing_devices": false,
  "device_map": {},
  "piston_text": "/** New Door / Window Chime */\n/** id: d4e2f9a1 */\n/** mode: restart */\n\ndefine\n  device Doors = Back Door, Front Door, ...;\n  string Message;\nend define;\n\nexecute\n  if\n    Any of {Doors}'s or {Windows}'s contact changes to open\n  then\n    do Set variable {Message} = {\"\"};\n  end if;\nend execute;"
}
```

That's it. Nothing else.

### Why This Is the Right Model

* **No drift possible** — the editor saves its own text, reads its own text back. Nothing is reconstructed from parts.
* **No translation layer** — the editor never translates. Only the compiler translates, once, at deploy time.
* **New statement types just work** — when a new statement type is added to the editor, it writes to `piston_text` and works immediately. No schema update, no new fields, no migration needed.
* **Sharing is identical to storage** — there is no separate shareable format. The piston text IS the shareable format. Paste it anywhere.
* **AI generation is simple** — generate text that looks like the editor display. Import it. Done.

### What the Wrapper Contains

The wrapper outside `piston_text` contains only what the system needs without parsing the text:

| Field | Purpose |
|---|---|
| `id` | Immutable UUID — never changes, never derived from name |
| `compile_target` | `"native_script"` or `"pyscript"` — for compilation routing |
| `has_missing_devices` | Flag for ⚠️ indicator on piston list |
| `device_map` | Role → entity ID mapping, filled on import by user |

Everything else — name, mode, author, created date, modified date, build number — lives in the header block inside `piston_text`, exactly as WebCoRE stored it.

### What Each Consumer Does

| Consumer | What it does |
|---|---|
| Editor | Reads `piston_text`, displays it directly, writes it back on save |
| Compiler | Reads `piston_text`, parses it, translates to HA YAML |
| Importer | Loads `piston_text` into editor, user maps `device_map` roles |
| AI generator | Generates text matching editor display format |
| Piston list | Reads wrapper only — never touches `piston_text` |

### The Compiler Is the Only Translator

The compiler reads the plain English piston text and translates everything:
* Friendly labels → HA state values ("Open" → "on")
* Role names → entity IDs via `device_map`
* Plain English times → 24hr format
* System variable expressions → HA template syntax
* Plain English operators → HA condition syntax
* Global variable references → inlined entity ID lists

The editor never translates. The piston list never translates. Only the compiler translates, and only at deploy time.

### Piston Header Block

Every piston begins with a header block inside `piston_text`. PistonCore extends WebCoRE's header format:

```
/********************************************************/
/* Piston Name                                          */
/********************************************************/
/* Author   : Jeremy                                    */
/* Created  : 7/12/2025, 7:17:46 AM                    */
/* Modified : 11/7/2025, 6:22:17 PM                    */
/* Build    : 3                                         */
/* id       : d4e2f9a1                                  */
/* mode     : restart                                   */
/********************************************************/
```

The `id` and `mode` fields in the header are authoritative. The wrapper `id` field matches — it exists only so the system can read the piston ID without parsing the full text.

### Piston Identity Rule — Core Invariant

* Every piston gets a UUID on creation — **this UUID never changes**, even if the piston is renamed
* HA automation ID is always `pistoncore_{uuid}`
* HA automation filename is always `pistoncore_{uuid}.yaml`
* HA script key and entity ID is always `pistoncore_{uuid}` — callable as `script.pistoncore_{uuid}`
* HA script filename is always `pistoncore_{uuid}.yaml`
* PyScript file is always `pistoncore_{uuid}.py`
* The piston slug (name-derived) is used ONLY for the automation `alias:` field
* All HA artifact names derive from UUID — never from piston name

### Versioning

`logic_version` in the wrapper tracks the piston text format version. If the format ever needs a structural change, migration reads the old text and rewrites it to the new format. The `piston_text` stays human readable throughout.

* If `logic_version` is missing, treat as v1
* If `logic_version` is from the future, warn and refuse to load — never silently corrupt


## 7. Variables

### 7.1 Global Variables

Defined once at the PistonCore level. Available to every piston.

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

PistonCore tracks which pistons reference each Device or Devices global. When the device list changes, PistonCore flags affected pistons as stale and shows a banner on the piston list page:

*"'Smoke Detectors' was updated — 3 pistons need redeployment to pick up your changes."*
`[Redeploy All]` `[Review]`

PistonCore maintains a persistent index at `/pistoncore-userdata/globals_index.json` mapping each global variable ID to the list of piston IDs that reference it. Updated on every successful compile.

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

Trigger types:
* Device or entity state change — `changes`, `changes to`, `changes from`, `changes from X to Y`
* Numeric — `rises above`, `drops below`
* State with duration — `changes to [value] and stays for [duration]`
* Button/momentary device — `gets [event]`, `gets any`
* Time — a specific time of day
* Sunrise / Sunset with optional offset in minutes
* Time pattern — every X minutes, every X hours
* HA event — any Home Assistant event fires
* Webhook — an incoming webhook call
* Called by another piston
* Manual only — only runs when Test is pressed

### 10.4 Conditions

Checked after a trigger fires. If conditions are not met the piston stops silently.

Operators are plain English. Device states use native HA values. Multiple conditions grouped with AND or OR — written in full, never symbols.

### 10.5 Action Tree

Top-to-bottom sequence of statements. The entire action tree is wrapped in an `execute / end execute;` block — this is a rendering wrapper only, not a data node in the JSON.

**execute / end execute is a rendering artifact.** The `actions` array in the piston JSON IS the execute block body. The frontend adds the wrapper rendering only.

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

On deploy, if the existing file's hash does not match what PistonCore expects, it stops and shows a diff of exactly what changed, then asks: **Overwrite** or **Cancel**.

PistonCore only operates on files that contain its own signature. It never touches any other file.

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

## 15.6 Missing Device Handling

### Core Rule — Non-Negotiable

**Pistons always run with whatever devices are available.** If a device in a role
is missing from HA, the piston compiles and runs against the remaining devices.
Batteries die, sensors get replaced, life happens. A piston that breaks because
one device out of four is temporarily unavailable is worse than useless.

### Detection — V1

On every HA connect, PistonCore checks if any entity in any piston's device_map
still exists in HA. Simple loop against the entity list already fetched.

If any entity is missing:
- Set `has_missing_devices: true` flag on the piston record
- Show ⚠️ icon next to the piston name on the piston list page
- Show a banner on the status page naming the specific missing device by its
  last known friendly name — this data already exists in change tracking and
  debug page storage, no new data model needed

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

### What Never Happens

- A piston never fails to compile because a device is missing
- A piston never stops running because a device is missing
- The user is never blocked from deploying — warned, not blocked

---

## 16. Orphan Automation Cleanup

When a piston is deleted in PistonCore:
1. Call HA to delete the automation (`DELETE /api/config/automation/config/{automation_id}`)
2. Delete the PyScript file if one exists
3. Call `automation/reload`
4. If HA is offline, queue the cleanup in `pending_cleanup.json` and retry on next connect

On every HA reconnect, PistonCore checks `pending_cleanup.json` and retries any queued cleanup operations.

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
  pistons/                    piston JSON files
  globals.json                global variable definitions (reference list)
  globals_index.json          piston-to-global reference index (auto-maintained)
  device-definitions/         custom device definitions
  config.json                 PistonCore settings (ha_url, ha_token, deployment_type)
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
  write-a-piston.md       Help an AI generate a piston JSON for import
```

**write-a-piston.md** must contain:
- The complete piston JSON format spec (Section 6 of this document)
- The full list of valid statement types
- The operator reference (from WIZARD_SPEC.md)
- Plain English instructions to the user: "paste this into any AI, then describe what you want"
- Plain English instructions on what to do with the result: "paste the JSON into PistonCore using the Import button on the main menu"
- A note that entity IDs must never appear — the AI should use role names, the user maps them on import

**UI entry point:** Main menu page has an "AI Help" button that opens a modal. The modal shows the prompt text in a read-only textarea with a `[Copy to clipboard]` button and plain English instructions. See FRONTEND_SPEC.md for the modal spec.

**Future prompts to add (not v1 scope):**
- Help an AI update a compiler template for a new HA version
- Help an AI write a PyScript template
- Help an AI explain what an existing piston does

### COMPILER_SPEC.md and AI-REVIEW-PROMPT.md — Stale, Must Update

**COMPILER_SPEC.md** was written against the old architecture (references companion, uses old schema_version, assumes hardcoded compile target boundary). It is the primary blocker for compiler coding. It must be updated before any compiler work begins. Do not write compiler code against the current COMPILER_SPEC.md.

**AI-REVIEW-PROMPT.md** references the old single-Docker architecture. It should be updated to reflect the two-product architecture and the closed decisions from the 28-item list so external AI reviewers don't relitigate them.

---

## 32. Open Items Blocking Coding

1. **COMPILER_SPEC.md** — must be updated before compiler work begins. See Section 31 for what is stale.
2. **AI-REVIEW-PROMPT.md** — update to reflect current architecture before next external review.
3. **settings / end settings block contents** — research WebCoRE behavior, define before implementing
4. **AI Prompt feature** — write-a-piston.md content, UI modal (see FRONTEND_SPEC.md)
5. **Which-interaction step feasibility** — evaluate PyScript context tracking in sandbox before building the wizard step
6. **Timer statement** — evaluate overlap with HA scheduler before including in v1

---

## 32. Standing Questions and Validation Workflow

### Logic Validation Rule — Before Any New Spec or Code

Any new technical approach, HA behavior assumption, or logic choice must be validated against real HA behavior BEFORE it is written into a spec or implemented in code.

What must be validated:
* How HA returns state values for any entity type
* Whether a native HA script feature works the way the spec assumes
* Whether a WebSocket API command returns the data structure expected
* Any compiler output pattern that has not been hand-verified against real HA YAML

When bringing in feedback from other AIs: other AIs can be confidently wrong about HA-specific behavior. Validate all HA behavior claims against real HA docs before acting on them.

---

## 33. Development Log

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

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
