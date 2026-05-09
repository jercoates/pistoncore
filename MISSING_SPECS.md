# PistonCore — Missing Specs Tracker

**Status:** Living document — add to this when a gap is found, remove when the spec is written
**Last Updated:** Session 28
**Purpose:** Track spec gaps that will block coding when we reach those features.
           Every item here must be resolved before its dependent task is started.

---

## How to Use This File

When a feature is coming up in TASKS.md and its spec is listed here as missing,
write the spec first — dedicate a session to it if needed. Do not code against
a missing or incomplete spec.

When a spec is written, move the item from this file to DONE at the bottom.

---

## 1. PyScript Compiler Spec — RESOLVED (Session 24)

PYSCRIPT_COMPILER_SPEC.md written and complete. All 6 gaps resolved.
Status changed to READY TO CODE.
See PYSCRIPT_COMPILER_SPEC.md for full spec.

---

## 2. WebSocket Message Protocol — MISSING

**Blocks:** S1-4 /ws endpoint implementation, S4-9 run status reporting
**Needs to be written before:** /ws endpoint is built
**What it must cover:**
- Connection handshake — what does the server send on connect?
- PISTONCORE_LOG event — exact JSON shape, all fields
- PISTONCORE_RUN_COMPLETE event — exact JSON shape, all fields
- HA WebSocket reconnect events — what does PistonCore forward to the frontend?
- Error events — what shape, what triggers them
- Keep-alive / ping-pong behavior
- What happens when HA WebSocket drops — what does the frontend receive?
- Frontend reconnection behavior — does it reconnect automatically?
- Message size limits / throttling for high-frequency trace output

**Reference:** DESIGN.md Section 21 defines what events exist but not their shape.
FRONTEND_SPEC.md references PISTONCORE_LOG and PISTONCORE_RUN_COMPLETE
but does not define the message format.

---

## 3. Settings Page Frontend Spec — MISSING

**Blocks:** Settings page implementation
**Needs to be written before:** Settings page is built
**What it must cover:**
- Page layout and navigation (accessible from where? Back button goes where?)
- HA Connection section:
  - Docker: HA URL field, long-lived token field, Test Connection button
  - Addon: token is automatic — show connection status only, no entry fields
  - HA version detected — display here
  - WebSocket connection status indicator
- PistonCore section:
  - Deployment type display (Docker / Addon)
  - PistonCore version display
- My Device Definitions section:
  - List of custom device definitions
  - Edit / Delete per definition
  - Link to the define-device flow (same as unknown device fallback)
- Global Variables section:
  - List all globals with type and current value
  - Create new global (name, type, default value)
  - Edit existing global (display name only — internal name never changes)
  - Delete global (warn if referenced by any piston)
- Error state: HA disconnected — what does each section show?
- Token storage guidance text (Docker only)
- Token rotation instructions (Docker only)

**Reference:** DESIGN.md Sections 4, 7.1, 8. FRONTEND_SPEC.md Open Items #6.

---

## 4. Piston List — Folder Management Flow — MISSING

**Blocks:** Folder management implementation
**Needs to be written before:** Folder create/rename/delete is built
**What it must cover:**
- Create folder: inline text input behavior, validation (no duplicates, no empty names)
- Rename folder: how is it triggered? Inline edit? Right-click?
- Delete folder: what happens to pistons inside? Move to Uncategorized automatically?
- Move piston to folder: drag and drop? Dropdown on piston row? Both?
- Folder sort order: alphabetical, always. Uncategorized always last.
- Empty folder behavior: show or hide empty folders?
- Folder state persistence: are folders collapsed/expanded state saved?

**Reference:** FRONTEND_SPEC.md has layout mockup and mentions [+ New Folder]
button but does not define any of the above flows.

---

## 5. Error States Inventory — MISSING

**Blocks:** Robust UI implementation
**Needs to be written before:** UI work enters Stage 4
**What it must cover (exhaustive list of error states):**

