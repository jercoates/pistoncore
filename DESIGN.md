# PistonCore Design Document

**Status:** Authoritative — architecture and design rationale. The *why* behind PistonCore.
**Scope:** This document owns architecture, philosophy, and design rationale. It does **not** own data schemas or wizard/editor mechanics — those live in the specs below and DESIGN.md only points to them. Project status, progress, and build tracking are **not** here — that's the README's job.

**Single source of truth — one place per topic, everything else points here:**

| Topic | Owner |
|---|---|
| Architecture, philosophy, design rationale | **DESIGN.md** (this document) |
| Piston JSON — field shapes, array order, storage rules, load-bearing name/entity_id rule | **PISTON_JSON_STRUCTURE_MAP.md** |
| Wizard + editor — build flows, device picker, condition builder, render rules, task model | **EDITOR_WIZARD_SPEC.md** |
| Screens, navigation, page layouts, import/export UI, WebSocket protocol | **FRONTEND_SPEC.md** |
| What HA can/cannot reproduce vs WebCoRE; native-vs-PyScript routing | **HA_LIMITATIONS.md** |
| Compiler behavior (JSON → HA YAML/PyScript) | **COMPILER_SPEC.md** (rewrite pending JSON freeze) |
| Project status, progress, build tracking | **README** (not a design concern) |

> **Conceptual anchor (not a spec):** `WebCoRE_Cloud_Side_Reference.docx` explains the WebCoRE data model PistonCore replicates (JSON-as-contract, the operand type system, name-as-lookup-key portability, editor-as-constrained-JSON-builder). It is framing only. PistonCore is **not** cloud-based — it has no broker, no install handshake, no token exchange; it stores locally and talks to HA directly. Ignore the reference's cloud/hub-bridge apparatus.

---

## 1. What Is PistonCore?

PistonCore is an open-source visual automation builder for Home Assistant, designed to feel immediately familiar to anyone who has used WebCoRE on SmartThings or Hubitat. It lets you build complex automations — called **pistons** — through a structured UI using dropdowns populated directly from your actual HA devices, without ever writing YAML or Python manually.

**PistonCore is not a home automation platform. It is a tool for building automations on top of one.**

It does not add devices, manage integrations, or extend HA's capabilities in any way. It reads what HA already has, gives you a better way to write logic against it, and compiles that logic to native HA files that run independently of PistonCore.

**PistonCore does not need to be running for your automations to work.** Compiled files are standard HA automation files. If you remove PistonCore tomorrow, every piston you built keeps running — as long as the relevant runtime remains in place: native HA script pistons keep running on HA itself (until HA schema drift eventually breaks an old output), and PyScript pistons keep running as long as PyScript stays installed and supported. Independent of PistonCore — not immune to the platforms underneath. See §30.

---

## 2. Core Philosophy

* **No required central server.** PistonCore runs locally as a native HA addon or on any Docker host. Nothing depends on servers controlled by the project maintainers.
* **Automations are yours.** Compiled files are standard HA files. PistonCore is the source of truth for your pistons — the compiled files on HA are just the output.
* **PistonCore manages only the files it creates.** Your existing hand-written automations, scripts, and YAML files are safe — PistonCore writes pistons only into its own subfolders and overwrites only files carrying its own signature. The one necessary exception: it appends two include lines to `configuration.yaml` so HA loads the PistonCore folders (see §19). It touches nothing else in that file and no other file it didn't create.
* **Compiled files are compiler-owned artifacts.** Files written by PistonCore to HA directories are deployment artifacts, not source files. They may be replaced wholesale on recompile. The piston JSON is always the source of truth — never the compiled HA file. Users who hand-edit compiled files will be warned at next deploy via the hash check.
* **Structured JSON is the internal master format.** Every piston is stored as a structured JSON object. The wizard writes structured data for every statement. The editor renders display text from that data — text is always generated from the JSON, never the other way around. This is the same proven model WebCoRE used. The compiler reads structured JSON directly — no text parsing required. Sharing and AI import use the Snapshot format — structured JSON with role name placeholders and no entity IDs. No text parsing required on import. Nothing drifts because the structured JSON is always the single source of truth.
* **Shareable by design.** Pistons are stored and shared as plain JSON. Paste them anywhere — a forum post, a GitHub Gist, a Discord message. Import from a URL or paste directly. No account required, no server involved.
* **AI-friendly from day one.** The piston JSON format is simple and fully documented so AI assistants can generate valid pistons from a plain English description.
* **Open and community driven.** MIT licensed. Anyone can host, fork, modify, or contribute.
* **Familiar to WebCoRE users.** The piston concept, structure, terminology, keywords, and logging behavior are intentionally close to WebCoRE so experienced users can pick it up immediately.
* **Plain English everywhere, icons plus labels for universal actions.** Logic operators and descriptive text are always written in plain English. Buttons use an icon paired with a plain English label — never an icon alone.
* **Minimum footprint in HA.** PistonCore touches only what is absolutely necessary and only what the user explicitly confirms during setup.
* **Incomplete but correct is better than complete but wrong.** The wizard must prefer showing fewer options over showing incorrect options. PistonCore is allowed to not know something. It is not allowed to guess wrong.
* **The compiler absorbs Home Assistant churn.** When Home Assistant changes YAML syntax, script structure, or field naming, PistonCore recompiles existing pistons against the updated templates. Users never manually migrate automations — that is PistonCore's job. The piston JSON stays stable; the emitted HA artifacts change to match whatever the current HA version expects.
* **Frontend never touches HA directly.** All HA communication goes through the PistonCore backend only. The frontend calls PistonCore API endpoints. The backend calls HA. The supervisor token (addon) and long-lived token (Docker) never reach the browser. This is a security invariant — any frontend code that fetches from HA directly is a bug, not a feature.

---

## 3. Two Deployment Forms — Docker First, Addon as the Goal

PistonCore runs in two forms that share everything that matters: the same frontend, the same backend core, the same piston JSON format, and the same compiler. They differ only in deployment packaging and auth method. The `HAClient` abstraction (§4) hides that difference so the rest of the codebase behaves identically either way.

**The goal is the addon. Docker is how we get there — it is built and tested first, and ships first.** Docker is the working development and validation vehicle; the addon is the target being built toward. The exact end-state relationship between the two forms is not fixed and does not need to be — what matters is only that core functionality is proven in Docker and that the addon is the objective.

### Docker form (built and tested first)

