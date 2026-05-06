# PistonCore — Missing Specs Tracker

**Status:** Living document — add to this when a gap is found, remove when the spec is written
**Last Updated:** Session 23
**Purpose:** Track spec gaps that will block coding when we reach those features.
           Every item here must be resolved before its dependent task is started.

---

## How to Use This File

When a feature is coming up in TASKS.md and its spec is listed here as missing,
write the spec first — dedicate a session to it if needed. Do not code against
a missing or incomplete spec.

When a spec is written, move the item from this file to DONE at the bottom.

---

## 1. PyScript Compiler Spec — MISSING

**Blocks:** Any complex piston deploying (break, cancel_pending_tasks, on_event)
**Needs to be written before:** S4-4 compiler template system, any complex piston testing
**What it must cover:**
- PyScript file structure and imports
- How each statement type compiles to Python (if/while/for/repeat/break/on_event/cancel)
- How device_map entity IDs are injected into PyScript
- How global variables are referenced in PyScript (input helper entity IDs)
- How piston variables compile to Python local variables
- How service calls are made from PyScript (hass.services.call)
- How triggers work in PyScript (@state_trigger, @time_trigger, @event_trigger)
- How PISTONCORE_RUN_COMPLETE event is fired from PyScript
- How the pc_globals_used comment header is generated
- Error handling pattern inside PyScript output
- The same file signature header format as native YAML

**Reference:** COMPILER_SPEC.md Section 19 explicitly flags this as "not yet designed."
DESIGN.md Section 3.1 covers when PyScript is used and the permanent PyScript
target for Docker.

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

## DONE — Specs Written

*(None yet — this tracker was created Session 23)*

---

*Add to this file whenever a coding task is blocked by a missing spec.
The goal is to never be surprised mid-session by a gap that could have been
caught earlier.*