*Connection errors:*
- HA completely unreachable on startup
- HA WebSocket drops while on piston list
- HA WebSocket drops while in editor
- HA WebSocket drops while wizard is open
- HA WebSocket drops during deploy
- Token invalid or expired (Docker)
- HA version below minimum (2023.1)

*Save/deploy errors:*
- Volume write failure (disk full, permissions)
- Compile error (invalid piston structure)
- yamllint failure on compiled output
- HA reload failure after successful file write
- File hash mismatch on deploy (manual edit detected)
- PyScript not installed when complex piston deploy attempted

*Piston list errors:*
- Piston file corrupt or unreadable
- Missing device (single) — ⚠ state
- Missing device (multi, partial) — degraded state
- Piston with future logic_version or ui_version

*Import errors:*
- Invalid JSON pasted
- Valid JSON but wrong format (not a piston)
- logic_version or ui_version from the future
- URL fetch failed
- URL returns non-JSON content

*For each error state, the spec must define:*
- What the user sees (exact text where possible)
- What actions are available (retry, cancel, ignore)
- Whether it blocks the current action or is informational only
- Whether the last good state is preserved

**Reference:** DESIGN.md Section 18 covers deploy pipeline errors.
FRONTEND_SPEC.md covers WebSocket drop in editor. Neither is exhaustive.

---

## 6. Test Strategy — MISSING

**Blocks:** Confidence that v1 actually works before release
**Needs to be written before:** v1 ships
**What it must cover:**
- What is manually tested vs automated
- For each statement type: what input JSON produces what HA YAML output
  (the hand-verification examples in COMPILER_SPEC.md Section 18 are the model —
  need one per statement type)
- Round-trip test cases: specific pistons that exercise each part of the stack
- HA version matrix: which HA versions are tested before release
- Known edge cases that must be manually verified (from HA_LIMITATIONS.md)
- What "done" looks like for each Stage in TASKS.md

**Reference:** COMPILER_SPEC.md Section 18 has one hand-written example.
That pattern should be repeated for every statement type.

---

## 7. Storage Architecture — MISSING

**Blocks:** Run logging, device change tracking, compile index, any feature that
reads or writes data beyond the current JSON files
**Needs to be written before:** S4-9 run status reporting, S4-2 missing device handler,
any logging code
**What it must cover:**

### What Already Has a Defined Home (do not relitigate)
- Piston JSON files → `/pistoncore-userdata/pistons/{uuid}.json`
- Global variables list → `/pistoncore-userdata/globals.json`
- Global variables index → `/pistoncore-userdata/globals_index.json`
- Custom device definitions → `/pistoncore-userdata/device-definitions/`
- PistonCore config → `/pistoncore-userdata/config.json`
- Pending cleanup queue → `/pistoncore-userdata/pending_cleanup.json`
- All customize volume files → `/pistoncore-customize/`

### What Needs a Defined Home (gaps to resolve)

**SQLite database — recommended for all record-style data**
File: `/pistoncore-userdata/pistoncore.db`
Reason: JSON files are right for documents (pistons, config, globals — written
infrequently, read as a whole). SQLite is right for records (logs, cache, indexes —
written constantly, queried by field, need trimming/pagination). Python has SQLite
built in — no new dependency.

Tables to define:

`run_log` — one row per piston run
- piston_id, run_id (UUID), timestamp, trigger_source, status (success/error/unknown),
  duration_ms, compile_target

`run_events` — one row per log line within a run
- run_id, sequence_number, timestamp, event_type (trigger/condition/action/log/error),
  statement_id, message

`device_state_cache` — last known state of every entity in any piston's device_map
- entity_id, friendly_name, last_seen (timestamp), last_known_state
- Used by missing device handler to show "last known name" when entity disappears
- Updated on every HA connect and on every state_changed event for tracked entities
- This resolves the device change tracking gap (see item 8 below)