* **Runs on:** Unraid, NAS, any Docker host, Docker-based HA installs (homeassistant/home-assistant container)
* **Auth:** Long-lived HA token entered once in PistonCore settings, stored in `config.json` on the volume
* **File writing:** Calls HA REST API directly with the token — no companion needed
* **Distribution:** Docker Hub, Unraid Community Apps, GitHub
* This is a full product, not a lite version. (Users running HA in the homeassistant/home-assistant container can't install HA addons — no supervisor exists — so the Docker form is the only path for them regardless.)

### Addon form (the goal)

* **Runs on:** HA OS, HA Supervised
* **Install:** User adds the PistonCore GitHub repo URL to the HA addon store, installs like any other addon
* **Auth:** Gets the HA supervisor token automatically from the environment — zero user setup
* **File writing:** Writes directly to `/config/automations/pistoncore/` and `/config/pyscript/pistoncore/`, calls `automation/reload` via REST API
* **No HACS companion needed. No separate integration needed.**
* **Distribution:** GitHub addon repository

### Dev Environment

Development happens in Docker on Unraid. Core functionality is built and validated in Docker first; addon packaging builds on that foundation. Addon-specific concerns (ingress/BASE_URL, supervisor auth — see §4, §23) are handled as the addon form is brought up, not retrofitted blindly.

---

## 3.1 Compiler Output Targets — Extensible List

The compiler selects an output target based on piston complexity. This is an extensible list — adding a new output target later is an addition, not a rewrite, and the piston JSON does not change when one is added.

### v1 Output Targets

| Piston Type | Output Target | Notes |
|---|---|---|
| Simple | Native HA YAML automation + script | Primary target — ~95% of pistons |
| Complex | PyScript `.py` file | For break, cancel_pending_tasks, on_event |

PyScript is a supported output target for complex pistons. No document language should imply it is deprecated.

> **Footnote — Possible future improvements (not planned, nothing depends on these).** Anything beyond v1 is a possible direction, not a commitment. A PistonCore-native runtime to replace PyScript for complex pistons, file-based device groups, and similar enhancements are ideas a future contributor *could* pursue — they are explicitly not on the author's build path; the complexity of a self-built automation engine is a deliberate non-goal. v1 is designed to stand complete on its own: simple pistons compile to native HA YAML and run independently of PistonCore (see §30 on what that does and doesn't guarantee), and PyScript covers complex pistons. No v1 behavior assumes any of these improvements will ever exist.
>
> *Known dead end for anyone reviving the native-runtime idea:* **AppDaemon was evaluated and ruled out.** It expects static Python classes while PistonCore needs pistons loaded dynamically from JSON; clean observability (the WebCoRE-style logs and traces PistonCore exists to provide) is impossible riding on a runtime you don't control; and a PistonCore→AppDaemon→HA stack makes failures impossible for non-technical users to localize. A native runtime, if ever built, would have to be a slim purpose-built async engine, not a layer on AppDaemon. Don't re-litigate this without a prototype that disproves the observability problem.

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

### Hybrid Output Model

**Simple pistons compile to native HA YAML; complex pistons compile to PyScript.** That PistonCore's output targets are native HA YAML and PyScript is a defining architectural commitment — the compiler, the independence model, and everything downstream is built on it.

The reasoning:

* Native YAML pistons are owned by HA. Traces work in HA natively. They keep running after PistonCore is removed, and HA keeps improving them. There is no upside to routing simple pistons through any PistonCore-controlled runtime.
* A runtime replacing YAML for simple pistons would make those automations depend on PistonCore running — automations that don't need it. That defeats the independence the YAML target gives you (see §3.1 footnote on why a native runtime is a non-goal).

| Piston Type | Output |
|---|---|
| Simple | Native HA YAML automation + script |
| Complex | PyScript `.py` file |

The simple/complex split itself (where the boundary falls) can be revisited if v1 testing shows it causes confusion or breakage — what's committed is the two output targets, not the exact placement of the line between them.

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

## 6. Piston JSON — The Master Format

> **What's authoritative in this section.** Sections 6.2 and 6.3 are SHORT POINTERS to the
> current full specs in 6.10 (Snapshot format) and 6.11 (Import flow). Do not treat 6.2/6.3
> as authoritative on their own. For the canonical field reference, schemas, the device→entity
> load-bearing rule, and a worked example, see **PISTON_JSON_STRUCTURE_MAP.md** (the schema
> authority) and **REFERENCE_PISTON_V2.json** (a correct, hand-verified example piston).
> Where this section and PISTON_JSON_STRUCTURE_MAP.md ever disagree, PISTON_JSON_STRUCTURE_MAP.md wins.

### Two Formats — One Clear Purpose Each

**Internal stored format:** Structured JSON — every statement is a typed data object. The wizard writes structured data. The editor renders display text from that data. The compiler reads structured JSON directly. This is the working format — the source of truth for everything PistonCore does with a piston.

**Shared/export/AI format (Snapshot JSON):** Structured JSON with role name placeholders and empty entity_ids on nodes. Used for AI import, community sharing, and WebCoRE migration. The same structured JSON the compiler and editor already use — just with entity IDs stripped from nodes. See Section 6.10.

These two formats serve different purposes. The internal format is for the compiler and editor. The Snapshot format is for humans, AI, and community sharing.

### 6.1 Internal Stored Format

The internal piston file contains a wrapper plus a `statements` array of structured JSON objects. This is the same proven model WebCoRE used, adapted for Home Assistant.

**The statements array is a nested tree.** Control flow nodes own their children directly — `then`, `else`, `statements`, `else_ifs`, and `cases` contain child statement objects embedded inline. There are no ID references between statements. The tree structure is explicit and self-contained.

**The editor must render every well-formed piston JSON correctly.** For malformed nodes (missing required fields, unknown type, future logic_version), it renders a clearly-flagged placeholder row that preserves the node and lets the user repair or delete it. The editor must never silently drop, duplicate, or corrupt nodes.

**The `statements` array is what the compiler reads. The editor renders display text from it. Nothing is ever parsed from display text during normal operation.**

For the complete wrapper schema, field reference, and a hand-written example see PISTON_JSON_STRUCTURE_MAP.md.

---

### 6.2 Snapshot Format — The Share and AI Format

Snapshot format is defined in DESIGN.md Section 6.10. See that section for the full spec.

Summary: A Snapshot is the internal piston JSON with `entity_ids` arrays set to `[]` on all condition and action nodes. Role labels are preserved. No entity IDs. Used for AI generation, community sharing, and WebCoRE migration. The same format for all three sources.

This is what `write-a-piston.md` teaches AI assistants to generate.
This is what `migrate-from-webcore.md` teaches AI assistants to produce from a WebCoRE screenshot.

---

### 6.3 Import Flow — Role Mapping

Import flow is defined in DESIGN.md Section 6.11. See that section for the full spec.

Summary: PistonCore detects Snapshot vs Backup by checking whether entity_ids are populated on nodes. For Snapshots, it walks the statement tree, collects unique role names, and presents a one-role-at-a-time mapping dialog. The user selects real HA devices for each role. entity_ids are written to all matching nodes. New UUID assigned on import.

---

### 6.4 Wrapper Fields

The authoritative wrapper field reference is in PISTON_JSON_STRUCTURE_MAP.md.

Current wrapper fields (logic_version 2):