`compile_index` — one row per piston, updated on every successful compile
- piston_id, compiled_at, compile_target, file_hash, logic_version, ui_version
- Allows stale piston detection without reading every piston JSON file
- Replaces the need to scan compiled file headers for hash comparison

**What must be defined in the spec:**
- Full schema for each table (column names, types, indexes)
- Retention policy for run_log and run_events (how many runs kept per piston?)
- Migration strategy if schema changes in a future version
- Whether SQLite is created on first launch or seeded from a template
- How the backend accesses the DB (direct sqlite3? SQLAlchemy? raw queries?)
- What happens if the DB file is corrupt on startup

**Reference:** DESIGN.md Section 21 (logging), Section 15.6 (missing device),
Section 13 (file hash). Volume structure in DESIGN.md Section 26.

---

## 8. Device Change Tracking Data Shape — MISSING

**Blocks:** S4-2 missing device handler implementation
**Needs to be written before:** Missing device handler is coded
**What it must cover:**
- Exact fields stored per entity in device_state_cache (see item 7 above —
  this is resolved by the SQLite device_state_cache table)
- What triggers a cache update:
  - On every HA connect (full refresh of all tracked entities)
  - On state_changed WebSocket event for any tracked entity
  - On successful piston save (new entities added to device_map get added to cache)
- What the comparison logic looks like on HA connect:
  - For each entity_id in all piston device_maps, check if it exists in HA entity list
  - If missing: check device_map_meta cardinality → hard flag (single) or degrade (multi)
  - Use friendly_name from device_state_cache for the warning message
- What "exists in HA" means: entity_id present in the entity registry, regardless of
  whether it is currently available or unavailable
- How the cache handles entity renames (old entity_id disappears, new one appears —
  PistonCore cannot automatically detect this is the same physical device)

**Reference:** DESIGN.md Section 15.6. MISSING_SPECS.md item 7 (SQLite schema).
HA_LIMITATIONS.md Section 3 (entity ID changes).

---

## 9. PyScript-Forcing Patterns — RESOLVED (Session 24)

All seven patterns documented in PYSCRIPT_COMPILER_SPEC.md Section 1.1:
- Original three: `break`, `on_event`, `cancel_pending_tasks`
- Added: `repeat_until_state`, `current_event_device`, `dynamic_attribute_access`, `loop_string_accumulation`

Detection note added: the last three require content analysis, not just type checking.
Detection logic must be written before compile target detection is coded.

---

## 10. Global Variables — Maintenance Strategy (Not Just Reuse)

**Blocks:** Global variable UI priority, sample piston design
**Context:** Real-world usage (60 pistons on Hubitat) shows globals are primarily
a **maintenance strategy**, not a convenience feature. When a new device is added
to a group, updating one global updates all pistons that reference it on next deploy.
This is how serious users manage scale.

**What this means for the specs:**

**Global management UI moves up in priority.** It is not a power-user feature —
it is a core workflow for anyone with a real installation. Must be easy to use,
not buried in settings.

**Standard global naming convention for sample pistons.** The preloaded piston
library should be built around a standard set of global names so that setting
up globals once covers all related sample pistons:

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

**The onboarding story this enables:**
User creates their globals, maps their devices once. Imports any sample piston.
Because the sample pistons reference the same global names, no re-mapping needed
for devices already in globals. One setup step covers all related pistons.

**What needs to be specced:**
- Global variable creation flow in the UI — must be fast and easy
- How sample pistons reference globals (role names that match global names)
- What happens when a global doesn't exist yet at import time — prompt to create it
- Global name validation — must match the @ prefix convention

---

## 11. Sample Piston Library — MISSING

**Blocks:** Community value, onboarding story, compiler test suite
**Needs to be written before:** v1 ships
**Context:** Four real production pistons reviewed in Session 23 are strong candidates
for a preloaded/community sample library. They are universally useful, exercise
almost every compiler pattern, and together form a complete test suite.

### Candidate Sample Pistons (from real production use)

**1. Low Battery Check**
- Checks all battery devices daily, builds status report, sends notification
- Patterns: for_each, dynamic attribute access, string accumulation, global device group
- Compile target: PyScript
- Globals needed: `@Battery_Devices`, `@Notifications_Push`

**2. Door / Window Chime**
- Announces which door/window opened, different volume by time of day and day of week
- Patterns: $currentEventDevice, multi-role OR trigger, day-of-week time condition, SSML
- Compile target: PyScript (due to $currentEventDevice)
- Globals needed: `@Announcement_Sonos`

**3. Carbon Monoxide / Smoke Alert**
- Detects CO, loops alerting every 30 seconds until all clear, lights + speakers + push
- Patterns: repeat/until live state, for_each with dynamic attribute, nested loops, global device group
- Compile target: PyScript
- Globals needed: `@Smoke_Detectors`, `@Speakers_All`, `@Notifications_Push`, `@Alert_Lights`

**4. Water Leak Detection and Shutoff**
- Multiple triggers: away+leak→shutoff, any leak→alert loop, always-on sensors→shutoff
- Patterns: repeat/until live state, presence condition, multiple triggers, valve control
- Compile target: PyScript
- Globals needed: `@Water_Sensors_All`, `@Water_Sensors_Away`, `@Water_Sensors_Always`,
  `@Presence_Sensors`, `@Shut_off_Valve`, `@Speakers_All`, `@Notifications_Push`

### What SAMPLE_PISTONS.md Must Cover
- Full Snapshot JSON for each sample piston
- What globals each piston expects (name and type)
- Setup instructions: create these globals first, then import
- What devices each role expects (single vs multi, what domain/capability)
- Known limitations or HA version requirements per piston
- Where to find the sample pistons (shipped with PistonCore? GitHub repo? Both?)

### Why These Pistons Are Also the Compiler Test Suite
All four together exercise:
- Every PyScript-forcing pattern
- Multi-device role expansion
- Global variable resolution at compile time
- for_each with dynamic attribute access
- repeat/until with live state
- Multiple triggers in one piston
- Day-of-week time conditions
- String accumulation across loop iterations

If all four compile correctly and deploy to real HA, the compiler is solid for v1.

---

## 12. Best Practices Documentation — MISSING

**Blocks:** Nothing directly — but new users will waste hours without this
**Needs to be written before:** v1 ships
**Context:** Three patterns that experienced WebCoRE users know intuitively
but new users discover slowly and painfully. Documenting them saves hours.

### Pattern 1 — Globals for Cross-Piston Device Management
Use global device variables for any device or group that appears in more
than one piston. When you add a new water sensor, update `@Water_Sensors_All`
and redeploy — every piston that references that global picks up the change.
Without globals, you hunt through every piston individually.

### Pattern 2 — Define Block for Single-Piston Device References
Even for devices used only in one piston, define them in the define block
at the top using a device variable, then reference the role name throughout
the logic. Keeps all device references in one place. When a device changes,
update the define block — not every condition and action that references it.

### Pattern 3 — Role Names Beat Hardcoded Devices in Logic
Conditions and actions should reference role names like `{Doors}` not
hardcoded entity lists buried in the if/then logic. Readable, maintainable,
and works correctly with the device picker and missing device handler.

### Where This Documentation Lives
- In-app: ghost text or tooltip in the define block explaining why roles exist
- In-app: tooltip on globals explaining the cross-piston maintenance benefit  
- Docs: BEST_PRACTICES.md in the repo
- Docs: Onboarding section in the README

**Reference:** SAMPLE_PISTONS.md (role naming), DESIGN.md Sections 7, 8.

---

## 13. Fat Compiler Context Assembly — RESOLVED (Session 32)
See context_builder.py. Spec written and implemented this session.
Moved to DONE section below.

---

## 14. Time Condition Compiler Path — MISSING