| Field | Internal | Snapshot | Backup | Purpose |
|---|---|---|---|---|
| `id` | ✅ | new on import | ✅ preserved | Immutable UUID |
| `name` | ✅ | ✅ | ✅ | Piston list display |
| `description` | ✅ | ✅ | ✅ | Optional description |
| `folder` | ✅ | ✅ | ✅ | Folder name or null |
| `mode` | ✅ | ✅ | ✅ | single/restart/queued/parallel |
| `enabled` | ✅ | ✅ | ✅ | boolean |
| `logic_version` | ✅ | ✅ | ✅ | Statement format version (must be 2 — v1 retired) |
| `ui_version` | ✅ | ✅ | ✅ | Editor layout version |
| `compile_target` | ✅ | ✅ | ✅ | native_script or pyscript (compiler-owned cache) |
| `variables` | ✅ | ✅ | ✅ | Variable definitions (device vars hold friendly names) |
| `triggers` | ✅ | ✅ | ✅ | Top-level trigger condition objects (`is_trigger: true`) |
| `conditions` | ✅ | ✅ | ✅ | Top-level piston-level condition objects |
| `restrictions` | ✅ | ✅ | ✅ | Top-level restriction condition objects |
| `statements` | ✅ | ✅ | ✅ | The action tree — structured statement objects |

**Triggers, conditions, and restrictions are top-level wrapper arrays — not nested inside
`if` blocks.** This matches the editor's section layout and the frontend storage model
The compiler reads `triggers` directly to build
the automation trigger block; it does not walk `statements` looking for `is_trigger` nodes.
See Section 10.3 and PISTON_JSON_STRUCTURE_MAP.md "Trigger / Condition / Restriction Storage".

**`logic_version` and `ui_version` are separate and change independently.**
A UI change bumps `ui_version` only. A new statement type bumps `logic_version` only. Never
collapse them into one field. **logic_version 1 is retired — no v1→v2 migration; reject
non-v2 pistons on load.**

---

### 6.5 What Each Consumer Does

| Consumer | Reads | Does |
|---|---|---|
| Editor | `statements` | Renders display text from structured data |
| Wizard | `statements` | Reads structured data to pre-populate edit, writes structured data on save |
| Compiler | `triggers`, `conditions`, `restrictions`, `statements` (entity_ids on nodes) | Reads typed objects directly — no role lookup, no device_map. Reads top-level trigger/condition/restriction arrays directly. |
| Import dialog | Snapshot or Backup JSON | Detects format, runs role mapping for Snapshots, skips for Backups |
| Piston list | `piston_index.json` | Reads index — never touches raw piston files for list display |
| Snapshot export | `statements` + wrapper | Replaces entity_ids with `__placeholder_<domain>__`, keeps role_tokens, strips compiled_value and runtime fields, replaces device-type variable initial_value with `["__fill_devices__"]`. Full spec in Section 6.10. |
| Backup export | Everything | Full format — entity_ids preserved on all nodes |

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
  "role_tokens": ["binary_sensor.front_door", "binary_sensor.back_door"],
  "entity_ids": ["binary_sensor.front_door", "binary_sensor.back_door"],
  "aggregation": "any",
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
JSON directly with entity_ids stripped from nodes.

The authoritative catalog of render functions (renderComparison, renderTask,
renderOperand, and the rest) and their exact output patterns lives in
EDITOR_WIZARD_SPEC.md §2. This section owns only the principle: **display text
is always projected from structured data, never stored.**

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
* These change independently — never collapse into one field.
* **`logic_version` must be 2.** logic_version 1 is fully retired — no migration. If a piston is missing `logic_version` or has any value other than 2, reject it on load with a clear error. Never silently coerce to any version.
* If `logic_version` is from the future (higher than the current supported version): warn and refuse to load — never silently corrupt.
* `ui_version` follows the same future-version rule.

---

### 6.10 Snapshot Format — Logic Version 2 (Current)

> This section defines the current Snapshot format for logic_version 2 pistons.
> PISTON_JSON_STRUCTURE_MAP.md Field Lifecycle table is the authoritative field-by-field reference.
> This section defines the rules and placeholder format. Both must agree.

**What a Snapshot is:** A piston exported for sharing, AI generation, community distribution, or the built-in library. Entity IDs are replaced with domain placeholders. All other data is preserved. The import wizard uses the preserved data to guide the user through device mapping.

**What a Snapshot is NOT:** A backup. Use Backup export for personal restore — it preserves all entity_ids intact and should never be shared publicly.

#### Placeholder Format — Single Definition

Placeholders replace entity IDs on export. The import wizard detects them to know which nodes need mapping.

| Situation | Placeholder written |
|---|---|
| Node had real entity IDs | `__placeholder_<domain>__` where domain is the HA domain prefix of the first entity_id (e.g. `light`, `binary_sensor`, `media_player`) |
| Node had empty entity_ids (unfinished piston or AI-generated) | `__placeholder_unknown__` |
| Time condition / non-device condition (entity_ids always `[]`) | Leave `[]` — no placeholder needed, these nodes are not device nodes |

**Examples:**
- `entity_ids: ["light.living_room"]` → `entity_ids: ["__placeholder_light__"]`
- `entity_ids: ["binary_sensor.front_door", "binary_sensor.back_door"]` → `entity_ids: ["__placeholder_binary_sensor__"]`
- `entity_ids: []` (unfinished node) → `entity_ids: ["__placeholder_unknown__"]`
- `entity_ids: []` (time condition with `role: "time"`) → `entity_ids: []` (unchanged)

One placeholder per node — never one per original entity. The placeholder carries the domain only; the import wizard handles quantity via the picker.

#### Piston Variable (Define) Export Rules

Device-type variables (`var_type: "device"` or `"devices"`) have their `initial_value` list of friendly names replaced with a marker:

```json
{ "initial_value": ["__fill_devices__"] }
```

This positively signals the import wizard that this variable needs the user to fill it. Non-device variables (string, number, boolean, etc.) are exported as-is — their values are universal and survive import unchanged.

#### What Is Kept and What Is Replaced

| Field | Snapshot behavior |
|---|---|
| `role` | **Kept** — human-readable label used by import dialog for context |
| `role_tokens` | **Kept** — tells import wizard whether a node is a physical device pick, a piston variable reference, or a global reference. The import wizard reads this to route each node to the correct mapping step. Never strip this field. |
| `entity_ids` | **Replaced** with `__placeholder_<domain>__` or `__placeholder_unknown__` (see table above) |
| `display_value` | **Kept** — helps the user and AI understand what the condition means |
| `compiled_value` | **Stripped** — installation-specific HA state strings have no meaning on another instance |
| `attribute`, `attribute_type`, `device_class`, `operator`, `aggregation` | **Kept** — needed by the import wizard to show context and to re-resolve entity_ids correctly after mapping |
| `variables` array | Device-type vars get `initial_value: ["__fill_devices__"]`. All other fields and all non-device vars kept as-is. |
| `id` (piston wrapper) | **Stripped** — new UUID assigned on import |
| `log`, `last_ran`, `last_result`, `last_variables`, `compile_check`, `stale`, `deployed` | **Stripped** — runtime fields |
| All other wrapper fields | **Kept** |

#### Snapshot Wrapper Example

```json
{
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
  "triggers": [ ... ],
  "conditions": [],
  "restrictions": [],
  "statements": [ ... ]
}
```

#### Snapshot Node Examples

**Physical device condition node:**
```json
{
  "id": "cond_a3f8c2d1",
  "is_trigger": true,
  "role": "Front Door",
  "role_tokens": ["binary_sensor.front_door"],
  "entity_ids": ["__placeholder_binary_sensor__"],
  "aggregation": "any",
  "attribute": "contact",
  "attribute_type": "binary",
  "device_class": "door",
  "operator": "changes to",
  "display_value": "Open",
  "group_operator": "and"
}
```

**Global variable action node:**
```json
{
  "id": "stmt_b7e2f941",
  "type": "action",
  "role": "@Speakers_All",
  "role_tokens": ["@Speakers_All"],
  "entity_ids": ["__placeholder_media_player__"],
  "tasks": [ ... ],
  "description": null,
  "disabled": false
}
```

**Piston variable action node:**
```json
{
  "id": "stmt_c3d5a221",
  "type": "action",
  "role": "Motion_Sensors",
  "role_tokens": ["Motion_Sensors"],
  "entity_ids": ["__placeholder_binary_sensor__"],
  "tasks": [ ... ],
  "description": null,
  "disabled": false
}
```

**Time condition (no change):**
```json
{
  "id": "cond_c1d4e823",
  "is_trigger": false,
  "role": "time",
  "role_tokens": [],
  "entity_ids": [],
  "operator": "is between",
  "value_from": "08:00:00",
  "value_to": "23:00:00",
  "group_operator": "and"
}
```

---

### 6.11 Snapshot Import Flow — Logic Version 2

> This section defines the import flow for logic_version 2 Snapshots.
> The full import dialog UI spec is in FRONTEND_SPEC.md Import Dialog section.
> This section owns the logic; FRONTEND_SPEC.md owns the screen layout.

#### Step 1 — Validate and Detect

User pastes Snapshot JSON (or imports from URL/file). PistonCore validates:
- Valid JSON
- Has required wrapper fields (`logic_version`, `statements`, `name`)
- `logic_version` must be 2 — reject anything else with a clear error message
- If `logic_version` is from the future: warn and refuse to load

**Snapshot vs Backup detection:** Check whether any condition, action, or for_each node has a placeholder in `entity_ids` (any entry matching `__placeholder_*`). If placeholders are found → Snapshot flow. If all nodes have real entity_ids → Backup flow (skip to Step 6).

#### Step 2 — Collect What Needs Mapping

Walk the entire piston tree (triggers, conditions, restrictions, statements recursively). Collect three separate lists:

**List A — Piston variables needing device fill:**
Any variable in `variables[]` where `var_type` is `"device"` or `"devices"` AND `initial_value` is `["__fill_devices__"]`.

**List B — Global references:**
Any node where `role_tokens` contains a token starting with `@`. Collect unique `@name` values.

**List C — Direct device nodes:**
Any node where `entity_ids` contains a placeholder AND `role_tokens` does NOT contain a variable name (no-dot token) AND does NOT contain an `@` token. These are nodes where the user picked physical devices directly without using a variable. Collect unique `role` values within this group.

Order of presentation does not matter — the three lists run in whatever order feels natural to present (variables first is recommended since they affect many nodes).

#### Step 3A — Fill Piston Variables (List A)

For each device-type variable in List A, show the device picker:

```
┌─────────────────────────────────────────────────────┐
│  Fill variable $Motion_Sensors             [✕ Skip] │
├─────────────────────────────────────────────────────┤
│  Pick the devices for this variable.                │
│  It is used in 3 places in this piston.             │
│                                                     │
│  [Device picker — search and multi-select]          │
│  (soft-filtered by most common attribute across     │
│   consuming nodes — full list always accessible)    │
│                                                     │
│            [Skip]        [← Back]  [Next →]         │
└─────────────────────────────────────────────────────┘
```

**Picker soft-filter:** Walk all nodes whose `role_tokens` includes this variable name. Collect their `attribute` fields. Find the most common attribute. Map that attribute to its HA domain (e.g. `motion` → `binary_sensor`, `illuminance` → `sensor`, `brightness` → `light`). Soft-filter the picker to show devices of that domain first, with the full list still accessible below. If no common attribute can be determined, show the full list unfiltered.

On commit: write the selected device friendly names to `initial_value` on the variable. All nodes referencing this variable will have their `entity_ids` re-resolved after all mapping steps complete (Step 5).

#### Step 3B — Match Global References (List B)

For each unique `@name` in List B, show a matching step:

```
┌─────────────────────────────────────────────────────┐
│  Match global @Speakers_All                [✕ Skip] │
├─────────────────────────────────────────────────────┤
│  This piston references @Speakers_All.              │
│  Match it to one of your globals:                   │
│                                                     │
│  [@my_speakers          ▼]                          │
│  ─────────────────────────                          │
│  @announcement_speakers                             │
│  @living_room_speakers                              │
│  @my_speakers                                       │
│  ─────────────────────────                          │
│  + Create new global "@Speakers_All"                │
│                                                     │
│            [Skip]        [← Back]  [Next →]         │
└─────────────────────────────────────────────────────┘
```

- Dropdown shows ALL globals from the user's `globals.json` — no type filtering. Users name globals however they want.
- "Create new global" at the bottom creates the global using the piston's `@name` as the name, then auto-selects it.
- On match: rewrite every occurrence of the original `@name` in `role_tokens` throughout the piston to the matched global's name. entity_ids for those nodes are re-resolved from the matched global after all mapping steps (Step 5).
- Skip: leave the `@name` as-is in `role_tokens`. entity_ids stay as placeholder. User can fix in editor.

#### Step 3C — Map Direct Device Nodes (List C)

For each unique `role` in List C (direct physical device picks, no variable), show the device picker:

```
┌─────────────────────────────────────────────────────┐
│  Map devices — "Front Door"                [✕ Skip] │
├─────────────────────────────────────────────────────┤
│  Used as: trigger (changes to Open)                 │
│  Device type: binary_sensor (door)                  │
│                                                     │
│  [Device picker — filtered to binary_sensor]        │
│  Selected: [front door ×]                           │
│                                                     │
│            [Skip]        [← Back]  [Next →]         │
└─────────────────────────────────────────────────────┘
```

**Picker filter:** Read the `__placeholder_<domain>__` value from any node in this role group. Filter the picker to that domain. If `__placeholder_unknown__`, show full unfiltered list.

On commit: write selected entity_ids directly to every node whose `role` matches this role name and whose `role_tokens` does not contain a variable or global token.

#### Step 4 — Review and Import

After all three lists are processed (or skipped), show a summary before final import:

```
┌─────────────────────────────────────────────────────┐
│  Ready to import                                    │
├─────────────────────────────────────────────────────┤
│  ✓ $Motion_Sensors — 2 devices selected             │
│  ✓ @Speakers_All → matched to @my_speakers          │
│  ✓ Front Door — mapped                              │
│  ⚠ Back Door — skipped (will need mapping later)    │
│                                                     │
│                         [← Back]  [Import]          │
└─────────────────────────────────────────────────────┘
```