**Blocks:** Any piston using time-of-day conditions (extremely common — chicken-lights
piston uses this)
**Needs to be written before:** S1-7 session 2 (condition compiler rewrite — Bug 8)
**What it must cover:**
- `Time is between X and Y` as a **condition** (not a trigger) — how does this compile?
- `Time is X` as a condition
- `$now` operand handling in time conditions
- `$sunrise` / `$sunset` with offsets in time conditions
- Day-of-week conditions (coordinate with S4-12 — do not duplicate)

**Reference:** COMPILER_SPEC.md Section 11 (no time-subject condition path exists).
STATEMENT_TYPES.md Condition Object Schema (time condition JSON is defined there).
PISTON_FORMAT.md Condition Field Reference (time condition example).

---

## 15. write-a-piston.md Prompt Content — MISSING

**Blocks:** S4-10 (Snapshot import via AI prompt)
**Needs to be written before:** S4-10 starts
**Status:** File exists in repo but content is a stub marked "being rewritten."
**What it must cover:** See AI_PROMPT_SPEC.md for the full requirements.
**Note:** Do not start S4-10 until this is complete and reviewed against
AI_PROMPT_SPEC.md.

---

## 16. PyScript Compiler Template Design — MISSING

**Blocks:** S1-7 session 2 (PyScript compiler coding)
**Needs to be written before:** Any PyScript compiler code is written
**Context:** The native YAML compiler uses Jinja2 templates stored in the customize
volume so HA YAML syntax changes only require template edits, not compiler code
changes. PyScript also has occasional API changes — decorator names, `task.unique()`
syntax, `service.call()` signature, `state_trigger` argument format have all changed
across PyScript versions. The PyScript compiler spec (PYSCRIPT_COMPILER_SPEC.md)
was written assuming pure Python string generation throughout. This decision was
never explicitly made or compared against the template approach.
**What it must cover:**
- Explicit decision: Jinja2 templates for boilerplate vs pure string generation
- If templates: which specific patterns get templates and which stay as strings
  (recommended split: templates for structural boilerplate that changes with
  PyScript versions; pure string generation for body logic where indentation
  is semantic)
- Proposed template list:
  - `pyscript_state_trigger.j2` — `@state_trigger(...)` decorator block
  - `pyscript_time_trigger.j2` — `@time_trigger(...)` decorator block
  - `pyscript_task_unique.j2` — `task.unique(...)` mode enforcement block
  - `pyscript_service_call.j2` — `service.call(...)` pattern
  - `pyscript_completion_event.j2` — `event.fire("PISTONCORE_RUN_COMPLETE", ...)`
- Template location in customize volume: same pattern as native YAML templates
- How body logic (if/while/for/set_variable) is generated — pure Python strings,
  not templates, because indentation is load-bearing
**Where this spec lives:** New Section 4.1 in PYSCRIPT_COMPILER_SPEC.md
**Reference:** PYSCRIPT_COMPILER_SPEC.md Section 4, COMPILER_SPEC.md Section 3
(customize volume template approach for native YAML)

---

## DONE

### Item 1 — PyScript Compiler Spec (Session 24)
PYSCRIPT_COMPILER_SPEC.md written. All 6 gaps resolved. Status: READY TO CODE.

### Item 9 — PyScript-Forcing Patterns (Session 24)
All seven patterns documented in PYSCRIPT_COMPILER_SPEC.md Section 1.1.
Detection note added for content-analysis patterns.

### Item 13 — Fat Compiler Context Assembly (Session 32)
context_builder.py created. build_compiler_context(piston) implemented.
ha_client.py: get_all_states(), get_services_for_domains(), get_areas(),
get_ha_version() added. api.py _compile() stub replaced with real context.
_get_app_version() removed (dead code after _compile() rewrite).

---

*Add to this file whenever a coding task is blocked by a missing spec.
The goal is to never be surprised mid-session by a gap that could have been
caught earlier.*