Skipped items import with placeholder values still in place. The editor shows ⚠ on those nodes. The user can fix them by editing each node in the wizard.

#### Step 5 — Resolve entity_ids

After all mapping steps:
1. For each filled piston variable: run the same re-resolution as `_reResolveVariableUses` — walk every consuming node, read its `attribute`, resolve the attribute-bearing entity from the variable's new `initial_value` device list, write to `entity_ids` on the node.
2. For each matched global: same resolution from the matched global's device list.
3. For direct device nodes: already written in Step 3C.

#### Step 6 — Assign New ID and Save

- Generate new UUID for the piston (Snapshots never preserve the original ID)
- Set `created_at` and `modified_at` to now
- Save to `/pistoncore-userdata/pistons/{new_uuid}.json`
- Update piston index
- Open in editor — user sees the mapped piston

#### Backup Import (No Mapping)

Backup files have real entity_ids on all nodes — no placeholders, no mapping dialog. Detected in Step 1. Skip Steps 2–5 entirely. Show the ID choice dialog (restore original / import as new copy) and go directly to Step 6.

---

## 7. Variables

### 7.1 Global Variables

Defined once at the PistonCore level. Available to every piston.

**Global Variable Model — Summary**

PistonCore uses two different mechanisms for global variables depending on type, with PyScript as the fallback for edge cases the native model cannot handle cleanly:

* **Device and Devices globals** — compile-time only. Entity IDs are baked directly into each compiled YAML file that references the global. No runtime lookup, no shared external store. When the global's device list changes, affected pistons are flagged stale and must be redeployed.
* **Non-device globals** (Text, Number, Yes/No, Date/Time) — backed by HA input helpers with a `pistoncore_` prefix. Compiled pistons read these live via HA template syntax at runtime. PistonCore creates and manages the helpers — the user never touches them directly.
* **Edge cases over threshold** — if a global variable usage pattern cannot be expressed cleanly in native YAML (e.g., a device global used in a loop with dynamic iteration), the piston is a candidate for PyScript compilation per `target-boundary.json`.

This model was a deliberate decision. Device globals being compile-time eliminates runtime race conditions entirely. Non-device globals being HA helpers means they work in HA's native UI, HA history, and HA automations written outside PistonCore. Re-open only if real testing shows the compile-time bake-in causes a concrete problem (e.g. redeploy-all at scale is too slow) — and even then the path forward is the `variable_refs` escape hatch, not runtime group lookup.

**Storage — two-part model:**

* PistonCore maintains a reference list of all global variables in `globals.json` on the volume. This is the management record — display name, type, internal UUID.
* Non-device types (Text, Number, Yes/No, Date/Time) are pushed to HA as native input helpers via REST API. The helper entity ID uses a `pistoncore_` prefix derived from the variable's internal UUID: `input_text.pistoncore_{uuid}`. Compiled pistons read helpers live via HA template syntax — no PistonCore involvement at runtime.
* Device and Devices globals are **compile-time values only**. When a piston is deployed, device entity IDs are baked directly into the compiled YAML as a literal inline list. There is no runtime group lookup and no shared external file. This eliminates any possible bugs from referencing a shared folder or variable store at runtime.

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
of piston IDs that reference it. Updated at piston save — backend scans `role_tokens`
for @-prefixed entries and updates the index.

### Global Variables — Maintenance Strategy

Global variables are primarily a **maintenance strategy**, not just a convenience feature.
When a device is added to a group, updating one global updates every piston that references
it on next redeploy. This is how installations with many pistons stay manageable.

**Global management UI is a core workflow — not a power-user feature.** It must be fast
and accessible, not buried in advanced settings.

### Standard Global Naming Convention

Sample pistons and community-shared pistons use these standard global names so that setting
up globals once covers all related pistons. Users who create globals with these exact names
can import any sample piston without remapping.

| Global Name | Type | Used By |
|---|---|---|
| `@Battery_Devices` | Devices | Low Battery Check |
| `@Smoke_Detectors` | Devices | CO/Smoke Alert |
| `@Water_Sensors_All` | Devices | Water Leak Shutoff |
| `@Water_Sensors_Away` | Devices | Water Leak Shutoff |
| `@Water_Sensors_Always` | Devices | Water Leak Shutoff |
| `@Presence_Sensors` | Devices | Water Leak, Presence pistons |
| `@Speakers_All` | Devices | CO Alert, Chime |
| `@Announcement_Sonos` | Device | Door Chime |
| `@Notifications_Push` | Device | All alert pistons |
| `@Notification_Text` | Device | All alert pistons |
| `@Alert_Lights` | Devices | CO Alert |
| `@Shut_off_Valve` | Device | Water Leak Shutoff |

### Sample Piston Global Reference Rules

Sample piston Snapshot JSON uses the global name as the role name (e.g., `"role": "@Smoke_Detectors"`).
At import time, when the user reaches the role mapping step for a role that matches an existing
global name, PistonCore pre-fills the device picker with that global's entity_ids. The user
can accept or override.

When a referenced global doesn't exist at import time, show an inline prompt in the role
mapping dialog: *"'@Smoke_Detectors' is referenced as a global in this piston, but no global
with that name exists yet. Create it now?"* `[Create Global]` `[Map manually]`. If Create:
opens the global creation flow inline. After creation, the device picker is pre-filled from
the new global.

### Global Name Validation Rules

Enforced in the UI at creation time — not a soft warning:
- Must start with `@` (always prepended — user types only the name portion)
- After the `@`: lowercase letters, numbers, underscores only. No spaces, no uppercase.
- No duplicate names (case-insensitive)
- Maximum 50 characters (including the `@`)

### Where the Maintenance Story Is Communicated

- Tooltip on the Global Variables section header in Settings: *"Globals let you update a device list once and redeploy all pistons that use it — no hunting through individual pistons."*
- Ghost text in the define block: *"Tip: use global variables for devices that appear in multiple pistons."*
- BEST_PRACTICES.md in the repo

### Global (device-list) edit behavior — owned by FRONTEND_SPEC.md

Device globals are named device lists that span multiple pistons. Editing one (adding or removing a device) is a targeted change to those device entries in the affected pistons — not a restructure — and requires those pistons to be resaved and redeployed to take effect. The save-time behavior, the user's choice between automatic and manual update, and all related UI live in **FRONTEND_SPEC.md** (globals move in and out of the editor, so they are a frontend concern). Not specified here.

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

List variants (Dynamic list, Text list, etc.) are out of scope for v1.

**Device and Devices variables always show the friendly name, never the entity ID.**

**Variable naming conventions — enforced throughout the UI:**
- `@variableName` — global variables. The `@` prefix is always shown in the editor, define block, variable picker, and expressions.
- `$variableName` — local piston variables and system variables. The `$` prefix is always shown.
- These prefixes are not optional decoration — they are part of the variable name as displayed to the user, matching WebCoRE exactly.

---

## 8. Device and Entity Model


> **⭐ Load-bearing rule (the contract everything depends on).** Variables and globals store
> device NAMES (friendly names) — never entity IDs. The friendly name is the lookup key: it's
> how PistonCore asks HA for a device's current entity IDs, pulled live every time. Nodes
> (condition / action / for_each / trigger) store the resolved attribute-bearing entity ID,
> one per device, for the chosen function (illuminance condition on 2 devices -> the 2
> *_illuminance entities, not battery/motion/temp). Resolution happens at the node, at commit,
> because the same variable can feed different attributes in different statements. Only nodes
> hold entity IDs; variables/globals never do. Full spec: PISTON_JSON_STRUCTURE_MAP.md, the
> load-bearing rule section; worked example / diff anchor: REFERENCE_PISTON_V2.json.


### The Picker — Capability-Organized

The user always works in friendly-name terms and never sees an entity ID in any screen. The picker is organized **by capability**, not by device or entity ID: the user expresses intent ("a contact sensor's state," "turn on these lights"), and the resolution to concrete entity IDs happens at the node at commit time per the load-bearing rule above. Capability and attribute lists are fetched live from HA — never a hardcoded list PistonCore maintains. The capability vocabulary the picker reads (`webcore_vocab.json`) is runtime data.

The picker's concrete behavior — its capability-loading pipeline, search, missing-device indicator (⚠ interactive deselectable rows), notify-target section, backend forwarding, and edit-load reconciliation for offline devices — is owned by **EDITOR_WIZARD_SPEC.md §8** and is not restated here. This section owns only the model: capability-organized, friendly-name-facing, entity IDs resolved at the node.

### WebSocket API — Required Commands

All device, entity, capability, trigger, condition, and service data is fetched via the HA WebSocket API. The REST API is used only for simple one-off calls (automation/reload, file writes, version check) that do not require a persistent connection.

Key WebSocket commands the builder depends on:
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
* The builder never crashes or shows incorrect options — always degrades to showing less rather than showing wrong

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

**This compilation approach is grounded in how HA actually handles multi-entity triggers (verified against HA docs, May 2026). It would change if HA's multi-entity behavior changes in a future version.**

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

### Entity State Subscription vs Polling — Decision

**PistonCore uses polling only for entity validation. It does not subscribe to `state_changed` events.**

Rationale: The goal of entity validation is to detect when an entity_id no longer exists in the HA registry — not to track its current state. The entity registry changes infrequently (device renamed, integration removed, device deleted). A 30-minute poll is more than adequate for this purpose. Subscribing to every `state_changed` event for every entity across all deployed pistons would produce enormous WebSocket traffic for no benefit — the state values themselves are not what PistonCore is tracking.

**What polling covers:**
- Entity validation every 30 minutes (Section 9.2 above) — checks entity_id still exists in registry
- HA connection health every 60 seconds — ping/pong on the WebSocket

**What subscribing covers:**
- `entity_state_cache` updates — PistonCore DOES subscribe to `state_changed` events, but only for entities that are already tracked (i.e., referenced in deployed pistons). This subscription is used solely to keep `entity_state_cache` current so that when an entity goes missing, PistonCore can show its last known friendly name in the warning message. It is not used for validation.

**Subscription list management:**
- On startup: subscribe to `state_changed` for all entity_ids found across all deployed piston nodes (condition, action, for_each). This is the initial tracked set.
- On successful piston deploy: add any new entity_ids from that piston to the subscription list.
- On piston delete: remove entity_ids that are no longer referenced by any other deployed piston.
- On HA WebSocket reconnect: re-subscribe to the full tracked set. The subscription does not survive a reconnect — it must be re-established every time the connection is restored.

**For Device/Devices globals:** PistonCore does NOT subscribe to state changes for global entity_ids to detect when to prompt for redeploy. The global device list only changes when the user edits it in PistonCore — that edit triggers the stale flag directly (Section 7.1). No external subscription needed.

**Summary — ha_client.py responsibilities:**
- Subscribe to `state_changed` for tracked entities → update `entity_state_cache` only
- Poll entity registry every 30 minutes → run entity validation
- Ping WebSocket every 60 seconds → maintain connection health
- Re-subscribe on reconnect → restore tracked entity subscription list

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

One or more triggers, built with the same dialog pattern as conditions and actions.

The model — load-bearing and owned here: triggers, conditions, and restrictions are **top-level sibling arrays** on the piston wrapper (`triggers`, `conditions`, `restrictions`), alongside the action tree (`statements`). A trigger is a condition-shaped object carrying `is_trigger: true`; that flag — not position, not operator-name guessing — is what makes it a trigger. The compiler reads the top-level `triggers` array directly to build the automation's trigger block; it never walks `statements` hunting for trigger nodes.

This is deliberately distinct from an `if` block's own inline `conditions` array (branch logic inside the action tree). Piston-level trigger/condition/restriction arrays and an if-block's branch conditions are separate things.

In the editor, triggers render with a ⚡ indicator, projected from the `is_trigger` flag — never parsed from text. The builder sets `is_trigger` based on which section the user clicked and writes to the matching top-level array.

Field shapes for trigger/condition objects are owned by **PISTON_JSON_STRUCTURE_MAP.md** (§3–§5). The catalog of trigger operators and value-input types is owned by **EDITOR_WIZARD_SPEC.md** and the `webcore_vocab.json` runtime data — not enumerated here, so there is one place to change them.

### 10.4 Conditions

Checked after a trigger fires; if conditions are not met the piston stops silently. Operators are plain English, device states use native HA values, and groups read in full words (All / Any / None) — never symbols. Group-operator surface and operator filtering are owned by EDITOR_WIZARD_SPEC.md §6.

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

### UI Rules

1. No pictograms for logic. AND/OR, equals, greater than — always written in plain English.
2. No entity IDs ever visible to the user.
3. All dropdowns populated from live HA data.
4. Sections are collapsible with plain English labels.
5. Errors are plain English.
6. Buttons use icon plus plain English label. Never icon alone.
7. Automatic validation on save.
8. Compiled output is never shown to the user in the editor or status page.

### Simple / Advanced Mode Toggle

A single global toggle, **defaulting to Advanced**. The intent: Simple mode narrows the surface to the most common building blocks and hides piston variables for newcomers; Advanced exposes everything — piston variables, all types, loops, wait-for-state, per-statement execution settings. Switching modes never destroys data.

The exact mechanics (localStorage key, precisely which controls each mode hides) are owned by EDITOR_WIZARD_SPEC.md §1.3.

### Compile Target / Complexity Indicator

The compile target (Native HA Script or PyScript) is a compiler-owned value set automatically on every save — the user never sets or sees it as an editable field. It is shown on the Test Compile / debug page, not in the editor. The editor shows only a PyScript *requirement* notification: when a statement is added that forces PyScript, an inline notification explains why:

*"This piston now requires PyScript compilation."*

For Docker users building complex pistons: show a subtle indicator that PyScript must be installed via HACS for deployment. Informational only — does not block building. (The live compile-target badge was removed from the editor; only the PyScript-required notification remains there.)

### Addon vs Docker Feature Flags

The backend reports `deployment_type: "addon" | "docker"` in the config response. The frontend uses this to conditionally show or hide relevant UI:

* **Addon:** Supervisor token is automatic — no token entry UI shown
* **Docker:** Token entry field shown in settings
* **PyScript requirement indicator:** Shown for complex pistons on Docker
* Feature flags are informational — the editor never blocks building based on deployment type

---

## 12. The Condition, Trigger, and Action Builder

When a user clicks ghost text or edits an existing statement, a builder dialog opens. Triggers, conditions, and actions share **one dialog pattern** — the same machinery renders all three, because a trigger is a condition shape with a flag (see PISTON_JSON_STRUCTURE_MAP.md).

The architectural commitments that make this work — and that DESIGN.md owns as *why*:

- **Live from HA, never cached.** Each choice's options are generated from HA at build time via WebSocket. PistonCore keeps no device-capability database of its own; the capability vocabulary it reads (`webcore_vocab.json`) is runtime data, not hardcoded lists.
- **Friendly names in, entity IDs at commit.** The user only ever sees and picks friendly names and capabilities. Entity IDs are resolved at the moment of commit and stored on the node — never shown, never stored on variables. This is the load-bearing rule (PISTON_JSON_STRUCTURE_MAP.md §0 / load-bearing rule section).
- **Plain-English sentence.** The dialog builds a readable English sentence as the user progresses; no pictograms, no operators-as-symbols.
- **Edit isolation.** Editing an existing statement works against an isolated copy and only writes back on an explicit commit, so a cancelled edit changes nothing.
- **Never two dialogs stacked.** Composite inserts (e.g. an if-block) resolve their condition first, then insert — one dialog at a time.

**All concrete mechanics live in EDITOR_WIZARD_SPEC.md and are not restated here:** dialog layout and sizing, the capability-organized device picker, the group operator surface (All/Any/None), comparison-operator filtering by attribute type, timed/past-tense operands, when-true/when-false sub-blocks, the task command picker, the commit bracket and scratch-buffer contract, and the "Add more" / re-arm primitive. That document is authoritative for how the builder behaves; this section is authoritative only for *why* it is shaped this way.

---

## 13. File Signature and Manual Edit Detection

Every compiled file written by PistonCore includes a signature header:

```
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: a3f8c2d1 | pc_version: 1.0 | pc_hash: [hash of compiled content]
```

The hash covers all file content below the two header lines. PistonCore overwrites only files that contain its own signature. The sole exception is the one-time `configuration.yaml` include-line append described in §19 — it touches no other file it did not create.

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
2. In the `compile_index` SQLite table (`file_hash` column) — lets startup scan compare without reading every file's content, only the header line

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

> Note: there is no `device_map` in the context object. Entity IDs
> are read directly from condition and action nodes. The authoritative context object
> spec is COMPILER_SPEC.md.

```python
{
    "piston":             { ... },   # Full piston JSON including statements
    "entity_states":      { ... },   # entity_id → current state/attributes from HA
    "services":           { ... },   # available services for referenced domains
    "ha_version":         "2025.6",  # detected HA version string
    "pistoncore_version": "1.0",
    "global_variables":   [ ... ],   # all defined globals — see COMPILER_SPEC.md
    "piston_variables":   [ ... ],   # variables defined in this piston's variables[] array
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

## 15.5 Editor Render Functions

The render-from-structure principle is stated in §6.6: the editor never stores display text; it projects plain-English display from structured statement data, and the same functions feed the status page's read-only script panel. The backend never renders — it reads and writes structured JSON only.

The authoritative render-function catalog and output patterns live in **EDITOR_WIZARD_SPEC.md §2**; statement schemas live in **PISTON_JSON_STRUCTURE_MAP.md**. Not restated here.

Snapshot export is structured JSON, not rendered text and not piston_text (retired) — see §6.10.

---

## 15.6 Missing Entity Handling

Under logic_version 2, entity IDs live directly on condition, action, and for_each nodes. There is no device_map or role-to-entity lookup. Missing entity detection works as follows:

### At Compile Time — MISSING_ENTITY Error

When a piston is compiled, PistonCore's `resolve_entities()` pass (COMPILER_SPEC.md) validates every entity_id on every node against the current HA entity registry. If any entity_id is not present in the registry:

- Compile fails with a `MISSING_ENTITY` error
- Error message names the missing entity_id and the role label of the node it belongs to
- The piston cannot be deployed until the error is resolved
- The last successfully deployed version remains active in HA unchanged

### Between Deploys — Scheduled Validation

The startup sequence (Section 9.1 Step 5) and scheduled background check (Section 9.2) run entity validation against all deployed pistons every 30 minutes. If an entity_id disappears from HA after a piston was deployed:

- Piston flagged as `entity_missing: true` in the piston index
- ⚠ shown on piston list
- Status page shows which entity is missing by its role label

This is informational only — the piston keeps running in HA. The user must fix in the editor and redeploy.

### Unavailable ≠ Missing

A device that is offline, dead battery, or temporarily unavailable is NOT missing. It still exists in the HA entity registry. The missing entity flag only fires when the entity_id is completely absent from the registry (renamed, deleted, integration removed).

### Fix Flow

1. ⚠ on piston list — user opens the piston in the editor
2. Node with missing entity shows inline warning: *"No device mapped — edit to assign"*
3. User clicks the node — wizard opens pre-filled with the current role label
4. User picks replacement device(s) from live HA picker
5. New entity_ids written to node on commit
6. Save and redeploy

### Last Known Friendly Name

The `entity_state_cache` SQLite table stores the last known friendly name for every entity_id referenced in any deployed piston. Missing entity notifications use this data so the user sees *"Front Door contact sensor is missing"* rather than *"binary_sensor.front_door_contact is missing"*.

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
* Writing to any file that does not contain its own signature header (except the one-time configuration.yaml include-line append below)
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

### Known HA Limitation — Folder Approach vs the HA UI Automation Editor

PistonCore loads its automations via `!include_dir_merge_list` pointed at its own
folder. This is deliberate — it keeps each piston in its own file instead of HA's
default single run-on `automations.yaml`. But it collides with how HA's built-in
UI automation editor works, and this is an HA limitation, not a PistonCore choice:

* HA's UI automation editor assumes **one** `automations.yaml` as its save target.
  Once any `!include_dir_merge_list` automation folder is in play, the UI editor
  no longer has an unambiguous place to write — automations created in the UI land
  in a fresh `automations.yaml` and do not appear alongside folder-loaded automations.
* Multiple automation sources *can* coexist at runtime, but only with **labeled
  keys** (`automation ui: !include automations.yaml` plus
  `automation pistoncore: !include_dir_merge_list ...`). Even labeled, the UI editor
  still only manages its own single file — it does not see or edit the PistonCore folder.
* **Switching modes is not cleanly reversible.** HA caches the source of each
  automation when first loaded. Moving to a merge-list folder and later reverting can
  leave automations stuck showing "cannot be edited from the UI," and the usual cache
  clears do not always fix it. Anyone testing PistonCore on a config that also uses the
  HA UI editor should expect this and test on a config they can roll back.

The practical consequence: a user who runs PistonCore's folder-based automations and
also wants to keep using HA's UI automation editor cannot have both behave cleanly at
once. PistonCore's model is the separated-folder approach; the run-on UI-managed
`automations.yaml` is the thing it steps away from. This trade-off belongs in user
documentation so users choose with open eyes.

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

**The frontend must never call HA directly.** Any frontend code that fetches from HA directly is a bug:
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

**PyScript (complex pistons):**
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

A single `BASE_URL` constant in the frontend. **Every connection must use it:**

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

See Section 6.10 (Snapshot format rules and placeholder definitions) and Section 6.11 (import flow) for the full spec. FRONTEND_SPEC.md owns the screen layouts and button specs.

### Snapshot (green label)

Anonymized export. Entity IDs replaced with domain placeholders (`__placeholder_<domain>__`). `role_tokens` preserved. `compiled_value` stripped. Device-type variable `initial_value` replaced with `["__fill_devices__"]`. Logic, structure, roles, and all other data preserved. Safe to post publicly. New piston ID generated on import. Import wizard guides the user through three mapping steps: fill piston variables, match globals, map direct device nodes.

### Backup (red label)

Full export — no changes to any field. Labeled clearly: *"For your own restore only — do not share."* Original piston ID preserved on import (or user can choose to import as new copy).

### Import Methods

* Paste JSON directly
* Paste a URL pointing to any raw JSON file
* Upload a `.piston` file
* AI-generated JSON pasted from any AI assistant (AI generates Snapshot format — placeholders in entity_ids, `["__fill_devices__"]` in device variables)

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
  device-definitions/         custom device definitions
  config.json                 PistonCore settings (ha_url, ha_token, deployment_type,
                              entity_check_interval_minutes, alarm_panel, tts_engine)
  pending_cleanup.json        queued orphan cleanup operations
  clipboard.json              persistent statement clipboard — one slot, survives
                              browser sessions and restarts
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

**Built-in library pistons** are stored inside the container image — not on the userdata volume. They are read-only and ship with the container. Location is a backend implementation detail. They are served via `GET /api/library`. When a user imports a library piston it is copied into `/pistoncore-userdata/pistons/` with a fresh UUID and goes through the standard Snapshot import flow (role mapping, variable fill, global match).

Default file behavior: container ships with defaults, copies them to volume on first launch only if files do not already exist. Container updates never overwrite user files.

### Addon File Paths

When running as an addon, PistonCore writes compiled output to:
* `/config/automations/pistoncore/pistoncore_{uuid}.yaml`
* `/config/scripts/pistoncore/pistoncore_{uuid}.yaml`
* `/config/pyscript/pistoncore/pistoncore_{uuid}.py` (if PyScript is installed)

## 28. V1 Core Feature Set

**Statement types:**
If Block, With/Do block, Only When restrictions, Wait (fixed duration or until time), Wait for state with timeout, Set variable, Repeat loop, For Each loop, While loop, Switch, Do Block, On Event (PyScript only), For Loop, Break (PyScript only), Cancel All Pending Tasks (PyScript only), Log message, Call another piston, Control another piston / HA automation, Stop

**Editor features:**
Structured document editor, inline ghost text insertion, WebCoRE-matching keywords, execute/end execute rendering wrapper, define/end define block for piston variables, drag and drop block reordering (within block only), Global Variables drawer, Simple/Advanced mode toggle (default Advanced), PyScript-required notification in editor (compile target shown on debug page), complexity indicator for PyScript requirement, per-statement cog (TEP/TCP/Execution Method), Snapshot and Backup export, duplicate piston, import from JSON/URL/file, status page with Test Compile button, save returns to status page, run log with plain English detail, log level per piston, log message action, trace mode via WebSocket, test required before trace, test always labeled Live Fire ⚠ with confirmation dialog, pause/resume, versioned Jinja2 compiler templates (user-replaceable), capability-organized device picker with search, unknown device fallback define screen, full operator set (see EDITOR_WIZARD_SPEC.md), copy AI prompt button, automatic validation on save, pre-deploy validation pipeline (yamllint + py_compile + HA reload validation), file signature and hash system, failure notification toggle, My Device Definitions screen, BASE_URL frontend standard, PyScript detection with setup prompt, background compile with status indicator

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
* PistonCore-native runtime engine (possible future only — see §3.1 footnote; not on the build path)

---

## 30. Independence Guarantee

"Independent" means independent **of PistonCore** — compiled pistons keep running after PistonCore is removed. It does **not** mean they run forever. Each output is at the mercy of its runtime: native YAML lasts until HA schema drift breaks it; PyScript lasts until PyScript itself breaks or loses support. PistonCore removes its own dependency from the equation — it cannot insulate the outputs from the platforms underneath them.

### Native HA Script pistons
* Keep running after PistonCore is removed ✅
* Not affected by PyScript removal ✅
* At risk from HA schema/version drift over time ⚠
* Require HA 2023.1 or later ⚠

### PyScript pistons
* Keep running after PistonCore is removed ✅ (as long as PyScript stays installed)
* Stop if PyScript is removed ❌
* At risk if PyScript breaks or loses support ⚠

### Global variables (helper-backed)
* Still readable by compiled pistons after PistonCore is removed ✅
* Helper values persist in HA after removal ✅
* Helper management stops after removal ⚠ (values stay, management UI gone)

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
- The complete Snapshot JSON format (Section 6.10 of this document)
- The full list of valid statement types and their JSON schemas
- The condition object schema including display_value/compiled_value split
- The operator reference (from EDITOR_WIZARD_SPEC.md)
- Role placeholder rules — role labels on nodes with empty entity_ids arrays
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

### COMPILER_SPEC.md — Frozen Pending JSON Stabilization

COMPILER_SPEC.md is **intentionally not kept in sync** while the piston JSON format stabilizes. Keeping the compiler spec aligned with every JSON change produced false confidence and wasted effort. The decision: let the JSON format settle, then do one authoritative compiler-spec rewrite.

**Treat COMPILER_SPEC.md as directionally correct but not authoritative.** The current truth for field shapes and schemas is **PISTON_JSON_STRUCTURE_MAP.md**. Compiler work proceeds against that document.

---

## 32. Intentionally Frozen — Not Yet Ready to Start

1. **AI Prompt feature** — AI_PROMPT_SPEC.md is intentionally frozen/stale (written against the old device_map model). Rewrite for logic_version 2 only after the JSON format is final. `write-a-piston.md` and `migrate-from-webcore.md` cannot be written until that rewrite. Do not update piecemeal.
2. **COMPILER_SPEC.md — intentionally frozen.** Directionally correct, not authoritative during JSON stabilization. Rewrite once the piston JSON format is final.

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

Per-session build history is **not** kept here — it tracked code that has since been retired and only added noise. Project status and progress belong in the README, not in this document. Architectural decisions are stated in-place throughout as present-tense rules, not as a dated changelog.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
